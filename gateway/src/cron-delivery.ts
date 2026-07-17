/**
 * cron-delivery.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Three delivery mode handlers for cron job output:
 *   • announce — Telegram / channel delivery (reuses sendDirectTelegram)
 *   • webhook  — HTTP POST to configured URL with independent retry backoff
 *   • none     — silent; result stored only in TaskRecord
 *
 * IMPORTANT: Delivery failures are tracked separately from job execution
 * failures. A job can succeed but its delivery can fail — these have
 * independent retry paths and must NEVER trigger the job's backoff ladder.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { CronJobV2, TaskRecord, CronStore } from "./cron-store.js";

// ─── Webhook retry config (independent of job backoff) ───────────────────────

const WEBHOOK_RETRY_DELAYS_MS = [5_000, 30_000, 120_000];  // 5s → 30s → 2m

// ─── Delivery Result ──────────────────────────────────────────────────────────

export interface DeliveryResult {
  status: "delivered" | "failed" | "skipped";
  attempts: number;
  error?: string;
}

// ─── Delivery Router ──────────────────────────────────────────────────────────

/**
 * Route the job's output to the configured delivery channel.
 * Updates the TaskRecord's deliveryStatus in the store.
 * Never throws — delivery errors are logged and returned, not escalated.
 */
export async function deliverJobOutput(
  job: CronJobV2,
  task: TaskRecord,
  output: string,
  store: CronStore,
  wsServer: any,
  resolvedChatId: number
): Promise<DeliveryResult> {
  let result: DeliveryResult;

  switch (job.deliveryMode) {
    case "announce":
      result = await deliverAnnounce(job, task, output, wsServer, resolvedChatId);
      break;
    case "webhook":
      result = await deliverWebhook(job, task, output, store);
      break;
    case "none":
    default:
      result = { status: "skipped", attempts: 0 };
      break;
  }

  // Update task record delivery status (non-blocking)
  store.updateTaskStatus(task.taskId, {
    deliveryStatus: result.status,
    deliveryAttempts: result.attempts,
  });

  if (result.status === "failed") {
    console.warn(`[CronDelivery] ⚠️  Delivery FAILED for job "${job.name}" (mode: ${job.deliveryMode}): ${result.error}`);
  } else if (result.status === "delivered") {
    console.log(`[CronDelivery] ✅ Delivered output for job "${job.name}" (mode: ${job.deliveryMode})`);
  }

  return result;
}

// ─── Announce Mode ────────────────────────────────────────────────────────────

async function deliverAnnounce(
  job: CronJobV2,
  task: TaskRecord,
  output: string,
  wsServer: any,
  resolvedChatId: number
): Promise<DeliveryResult> {
  if (!wsServer || resolvedChatId === 0) {
    return { status: "failed", attempts: 1, error: "No WS server or chat ID for announce delivery" };
  }

  const nowStr = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: job.timezone ?? "Asia/Kolkata",
  });

  const cleanOutput = output
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
    .replace(/^\n+|\n+$/g, "")
    .trim();

  const fullMessage = [
    `🤖 *${job.agentId}*`,
    `⏰ _Auto-run at ${nowStr}_`,
    `📋 *${job.name}*`,
    `━━━━━━━━━━━━━━━`,
    cleanOutput || "_Agent completed run but produced no text reply._",
  ].join("\n");

  // Chunking: Telegram max 4096 chars
  const MAX_CHUNK = 4000;
  const chunks: string[] = [];
  if (fullMessage.length > MAX_CHUNK) {
    for (let i = 0; i < fullMessage.length; i += MAX_CHUNK) {
      chunks.push(fullMessage.slice(i, i + MAX_CHUNK));
    }
  } else {
    chunks.push(fullMessage);
  }

  try {
    for (const chunk of chunks) {
      await wsServer.sendDirectTelegram(job.agentId, resolvedChatId, chunk);
    }
    return { status: "delivered", attempts: 1 };
  } catch (err: any) {
    return { status: "failed", attempts: 1, error: err.message };
  }
}

// ─── Webhook Mode ─────────────────────────────────────────────────────────────

async function deliverWebhook(
  job: CronJobV2,
  task: TaskRecord,
  output: string,
  store: CronStore
): Promise<DeliveryResult> {
  const url = job.webhookUrl;
  const token = job.webhookToken;

  if (!url) {
    return { status: "failed", attempts: 0, error: "No webhookUrl configured for webhook delivery mode" };
  }

  const body = JSON.stringify({
    jobId: job.id,
    jobName: job.name,
    agentId: job.agentId,
    taskId: task.taskId,
    scheduledFireTime: task.scheduledFireTime,
    completedAt: task.completedAt ?? Date.now(),
    output,
    idempotencyKey: task.idempotencyKey,
  });

  let lastError = "";
  const totalAttempts = WEBHOOK_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Komorebi-Job-Id": job.id,
        "X-Komorebi-Idempotency-Key": task.idempotencyKey,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        return { status: "delivered", attempts: attempt };
      }
      lastError = `HTTP ${res.status} ${res.statusText}`;
    } catch (err: any) {
      lastError = err.message || "Network error";
    }

    if (attempt < totalAttempts) {
      const delay = WEBHOOK_RETRY_DELAYS_MS[attempt - 1];
      console.warn(`[CronDelivery] Webhook delivery attempt ${attempt} failed for "${job.name}": ${lastError}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { status: "failed", attempts: totalAttempts, error: lastError };
}

// ─── Chat ID resolution ───────────────────────────────────────────────────────

/**
 * Resolve the Telegram chat ID to use for announce delivery.
 * Checks job.channel, then global config allowedTelegramChatIds, then
 * per-agent bot config.
 */
export function resolveAnnounceChatId(
  job: CronJobV2,
  ownerChatId: number | null,
  wsServer: any
): number {
  if (job.channel && /^\d+$/.test(job.channel)) {
    return parseInt(job.channel, 10);
  }

  if (ownerChatId) return ownerChatId;

  if (wsServer) {
    const cfg = wsServer.globalConfig as any;
    const allowed = cfg?.allowedTelegramChatIds;
    if (allowed && allowed.length > 0) return Number(allowed[0]);

    const botCfg = cfg?.telegram?.bots?.find((b: any) => b.agentId === job.agentId);
    if (botCfg?.allowedUserIds?.length > 0) return Number(botCfg.allowedUserIds[0]);
  }

  return 0;
}

// ─── Failure notify ───────────────────────────────────────────────────────────

/** Send a Telegram alert when a job execution fails (not delivery). */
export async function notifyJobFailure(
  job: CronJobV2,
  errorMsg: string,
  consecutiveFailures: number,
  wsServer: any,
  resolvedChatId: number
): Promise<void> {
  if (!wsServer || resolvedChatId === 0) return;
  const backoffLabels = ["30s", "1m", "5m", "15m", "60m"];
  const backoffInfo = consecutiveFailures <= 5
    ? `⏳ Next retry in ${backoffLabels[consecutiveFailures - 1] ?? "—"}`
    : "🚨 Job escalated to Self-Healing — auto-retry stopped";

  await wsServer.sendDirectTelegram(
    job.agentId,
    resolvedChatId,
    `❌ *Cron job failed* (#${consecutiveFailures})\n📋 *${job.name}*\n🤖 Agent: ${job.agentId}\n⚠️ Error: ${errorMsg}\n${backoffInfo}`
  ).catch(() => {});
}
