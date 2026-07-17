/**
 * cron.ts  — Komorebi Omoi Cron Subsystem (v2 complete rebuild)
 * ──────────────────────────────────────────────────────────────────────────────
 * Orchestrates all cron subsystems:
 *   CronStore             — JSONL persistence
 *   CronSchedulerCore     — time-bucketed drift-resistant scheduler
 *   Claim/Confirm         — crash-proof execution reliability
 *   Exponential Backoff   — 30s→1m→5m→15m→60m + Self-Healing escalation
 *   Task Records          — audit trail per execution
 *   Task Flow             — multi-step cron-triggered sequences
 *   Delivery Modes        — announce / webhook / none
 *   Boundary Validator    — startup config health check
 *
 * Public API is backward-compatible with the old GatewayCronScheduler:
 *   getJobs()           → CronJobV2[] (superset of old CronJobConfig)
 *   addOrUpdateJob()    → accepts legacy CronJobConfig or new CronJobV2
 *   deleteJob(id)
 *   runJob(id)          → manual trigger
 *
 * NEW public methods:
 *   getTasks(jobId?)    → TaskRecord[]
 *   getDriftReport()    → drift stats
 *   getBoundaryWarnings() → BoundaryWarning[]
 *   getQueueSnapshot()  → SchedulerQueueEntry[]
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { join } from "node:path";

import { CronStore }              from "./cron-store.js";
import {
  CronSchedulerCore, computeNextRun, validateSchedule, cronToHuman,
  getBackoffDelay, makeIdempotencyKey, MAX_FAILURES_BEFORE_ESCALATION
} from "./cron-scheduler.js";
import {
  claimExecution, confirmExecution, recoverUnconfirmedClaims,
  createTaskRecord, finaliseTaskRecord, executeTaskFlow, logCronEventToMemory
} from "./cron-task-flow.js";
import {
  deliverJobOutput, resolveAnnounceChatId, notifyJobFailure
} from "./cron-delivery.js";
import { validateCronBoundaries }  from "./cron-boundary-validator.js";
import { SelfHealingSubsystem }    from "./self-healing.js";
import type { CronJobV2, TaskRecord } from "./cron-store.js";
import type { BoundaryWarning }    from "./cron-boundary-validator.js";
import type { SchedulerQueueEntry } from "./cron-scheduler.js";
import type { SessionManager }     from "./session.js";
import type { GatewayWsServer }    from "./server.js";
import type { KomorebiConfig }     from "./types.js";

// Re-export types for server.ts and dashboard compatibility
export type { CronJobV2 as CronJobConfig };
export type { TaskRecord };
export type { BoundaryWarning };

export class GatewayCronScheduler {
  private store      = new CronStore();
  private core:        CronSchedulerCore;
  private boundaryWarnings: BoundaryWarning[] = [];
  private ownerChatId: number | null;

  // Track currently running job IDs (to show "running" badge in dashboard)
  private runningJobs = new Set<string>();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly getWsServer: () => GatewayWsServer | undefined,
    ownerChatId?: number | null,
    private readonly getGlobalConfig?: () => KomorebiConfig
  ) {
    this.ownerChatId = ownerChatId ?? null;

    this.core = new CronSchedulerCore(
      () => this.store.loadJobs(),
      (result) => this.executeJob(result),
      (driftData) => {
        this.store.recordDrift({
          timestamp:         Date.now(),
          jobId:             driftData.jobId,
          scheduledFireTime: driftData.scheduledFireTime,
          actualFireTime:    driftData.actualFireTime,
          driftMs:           driftData.driftMs,
        });
      }
    );

    // Boot sequence
    this.boot();
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    console.log("[CronScheduler] 🚀 Boot sequence starting...");

    // 1. Load and recompute nextRun for ALL enabled jobs
    const jobs = this.store.loadJobs();
    let updated = 0;
    for (const job of jobs) {
      const recomputed = this.recomputeNextRun(job);
      if (recomputed !== job.nextRun) {
        job.nextRun = recomputed;
        updated++;
      }
    }
    if (updated > 0) {
      this.store.saveJobs(jobs);
      console.log(`[CronScheduler] Recomputed nextRun for ${updated} job(s)`);
    }

    // 2. Boundary validation
    this.boundaryWarnings = validateCronBoundaries(jobs);

    // 3. Crash recovery: claimed-but-unconfirmed executions
    const toResume = recoverUnconfirmedClaims(this.store);
    if (toResume.length > 0) {
      console.log(`[CronScheduler] ♻️  ${toResume.length} claimed-but-unconfirmed execution(s) detected — scheduling immediate resume`);
      for (const item of toResume) {
        setTimeout(async () => {
          await this.executeJob({
            jobId: item.jobId,
            scheduledFireTime: item.scheduledFireTime,
            idempotencyKey: item.idempotencyKey,
          });
        }, 2000);
      }
    }

    // 4. Start scheduler
    this.core.start();

    console.log(`[CronScheduler] ✅ Ready — ${jobs.filter(j => j.enabled).length} active job(s)`);
    this.logScheduledJobs(jobs);
  }

  private logScheduledJobs(jobs: CronJobV2[]): void {
    for (const job of jobs) {
      if (job.enabled && job.nextRun) {
        const human = cronToHuman(job.schedule ?? job.expression ?? "", job.timezone ?? "UTC");
        console.log(`[CronScheduler] ⏰ "${job.name}" [${job.type}] — ${human} — next: ${new Date(job.nextRun).toLocaleString()}`);
      } else if (!job.enabled) {
        console.log(`[CronScheduler] 💤 "${job.name}" — DISABLED`);
      }
    }
  }

  // ─── nextRun computation ──────────────────────────────────────────────────

  private recomputeNextRun(job: CronJobV2): number | null {
    if (!job.enabled || job.status === "failing" || job.status === "disabled") return null;

    // If in backoff, nextRun is already set to backoffUntil
    if (job.backoffUntil && job.backoffUntil > Date.now()) return job.backoffUntil;

    const schedule = job.schedule ?? job.expression ?? "";
    if (!schedule) return null;

    return computeNextRun(schedule, job.timezone ?? "UTC");
  }

  // ─── Core execution engine ────────────────────────────────────────────────

  private async executeJob(result: {
    jobId: string;
    scheduledFireTime: number;
    idempotencyKey: string;
  }): Promise<void> {
    const job = this.store.getJob(result.jobId);
    if (!job) {
      console.warn(`[CronScheduler] Job ${result.jobId} not found — skipping`);
      return;
    }
    if (!job.enabled || job.status === "failing" || job.status === "disabled") {
      console.warn(`[CronScheduler] Job "${job.name}" is ${job.status} — skipping`);
      return;
    }

    const wsServer = this.getWsServer();
    const resolvedChatId = resolveAnnounceChatId(job, this.ownerChatId, wsServer);
    const isManualTrigger = result.scheduledFireTime === 0;

    console.log(`[CronScheduler] 🔥 Firing "${job.name}" [${job.type}] — idempotencyKey: ${result.idempotencyKey}`);

    // ── Step 1: Claim ──────────────────────────────────────────────────────
    claimExecution(this.store, job, result.scheduledFireTime, result.idempotencyKey);

    // ── Step 2: Create task record ─────────────────────────────────────────
    const task = createTaskRecord(
      job,
      result.scheduledFireTime,
      Date.now(),
      result.idempotencyKey,
      isManualTrigger
    );
    this.store.appendTask(task);

    // ── Step 3: Broadcast start event ─────────────────────────────────────
    this.runningJobs.add(job.id);
    this.broadcastCronEvent("cron_started", {
      jobId: job.id, name: job.name, agentId: job.agentId,
      taskId: task.taskId, startedAt: task.startedAt,
    });

    const startMs = Date.now();
    let success = false;
    let output = "";
    let errorMsg: string | undefined;

    try {
      // ── Step 4: Execute by type ──────────────────────────────────────────
      if (job.type === "command") {
        output = await this.executeCommand(job);
      } else {
        output = await this.executeAgentTurn(job, task, wsServer);
      }
      success = true;

    } catch (err: any) {
      errorMsg = err.message || "Unknown error";
      console.error(`[CronScheduler] ❌ Job "${job.name}" failed:`, errorMsg);
    } finally {
      this.runningJobs.delete(job.id);
    }

    const durationMs = Date.now() - startMs;

    // ── Step 5: Update task record ─────────────────────────────────────────
    const finalisedTask = finaliseTaskRecord(this.store, task, {
      status: success ? "completed" : "failed",
      output: success ? output : errorMsg ?? null,
      completedAt: Date.now(),
    });

    // ── Step 6: Confirm claim ──────────────────────────────────────────────
    confirmExecution(this.store, result.idempotencyKey, finalisedTask.taskId);

    // ── Step 7: Delivery ───────────────────────────────────────────────────
    if (success && job.deliveryMode !== "none") {
      await deliverJobOutput(job, finalisedTask, output, this.store, wsServer, resolvedChatId);
    }

    if (!success) {
      await notifyJobFailure(job, errorMsg!, job.consecutiveFailures + 1, wsServer, resolvedChatId);
    }

    // ── Step 8: Update job state + advance schedule ────────────────────────
    await this.handleJobOutcome(job, success, errorMsg, durationMs);

    // ── Step 9: Broadcast completion ───────────────────────────────────────
    const updatedJob = this.store.getJob(job.id);
    this.broadcastCronEvent("cron_completed", {
      jobId: job.id, name: job.name, agentId: job.agentId,
      taskId: finalisedTask.taskId, success, durationMs,
      error: errorMsg, nextRun: updatedJob?.nextRun ?? null,
      status: updatedJob?.status ?? job.status,
    });

    console.log(`[CronScheduler] ${success ? "✅" : "❌"} "${job.name}" ${success ? "completed" : "failed"} in ${durationMs}ms`);
  }

  // ─── Execution by type ────────────────────────────────────────────────────

  private async executeAgentTurn(
    job: CronJobV2,
    task: TaskRecord,
    wsServer: any
  ): Promise<string> {
    if (!wsServer) throw new Error("WS Server not initialized");

    const sessionKey = job.type === "session"
      ? `${job.agentId}:cron:${job.id}`          // reuse persistent session context
      : `${job.agentId}:cron_iso:${task.taskId}`; // fresh isolated context

    let promptContent = job.payload ?? job.prompt ?? "";

    // Dynamic payload generation
    if (job.dynamicPayload && job.type === "session") {
      try {
        const tempSession = `${job.agentId}:cron_dynamic:${task.taskId}`;
        await wsServer.sessionManager.ensureAgentRunning(job.agentId, tempSession);
        const ws = wsServer.sessionManager.getAgentConnection(tempSession);
        if (ws) {
          const res = await wsServer.sendRequest(ws, "queryModel", {
            systemInstruction: "Generate a dynamic, operational step-by-step task prompt for this agent based on the scheduling instruction.",
            prompt: promptContent,
          });
          if (res?.text) promptContent = res.text.trim();
        }
        wsServer.sessionManager.terminateSession(tempSession);
      } catch (err: any) {
        console.warn(`[CronScheduler] Dynamic payload generation failed: ${err.message}. Using static payload.`);
      }
    }

    // Pass idempotency key through the WakeEvent payload
    const wakeEvent = {
      type: "cron" as const,
      sessionId: sessionKey,
      agentId: job.agentId,
      payload: {
        message: promptContent,
        cronExpression: job.schedule ?? job.expression ?? "",
        idempotencyKey: task.idempotencyKey,
        envelope: {
          sender: { id: 0, firstName: "System", username: "cron" },
          chatId: 0,
          content: promptContent,
          attachments: [],
          channel: "cron" as any,
          timestamp: Math.floor(Date.now() / 1000),
          isCron: true,
          cronJobName: job.name,
          agentId: job.agentId,
        },
      },
      timestamp: Date.now(),
    };

    wsServer.messagePipeline.lastCronReplies?.delete(sessionKey);
    await wsServer.messagePipeline.handleWakeEvent(wakeEvent);

    const reply = wsServer.messagePipeline.lastCronReplies?.get(sessionKey) ?? "";
    wsServer.messagePipeline.lastCronReplies?.delete(sessionKey);

    // Teardown isolated sessions; keep session-type sessions alive
    if (job.type === "isolated") {
      try { wsServer.sessionManager.terminateSession(sessionKey); } catch {}
    }

    return reply;
  }

  private async executeCommand(job: CronJobV2): Promise<string> {
    const cmd = job.payload ?? job.prompt ?? "";
    if (!cmd) throw new Error("No command payload specified");
    console.log(`[CronScheduler] 🖥  Executing command job "${job.name}": ${cmd.slice(0, 80)}`);
    try {
      const stdout = execSync(cmd, { timeout: 30_000, encoding: "utf-8" });
      return stdout.trim();
    } catch (err: any) {
      const stderr = err.stderr?.toString?.() ?? "";
      throw new Error(`Command failed (exit ${err.status}): ${err.message}\n${stderr}`.slice(0, 500));
    }
  }

  // ─── Job outcome handling (backoff, nextRun, self-healing) ────────────────

  private async handleJobOutcome(
    job: CronJobV2,
    success: boolean,
    errorMsg: string | undefined,
    durationMs: number
  ): Promise<void> {
    const now = Date.now();
    const agentCfg = this.getGlobalConfig?.()?.agents?.find(a => a.id === job.agentId);
    const workspace = agentCfg?.workspace;

    if (success) {
      // ── SUCCESS: reset failures, advance to normal schedule ──────────────
      if (job.consecutiveFailures > 0) {
        console.log(`[CronScheduler] 🎉 "${job.name}" recovered after ${job.consecutiveFailures} failures — resetting to normal schedule`);
        logCronEventToMemory(job.agentId, workspace,
          "RECOVERED", `Job "${job.name}" recovered after ${job.consecutiveFailures} consecutive failures`);
      }
      job.consecutiveFailures = 0;
      job.backoffUntil = null;
      job.status = "active";
      job.lastRun = now;
      job.nextRun = this.recomputeNextRun(job);

    } else {
      // ── FAILURE: walk the backoff ladder ─────────────────────────────────
      job.consecutiveFailures = (job.consecutiveFailures ?? 0) + 1;
      job.lastRun = now;

      const delay = getBackoffDelay(job.consecutiveFailures);

      if (delay !== null) {
        // Still in backoff territory
        job.status = "backoff";
        job.backoffUntil = now + delay;
        job.nextRun = job.backoffUntil;
        const labels = ["30s", "1m", "5m", "15m", "60m"];
        const label = labels[job.consecutiveFailures - 1] ?? `${delay}ms`;
        console.warn(`[CronScheduler] ⏳ "${job.name}" backoff #${job.consecutiveFailures}: retry in ${label}`);
        logCronEventToMemory(job.agentId, workspace,
          "BACKOFF", `Job "${job.name}" failure #${job.consecutiveFailures}: retry in ${label}. Error: ${errorMsg}`);

      } else {
        // Backoff ladder exhausted → escalate to Self-Healing
        job.status = "failing";
        job.nextRun = null;
        job.backoffUntil = null;
        console.error(`[CronScheduler] 🚨 "${job.name}" has failed ${job.consecutiveFailures} times — escalating to Self-Healing`);
        logCronEventToMemory(job.agentId, workspace,
          "ESCALATED", `Job "${job.name}" escalated after ${job.consecutiveFailures} consecutive failures. Auto-retry stopped.`);

        // Fire-and-forget: Self-Healing escalation
        SelfHealingSubsystem.getInstance().recordFailure(
          `cron-job:${job.id}`,
          `cron_job_exhausted_backoff:${errorMsg?.slice(0, 120) ?? "unknown"}`,
          { jobId: job.id, jobName: job.name, agentId: job.agentId, consecutiveFailures: job.consecutiveFailures }
        ).catch(err => console.warn("[CronScheduler] Self-healing escalation failed:", err.message));
      }
    }

    // Persist updated job
    this.store.upsertJob(job);

    // Update scheduler queue
    this.core.upsertJobInQueue(job);
  }

  // ─── Public API (backward compatible + new) ───────────────────────────────

  public getJobs(): CronJobV2[] {
    return this.store.loadJobs().map(job => ({
      ...job,
      // Legacy compat fields
      expression: job.schedule ?? job.expression,
      prompt: job.payload ?? job.prompt,
      nextRun: job.nextRun,
      humanSchedule: cronToHuman(job.schedule ?? job.expression ?? "", job.timezone ?? "UTC"),
      isRunning: this.runningJobs.has(job.id),
    }));
  }

  public getTasks(jobId?: string): TaskRecord[] {
    return this.store.loadTasks(jobId);
  }

  public getDriftReport() {
    return this.store.getDriftReport();
  }

  public getBoundaryWarnings(): BoundaryWarning[] {
    return this.boundaryWarnings;
  }

  public getQueueSnapshot(): SchedulerQueueEntry[] {
    return this.core.getQueueSnapshot();
  }

  public getNextRunTime(jobId: string): number | null {
    return this.store.getJob(jobId)?.nextRun ?? null;
  }

  /**
   * addOrUpdateJob — accepts both legacy CronJobConfig and new CronJobV2.
   * Normalises to CronJobV2 internally.
   */
  public addOrUpdateJob(config: any): void {
    let job: CronJobV2;

    // If it looks like a new-format job (has `schedule` or `type`), use as-is
    if (config.schedule || config.type) {
      job = { ...config } as CronJobV2;
    } else {
      // Legacy format: upgrade it
      job = this.store.upgradeJob(config);
    }

    // Recompute nextRun
    job.nextRun = this.recomputeNextRun(job);
    job.status  = job.enabled ? "active" : "disabled";

    this.store.upsertJob(job);
    this.core.upsertJobInQueue(job);

    console.log(`[CronScheduler] 💾 Saved job "${job.name}" — next run: ${job.nextRun ? new Date(job.nextRun).toLocaleString() : "N/A"}`);

    // Re-run boundary validation
    this.boundaryWarnings = validateCronBoundaries(this.store.loadJobs());
  }

  public deleteJob(id: string): void {
    this.store.deleteJob(id);
    this.core.removeJobFromQueue(id);
    console.log(`[CronScheduler] 🗑  Deleted job ${id}`);
  }

  /** Manual trigger — fires immediately outside the scheduler loop */
  public async runJob(id: string): Promise<void> {
    const job = this.store.getJob(id);
    if (!job) throw new Error(`Cron job not found: ${id}`);

    const now = Date.now();
    const key = makeIdempotencyKey(id, 0);  // scheduledFireTime=0 marks manual

    console.log(`[CronScheduler] ▶  Manual trigger for "${job.name}"`);
    await this.executeJob({
      jobId: id,
      scheduledFireTime: 0,   // 0 = manual trigger sentinel
      idempotencyKey: `manual-${key}-${now}`,
    });
  }

  /** Enable a failing/disabled job and resume its schedule */
  public enableJob(id: string): void {
    const job = this.store.getJob(id);
    if (!job) return;
    job.enabled = true;
    job.status = "active";
    job.consecutiveFailures = 0;
    job.backoffUntil = null;
    job.nextRun = this.recomputeNextRun(job);
    this.store.upsertJob(job);
    this.core.upsertJobInQueue(job);
    console.log(`[CronScheduler] ▶  Enabled job "${job.name}" — next: ${job.nextRun ? new Date(job.nextRun).toLocaleString() : "N/A"}`);
  }

  public disableJob(id: string): void {
    const job = this.store.getJob(id);
    if (!job) return;
    job.enabled = false;
    job.status = "disabled";
    job.nextRun = null;
    this.store.upsertJob(job);
    this.core.removeJobFromQueue(id);
    console.log(`[CronScheduler] ⏸  Disabled job "${job.name}"`);
  }

  // ─── Internal broadcast ───────────────────────────────────────────────────

  private broadcastCronEvent(event: string, data: any): void {
    try {
      const ws = this.getWsServer();
      if (ws) ws.publishToBus("cron_event", { event, data, timestamp: Date.now() });
    } catch {}
  }
}
