/**
 * cron-scheduler.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Time-bucketed, drift-resistant scheduler core for Komorebi Omoi.
 *
 * Key properties:
 *  • 2-second polling loop — one loop for all jobs, no per-job timers
 *  • Sorted in-memory priority queue keyed by nextRun (rebuilt from persisted
 *    store on startup, so crash-and-restart is fully transparent)
 *  • Jitter (0–2000ms randomised) applied to jobs sharing the same cron minute
 *    to prevent simultaneous thundering-herd hits on the Pi 5 harness
 *  • Drift measured as (actualFireTime - scheduledFireTime); rolling average
 *    alerts the Watchdog when it consistently exceeds DRIFT_ALERT_MS
 *  • Timezone-aware nextRun computed via Intl API (no extra npm dep)
 *  • One-shot ISO timestamp support alongside recurring cron expressions
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createHash } from "node:crypto";
import type { CronJobV2 } from "./cron-store.js";
import type { GatewayWatchdog } from "./watchdog.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS     = 2_000;
const JITTER_MAX_MS        = 2_000;
const DRIFT_ALERT_MS       = 5_000;   // alert if rolling avg drift > 5s
const DRIFT_ROLLING_WINDOW = 20;      // number of samples for rolling avg
const BACKOFF_SEQUENCE_MS  = [30_000, 60_000, 300_000, 900_000, 3_600_000];
const MAX_FAILURES_BEFORE_ESCALATION = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerQueueEntry {
  jobId: string;
  scheduledFireTime: number;  // ms since epoch
}

export interface FireResult {
  jobId: string;
  scheduledFireTime: number;
  idempotencyKey: string;
}

// ─── Timezone-aware cron nextRun (pure Intl, no cron-parser dep) ─────────────

/**
 * Given a 5-field cron expression and IANA timezone, compute the next fire
 * time after `from` (defaults to now).
 *
 * Implements a simple "tick forward" algorithm:
 *   1. Convert `from` to wall-clock in the target timezone
 *   2. Advance minute by minute until the cron expression matches
 *   3. Return the UTC timestamp of that matching moment
 *
 * Handles DST by always working in wall-clock time, then converting back.
 * Accurate to the minute (cron granularity).
 */
export function computeNextRun(
  schedule: string,
  timezone: string,
  from: Date = new Date()
): number | null {
  // One-shot: ISO timestamp
  if (schedule.includes("T") || schedule.includes("-")) {
    try {
      const ts = new Date(schedule).getTime();
      return ts > from.getTime() ? ts : null;  // null = already fired
    } catch { return null; }
  }

  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = fields;

  const parseField = (expr: string, min: number, max: number): Set<number> => {
    const result = new Set<number>();
    for (const part of expr.split(",")) {
      if (part === "*") {
        for (let i = min; i <= max; i++) result.add(i);
      } else if (part.startsWith("*/")) {
        const step = parseInt(part.slice(2), 10);
        for (let i = min; i <= max; i += step) result.add(i);
      } else if (part.includes("-")) {
        const [lo, hi] = part.split("-").map(Number);
        for (let i = lo; i <= hi; i++) result.add(i);
      } else if (part.includes("/")) {
        const [start, step] = part.split("/");
        const startVal = start === "*" ? min : parseInt(start, 10);
        const stepVal = parseInt(step, 10);
        for (let i = startVal; i <= max; i += stepVal) result.add(i);
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n)) result.add(n);
      }
    }
    return result;
  };

  const minutes    = parseField(minExpr,  0, 59);
  const hours      = parseField(hourExpr, 0, 23);
  const doms       = parseField(domExpr,  1, 31);
  const months     = parseField(monExpr,  1, 12);
  const dows       = parseField(dowExpr,  0,  6);  // 0=Sun

  // Build a formatter that gives us wall-clock parts in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  // Start searching from the *next* minute after `from`
  let cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor = new Date(cursor.getTime() + 60_000);  // advance to next minute

  // Safety: search at most 1 year ahead
  const limit = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000);

  while (cursor < limit) {
    const parts = fmt.formatToParts(cursor);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? "0", 10);

    const min = get("minute");
    const hr  = get("hour") === 24 ? 0 : get("hour");
    const dom = get("day");
    const mon = get("month");
    const dow = cursor.getDay();  // Note: getDay() returns UTC day, but we need tz day

    // Get actual dow in target timezone
    const tzDate = new Date(cursor.toLocaleString("en-US", { timeZone: timezone }));
    const tzDow = tzDate.getDay();

    if (
      minutes.has(min) &&
      hours.has(hr) &&
      doms.has(dom) &&
      months.has(mon) &&
      dows.has(tzDow)
    ) {
      return cursor.getTime();
    }

    cursor = new Date(cursor.getTime() + 60_000);
  }

  return null;
}

/**
 * Returns true if a schedule string is a valid cron expression or ISO timestamp.
 */
export function validateSchedule(schedule: string): boolean {
  if (!schedule) return false;
  // ISO timestamp
  if (schedule.includes("T") || schedule.match(/^\d{4}-\d{2}-\d{2}/)) {
    return !isNaN(new Date(schedule).getTime());
  }
  // Cron expression: 5 fields
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every(f => /^[\d\*\/\-,]+$/.test(f));
}

/**
 * Convert a cron expression to a human-readable description.
 * Handles common patterns; falls back to the raw expression.
 */
export function cronToHuman(schedule: string, timezone: string): string {
  // One-shot
  if (schedule.includes("T") || schedule.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      return `Once at ${new Date(schedule).toLocaleString("en-US", { timeZone: timezone })} (${timezone})`;
    } catch { return schedule; }
  }

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [min, hr, dom, mon, dow] = parts;

  if (schedule === "* * * * *")     return "Every minute";
  if (schedule === "*/5 * * * *")   return "Every 5 minutes";
  if (schedule === "*/15 * * * *")  return "Every 15 minutes";
  if (schedule === "*/30 * * * *")  return "Every 30 minutes";
  if (dom === "*" && mon === "*" && dow === "*") {
    if (min !== "*" && hr !== "*") {
      const h = parseInt(hr, 10);
      const m = parseInt(min, 10);
      const suffix = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const mStr = m.toString().padStart(2, "0");
      return `Daily at ${h12}:${mStr} ${suffix} ${timezone}`;
    }
    if (min !== "*" && hr === "*") return `Every hour at minute ${min} (${timezone})`;
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (dom === "*" && mon === "*" && dow !== "*") {
    const dayNum = parseInt(dow, 10);
    const dayName = dayNames[dayNum] ?? dow;
    if (min !== "*" && hr !== "*") {
      const h = parseInt(hr, 10);
      const m = parseInt(min, 10);
      const suffix = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const mStr = m.toString().padStart(2, "0");
      return `Weekly on ${dayName} at ${h12}:${mStr} ${suffix} ${timezone}`;
    }
  }
  return `${schedule} (${timezone})`;
}

// ─── Idempotency Key ─────────────────────────────────────────────────────────

/**
 * Deterministic idempotency key: sha256(jobId:scheduledFireTime).slice(0,16)
 * Same job + same scheduled fire time always yields the same key, so a
 * retried execution doesn't duplicate real-world side effects.
 */
export function makeIdempotencyKey(jobId: string, scheduledFireTime: number): string {
  return createHash("sha256")
    .update(`${jobId}:${scheduledFireTime}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── Backoff ──────────────────────────────────────────────────────────────────

/** Returns the delay in ms for a given consecutive failure count, or null if escalation needed. */
export function getBackoffDelay(consecutiveFailures: number): number | null {
  if (consecutiveFailures <= 0) return null;
  const idx = consecutiveFailures - 1;
  if (idx >= BACKOFF_SEQUENCE_MS.length) return null;  // exhausted → escalate
  return BACKOFF_SEQUENCE_MS[idx];
}

/** Returns a text label for the current backoff state */
export function backoffLabel(consecutiveFailures: number): string {
  const delay = getBackoffDelay(consecutiveFailures);
  if (!delay) {
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_ESCALATION) return "escalated";
    return "none";
  }
  if (delay < 60_000)    return `${delay / 1000}s`;
  if (delay < 3_600_000) return `${delay / 60_000}m`;
  return `${delay / 3_600_000}h`;
}

export { MAX_FAILURES_BEFORE_ESCALATION };

// ─── Priority Queue ──────────────────────────────────────────────────────────

/** Simple sorted array acting as a min-heap by scheduledFireTime. */
export class SchedulerQueue {
  private entries: SchedulerQueueEntry[] = [];

  public insert(entry: SchedulerQueueEntry): void {
    this.entries.push(entry);
    this.entries.sort((a, b) => a.scheduledFireTime - b.scheduledFireTime);
  }

  public popDue(now: number): SchedulerQueueEntry[] {
    const due: SchedulerQueueEntry[] = [];
    while (this.entries.length > 0 && this.entries[0].scheduledFireTime <= now) {
      due.push(this.entries.shift()!);
    }
    return due;
  }

  public remove(jobId: string): void {
    this.entries = this.entries.filter(e => e.jobId !== jobId);
  }

  public peek(): SchedulerQueueEntry | undefined {
    return this.entries[0];
  }

  public size(): number {
    return this.entries.length;
  }

  public all(): SchedulerQueueEntry[] {
    return [...this.entries];
  }

  public rebuild(jobs: CronJobV2[]): void {
    this.entries = [];
    for (const job of jobs) {
      if (job.enabled && job.status !== "failing" && job.status !== "disabled" && job.nextRun) {
        this.entries.push({ jobId: job.id, scheduledFireTime: job.nextRun });
      }
    }
    this.entries.sort((a, b) => a.scheduledFireTime - b.scheduledFireTime);
  }
}

// ─── Scheduler Core ───────────────────────────────────────────────────────────

export type FireCallback = (result: FireResult) => Promise<void>;

export class CronSchedulerCore {
  private queue = new SchedulerQueue();
  private loopTimer: NodeJS.Timeout | null = null;
  private driftSamples: number[] = [];
  private watchdog: GatewayWatchdog | null = null;

  constructor(
    private readonly getJobs: () => CronJobV2[],
    private readonly onFire: FireCallback,
    private readonly onDrift: (sample: { jobId: string; scheduledFireTime: number; actualFireTime: number; driftMs: number }) => void
  ) {}

  public setWatchdog(watchdog: GatewayWatchdog): void {
    this.watchdog = watchdog;
  }

  /** Start scheduler, rebuilding queue from persisted jobs. */
  public start(): void {
    if (this.loopTimer) return;
    this.rebuildQueue();
    this.loopTimer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    console.log(`[CronScheduler] ⏱  Scheduler started — polling every ${POLL_INTERVAL_MS}ms, queue has ${this.queue.size()} entries`);
  }

  public stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /** Rebuild the priority queue from persisted job state. Called on start + job changes. */
  public rebuildQueue(): void {
    const jobs = this.getJobs();
    this.queue.rebuild(jobs);
    console.log(`[CronScheduler] Queue rebuilt: ${this.queue.size()} active entries`);
  }

  /** Add or update a single job in the queue. */
  public upsertJobInQueue(job: CronJobV2): void {
    this.queue.remove(job.id);
    if (job.enabled && job.status !== "failing" && job.status !== "disabled" && job.nextRun) {
      this.queue.insert({ jobId: job.id, scheduledFireTime: job.nextRun });
    }
  }

  /** Remove a job from the queue (on delete or disable). */
  public removeJobFromQueue(jobId: string): void {
    this.queue.remove(jobId);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const due = this.queue.popDue(now);
    if (due.length === 0) return;

    // Group by scheduled minute to detect simultaneous firings
    const byMinute = new Map<number, SchedulerQueueEntry[]>();
    for (const entry of due) {
      const minute = Math.floor(entry.scheduledFireTime / 60_000);
      if (!byMinute.has(minute)) byMinute.set(minute, []);
      byMinute.get(minute)!.push(entry);
    }

    for (const [, entries] of byMinute) {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        // Apply jitter only when multiple jobs share the same minute
        const jitter = entries.length > 1 ? Math.floor(Math.random() * JITTER_MAX_MS) : 0;

        // Measure drift (before jitter, jitter is intentional)
        const driftMs = now - entry.scheduledFireTime;
        this.onDrift({
          jobId: entry.jobId,
          scheduledFireTime: entry.scheduledFireTime,
          actualFireTime: now,
          driftMs
        });
        this.trackDrift(driftMs);

        const key = makeIdempotencyKey(entry.jobId, entry.scheduledFireTime);

        // Fire with jitter delay
        setTimeout(async () => {
          try {
            await this.onFire({
              jobId: entry.jobId,
              scheduledFireTime: entry.scheduledFireTime,
              idempotencyKey: key,
            });
          } catch (err: any) {
            console.error(`[CronScheduler] Unhandled error firing job ${entry.jobId}:`, err.message);
          }
        }, jitter);
      }
    }
  }

  private trackDrift(driftMs: number): void {
    this.driftSamples.push(driftMs);
    if (this.driftSamples.length > DRIFT_ROLLING_WINDOW) {
      this.driftSamples.shift();
    }
    if (this.driftSamples.length >= 10) {
      const avg = this.driftSamples.reduce((s, d) => s + d, 0) / this.driftSamples.length;
      if (avg > DRIFT_ALERT_MS && this.watchdog) {
        console.warn(`[CronScheduler] ⚠️  Scheduler drift alert: rolling avg drift is ${avg.toFixed(0)}ms — possible CPU starvation`);
        // Route through Watchdog's existing failure recorder
        const sh = (this.watchdog as any)._selfHealing;
        if (sh && typeof sh.recordFailure === "function") {
          sh.recordFailure("cron-scheduler", `scheduler_drift_high:${Math.round(avg)}ms`).catch(() => {});
        }
      }
    }
  }

  public getQueueSnapshot(): SchedulerQueueEntry[] {
    return this.queue.all();
  }
}
