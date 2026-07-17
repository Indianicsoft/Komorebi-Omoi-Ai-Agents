import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface BoundaryRule {
  domain: string;
  pattern: string;
  tier: string;
}

@customElement("autonomy-page")
export class AutonomyPage extends LitElement {
  @state() private activeAgent = "";
  @state() private config: any = null;
  @state() private agents: any[] = [];
  @state() private wsClient = WsClient.getInstance();

  @state() private quieter = false;
  @state() private rules: BoundaryRule[] = [];
  @state() private logEntries: string[] = [];

  @state() private resolvedContextMode = "unknown";
  @state() private activeSignals: any[] = [];

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
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
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

    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 8px;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 46px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--border-color);
      transition: .3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-primary);
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--accent-primary);
    }

    input:checked + .slider:before {
      transform: translateX(22px);
    }

    .rule-grid {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      gap: 0.75rem;
      font-size: 0.85rem;
    }

    .rule-header {
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .rule-row {
      border-bottom: 1px dashed var(--border-color);
      padding: 0.4rem 0;
      color: var(--text-secondary);
    }

    .badge {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .badge-do {
      background: rgba(46, 204, 113, 0.2);
      color: var(--status-green);
    }

    .badge-suggest {
      background: rgba(52, 152, 219, 0.2);
      color: var(--accent-secondary);
    }

    .badge-ask {
      background: rgba(241, 196, 15, 0.2);
      color: #f1c40f;
    }

    .badge-never {
      background: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
    }

    .btn {
      background-color: var(--accent-primary);
      border: none;
      color: white;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.3s;
    }

    .btn:hover {
      background-color: var(--accent-secondary);
    }

    .btn-danger {
      background-color: #e74c3c;
    }

    .btn-danger:hover {
      background-color: #c0392b;
    }

    .logs-box {
      max-height: 200px;
      overflow-y: auto;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .log-line {
      color: var(--text-muted);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 1.5rem;
      font-style: italic;
    }

    .context-mode {
      font-size: 1.1rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .mode-desk { color: var(--status-green); }
    .mode-mobile { color: var(--accent-secondary); }
    .mode-dnd { color: #e74c3c; }
    .mode-unknown { color: var(--text-muted); }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.wsClient.addEventListener((event, data) => {
      if (event === "busMessage" && data && data.topic === "loop_progress") {
        this.fetchStatus();
      }
    });
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.agents = this.config.agents || [];
      if (this.agents.length > 0) {
        this.activeAgent = this.agents[0].id;
        this.fetchStatus();
      }
    } catch (err) {
      console.error("[AutonomyPage] Failed to load configuration:", err);
    }
  }

  private async fetchStatus() {
    if (!this.activeAgent) return;
    try {
      const result = await this.wsClient.send("getAgentProactivityStatus", {
        agentId: this.activeAgent
      });
      if (result) {
        this.quieter = result.quieter || false;
        this.rules = result.rules || [];
        this.logEntries = result.logEntries || [];
      }
      await this.fetchContext();
    } catch (err) {
      console.error("[AutonomyPage] Failed to query proactivity status:", err);
    }
  }

  private async fetchContext() {
    if (!this.activeAgent) return;
    try {
      const data = await this.wsClient.send<any>("getAgentContext", {
        agentId: this.activeAgent
      });
      this.resolvedContextMode = data.resolvedMode || "unknown";
      this.activeSignals = data.activeSignals || [];
    } catch (err) {
      console.error("[AutonomyPage] Failed to fetch context:", err);
    }
  }

  private async handleQuieterToggle() {
    const nextVal = !this.quieter;
    try {
      await this.wsClient.send("toggleQuieterMode", {
        agentId: this.activeAgent,
        value: nextVal
      });
      this.quieter = nextVal;
    } catch (err) {
      console.error("[AutonomyPage] Failed to toggle quieter mode:", err);
    }
  }

  private async handleReset() {
    if (!confirm("Are you sure you want to clear all boundary learning rules for this agent?")) return;
    try {
      await this.wsClient.send("resetAgentBoundaries", {
        agentId: this.activeAgent
      });
      this.fetchStatus();
    } catch (err) {
      console.error("[AutonomyPage] Reset boundaries request failed:", err);
    }
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">Autonomy & Behavioral Boundaries</div>
        <select .value=${this.activeAgent} @change=${(e: any) => { this.activeAgent = e.target.value; this.fetchStatus(); }}>
          ${this.agents.map(a => html`
            <option value=${a.id}>${a.name || a.id}</option>
          `)}
        </select>
      </div>

      <div class="panel">
        <div class="panel-title">Active Situational Context</div>
        <div style="display: flex; gap: 2rem; align-items: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Resolved Mode</div>
            <div class="context-mode mode-${this.resolvedContextMode === "active-desk" ? "desk" : this.resolvedContextMode === "mobile-brief" ? "mobile" : this.resolvedContextMode === "do-not-disturb" ? "dnd" : "unknown"}">
              ${this.resolvedContextMode === "active-desk" ? "🟢 Active Desk" : this.resolvedContextMode === "mobile-brief" ? "📱 Mobile Brief" : this.resolvedContextMode === "do-not-disturb" ? "🔴 Do Not Disturb" : "⚪ Unknown"}
            </div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Active Context Signals</div>
            ${this.activeSignals.length === 0 ? html`
              <div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No active signals. Mode is resolved from defaults.</div>
            ` : html`
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${this.activeSignals.map(sig => html`
                  <span style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
                    <strong>${sig.signalType}</strong>: ${sig.value}
                    <span style="font-size: 0.7rem; color: var(--text-muted);">(${sig.source})</span>
                  </span>
                `)}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Noise Reduction Control</div>
        <div class="control-row">
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Quieter Alert Limit (Noise Reduction)</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Automatically reduces the daily proactive notification cap by 50% when enabled.</div>
          </div>
          <div class="toggle-container">
            <span style="font-size: 0.85rem; color: var(--text-muted);">${this.quieter ? "Enabled" : "Disabled"}</span>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.quieter} @change=${this.handleQuieterToggle}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center;" class="panel-title">
          <span>Learned Domain Boundaries</span>
          <button class="btn btn-danger" @click=${this.handleReset}>Reset All Rules</button>
        </div>

        ${this.rules.length === 0 ? html`
          <div class="empty-state">No domain boundary overrides learned yet. Interact with the agent proactively to train rules.</div>
        ` : html`
          <div class="rule-grid">
            <div class="rule-header">Domain</div>
            <div class="rule-header">Pattern</div>
            <div class="rule-header">Autonomy Tier</div>

            ${this.rules.map(rule => html`
              <div class="rule-row">${rule.domain}</div>
              <div class="rule-row">${rule.pattern}</div>
              <div class="rule-row">
                <span class="badge badge-${rule.tier.toLowerCase()}">${rule.tier}</span>
              </div>
            `)}
          </div>
        `}
      </div>

      <div class="panel">
        <div class="panel-title">Proactivity Action Log</div>
        <div class="logs-box">
          ${this.logEntries.length === 0 ? html`
            <div class="empty-state" style="padding: 0.5rem 0;">No proactive actions logged yet.</div>
          ` : this.logEntries.map(entry => html`
            <div class="log-line">${entry}</div>
          `)}
        </div>
      </div>
    `;
  }
}
