/**
 * cron-boundary-validator.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Startup validation: enforces clear boundaries between
 *   Cron  — precise timing or isolated execution required
 *   Heartbeat — full session context, approximate timing fine (~30min)
 *   Hooks — react to in-process events (session reset, compaction, tool calls)
 *
 * Logs warnings but never blocks startup. Operators can choose to ignore.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import type { CronJobV2 } from "./cron-store.js";

export interface BoundaryWarning {
  jobId: string;
  jobName: string;
  issue: string;
  suggestion: string;
  severity: "warning" | "info";
}

/**
 * Compute the approximate cron frequency in minutes.
 * Returns Infinity for one-shot or unparseable expressions.
 */
function cronFrequencyMinutes(schedule: string): number {
  // One-shot
  if (schedule.includes("T") || schedule.match(/^\d{4}-\d{2}-\d{2}/)) return Infinity;

  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return Infinity;

  const [minExpr, hrExpr, domExpr, monExpr] = fields;

  // Every minute
  if (minExpr === "*") return 1;

  // */N minute
  if (minExpr.startsWith("*/")) {
    const n = parseInt(minExpr.slice(2), 10);
    if (!isNaN(n)) return n;
  }

  // Hourly (*/N hour, specific minute)
  if (hrExpr.startsWith("*/")) {
    const n = parseInt(hrExpr.slice(2), 10);
    if (!isNaN(n)) return n * 60;
  }

  // Specific hour + minute → daily-ish
  if (!minExpr.includes("*") && !hrExpr.includes("*")) {
    return 24 * 60;
  }

  return 60; // default estimate
}

/**
 * Validate all loaded jobs against the Cron/Heartbeat/Hook boundary rules.
 * Prints warnings to console and returns them for dashboard display.
 */
export function validateCronBoundaries(jobs: CronJobV2[]): BoundaryWarning[] {
  const warnings: BoundaryWarning[] = [];

  for (const job of jobs) {
    if (!job.enabled) continue;

    const freqMin = cronFrequencyMinutes(job.schedule ?? job.expression ?? "");

    // Rule 1: Every-minute cron that isn't a command → should be a Heartbeat
    if (freqMin === 1 && job.type !== "command") {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: "Job runs every minute with type 'session' or 'isolated'",
        suggestion: "Consider converting to a Heartbeat task (uses full session context, ~30 min interval, lower overhead) or change type to 'command' for lightweight monitoring",
        severity: "warning",
      });
    }

    // Rule 2: High-frequency session jobs waste context history
    if (freqMin <= 5 && freqMin > 1 && job.type === "session") {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: `Job runs every ${freqMin} minutes as type 'session' — accumulates context rapidly`,
        suggestion: "For high-frequency polling, use type 'isolated' (fresh context per run) or 'command'. Reserve 'session' for infrequent jobs that benefit from conversation history.",
        severity: "warning",
      });
    }

    // Rule 3: Every-minute session jobs on Pi 5 will starve CPU
    if (freqMin <= 2 && job.type === "session") {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: `Very high frequency (every ${freqMin} min) session job on constrained hardware`,
        suggestion: "On Raspberry Pi 5, running full agent reasoning loops more than once every 5 minutes per agent may cause CPU/RAM saturation. Use type 'command' or a longer schedule.",
        severity: "warning",
      });
    }

    // Rule 4: Webhook delivery with no webhookUrl
    if (job.deliveryMode === "webhook" && !job.webhookUrl) {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: "Delivery mode is 'webhook' but no webhookUrl is configured",
        suggestion: "Set webhookUrl in the job configuration, or change deliveryMode to 'announce' or 'none'.",
        severity: "warning",
      });
    }

    // Rule 5: Command type with non-command payload that looks like a prompt
    if (job.type === "command" && (job.payload ?? job.prompt ?? "").length > 200) {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: "Type 'command' job has a very long payload — command jobs run shell/tool commands, not agent prompts",
        suggestion: "If this is an agent instruction, change type to 'session' or 'isolated'.",
        severity: "info",
      });
    }

    // Rule 6: Isolated job with dynamicPayload — pointless since there's no session memory to draw from
    if (job.type === "isolated" && job.dynamicPayload) {
      warnings.push({
        jobId: job.id,
        jobName: job.name,
        issue: "Dynamic payload generation uses session context, but type is 'isolated' (fresh context per run)",
        suggestion: "For dynamic prompts that need session history, use type 'session'. For isolated runs, use a static payload.",
        severity: "info",
      });
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n[CronBoundaryValidator] ⚠️  ${warnings.length} boundary warning(s) detected:`);
    for (const w of warnings) {
      console.warn(`  [${w.severity.toUpperCase()}] "${w.jobName}": ${w.issue}`);
      console.warn(`    → ${w.suggestion}`);
    }
    console.warn("");
  } else {
    console.log("[CronBoundaryValidator] ✅ All cron jobs pass boundary validation");
  }

  return warnings;
}
