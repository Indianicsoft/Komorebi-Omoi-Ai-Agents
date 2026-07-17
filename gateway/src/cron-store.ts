/**
 * cron-store.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * JSONL-backed persistence layer for the Komorebi Omoi Cron subsystem.
 *
 * Storage layout under ~/.komorebi/cron/:
 *   jobs.jsonl    — one CronJobV2 per line (rewritten fully on change)
 *   tasks.jsonl   — append-only TaskRecord audit trail
 *   claims.jsonl  — append-only execution claims for crash recovery
 *   drift-log.jsonl — append-only scheduler drift samples (24h rolling)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import {
  existsSync, readFileSync, writeFileSync,
  appendFileSync, mkdirSync
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ─── Job Model ────────────────────────────────────────────────────────────────

export type JobType = "session" | "isolated" | "command";
export type DeliveryMode = "announce" | "webhook" | "none";
export type JobStatus = "active" | "backoff" | "failing" | "disabled" | "completed";

export interface CronJobV2 {
  // Identity
  id: string;
  name: string;
  agentId: string;

  // Scheduling
  /** Cron expression (5-field) OR ISO-8601 timestamp for one-shot jobs */
  schedule: string;
  timezone: string;        // IANA tz, e.g. "Asia/Kolkata"

  // Execution
  type: JobType;
  /** Prompt text for session/isolated; shell command for command type */
  payload: string;
  dynamicPayload?: boolean;

  // Delivery
  deliveryMode: DeliveryMode;
  /** Telegram chat ID or channel name for announce mode */
  channel?: string;
  /** URL for webhook delivery mode */
  webhookUrl?: string;
  /** Bearer token for webhook delivery (also used for /api/cron/trigger/:id) */
  webhookToken: string;

  // State
  enabled: boolean;
  status: JobStatus;
  createdAt: number;
  lastRun: number | null;
  nextRun: number | null;
  consecutiveFailures: number;
  backoffUntil: number | null;

  // Legacy compat (old dashboard saves these fields)
  expression?: string;   // alias for schedule
  prompt?: string;       // alias for payload
  history?: any[];       // legacy — kept for backward compat reads, ignored internally
}

// ─── Task Record ──────────────────────────────────────────────────────────────

export type TaskStatus =
  | "running"
  | "completed"
  | "failed"
  | "resumed"      // recovered from claimed-but-unconfirmed state
  | "delivery_failed";

export interface TaskRecord {
  taskId: string;
  jobId: string;
  jobName: string;
  agentId: string;
  scheduledFireTime: number;   // intended fire time (not actual)
  actualFireTime: number;      // when the scheduler actually fired it
  driftMs: number;             // actualFireTime - scheduledFireTime
  startedAt: number;
  completedAt: number | null;
  status: TaskStatus;
  output: string | null;
  deliveryStatus: "pending" | "delivered" | "failed" | "skipped";
  deliveryAttempts: number;
  idempotencyKey: string;
  isManualTrigger: boolean;
}

// ─── Claim Record ─────────────────────────────────────────────────────────────

export type ClaimStatus = "claimed" | "confirmed" | "resumed";

export interface ClaimRecord {
  executionId: string;
  jobId: string;
  scheduledFireTime: number;
  claimedAt: number;
  status: ClaimStatus;
  taskId: string | null;
}

// ─── Drift Sample ─────────────────────────────────────────────────────────────

export interface DriftSample {
  timestamp: number;
  jobId: string;
  scheduledFireTime: number;
  actualFireTime: number;
  driftMs: number;
}

// ─── Store Class ─────────────────────────────────────────────────────────────

export class CronStore {
  private readonly dir: string;
  private readonly jobsPath: string;
  private readonly tasksPath: string;
  private readonly claimsPath: string;
  private readonly driftPath: string;

  /** 24-hour rolling window for drift samples kept in memory */
  private driftCache: DriftSample[] = [];
  private readonly DRIFT_WINDOW_MS = 24 * 60 * 60 * 1000;

  constructor() {
    this.dir = join(homedir(), ".komorebi", "cron");
    this.jobsPath   = join(this.dir, "jobs.jsonl");
    this.tasksPath  = join(this.dir, "tasks.jsonl");
    this.claimsPath = join(this.dir, "claims.jsonl");
    this.driftPath  = join(this.dir, "drift-log.jsonl");
    this.ensureDir();
    this.loadDriftCache();
  }

  private ensureDir() {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  // ── Job CRUD ───────────────────────────────────────────────────────────────

  public loadJobs(): CronJobV2[] {
    // Also migrate legacy cron.json if jobs.jsonl doesn't exist yet
    if (!existsSync(this.jobsPath)) {
      return this.migrateLegacy();
    }
    try {
      const content = readFileSync(this.jobsPath, "utf-8").trim();
      if (!content) return [];
      return content.split("\n")
        .filter(Boolean)
        .map(l => {
          try { return JSON.parse(l) as CronJobV2; }
          catch { return null; }
        })
        .filter((j): j is CronJobV2 => j !== null);
    } catch (err) {
      console.error("[CronStore] Failed to load jobs.jsonl:", err);
      return [];
    }
  }

  private migrateLegacy(): CronJobV2[] {
    const legacyPath = join(homedir(), ".komorebi", "cron.json");
    if (!existsSync(legacyPath)) return [];
    try {
      const raw = readFileSync(legacyPath, "utf-8");
      const list = JSON.parse(raw) as any[];
      const migrated: CronJobV2[] = list.map(old => this.upgradeJob(old));
      this.saveJobs(migrated);
      console.log(`[CronStore] Migrated ${migrated.length} legacy jobs from cron.json → cron/jobs.jsonl`);
      return migrated;
    } catch (err) {
      console.error("[CronStore] Legacy migration failed:", err);
      return [];
    }
  }

  /** Upgrade a legacy CronJobConfig to CronJobV2 */
  public upgradeJob(old: any): CronJobV2 {
    return {
      id: old.id,
      name: old.name ?? "Unnamed Job",
      agentId: old.agentId ?? old.targetAgentId ?? "",
      schedule: old.expression ?? old.schedule ?? "0 0 * * *",
      timezone: old.timezone ?? "Asia/Kolkata",
      type: old.type ?? "session",
      payload: old.prompt ?? old.payload ?? "",
      dynamicPayload: old.dynamicPrompt ?? false,
      deliveryMode: old.deliveryMode ?? (old.webhookToken ? "announce" : "none"),
      channel: old.channel,
      webhookUrl: old.webhookUrl,
      webhookToken: old.webhookToken ?? `kore_${Math.random().toString(36).slice(2, 14)}`,
      enabled: old.enabled ?? true,
      status: old.enabled ? "active" : "disabled",
      createdAt: old.createdAt ?? Date.now(),
      lastRun: null,
      nextRun: null,
      consecutiveFailures: 0,
      backoffUntil: null,
      // keep legacy fields for dashboard compat
      expression: old.expression ?? old.schedule,
      prompt: old.prompt ?? old.payload,
      history: old.history ?? [],
    };
  }

  public saveJobs(jobs: CronJobV2[]): void {
    try {
      const content = jobs.map(j => JSON.stringify(j)).join("\n") + (jobs.length ? "\n" : "");
      writeFileSync(this.jobsPath, content, "utf-8");
    } catch (err) {
      console.error("[CronStore] Failed to save jobs.jsonl:", err);
    }
  }

  public upsertJob(job: CronJobV2): void {
    const jobs = this.loadJobs();
    const idx = jobs.findIndex(j => j.id === job.id);
    if (idx === -1) {
      jobs.push(job);
    } else {
      jobs[idx] = job;
    }
    this.saveJobs(jobs);
  }

  public deleteJob(id: string): void {
    const jobs = this.loadJobs().filter(j => j.id !== id);
    this.saveJobs(jobs);
  }

  public getJob(id: string): CronJobV2 | null {
    return this.loadJobs().find(j => j.id === id) ?? null;
  }

  // ── Task Records ──────────────────────────────────────────────────────────

  public appendTask(task: TaskRecord): void {
    try {
      appendFileSync(this.tasksPath, JSON.stringify(task) + "\n", "utf-8");
    } catch (err) {
      console.error("[CronStore] Failed to append task:", err);
    }
  }

  public loadTasks(jobId?: string): TaskRecord[] {
    if (!existsSync(this.tasksPath)) return [];
    try {
      const lines = readFileSync(this.tasksPath, "utf-8").trim().split("\n").filter(Boolean);
      const all = lines.map(l => {
        try { return JSON.parse(l) as TaskRecord; } catch { return null; }
      }).filter((t): t is TaskRecord => t !== null);
      return jobId ? all.filter(t => t.jobId === jobId) : all;
    } catch {
      return [];
    }
  }

  public updateTaskStatus(taskId: string, updates: Partial<TaskRecord>): void {
    if (!existsSync(this.tasksPath)) return;
    try {
      const lines = readFileSync(this.tasksPath, "utf-8").trim().split("\n").filter(Boolean);
      const updated = lines.map(l => {
        try {
          const t = JSON.parse(l) as TaskRecord;
          if (t.taskId === taskId) return JSON.stringify({ ...t, ...updates });
          return l;
        } catch { return l; }
      });
      writeFileSync(this.tasksPath, updated.join("\n") + "\n", "utf-8");
    } catch (err) {
      console.error("[CronStore] Failed to update task:", err);
    }
  }

  // ── Claims ────────────────────────────────────────────────────────────────

  public writeClaim(claim: ClaimRecord): void {
    try {
      appendFileSync(this.claimsPath, JSON.stringify(claim) + "\n", "utf-8");
    } catch (err) {
      console.error("[CronStore] Failed to write claim:", err);
    }
  }

  public confirmClaim(executionId: string, taskId: string): void {
    if (!existsSync(this.claimsPath)) return;
    try {
      const lines = readFileSync(this.claimsPath, "utf-8").trim().split("\n").filter(Boolean);
      const updated = lines.map(l => {
        try {
          const c = JSON.parse(l) as ClaimRecord;
          if (c.executionId === executionId) {
            return JSON.stringify({ ...c, status: "confirmed" as ClaimStatus, taskId });
          }
          return l;
        } catch { return l; }
      });
      writeFileSync(this.claimsPath, updated.join("\n") + "\n", "utf-8");
    } catch (err) {
      console.error("[CronStore] Failed to confirm claim:", err);
    }
  }

  /** Returns claims that were written but never confirmed — crash recovery targets */
  public getUnconfirmedClaims(): ClaimRecord[] {
    if (!existsSync(this.claimsPath)) return [];
    try {
      return readFileSync(this.claimsPath, "utf-8")
        .trim().split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l) as ClaimRecord; } catch { return null; } })
        .filter((c): c is ClaimRecord => c !== null && c.status === "claimed");
    } catch {
      return [];
    }
  }

  // ── Drift Log ─────────────────────────────────────────────────────────────

  public recordDrift(sample: DriftSample): void {
    try {
      appendFileSync(this.driftPath, JSON.stringify(sample) + "\n", "utf-8");
    } catch {}
    this.driftCache.push(sample);
    // Prune to 24h window in memory
    const cutoff = Date.now() - this.DRIFT_WINDOW_MS;
    this.driftCache = this.driftCache.filter(s => s.timestamp > cutoff);
  }

  public getDriftReport(): {
    samples: DriftSample[];
    avgDriftMs: number;
    maxDriftMs: number;
    p95DriftMs: number;
  } {
    const samples = this.driftCache;
    if (samples.length === 0) {
      return { samples: [], avgDriftMs: 0, maxDriftMs: 0, p95DriftMs: 0 };
    }
    const drifts = samples.map(s => s.driftMs).sort((a, b) => a - b);
    const avg = drifts.reduce((s, d) => s + d, 0) / drifts.length;
    const max = drifts[drifts.length - 1];
    const p95 = drifts[Math.floor(drifts.length * 0.95)] ?? max;
    return { samples, avgDriftMs: avg, maxDriftMs: max, p95DriftMs: p95 };
  }

  private loadDriftCache(): void {
    if (!existsSync(this.driftPath)) return;
    try {
      const cutoff = Date.now() - this.DRIFT_WINDOW_MS;
      this.driftCache = readFileSync(this.driftPath, "utf-8")
        .trim().split("\n").filter(Boolean)
        .map(l => { try { return JSON.parse(l) as DriftSample; } catch { return null; } })
        .filter((s): s is DriftSample => s !== null && s.timestamp > cutoff);
    } catch {}
  }
}
