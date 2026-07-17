/**
 * cron-task-flow.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Task Record management, Claim/Confirm crash-recovery, and Task Flow
 * coordination for multi-step cron-triggered work sequences.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  CronJobV2, TaskRecord, ClaimRecord, CronStore
} from "./cron-store.js";

// ─── Claim / Confirm ─────────────────────────────────────────────────────────

/**
 * BEFORE executing a job: write a "claimed" marker.
 * If the Gateway crashes between claim and confirm, on restart we find this
 * claim and re-verify the task rather than blindly re-running (which could
 * double-deliver a Telegram announcement or double-trigger a side effect).
 */
export function claimExecution(
  store: CronStore,
  job: CronJobV2,
  scheduledFireTime: number,
  idempotencyKey: string
): ClaimRecord {
  const claim: ClaimRecord = {
    executionId: idempotencyKey,
    jobId: job.id,
    scheduledFireTime,
    claimedAt: Date.now(),
    status: "claimed",
    taskId: null,
  };
  store.writeClaim(claim);
  console.log(`[CronTaskFlow] 📌 Claimed execution ${idempotencyKey} for job "${job.name}"`);
  return claim;
}

/**
 * AFTER execution completes (success or failure): mark claim as confirmed.
 */
export function confirmExecution(
  store: CronStore,
  executionId: string,
  taskId: string
): void {
  store.confirmClaim(executionId, taskId);
  console.log(`[CronTaskFlow] ✅ Confirmed execution ${executionId} → taskId ${taskId}`);
}

// ─── Task Records ─────────────────────────────────────────────────────────────

export function createTaskRecord(
  job: CronJobV2,
  scheduledFireTime: number,
  actualFireTime: number,
  idempotencyKey: string,
  isManualTrigger = false
): TaskRecord {
  return {
    taskId: randomUUID(),
    jobId: job.id,
    jobName: job.name,
    agentId: job.agentId,
    scheduledFireTime,
    actualFireTime,
    driftMs: actualFireTime - scheduledFireTime,
    startedAt: Date.now(),
    completedAt: null,
    status: "running",
    output: null,
    deliveryStatus: job.deliveryMode === "none" ? "skipped" : "pending",
    deliveryAttempts: 0,
    idempotencyKey,
    isManualTrigger,
  };
}

export function finaliseTaskRecord(
  store: CronStore,
  task: TaskRecord,
  updates: Partial<TaskRecord>
): TaskRecord {
  const updated: TaskRecord = {
    ...task,
    ...updates,
    completedAt: updates.completedAt ?? Date.now(),
  };
  store.updateTaskStatus(task.taskId, updated);
  return updated;
}

// ─── Crash Recovery ───────────────────────────────────────────────────────────

/**
 * On Gateway startup, check for claimed-but-unconfirmed executions.
 * For each one:
 *   1. Check if a completed task record exists (process completed but confirm write crashed)
 *      → If yes: just confirm the claim, don't re-execute
 *   2. Check if a "running" task record exists (process crashed mid-run)
 *      → Mark the task as "resumed", re-execute with the SAME idempotency key
 *        (idempotency key prevents duplicate delivery)
 *   3. No task record → re-execute
 *
 * Returns a list of jobIds that need to be re-executed.
 */
export function recoverUnconfirmedClaims(
  store: CronStore
): Array<{ jobId: string; scheduledFireTime: number; idempotencyKey: string; wasRunning: boolean }> {
  const unconfirmed = store.getUnconfirmedClaims();
  if (unconfirmed.length === 0) return [];

  console.log(`[CronTaskFlow] 🔍 Checking ${unconfirmed.length} unconfirmed claim(s) from before crash...`);
  const toResume: ReturnType<typeof recoverUnconfirmedClaims> = [];

  for (const claim of unconfirmed) {
    const tasks = store.loadTasks(claim.jobId);
    const matchingTask = tasks.find(t => t.idempotencyKey === claim.executionId);

    if (matchingTask) {
      if (matchingTask.status === "completed" || matchingTask.status === "failed") {
        // Task fully completed — just confirm the claim
        console.log(`[CronTaskFlow] ✅ Claim ${claim.executionId} already has completed task ${matchingTask.taskId} — auto-confirming`);
        store.confirmClaim(claim.executionId, matchingTask.taskId);
      } else if (matchingTask.status === "running") {
        // Crashed mid-run — resume
        console.log(`[CronTaskFlow] ⚠️  Claim ${claim.executionId} has a stuck "running" task — scheduling resume`);
        store.updateTaskStatus(matchingTask.taskId, { status: "resumed" });
        toResume.push({
          jobId: claim.jobId,
          scheduledFireTime: claim.scheduledFireTime,
          idempotencyKey: claim.executionId,
          wasRunning: true,
        });
      }
    } else {
      // No task at all — crash before task record was created
      console.log(`[CronTaskFlow] ⚠️  Claim ${claim.executionId} has no task record — scheduling re-execution`);
      toResume.push({
        jobId: claim.jobId,
        scheduledFireTime: claim.scheduledFireTime,
        idempotencyKey: claim.executionId,
        wasRunning: false,
      });
    }
  }

  return toResume;
}

// ─── Task Flow: Multi-Step Cron-Triggered Sequences ──────────────────────────

export interface TaskFlowStep {
  name: string;
  prompt: string;
  dependsOn?: string;  // name of step that must complete first
}

export interface TaskFlowConfig {
  steps: TaskFlowStep[];
}

export interface TaskFlowResult {
  succeeded: boolean;
  stepResults: Array<{
    step: string;
    taskId: string;
    status: "completed" | "failed" | "skipped";
    output: string | null;
  }>;
}

/**
 * Executes a multi-step Task Flow for a single cron trigger.
 * Steps execute sequentially by default; dependency-aware execution
 * is supported via the `dependsOn` field.
 *
 * Each step creates its own TaskRecord for full auditability.
 * If a step fails, dependent steps are skipped (not failed).
 *
 * The cron job's payload should be a JSON-serialised TaskFlowConfig
 * for multi-step jobs; single-step jobs use payload as a plain string.
 */
export async function executeTaskFlow(
  store: CronStore,
  job: CronJobV2,
  parentTask: TaskRecord,
  executeStep: (stepPrompt: string, stepName: string, parentTaskId: string) => Promise<string>,
): Promise<TaskFlowResult> {
  let flowConfig: TaskFlowConfig;

  try {
    const parsed = JSON.parse(job.payload);
    flowConfig = parsed as TaskFlowConfig;
    if (!Array.isArray(flowConfig.steps)) throw new Error("not a flow");
  } catch {
    // Single-step job — wrap in a trivial flow
    flowConfig = { steps: [{ name: "main", prompt: job.payload }] };
  }

  const completedSteps = new Map<string, { taskId: string; output: string | null }>();
  const stepResults: TaskFlowResult["stepResults"] = [];

  for (const step of flowConfig.steps) {
    // Check dependency
    if (step.dependsOn) {
      const dep = completedSteps.get(step.dependsOn);
      if (!dep) {
        console.warn(`[CronTaskFlow] Step "${step.name}" skipped — dependency "${step.dependsOn}" did not complete`);
        const skippedTask = createTaskRecord(job, parentTask.scheduledFireTime, Date.now(), `${parentTask.idempotencyKey}-${step.name}`, false);
        const finalised = finaliseTaskRecord(store, { ...skippedTask, status: "failed" }, { status: "failed", output: `Skipped: dependency "${step.dependsOn}" failed` });
        store.appendTask(finalised);
        stepResults.push({ step: step.name, taskId: finalised.taskId, status: "skipped", output: null });
        continue;
      }
    }

    const stepTask = createTaskRecord(
      job,
      parentTask.scheduledFireTime,
      Date.now(),
      `${parentTask.idempotencyKey}-${step.name}`,
      false
    );
    store.appendTask(stepTask);

    console.log(`[CronTaskFlow] ▶  Step "${step.name}" starting (task ${stepTask.taskId})`);

    try {
      const output = await executeStep(step.prompt, step.name, parentTask.taskId);
      const finalised = finaliseTaskRecord(store, stepTask, { status: "completed", output });
      completedSteps.set(step.name, { taskId: finalised.taskId, output });
      stepResults.push({ step: step.name, taskId: finalised.taskId, status: "completed", output });
      console.log(`[CronTaskFlow] ✅ Step "${step.name}" completed`);
    } catch (err: any) {
      const finalised = finaliseTaskRecord(store, stepTask, { status: "failed", output: err.message });
      stepResults.push({ step: step.name, taskId: finalised.taskId, status: "failed", output: err.message });
      console.error(`[CronTaskFlow] ❌ Step "${step.name}" failed:`, err.message);
    }
  }

  const succeeded = stepResults.every(r => r.status === "completed");
  return { succeeded, stepResults };
}

// ─── Memory logging ───────────────────────────────────────────────────────────

/**
 * Append a cron-related event to the agent's daily memory file.
 * Used for backoff transitions, retry events, and job failures.
 */
export function logCronEventToMemory(
  agentId: string,
  agentWorkspace: string | undefined,
  eventType: string,
  detail: string
): void {
  if (!agentWorkspace) return;
  try {
    const dateStr = new Date().toISOString().split("T")[0];
    const memoryDir = join(agentWorkspace, "memory");
    if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
    const memPath = join(memoryDir, `${dateStr}.md`);
    const line = `\n- [${new Date().toISOString()}] [CRON:${eventType}] ${detail}\n`;
    appendFileSync(memPath, line, "utf-8");
  } catch {}
}
