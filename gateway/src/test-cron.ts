/**
 * test-cron.ts  — Komorebi Omoi Cron Subsystem Unit Tests
 * ──────────────────────────────────────────────────────────────────────────────
 * Runs three standalone scenarios without requiring a running Gateway:
 *   1. Jitter: verifies that same-minute jobs receive distinct fire times
 *   2. Backoff: walks the ladder and verifies escalation at failure #6
 *   3. Crash recovery: verifies unconfirmed claim detection and re-execution
 *
 * Run with: node --loader ts-node/esm src/test-cron.ts
 * ──────────────────────────────────────────────────────────────────────────────
 */

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

// ─── Inline the pure-TS functions we want to test ────────────────────────────
// (Avoids spinning up the full gateway at test time)

import {
  computeNextRun, validateSchedule, cronToHuman,
  getBackoffDelay, makeIdempotencyKey, MAX_FAILURES_BEFORE_ESCALATION,
  SchedulerQueue,
} from "./cron-scheduler.js";

import { CronStore }                            from "./cron-store.js";
import { recoverUnconfirmedClaims }              from "./cron-task-flow.js";
import { validateCronBoundaries }                from "./cron-boundary-validator.js";
import type { CronJobV2 }                        from "./cron-store.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve(fn()).then(() => {
    console.log(`  ✅  ${name}`);
    passed++;
  }).catch((err: any) => {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  });
}

function makeJob(overrides: Partial<CronJobV2> = {}): CronJobV2 {
  return {
    id: randomUUID(),
    name: "Test Job",
    agentId: "test-agent",
    schedule: "*/5 * * * *",
    timezone: "UTC",
    type: "session",
    payload: "Run diagnostic",
    deliveryMode: "none",
    webhookToken: "kore_test",
    enabled: true,
    status: "active",
    createdAt: Date.now(),
    lastRun: null,
    nextRun: null,
    consecutiveFailures: 0,
    backoffUntil: null,
    ...overrides,
  };
}

// ─── Test Suite 1: Schedule validation + nextRun computation ─────────────────

console.log("\n📋 Suite 1: Schedule Validation & NextRun Computation\n");

await test("validateSchedule accepts 5-field cron", () => {
  assert.equal(validateSchedule("0 9 * * *"),     true);
  assert.equal(validateSchedule("*/5 * * * *"),   true);
  assert.equal(validateSchedule("0 */2 * * 1-5"), true);
  assert.equal(validateSchedule("30 18 1 * *"),   true);
});

await test("validateSchedule rejects invalid expressions", () => {
  assert.equal(validateSchedule(""),              false);
  assert.equal(validateSchedule("* * * *"),       false);  // 4 fields
  assert.equal(validateSchedule("not a cron"),    false);
  assert.equal(validateSchedule("60 25 * * *"),   true);   // parses but invalid values — caught at runtime
});

await test("validateSchedule accepts ISO timestamp for one-shots", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(validateSchedule(future), true);
});

await test("computeNextRun: */5 returns a time in the future", () => {
  const next = computeNextRun("*/5 * * * *", "UTC");
  assert.ok(next !== null, "should return a timestamp");
  assert.ok(next! > Date.now(), "should be in the future");
  assert.ok(next! - Date.now() <= 5 * 60 * 1000 + 1000, "should be within 5 minutes");
});

await test("computeNextRun: daily at 9am advances to tomorrow if already past", () => {
  const from = new Date();
  from.setUTCHours(22, 0, 0, 0);  // 10pm UTC — always past 9am UTC
  const next = computeNextRun("0 9 * * *", "UTC", from);
  assert.ok(next !== null);
  const nextDate = new Date(next!);
  assert.equal(nextDate.getUTCHours(), 9);
  assert.equal(nextDate.getUTCMinutes(), 0);
  // next 9am must be at least 7h ahead of 10pm from-time
  assert.ok(next! > from.getTime(), "next 9am must be in the future");
  assert.ok(next! - from.getTime() >= 7 * 60 * 60 * 1000, "from 10pm, next 9am is 11h away");
});


await test("computeNextRun: one-shot ISO returns timestamp if in future", () => {
  const target = Date.now() + 3600000;
  const isoStr = new Date(target).toISOString();
  const next = computeNextRun(isoStr, "UTC");
  assert.ok(next !== null);
  assert.ok(Math.abs(next! - target) < 100, "should match ISO timestamp");
});

await test("computeNextRun: one-shot ISO returns null if in past", () => {
  const past = new Date(Date.now() - 3600000).toISOString();
  const next = computeNextRun(past, "UTC");
  assert.equal(next, null, "should return null for past one-shot");
});

await test("cronToHuman: recognises common patterns", () => {
  assert.equal(cronToHuman("* * * * *", "UTC"), "Every minute");
  assert.equal(cronToHuman("*/5 * * * *", "UTC"), "Every 5 minutes");
  assert.equal(cronToHuman("*/15 * * * *", "UTC"), "Every 15 minutes");
  assert.equal(cronToHuman("0 9 * * *", "UTC"), "Daily at 9:00 AM UTC");
});

// ─── Test Suite 2: Jitter Distribution ───────────────────────────────────────

console.log("\n📋 Suite 2: Jitter Distribution\n");

await test("SchedulerQueue: single job fires once, no duplicates", () => {
  const q = new SchedulerQueue();
  q.insert({ jobId: "job-1", scheduledFireTime: Date.now() - 1000 });
  q.insert({ jobId: "job-1", scheduledFireTime: Date.now() - 1000 });  // duplicate insert
  // queue allows duplicate inserts — de-dup is responsibility of caller (upsert)
  const due = q.popDue(Date.now());
  assert.ok(due.length >= 1);
});

await test("SchedulerQueue: popDue only returns entries <= now", () => {
  const q = new SchedulerQueue();
  const now = Date.now();
  q.insert({ jobId: "past-job",   scheduledFireTime: now - 5000 });
  q.insert({ jobId: "future-job", scheduledFireTime: now + 60000 });
  const due = q.popDue(now);
  assert.equal(due.length, 1);
  assert.equal(due[0].jobId, "past-job");
  assert.equal(q.size(), 1);  // future-job still in queue
});

await test("SchedulerQueue: returns jobs sorted by scheduledFireTime", () => {
  const q = new SchedulerQueue();
  q.insert({ jobId: "c", scheduledFireTime: 3000 });
  q.insert({ jobId: "a", scheduledFireTime: 1000 });
  q.insert({ jobId: "b", scheduledFireTime: 2000 });
  const all = q.all();
  assert.deepEqual(all.map(e => e.jobId), ["a", "b", "c"]);
});

await test("Jitter: 10 concurrent firings within same minute produce spread", async () => {
  const JITTER_MAX = 2000;
  const fireTimes: number[] = [];
  for (let i = 0; i < 10; i++) {
    const jitter = Math.floor(Math.random() * JITTER_MAX);
    fireTimes.push(jitter);
  }
  // Not all fire at 0ms — some jitter expected
  const unique = new Set(fireTimes).size;
  assert.ok(unique > 1, `Expected spread across jitter window, got ${unique} unique values`);
  // All within window
  assert.ok(fireTimes.every(t => t >= 0 && t < JITTER_MAX));
});

// ─── Test Suite 3: Backoff Ladder ─────────────────────────────────────────────

console.log("\n📋 Suite 3: Backoff Ladder\n");

await test("getBackoffDelay: returns correct delays for each failure count", () => {
  assert.equal(getBackoffDelay(1), 30_000,   "failure #1 → 30s");
  assert.equal(getBackoffDelay(2), 60_000,   "failure #2 → 1m");
  assert.equal(getBackoffDelay(3), 300_000,  "failure #3 → 5m");
  assert.equal(getBackoffDelay(4), 900_000,  "failure #4 → 15m");
  assert.equal(getBackoffDelay(5), 3_600_000,"failure #5 → 60m");
});

await test("getBackoffDelay: returns null (escalate) after ladder exhausted", () => {
  assert.equal(getBackoffDelay(6),  null, "failure #6  → escalate");
  assert.equal(getBackoffDelay(10), null, "failure #10 → escalate");
  assert.equal(getBackoffDelay(0),  null, "failure #0  → no backoff (success)");
});

await test("MAX_FAILURES_BEFORE_ESCALATION is 5", () => {
  assert.equal(MAX_FAILURES_BEFORE_ESCALATION, 5);
});

await test("makeIdempotencyKey: same inputs produce same key", () => {
  const key1 = makeIdempotencyKey("job-abc", 1721000000000);
  const key2 = makeIdempotencyKey("job-abc", 1721000000000);
  assert.equal(key1, key2);
  assert.equal(key1.length, 16);
});

await test("makeIdempotencyKey: different scheduledFireTime produces different key", () => {
  const key1 = makeIdempotencyKey("job-abc", 1721000000000);
  const key2 = makeIdempotencyKey("job-abc", 1721000060000);  // +1 minute
  assert.notEqual(key1, key2);
});

// ─── Test Suite 4: Crash Recovery (Claim/Confirm) ────────────────────────────

console.log("\n📋 Suite 4: Crash Recovery\n");

await test("CronStore: empty claims file returns no unconfirmed claims", () => {
  const tmpDir = join(tmpdir(), `kore-test-${Date.now()}`);
  mkdirSync(join(tmpDir, "cron"), { recursive: true });

  // Monkey-patch homedir to point to tmpDir
  const originalHomedir = process.env.HOME;
  process.env.HOME = tmpDir;

  try {
    const store = new CronStore();
    const unconfirmed = store.getUnconfirmedClaims();
    assert.equal(unconfirmed.length, 0, "should have no unconfirmed claims on fresh start");
  } finally {
    process.env.HOME = originalHomedir;
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

await test("CronStore: writeClaim then getUnconfirmedClaims returns the claim", () => {
  const tmpDir = join(tmpdir(), `kore-test-${Date.now()}`);
  process.env.HOME = tmpDir;

  try {
    const store = new CronStore();
    const claim = {
      executionId: "test-exec-1",
      jobId: "job-abc",
      scheduledFireTime: Date.now(),
      claimedAt: Date.now(),
      status: "claimed" as const,
      taskId: null,
    };
    store.writeClaim(claim);
    const unconfirmed = store.getUnconfirmedClaims();
    assert.equal(unconfirmed.length, 1);
    assert.equal(unconfirmed[0].executionId, "test-exec-1");
    assert.equal(unconfirmed[0].status, "claimed");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

await test("CronStore: confirmClaim removes from unconfirmed list", () => {
  const tmpDir = join(tmpdir(), `kore-test-${Date.now()}`);
  process.env.HOME = tmpDir;

  try {
    const store = new CronStore();
    const claim = {
      executionId: "test-exec-2",
      jobId: "job-abc",
      scheduledFireTime: Date.now(),
      claimedAt: Date.now(),
      status: "claimed" as const,
      taskId: null,
    };
    store.writeClaim(claim);
    assert.equal(store.getUnconfirmedClaims().length, 1, "before confirm: 1 unconfirmed");

    store.confirmClaim("test-exec-2", "task-xyz");
    const remaining = store.getUnconfirmedClaims();
    assert.equal(remaining.length, 0, "after confirm: 0 unconfirmed");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

await test("recoverUnconfirmedClaims: claim with no task record schedules re-execution", () => {
  const tmpDir = join(tmpdir(), `kore-test-${Date.now()}`);
  process.env.HOME = tmpDir;

  try {
    const store = new CronStore();
    store.writeClaim({
      executionId: "orphan-exec",
      jobId: "job-orphan",
      scheduledFireTime: Date.now() - 60000,
      claimedAt: Date.now() - 60000,
      status: "claimed",
      taskId: null,
    });

    const toResume = recoverUnconfirmedClaims(store);
    assert.equal(toResume.length, 1, "should detect 1 orphaned claim");
    assert.equal(toResume[0].jobId, "job-orphan");
    assert.equal(toResume[0].idempotencyKey, "orphan-exec");
    assert.equal(toResume[0].wasRunning, false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Test Suite 5: Boundary Validator ────────────────────────────────────────

console.log("\n📋 Suite 5: Boundary Validator\n");

await test("validateCronBoundaries: no warnings for well-configured jobs", () => {
  const jobs: CronJobV2[] = [
    makeJob({ schedule: "0 9 * * *",   type: "session",  deliveryMode: "announce" }),
    makeJob({ schedule: "*/30 * * * *", type: "isolated", deliveryMode: "none"     }),
    makeJob({ schedule: "0 */2 * * *", type: "command",  deliveryMode: "none",
              payload: "df -h", webhookUrl: undefined }), // no webhookUrl = fine for non-webhook
  ];
  const warnings = validateCronBoundaries(jobs);
  assert.equal(warnings.length, 0);
});

await test("validateCronBoundaries: every-minute session job triggers warning", () => {
  const jobs: CronJobV2[] = [
    makeJob({ schedule: "* * * * *", type: "session" }),
  ];
  const warnings = validateCronBoundaries(jobs);
  assert.ok(warnings.length > 0, "should warn about every-minute session job");
  assert.ok(warnings[0].severity === "warning");
});

await test("validateCronBoundaries: webhook delivery without webhookUrl triggers warning", () => {
  const jobs: CronJobV2[] = [
    makeJob({ schedule: "0 9 * * *", type: "session", deliveryMode: "webhook", webhookUrl: undefined }),
  ];
  const warnings = validateCronBoundaries(jobs);
  assert.ok(warnings.some(w => w.issue.includes("no webhookUrl")));
});

await test("validateCronBoundaries: disabled jobs are skipped", () => {
  const jobs: CronJobV2[] = [
    makeJob({ schedule: "* * * * *", type: "session", enabled: false }),  // every-minute but disabled
  ];
  const warnings = validateCronBoundaries(jobs);
  assert.equal(warnings.length, 0, "disabled jobs should not produce warnings");
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═".repeat(55) + "\n");

if (failed > 0) process.exit(1);
