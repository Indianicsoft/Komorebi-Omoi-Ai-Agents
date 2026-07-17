import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface AgentTelemetry {
  agentId: string;
  sessionId: string;
  pid: number | null;
  ramUsageMb: number;
  cpuPercent: number;
  uptimeMs: number;
  lastActivityMsAgo: number;
  restarts: number;
  status: string;
}

@customElement("instances-page")
export class InstancesPage extends LitElement {
  @state() private instances: AgentTelemetry[] = [];
  @state() private filteredInstances: AgentTelemetry[] = [];
  @state() private refreshing = false;
  @state() private filterAgent = "";
  @state() private filterStatus = "";
  @state() private bulkActionMsg = "";
  @state() private bulkActionPending = false;

  private wsClient = WsClient.getInstance();
  private pollInterval: any = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .controls-right {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 0.75rem 1rem;
    }

    .filter-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
      cursor: pointer;
    }

    /* Bulk-action banner */
    .bulk-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      flex-wrap: wrap;
    }

    .bulk-banner .label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      flex: 1;
    }

    .bulk-banner .status-msg {
      font-size: 0.82rem;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      background: rgba(0, 255, 102, 0.1);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .table-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: rgba(255, 255, 255, 0.02);
    }

    /* Duplicate row highlight */
    tr.is-duplicate td {
      background-color: rgba(255, 165, 0, 0.06) !important;
    }

    tr.is-duplicate td:first-child {
      border-left: 3px solid rgba(255, 165, 0, 0.7);
    }

    .dup-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      background: rgba(255, 165, 0, 0.15);
      color: #ffaa00;
      border: 1px solid rgba(255, 165, 0, 0.3);
      margin-left: 0.4rem;
      vertical-align: middle;
    }

    /* Badges */
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }

    .badge.running {
      background-color: var(--status-green-glow);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .badge.idle {
      background-color: rgba(100, 116, 139, 0.1);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .badge.crashed, .badge.failed {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border: 1px solid rgba(255, 51, 102, 0.2);
    }

    .badge.unresponsive {
      background-color: rgba(255, 165, 0, 0.1);
      color: #ffaa00;
      border: 1px solid rgba(255, 165, 0, 0.25);
    }

    /* Buttons */
    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.8rem;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-stop {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-stop:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .btn-restart {
      color: var(--accent-secondary);
      border-color: rgba(0, 240, 255, 0.3);
    }

    .btn-restart:hover:not(:disabled) {
      background-color: var(--accent-secondary-glow);
    }

    .btn-warn {
      color: #ffaa00;
      border-color: rgba(255, 165, 0, 0.35);
    }

    .btn-warn:hover:not(:disabled) {
      background-color: rgba(255, 165, 0, 0.1);
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.4);
      font-weight: 600;
    }

    .btn-danger:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .action-group {
      display: flex;
      gap: 0.5rem;
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 3rem;
      font-size: 0.9rem;
    }

    .stats-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .stat-chip {
      font-size: 0.78rem;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .stat-chip span {
      color: var(--text-primary);
      font-weight: 600;
    }

    .stat-chip.warn span {
      color: #ffaa00;
    }

    .stat-chip.danger span {
      color: var(--status-red);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.refreshTelemetry();
    this.pollInterval = setInterval(this.refreshTelemetry.bind(this), 3000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  private async refreshTelemetry() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      this.instances = await this.wsClient.send<AgentTelemetry[]>("getAgentsTelemetry");
      this.applyFilters();
    } catch (err) {
      console.error("[Instances] Failed to fetch active processes:", err);
    } finally {
      this.refreshing = false;
    }
  }

  private applyFilters() {
    this.filteredInstances = this.instances.filter(inst => {
      if (this.filterAgent && inst.agentId !== this.filterAgent) return false;
      if (this.filterStatus && inst.status !== this.filterStatus) return false;
      return true;
    });
  }

  /** Returns a Set of agentIds that have more than one instance running (duplicates). */
  private getDuplicateAgentIds(): Set<string> {
    const counts = new Map<string, number>();
    for (const inst of this.instances) {
      counts.set(inst.agentId, (counts.get(inst.agentId) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [agentId, count] of counts) {
      if (count > 1) dupes.add(agentId);
    }
    return dupes;
  }

  private async stopAgent(sessionId: string) {
    if (!confirm("Are you sure you want to stop this agent process lane?")) return;
    try {
      await this.wsClient.send("stopAgent", { sessionId });
      this.setBulkMsg("Stop command dispatched.");
      await this.refreshTelemetry();
    } catch (err: any) {
      alert(`Failed to stop agent: ${err.message}`);
    }
  }

  private async restartAgent(agentId: string, sessionId: string) {
    if (!confirm("Are you sure you want to restart this agent process lane?")) return;
    try {
      await this.wsClient.send("restartAgent", { agentId, sessionId });
      this.setBulkMsg("Restart command dispatched.");
      await this.refreshTelemetry();
    } catch (err: any) {
      alert(`Failed to restart agent: ${err.message}`);
    }
  }

  private async killDuplicates() {
    if (!confirm("This will terminate all duplicate process lanes per agent, keeping only the most recently started one. Continue?")) return;
    this.bulkActionPending = true;
    try {
      const result = await this.wsClient.send<{ killed: number }>("killDuplicateInstances", {});
      this.setBulkMsg(`Killed ${result.killed} duplicate instance(s).`);
      await this.refreshTelemetry();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      this.bulkActionPending = false;
    }
  }

  private async killAllIdle() {
    if (!confirm("This will terminate all idle, crashed, and failed process lanes. Running sessions will not be affected. Continue?")) return;
    this.bulkActionPending = true;
    try {
      const result = await this.wsClient.send<{ killed: number }>("killAllIdleInstances", {});
      this.setBulkMsg(`Killed ${result.killed} idle/crashed/failed instance(s).`);
      await this.refreshTelemetry();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      this.bulkActionPending = false;
    }
  }

  private async killAllForAgent(agentId: string) {
    if (!agentId) return;
    if (!confirm(`This will terminate ALL process lanes for agent "${agentId}". Continue?`)) return;
    this.bulkActionPending = true;
    try {
      const result = await this.wsClient.send<{ killed: number }>("killAgentInstances", { agentId });
      this.setBulkMsg(`Killed ${result.killed} instance(s) for agent '${agentId}'.`);
      await this.refreshTelemetry();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      this.bulkActionPending = false;
    }
  }

  private setBulkMsg(msg: string) {
    this.bulkActionMsg = msg;
    setTimeout(() => { this.bulkActionMsg = ""; }, 4000);
  }

  private formatUptime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}m ${s}s`;
  }

  private formatLastActivity(msAgo: number): string {
    if (msAgo < 0) return "Just now";
    const secs = Math.floor(msAgo / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ago`;
  }

  render() {
    const uniqueAgents = Array.from(new Set(this.instances.map(i => i.agentId)));
    const dupeAgentIds = this.getDuplicateAgentIds();
    const runningCount = this.instances.filter(i => i.status === "running").length;
    const idleCount = this.instances.filter(i => i.status === "idle" || i.status === "crashed" || i.status === "failed").length;
    const dupeCount = Array.from(dupeAgentIds).reduce((acc, agentId) => {
      return acc + this.instances.filter(i => i.agentId === agentId).length - 1;
    }, 0);

    return html`
      <div class="title-row">
        <div class="title">Process Pool Supervisor</div>
        <div class="controls-right">
          <button class="btn" @click=${this.refreshTelemetry} ?disabled=${this.refreshing}>
            ${this.refreshing ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      <!-- Stats summary row -->
      <div class="stats-row">
        <div class="stat-chip">Total <span>${this.instances.length}</span></div>
        <div class="stat-chip">Running <span>${runningCount}</span></div>
        <div class="stat-chip ${idleCount > 0 ? "warn" : ""}">Idle / Crashed <span>${idleCount}</span></div>
        <div class="stat-chip ${dupeCount > 0 ? "warn" : ""}">Duplicates <span>${dupeCount}</span></div>
        <div class="stat-chip">Shown <span>${this.filteredInstances.length}</span></div>
      </div>

      <!-- Bulk action bar -->
      <div class="bulk-banner">
        <span class="label">🛠️ Bulk Actions</span>

        <button
          class="btn btn-warn"
          @click=${this.killDuplicates}
          ?disabled=${this.bulkActionPending || dupeCount === 0}
          title="Kill all duplicate process lanes, keeping the most recently started one per agent"
        >
          🗑 Kill Duplicates ${dupeCount > 0 ? `(${dupeCount})` : ""}
        </button>

        <button
          class="btn btn-danger"
          @click=${this.killAllIdle}
          ?disabled=${this.bulkActionPending || idleCount === 0}
          title="Terminate all idle, crashed, and failed process lanes"
        >
          ⚡ Kill Idle / Crashed ${idleCount > 0 ? `(${idleCount})` : ""}
        </button>

        ${this.filterAgent ? html`
          <button
            class="btn btn-danger"
            @click=${() => this.killAllForAgent(this.filterAgent)}
            ?disabled=${this.bulkActionPending}
            title="Terminate all instances for the currently filtered agent"
          >
            💀 Kill All for "${this.filterAgent}"
          </button>
        ` : ""}

        ${this.bulkActionMsg ? html`<span class="status-msg">${this.bulkActionMsg}</span>` : ""}
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <span class="filter-label">Filter by:</span>
        <select
          .value=${this.filterAgent}
          @change=${(e: any) => { this.filterAgent = e.target.value; this.applyFilters(); }}
        >
          <option value="">All Agents</option>
          ${uniqueAgents.map(a => html`<option value=${a}>${a}${dupeAgentIds.has(a) ? " ⚠ dup" : ""}</option>`)}
        </select>

        <select
          .value=${this.filterStatus}
          @change=${(e: any) => { this.filterStatus = e.target.value; this.applyFilters(); }}
        >
          <option value="">All Statuses</option>
          <option value="running">Running</option>
          <option value="idle">Idle</option>
          <option value="crashed">Crashed</option>
          <option value="failed">Failed</option>
          <option value="unresponsive">Unresponsive</option>
        </select>
      </div>

      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Session ID</th>
              <th>PID</th>
              <th>RAM</th>
              <th>CPU%</th>
              <th>Uptime</th>
              <th>Last Activity</th>
              <th>Restarts</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredInstances.length === 0 ? html`
              <tr>
                <td colspan="10" class="empty-state">
                  ${this.filterAgent || this.filterStatus
                    ? "No instances match the current filter."
                    : "No active agent sessions are running in the pool. Message your bots to initialize."}
                </td>
              </tr>
            ` : this.filteredInstances.map(inst => {
              const isDuplicate = dupeAgentIds.has(inst.agentId);
              return html`
                <tr class=${isDuplicate ? "is-duplicate" : ""}>
                  <td>
                    <strong>${inst.agentId}</strong>
                    ${isDuplicate ? html`<span class="dup-badge">DUP</span>` : ""}
                  </td>
                  <td><span style="font-family: var(--font-mono); font-size: 0.8rem">${inst.sessionId}</span></td>
                  <td><code>${inst.pid || "N/A"}</code></td>
                  <td>${inst.ramUsageMb} MB</td>
                  <td>${inst.cpuPercent.toFixed(1)}%</td>
                  <td>${this.formatUptime(inst.uptimeMs)}</td>
                  <td>${this.formatLastActivity(inst.lastActivityMsAgo)}</td>
                  <td>${inst.restarts}</td>
                  <td><span class="badge ${inst.status}">${inst.status.toUpperCase()}</span></td>
                  <td>
                    <div class="action-group">
                      <button class="btn btn-restart" @click=${() => this.restartAgent(inst.agentId, inst.sessionId)}>🔄 Restart</button>
                      <button class="btn btn-stop" @click=${() => this.stopAgent(inst.sessionId)}>🛑 Stop</button>
                    </div>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}
