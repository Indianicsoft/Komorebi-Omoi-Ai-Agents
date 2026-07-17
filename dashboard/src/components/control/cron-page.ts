import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

// ─── Types (mirror of cron-store.ts) ─────────────────────────────────────────

type JobType       = "session" | "isolated" | "command";
type DeliveryMode  = "announce" | "webhook" | "none";
type JobStatus     = "active" | "backoff" | "failing" | "disabled" | "completed";

interface CronJob {
  id: string;
  name: string;
  agentId: string;
  schedule: string;
  timezone: string;
  type: JobType;
  payload: string;
  dynamicPayload?: boolean;
  deliveryMode: DeliveryMode;
  channel?: string;
  webhookUrl?: string;
  webhookToken: string;
  enabled: boolean;
  status: JobStatus;
  createdAt: number;
  lastRun: number | null;
  nextRun: number | null;
  consecutiveFailures: number;
  backoffUntil: number | null;
  humanSchedule?: string;
  isRunning?: boolean;
  // legacy compat
  expression?: string;
  prompt?: string;
}

interface TaskRecord {
  taskId: string;
  jobId: string;
  jobName: string;
  agentId: string;
  scheduledFireTime: number;
  actualFireTime: number;
  driftMs: number;
  startedAt: number;
  completedAt: number | null;
  status: "running" | "completed" | "failed" | "resumed" | "delivery_failed";
  output: string | null;
  deliveryStatus: "pending" | "delivered" | "failed" | "skipped";
  deliveryAttempts: number;
  idempotencyKey: string;
  isManualTrigger: boolean;
}

interface DriftReport {
  samples: Array<{ timestamp: number; jobId: string; driftMs: number }>;
  avgDriftMs: number;
  maxDriftMs: number;
  p95DriftMs: number;
}

interface BoundaryWarning {
  jobId: string;
  jobName: string;
  issue: string;
  suggestion: string;
  severity: "warning" | "info";
}


const TIMEZONES = [
  "UTC", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles",
  "America/Chicago", "Australia/Sydney", "Pacific/Auckland",
];

@customElement("cron-page")
export class CronPage extends LitElement {
  @state() private jobs: CronJob[] = [];
  @state() private selectedJob: CronJob | null = null;
  @state() private selectedJobTasks: TaskRecord[] = [];
  @state() private isEditing = false;
  @state() private agents: any[] = [];
  @state() private liveNotification: string | null = null;
  @state() private isGeneratingPrompt = false;
  @state() private revealWebhookToken = false;
  @state() private driftReport: DriftReport | null = null;
  @state() private boundaryWarnings: BoundaryWarning[] = [];
  @state() private schedulePreview = "";
  @state() private scheduleValid = true;
  @state() private activeTab: "details" | "tasks" | "delivery" = "details";

  // Form fields
  @state() private formId = "";
  @state() private formName = "";
  @state() private formAgentId = "";
  @state() private formSchedule = "0 9 * * *";
  @state() private formTimezone = "Asia/Kolkata";
  @state() private formType: JobType = "session";
  @state() private formPayload = "";
  @state() private formDynamicPayload = false;
  @state() private formDeliveryMode: DeliveryMode = "announce";
  @state() private formChannel = "";
  @state() private formWebhookUrl = "";
  @state() private formWebhookToken = "";
  @state() private formEnabled = true;

  private wsClient = WsClient.getInstance();
  private busListener?: (event: string, data: any) => void;
  private refreshTimer?: number;
  private countdownTimer?: number;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Layout ── */
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 1.25rem;
      align-items: start;
    }

    /* ── Panels ── */
    .panel {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.25rem;
    }
    .panel-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    /* ── Job Cards ── */
    .job-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .job-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.85rem 1rem;
      cursor: pointer;
      transition: all 0.18s;
      position: relative;
    }
    .job-card:hover { border-color: var(--accent-primary); transform: translateY(-1px); }
    .job-card.selected { border-color: var(--accent-primary); box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
    .job-card.running {
      border-color: #f59e0b;
      animation: pulse-border 1.5s ease-in-out infinite;
    }
    @keyframes pulse-border {
      0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
      50%      { box-shadow: 0 0 0 4px rgba(245,158,11,0.1); }
    }
    .job-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
    .job-name { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
    .job-badges { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
    .job-meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem; margin-top: 0.25rem; }
    .job-meta strong { color: var(--text-secondary); }
    .next-run { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; }

    /* ── Badges ── */
    .badge {
      font-size: 0.68rem; font-weight: 700;
      padding: 0.12rem 0.45rem; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-active   { background: rgba(16,185,129,0.15); color: #10b981; }
    .badge-disabled { background: rgba(100,116,139,0.1); color: var(--text-muted); }
    .badge-backoff  { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-failing  { background: rgba(239,68,68,0.15);  color: #ef4444; }
    .badge-running  { background: rgba(245,158,11,0.2);  color: #f59e0b; }
    .badge-session  { background: rgba(99,102,241,0.12); color: var(--accent-primary); }
    .badge-isolated { background: rgba(139,92,246,0.12); color: #8b5cf6; }
    .badge-command  { background: rgba(20,184,166,0.12); color: #14b8a6; }
    .badge-announce { background: rgba(59,130,246,0.12); color: #3b82f6; }
    .badge-webhook  { background: rgba(168,85,247,0.12); color: #a855f7; }
    .badge-none     { background: rgba(100,116,139,0.08); color: var(--text-muted); }

    /* ── Tabs ── */
    .tabs {
      display: flex; gap: 0; border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    .tab {
      padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; border-bottom: 2px solid transparent;
      color: var(--text-muted); transition: all 0.15s;
    }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: var(--accent-primary); border-bottom-color: var(--accent-primary); }

    /* ── Forms ── */
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem; }
    label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
    input, select, textarea {
      background: var(--bg-primary); border: 1px solid var(--border-color);
      border-radius: 6px; color: var(--text-primary);
      padding: 0.45rem 0.6rem; outline: none;
      font-size: 0.88rem; font-family: var(--font-sans);
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent-primary); }
    input.invalid { border-color: #ef4444 !important; }
    textarea { resize: vertical; min-height: 75px; }
    .schedule-preview {
      font-size: 0.75rem; padding: 0.3rem 0.5rem;
      border-radius: 4px; margin-top: 0.2rem;
    }
    .schedule-preview.valid   { background: rgba(16,185,129,0.1); color: #10b981; }
    .schedule-preview.invalid { background: rgba(239,68,68,0.1);   color: #ef4444; }
    .type-grid {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 0.4rem;
    }
    .type-btn {
      padding: 0.5rem 0.3rem; border: 1px solid var(--border-color);
      border-radius: 6px; cursor: pointer; text-align: center;
      font-size: 0.78rem; font-weight: 600; transition: all 0.15s;
      background: var(--bg-tertiary); color: var(--text-secondary);
    }
    .type-btn:hover { border-color: var(--accent-primary); }
    .type-btn.selected { border-color: var(--accent-primary); background: rgba(99,102,241,0.12); color: var(--accent-primary); }
    .delivery-grid {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 0.4rem;
    }
    .delivery-btn {
      padding: 0.45rem 0.3rem; border: 1px solid var(--border-color);
      border-radius: 6px; cursor: pointer; text-align: center;
      font-size: 0.78rem; font-weight: 600; transition: all 0.15s;
      background: var(--bg-tertiary); color: var(--text-secondary);
    }
    .delivery-btn.selected { border-color: var(--accent-primary); background: rgba(99,102,241,0.12); color: var(--accent-primary); }

    /* ── Buttons ── */
    .btn {
      background: var(--bg-tertiary); border: 1px solid var(--border-color);
      color: var(--text-primary); padding: 0.38rem 0.75rem;
      border-radius: 6px; cursor: pointer; font-weight: 500;
      font-size: 0.83rem; transition: all 0.18s;
    }
    .btn:hover { background: var(--border-color); }
    .btn-primary { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; }
    .btn-primary:hover { opacity: 0.88; }
    .btn-danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
    .btn-danger:hover { background: rgba(239,68,68,0.1); }
    .btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
    .btn-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* ── Task history ── */
    .task-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 260px; overflow-y: auto; }
    .task-item {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 0.45rem 0.6rem;
      background: var(--bg-primary); border-radius: 5px;
      font-size: 0.75rem; border-left: 3px solid var(--border-color);
    }
    .task-item.completed { border-left-color: #10b981; }
    .task-item.failed    { border-left-color: #ef4444; }
    .task-item.running   { border-left-color: #f59e0b; }
    .task-item.resumed   { border-left-color: #8b5cf6; }
    .task-drift { font-size: 0.68rem; color: var(--text-muted); }
    .task-drift.high { color: #f59e0b; }

    /* ── Drift monitor ── */
    .drift-widget {
      background: var(--bg-tertiary); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 0.85rem; margin-top: 0.75rem;
    }
    .drift-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .drift-title { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); }
    .drift-stats { display: flex; gap: 1rem; font-size: 0.75rem; }
    .drift-stat { display: flex; flex-direction: column; align-items: center; }
    .drift-stat-val { font-size: 1rem; font-weight: 700; color: var(--accent-primary); }
    .drift-stat-lbl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; }
    .drift-bar-container { display: flex; gap: 2px; height: 32px; align-items: flex-end; margin-top: 0.5rem; }
    .drift-bar { flex: 1; background: rgba(99,102,241,0.4); border-radius: 2px 2px 0 0; min-height: 2px; transition: height 0.3s; }
    .drift-bar.high { background: rgba(245,158,11,0.7); }
    .drift-bar.critical { background: rgba(239,68,68,0.7); }

    /* ── Warnings ── */
    .warning-badge {
      background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3);
      border-radius: 6px; padding: 0.5rem 0.75rem;
      font-size: 0.78rem; color: #f59e0b; margin-bottom: 0.5rem;
    }
    .warning-badge details summary { cursor: pointer; font-weight: 600; }
    .warning-badge .suggestion { color: var(--text-secondary); margin-top: 0.3rem; font-style: italic; }

    /* ── Backoff state ── */
    .backoff-visual {
      display: flex; gap: 0.3rem; align-items: center;
      margin: 0.5rem 0; flex-wrap: wrap;
    }
    .backoff-step {
      font-size: 0.7rem; padding: 0.15rem 0.4rem;
      border-radius: 4px; border: 1px solid var(--border-color);
      color: var(--text-muted);
    }
    .backoff-step.done    { background: rgba(239,68,68,0.12); color: #ef4444; border-color: rgba(239,68,68,0.3); }
    .backoff-step.current { background: rgba(245,158,11,0.15); color: #f59e0b; border-color: rgba(245,158,11,0.4); font-weight: 700; }
    .backoff-step.pending { opacity: 0.4; }

    /* ── Webhook section ── */
    .webhook-box {
      background: var(--bg-tertiary); border: 1px dashed var(--border-color);
      border-radius: 6px; padding: 0.75rem; display: flex;
      flex-direction: column; gap: 0.5rem;
    }
    .mono { font-family: var(--font-mono); font-size: 0.78rem; word-break: break-all; }

    /* ── Notifications ── */
    .live-notification {
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
      border: 1px solid rgba(99,102,241,0.4); border-radius: 8px;
      padding: 0.55rem 1rem; font-size: 0.85rem; color: var(--text-primary);
      display: flex; align-items: center; gap: 0.5rem;
      animation: slide-in 0.3s ease;
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadAll();
    this.subscribeToBusEvents();
    this.refreshTimer  = window.setInterval(() => this.loadAll(), 30_000);
    this.countdownTimer = window.setInterval(() => this.requestUpdate(), 5_000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.busListener) this.wsClient.removeEventListener(this.busListener);
    if (this.refreshTimer)  clearInterval(this.refreshTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private subscribeToBusEvents() {
    this.busListener = (event: string, data: any) => {
      if (event !== "cron_event") return;
      const evt  = data?.event;
      const eData = data?.data;
      if (evt === "cron_started") {
        this.showNotification(`⚡ Running: "${eData?.name}"`);
        this.loadAll();
      } else if (evt === "cron_completed") {
        const ok = eData?.success ? "✅" : "❌";
        this.showNotification(`${ok} "${eData?.name}" (${eData?.durationMs}ms)`);
        this.loadAll();
        if (this.selectedJob?.id === eData?.jobId) this.loadTasks(eData.jobId);
      }
    };
    this.wsClient.addEventListener(this.busListener);
  }

  private showNotification(msg: string) {
    this.liveNotification = msg;
    setTimeout(() => { if (this.liveNotification === msg) this.liveNotification = null; }, 5000);
  }

  private async loadAll() {
    try {
      const [jobs, configData, drift, warnings] = await Promise.allSettled([
        this.wsClient.send<CronJob[]>("listCronJobs"),
        this.wsClient.send<any>("getSystemConfig"),
        this.wsClient.send<DriftReport>("getCronDriftReport"),
        this.wsClient.send<{warnings: BoundaryWarning[]}>("getCronBoundaryWarnings"),
      ]);
      if (jobs.status === "fulfilled") {
        this.jobs = jobs.value;
        if (this.selectedJob) {
          const refreshed = this.jobs.find(j => j.id === this.selectedJob!.id);
          if (refreshed) this.selectedJob = refreshed;
        }
      }
      if (configData.status === "fulfilled") {
        this.agents = configData.value?.config?.agents ?? [];
        if (this.agents.length && !this.formAgentId) this.formAgentId = this.agents[0].id;
      }
      if (drift.status === "fulfilled") this.driftReport = drift.value;
      if (warnings.status === "fulfilled") this.boundaryWarnings = warnings.value?.warnings ?? [];
    } catch (err) {
      console.error("[CronPage] loadAll failed:", err);
    }
  }

  private async loadTasks(jobId: string) {
    try {
      const res = await this.wsClient.send<{tasks: TaskRecord[]}>("getCronTasks", { jobId });
      this.selectedJobTasks = (res?.tasks ?? []).reverse();
    } catch { this.selectedJobTasks = []; }
  }

  private async selectJob(job: CronJob) {
    this.selectedJob = job;
    this.isEditing = false;
    this.revealWebhookToken = false;
    this.activeTab = "details";
    await this.loadTasks(job.id);
  }

  private startNewJob() {
    this.selectedJob = null;
    this.isEditing = true;
    this.formId = crypto.randomUUID();
    this.formName = "";
    this.formAgentId = this.agents[0]?.id ?? "";
    this.formSchedule = "0 9 * * *";
    this.formTimezone = "Asia/Kolkata";
    this.formType = "session";
    this.formPayload = "";
    this.formDynamicPayload = false;
    this.formDeliveryMode = "announce";
    this.formChannel = "";
    this.formWebhookUrl = "";
    this.formWebhookToken = `kore_${Math.random().toString(36).slice(2, 14)}`;
    this.formEnabled = true;
    this.schedulePreview = "";
    this.scheduleValid = true;
  }

  private editJob(job: CronJob) {
    this.isEditing = true;
    this.formId = job.id;
    this.formName = job.name;
    this.formAgentId = job.agentId;
    this.formSchedule = job.schedule ?? job.expression ?? "";
    this.formTimezone = job.timezone ?? "Asia/Kolkata";
    this.formType = job.type ?? "session";
    this.formPayload = job.payload ?? job.prompt ?? "";
    this.formDynamicPayload = !!job.dynamicPayload;
    this.formDeliveryMode = job.deliveryMode ?? "announce";
    this.formChannel = job.channel ?? "";
    this.formWebhookUrl = job.webhookUrl ?? "";
    this.formWebhookToken = job.webhookToken ?? "";
    this.formEnabled = job.enabled;
    this.validateSchedule(this.formSchedule);
  }

  private async validateSchedule(schedule: string) {
    this.formSchedule = schedule;
    if (!schedule) { this.schedulePreview = ""; return; }
    try {
      const res = await this.wsClient.send<{valid: boolean; human: string | null}>(
        "validateCronSchedule", { schedule, timezone: this.formTimezone }
      );
      this.scheduleValid = res.valid;
      this.schedulePreview = res.valid ? (res.human ?? schedule) : "Invalid cron expression";
    } catch { this.schedulePreview = ""; }
  }

  private async saveJob() {
    if (!this.formName || !this.formSchedule || !this.formPayload) {
      alert("Please fill in Name, Schedule, and Payload/Command."); return;
    }
    if (!this.scheduleValid) { alert("Please enter a valid cron expression."); return; }

    const job = {
      id: this.formId,
      name: this.formName,
      agentId: this.formAgentId,
      schedule: this.formSchedule,
      timezone: this.formTimezone,
      type: this.formType,
      payload: this.formPayload,
      dynamicPayload: this.formDynamicPayload,
      deliveryMode: this.formDeliveryMode,
      channel: this.formChannel || undefined,
      webhookUrl: this.formWebhookUrl || undefined,
      webhookToken: this.formWebhookToken,
      enabled: this.formEnabled,
      status: this.formEnabled ? "active" : "disabled",
      createdAt: Date.now(),
      // legacy compat
      expression: this.formSchedule,
      prompt: this.formPayload,
    };

    try {
      await this.wsClient.send("saveCronJob", { job });
      this.isEditing = false;
      await this.loadAll();
      const saved = this.jobs.find(j => j.id === this.formId);
      if (saved) this.selectJob(saved);
    } catch (err: any) {
      alert(`Error saving job: ${err.message}`);
    }
  }

  private async deleteJob(id: string) {
    if (!confirm("Delete this cron job? This cannot be undone.")) return;
    await this.wsClient.send("deleteCronJob", { jobId: id });
    this.selectedJob = null;
    this.loadAll();
  }

  private async runNow(id: string) {
    try {
      await this.wsClient.send("runCronJob", { jobId: id });
      this.showNotification("⚡ Manual trigger sent");
      this.loadAll();
    } catch (err: any) { alert(`Trigger failed: ${err.message}`); }
  }

  private async toggleEnabled(job: CronJob) {
    const rpc = job.enabled ? "disableCronJob" : "enableCronJob";
    await this.wsClient.send(rpc, { jobId: job.id });
    this.loadAll();
  }

  private async generatePayloadWithAI() {
    const userInput = prompt("Briefly describe what this cron job should do:");
    if (!userInput?.trim()) return;
    this.isGeneratingPrompt = true;
    try {
      const res = await this.wsClient.send<any>("queryAgentModel", {
        agentId: this.formAgentId,
        systemInstruction: "Write a detailed, operational step-by-step cron task prompt for an autonomous AI agent. Be concise and direct.",
        prompt: userInput.trim(),
      });
      if (res.success && res.text) this.formPayload = res.text.trim();
      else alert("AI generation returned an empty response.");
    } catch (err: any) { alert(`AI error: ${err.message}`); }
    finally { this.isGeneratingPrompt = false; }
  }

  private formatRelative(ts: number | null | undefined): string {
    if (!ts) return "—";
    const diff = ts - Date.now();
    if (Math.abs(diff) < 5000) return "now";
    const abs = Math.abs(diff);
    const ago = diff < 0;
    const m = Math.floor(abs / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const str = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m` : "<1 min";
    return ago ? `${str} ago` : `in ${str}`;
  }

  private formatTs(ts: number | null | undefined): string {
    if (!ts) return "Never";
    return new Date(ts).toLocaleString();
  }

  private getStatusBadgeClass(job: CronJob): string {
    if (job.isRunning) return "badge-running";
    return {
      active: "badge-active", backoff: "badge-backoff",
      failing: "badge-failing", disabled: "badge-disabled", completed: "badge-active"
    }[job.status] ?? "badge-disabled";
  }

  private getStatusLabel(job: CronJob): string {
    if (job.isRunning) return "RUNNING";
    return { active: "ACTIVE", backoff: "BACKOFF", failing: "FAILING",
             disabled: "DISABLED", completed: "DONE" }[job.status] ?? job.status.toUpperCase();
  }

  private getGatewayBaseUrl(): string {
    const { protocol, hostname, port } = window.location;
    return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">⏰ Cron Scheduler</div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn" @click=${() => this.loadAll()}>↻ Refresh</button>
          <button class="btn btn-primary" @click=${this.startNewJob}>➕ New Job</button>
        </div>
      </div>

      ${this.liveNotification ? html`
        <div class="live-notification">🔔 ${this.liveNotification}</div>` : ""}

      ${this.boundaryWarnings.length > 0 ? html`
        <div>
          ${this.boundaryWarnings.map(w => html`
            <div class="warning-badge">
              <details>
                <summary>⚠️ <strong>${w.jobName}</strong>: ${w.issue}</summary>
                <div class="suggestion">💡 ${w.suggestion}</div>
              </details>
            </div>
          `)}
        </div>` : ""}

      <div class="layout">
        <!-- Job list -->
        <div>
          <div class="job-list">
            ${this.jobs.length === 0 ? html`
              <div style="text-align:center;color:var(--text-muted);padding:3rem">
                No cron jobs configured. Click <strong>New Job</strong> to create one.
              </div>` : this.jobs.map(job => html`
              <div
                class="job-card ${this.selectedJob?.id === job.id ? "selected" : ""} ${job.isRunning ? "running" : ""}"
                @click=${() => this.selectJob(job)}
              >
                <div class="job-card-top">
                  <span class="job-name">${job.name}</span>
                  <div class="job-badges">
                    ${job.isRunning ? html`<span class="badge badge-running">RUNNING</span>` : ""}
                    <span class="badge ${this.getStatusBadgeClass(job)}">${this.getStatusLabel(job)}</span>
                    <span class="badge badge-${job.type ?? "session"}">${(job.type ?? "session").toUpperCase()}</span>
                    <span class="badge badge-${job.deliveryMode ?? "none"}">${(job.deliveryMode ?? "none").toUpperCase()}</span>
                  </div>
                </div>
                <div class="job-meta">
                  <span>🤖 <strong>${job.agentId}</strong></span>
                  <span style="font-family:var(--font-mono)">${job.schedule ?? job.expression}</span>
                  ${job.consecutiveFailures > 0 ? html`<span style="color:#ef4444">⚠️ ${job.consecutiveFailures} failure(s)</span>` : ""}
                </div>
                ${job.enabled && job.nextRun ? html`
                  <div class="next-run">⏰ Next: <strong>${this.formatRelative(job.nextRun)}</strong>
                    <span style="opacity:0.6">· ${this.formatTs(job.nextRun)}</span>
                  </div>` : ""}
                ${job.humanSchedule ? html`<div style="font-size:0.73rem;color:var(--text-muted);margin-top:0.2rem">📅 ${job.humanSchedule}</div>` : ""}
              </div>
            `)}
          </div>

          ${this.renderDriftWidget()}
        </div>

        <!-- Detail / form panel -->
        <div class="panel" style="position:sticky;top:1rem">
          ${this.isEditing ? this.renderForm() : this.renderDetails()}
        </div>
      </div>
    `;
  }

  private renderDriftWidget() {
    if (!this.driftReport) return html``;
    const r = this.driftReport;
    const samples = r.samples.slice(-40);
    const maxDrift = Math.max(...samples.map(s => s.driftMs), 1);
    const WARN = 3000; const CRIT = 5000;
    return html`
      <div class="drift-widget">
        <div class="drift-header">
          <span class="drift-title">📊 Scheduler Drift (24h)</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${samples.length} samples</span>
        </div>
        <div class="drift-stats">
          <div class="drift-stat">
            <span class="drift-stat-val" style="${r.avgDriftMs > WARN ? "color:#f59e0b" : ""}">${r.avgDriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">avg</span>
          </div>
          <div class="drift-stat">
            <span class="drift-stat-val" style="${r.p95DriftMs > CRIT ? "color:#ef4444" : ""}">${r.p95DriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">p95</span>
          </div>
          <div class="drift-stat">
            <span class="drift-stat-val" style="${r.maxDriftMs > CRIT ? "color:#ef4444" : ""}">${r.maxDriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">max</span>
          </div>
        </div>
        ${samples.length > 0 ? html`
          <div class="drift-bar-container">
            ${samples.map(s => {
              const pct = Math.min((s.driftMs / maxDrift) * 100, 100);
              const cls = s.driftMs > CRIT ? "critical" : s.driftMs > WARN ? "high" : "";
              return html`<div class="drift-bar ${cls}" style="height:${Math.max(pct, 4)}%;" title="${s.driftMs}ms"></div>`;
            })}
          </div>
          ${r.avgDriftMs > WARN ? html`
            <div style="font-size:0.73rem;color:#f59e0b;margin-top:0.4rem">
              ⚠️ High drift detected — possible Pi 5 CPU contention. Run <code>komorebi cron drift-report</code> for details.
            </div>` : ""}
        ` : html`<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.5rem">No samples yet</div>`}
      </div>
    `;
  }

  private renderDetails() {
    if (!this.selectedJob) {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text-muted);font-size:0.9rem;text-align:center">
          Select a job from the list to view details, task history, and delivery config.
        </div>`;
    }

    const job = this.selectedJob;

    return html`
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div style="border-bottom:1px solid var(--border-color);padding-bottom:0.6rem">
          <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">${job.name}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);font-family:var(--font-mono)">ID: ${job.id}</div>
        </div>

        <div class="tabs">
          ${(["details", "tasks", "delivery"] as const).map(tab => html`
            <div class="tab ${this.activeTab === tab ? "active" : ""}" @click=${() => this.activeTab = tab}>
              ${{ details: "Details", tasks: "Task History", delivery: "Delivery" }[tab]}
            </div>`)}
        </div>

        ${this.activeTab === "details"   ? this.renderJobDetails(job) : ""}
        ${this.activeTab === "tasks"     ? this.renderTaskHistory() : ""}
        ${this.activeTab === "delivery"  ? this.renderDeliveryConfig(job) : ""}

        <div class="btn-row" style="margin-top:0.5rem">
          <button class="btn btn-primary" style="flex:1" @click=${() => this.runNow(job.id)}>⚡ Run Now</button>
          <button class="btn" @click=${() => this.editJob(job)}>✏️ Edit</button>
          <button class="btn" @click=${() => this.toggleEnabled(job)}>
            ${job.enabled ? "⏸ Disable" : "▶ Enable"}
          </button>
          <button class="btn btn-danger" @click=${() => this.deleteJob(job.id)}>✕</button>
        </div>
      </div>
    `;
  }

  private renderJobDetails(job: CronJob) {
    const backoffLabels = ["30s", "1m", "5m", "15m", "60m"];
    return html`
      <div style="display:flex;flex-direction:column;gap:0.6rem;font-size:0.85rem">
        <div><span style="color:var(--text-muted)">Agent:</span> <strong>${job.agentId}</strong></div>
        <div><span style="color:var(--text-muted)">Type:</span> <span class="badge badge-${job.type}">${job.type}</span></div>
        <div><span style="color:var(--text-muted)">Status:</span> <span class="badge ${this.getStatusBadgeClass(job)}">${this.getStatusLabel(job)}</span></div>
        <div><span style="color:var(--text-muted)">Schedule:</span> <code style="font-family:var(--font-mono);color:var(--accent-primary)">${job.schedule ?? job.expression}</code></div>
        <div><span style="color:var(--text-muted)">Timezone:</span> ${job.timezone}</div>
        ${job.humanSchedule ? html`<div style="color:var(--text-muted);font-style:italic">${job.humanSchedule}</div>` : ""}
        ${job.nextRun ? html`
          <div style="background:var(--bg-tertiary);padding:0.5rem;border-radius:6px">
            ⏰ Next Run: <strong>${this.formatTs(job.nextRun)}</strong>
            <span style="color:var(--text-muted)">(${this.formatRelative(job.nextRun)})</span>
          </div>` : ""}
        <div><span style="color:var(--text-muted)">Last Run:</span> ${this.formatTs(job.lastRun)}</div>

        ${job.consecutiveFailures > 0 ? html`
          <div>
            <div style="color:var(--text-muted);margin-bottom:0.3rem">Backoff State (${job.consecutiveFailures} failures):</div>
            <div class="backoff-visual">
              ${backoffLabels.map((lbl, i) => {
                const f = job.consecutiveFailures;
                const cls = i < f - 1 ? "done" : i === f - 1 ? "current" : "pending";
                return html`<div class="backoff-step ${cls}">${lbl}</div>`;
              })}
              <div class="backoff-step ${job.consecutiveFailures >= 5 ? "done" : "pending"}" style="${job.consecutiveFailures >= 5 ? "color:#ef4444" : ""}">escalate</div>
            </div>
            ${job.backoffUntil ? html`<div style="font-size:0.75rem;color:#f59e0b">Retrying ${this.formatRelative(job.backoffUntil)}</div>` : ""}
          </div>` : ""}

        <div style="background:var(--bg-primary);padding:0.6rem;border-radius:6px;margin-top:0.3rem">
          <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:0.2rem">Payload / Prompt:</div>
          <div style="font-size:0.82rem;font-style:italic;max-height:80px;overflow-y:auto">"${job.payload ?? job.prompt}"</div>
        </div>
      </div>
    `;
  }

  private renderTaskHistory() {
    if (this.selectedJobTasks.length === 0) {
      return html`<div style="text-align:center;color:var(--text-muted);padding:1.5rem;font-size:0.85rem">No task records found.</div>`;
    }
    return html`
      <div class="task-list">
        ${this.selectedJobTasks.map(t => html`
          <div class="task-item ${t.status}">
            <div>
              <div style="font-weight:600">${new Date(t.startedAt).toLocaleString()}</div>
              <div style="color:var(--text-muted)">${t.isManualTrigger ? "Manual trigger" : `Scheduled: ${this.formatTs(t.scheduledFireTime)}`}</div>
              <div class="task-drift ${t.driftMs > 5000 ? "high" : ""}">Drift: ${t.driftMs}ms</div>
              ${t.output ? html`<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;max-height:40px;overflow:hidden">${t.output.slice(0, 120)}…</div>` : ""}
              ${t.deliveryStatus !== "skipped" ? html`<div style="font-size:0.68rem;color:var(--text-muted)">Delivery: ${t.deliveryStatus} (${t.deliveryAttempts} attempt(s))</div>` : ""}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div>${{ completed: "🟢", failed: "🔴", running: "🟡", resumed: "🔵", delivery_failed: "🟠" }[t.status] ?? "⚪"}</div>
              ${t.completedAt ? html`<div style="font-size:0.68rem;color:var(--text-muted)">${((t.completedAt - t.startedAt))}ms</div>` : ""}
              <div style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono)">${t.idempotencyKey}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderDeliveryConfig(job: CronJob) {
    const base = this.getGatewayBaseUrl();
    const webhookTriggerUrl = `${base}/api/cron/trigger/${job.id}`;
    return html`
      <div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.85rem">
        <div>Delivery Mode: <span class="badge badge-${job.deliveryMode}">${job.deliveryMode.toUpperCase()}</span></div>

        ${job.deliveryMode === "announce" ? html`
          <div>Channel / Chat ID: <strong>${job.channel || "(auto-resolved from config)"}</strong></div>` : ""}

        ${job.deliveryMode === "webhook" ? html`
          <div>
            <div style="color:var(--text-muted);margin-bottom:0.25rem">Webhook URL:</div>
            <div class="mono" style="background:var(--bg-primary);padding:0.4rem;border-radius:4px">${job.webhookUrl || "Not configured"}</div>
          </div>` : ""}

        <div class="webhook-box">
          <span style="font-size:0.78rem;font-weight:700;color:var(--accent-primary)">🔌 Manual Trigger Endpoint</span>
          <div class="mono" style="background:var(--bg-primary);padding:0.35rem;border-radius:4px">POST ${webhookTriggerUrl}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem">
            <span>Bearer Token: <code>${this.revealWebhookToken ? job.webhookToken : "•".repeat(16)}</code></span>
            <button class="btn btn-sm" @click=${() => this.revealWebhookToken = !this.revealWebhookToken}>
              ${this.revealWebhookToken ? "Hide" : "Reveal"}
            </button>
          </div>
          <button class="btn" style="width:100%;font-size:0.75rem" @click=${() => {
            navigator.clipboard.writeText(webhookTriggerUrl);
            alert(`URL copied!\nToken: ${job.webhookToken}`);
          }}>📋 Copy URL</button>
        </div>
      </div>
    `;
  }

  private renderForm() {
    const isEdit = !!this.selectedJob;
    return html`
      <div style="display:flex;flex-direction:column;gap:0.25rem;height:100%">
        <h3 style="font-family:var(--font-display);border-bottom:1px solid var(--border-color);padding-bottom:0.5rem;margin-bottom:0.5rem">
          ${isEdit ? "✏️ Edit Job" : "➕ Create Job"}
        </h3>

        <div class="form-group">
          <label>Job Name</label>
          <input type="text" placeholder="e.g. Daily Briefing" .value=${this.formName}
            @input=${(e: any) => this.formName = e.target.value} />
        </div>

        <div class="form-group">
          <label>Target Agent</label>
          <select .value=${this.formAgentId} @change=${(e: any) => this.formAgentId = e.target.value}>
            ${this.agents.map(a => html`<option value=${a.id}>${a.name ?? a.id}</option>`)}
          </select>
        </div>

        <div class="form-group">
          <label>Schedule (cron expression or ISO timestamp)</label>
          <input type="text" class="${!this.scheduleValid ? "invalid" : ""}"
            placeholder="0 9 * * * (daily at 9am)" .value=${this.formSchedule}
            style="font-family:var(--font-mono)"
            @input=${(e: any) => this.validateSchedule(e.target.value)} />
          ${this.schedulePreview ? html`
            <div class="schedule-preview ${this.scheduleValid ? "valid" : "invalid"}">
              ${this.scheduleValid ? "📅 " : "❌ "}${this.schedulePreview}
            </div>` : ""}
        </div>

        <div class="form-group">
          <label>Timezone</label>
          <select .value=${this.formTimezone} @change=${(e: any) => { this.formTimezone = e.target.value; this.validateSchedule(this.formSchedule); }}>
            ${TIMEZONES.map(tz => html`<option value=${tz}>${tz}</option>`)}
          </select>
        </div>

        <div class="form-group">
          <label>Execution Type</label>
          <div class="type-grid">
            ${(["session", "isolated", "command"] as const).map(t => html`
              <div class="type-btn ${this.formType === t ? "selected" : ""}" @click=${() => this.formType = t}>
                ${{ session: "🧠 Session", isolated: "🔒 Isolated", command: "🖥 Command" }[t]}
              </div>`)}
          </div>
          <span style="font-size:0.72rem;color:var(--text-muted)">
            ${{ session: "Full session context — good for daily briefings, reviews",
                isolated: "Fresh context per run — good for one-off reports, checks",
                command: "Runs shell command directly — no agent loop" }[this.formType]}
          </span>
        </div>

        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <label>${this.formType === "command" ? "Shell Command" : "Agent Prompt"}</label>
            ${this.formType !== "command" ? html`
              <button class="btn btn-sm" ?disabled=${this.isGeneratingPrompt} @click=${this.generatePayloadWithAI}>
                ${this.isGeneratingPrompt ? "⏳ Generating…" : "✨ AI Generate"}
              </button>` : ""}
          </div>
          <textarea placeholder="${this.formType === "command" ? "e.g. /usr/bin/df -h" : "Write the instructions the agent should execute…"}"
            .value=${this.formPayload}
            @input=${(e: any) => this.formPayload = e.target.value}></textarea>
        </div>

        ${this.formType !== "command" ? html`
          <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
            <input type="checkbox" id="dynpay" .checked=${this.formDynamicPayload} style="width:auto"
              @change=${(e: any) => this.formDynamicPayload = e.target.checked} />
            <label for="dynpay">Generate prompt dynamically at runtime using agent AI</label>
          </div>` : ""}

        <div class="form-group">
          <label>Delivery Mode</label>
          <div class="delivery-grid">
            ${(["announce", "webhook", "none"] as const).map(m => html`
              <div class="delivery-btn ${this.formDeliveryMode === m ? "selected" : ""}" @click=${() => this.formDeliveryMode = m}>
                ${{ announce: "📣 Announce", webhook: "🔗 Webhook", none: "🔇 Silent" }[m]}
              </div>`)}
          </div>
        </div>

        ${this.formDeliveryMode === "announce" ? html`
          <div class="form-group">
            <label>Chat ID / Channel (optional — auto-detected if blank)</label>
            <input type="text" placeholder="e.g. -1001234567890" .value=${this.formChannel}
              @input=${(e: any) => this.formChannel = e.target.value} />
          </div>` : ""}

        ${this.formDeliveryMode === "webhook" ? html`
          <div class="form-group">
            <label>Webhook URL</label>
            <input type="url" placeholder="https://your-service.example.com/hook" .value=${this.formWebhookUrl}
              @input=${(e: any) => this.formWebhookUrl = e.target.value} />
          </div>` : ""}

        <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
          <input type="checkbox" id="enabled" .checked=${this.formEnabled} style="width:auto"
            @change=${(e: any) => this.formEnabled = e.target.checked} />
          <label for="enabled">Enable job immediately on save</label>
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:0.75rem">
          <button class="btn btn-primary" style="flex:1" @click=${this.saveJob}>💾 Save</button>
          <button class="btn" @click=${() => this.isEditing = false}>Cancel</button>
        </div>
      </div>
    `;
  }
}
