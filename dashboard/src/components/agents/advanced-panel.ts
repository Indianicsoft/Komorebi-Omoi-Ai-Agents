import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface PromptDriftEntry {
  timestamp: number;
  delta: string;
}

interface LearningLogEntry {
  timestamp: number;
  sessionId: string;
  confidence: number;
  toolCallsCount: number;
  success: boolean;
}

interface SkillHistogramItem {
  runs: number;
  successes: number;
  failures: number;
  avgConfidence: number;
}

@customElement("advanced-panel")
export class AdvancedPanel extends LitElement {
  @state() private activeAgent = "";
  @state() private config: any = null;
  @state() private baseHash = "";
  @state() private agents: any[] = [];
  
  // Advanced stats fetched from gateway API
  @state() private promptDrift: PromptDriftEntry[] = [];
  @state() private learningLog: LearningLogEntry[] = [];
  @state() private histogram: Record<string, SkillHistogramItem> = {};
  @state() private isStatsLoading = false;
  
  private wsClient = WsClient.getInstance();

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

    .agent-select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    /* Glassmorphism Panel styles */
    .glass-card {
      background: rgba(30, 41, 59, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 0.5rem;
    }

    /* Toggle Switch Styles */
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .toggle-desc {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .toggle-label {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .toggle-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }

    .switch input {
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
      background-color: rgba(255, 255, 255, 0.15);
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
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--accent-primary);
      box-shadow: 0 0 8px var(--accent-primary);
    }

    input:checked + .slider:before {
      transform: translateX(24px);
    }

    /* Timeline styles */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      padding-left: 1.5rem;
      margin-top: 0.5rem;
    }

    .timeline-line {
      position: absolute;
      left: 5px;
      top: 5px;
      bottom: 5px;
      width: 2px;
      background: rgba(255, 255, 255, 0.1);
    }

    .timeline-item {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .timeline-dot {
      position: absolute;
      left: -23px;
      top: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-secondary);
      box-shadow: 0 0 8px var(--accent-secondary);
    }

    .timeline-time {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .timeline-content {
      font-size: 0.88rem;
      color: var(--text-secondary);
      background: rgba(0, 0, 0, 0.15);
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.03);
      font-family: var(--font-mono);
    }

    /* Table styles */
    .hist-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
    }

    .hist-table th, .hist-table td {
      text-align: left;
      padding: 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.85rem;
    }

    .hist-table th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }

    .hist-table td {
      color: var(--text-secondary);
    }

    .progress-bar-container {
      width: 100px;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-right: 0.5rem;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    }

    /* Sparkline grid */
    .sparkline-row {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 32px;
      background: rgba(0, 0, 0, 0.15);
      padding: 6px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }

    .sparkline-bar {
      flex: 1;
      background-color: var(--accent-primary);
      min-width: 4px;
      border-radius: 1px;
    }

    .empty-state {
      font-style: italic;
      color: var(--text-muted);
      font-size: 0.85rem;
      padding: 0.5rem 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.baseHash = data.hash;
      this.agents = this.config.agents || [];
      if (this.agents.length > 0 && !this.activeAgent) {
        this.activeAgent = this.agents[0].id;
      }
      await this.loadAdvancedStats();
    } catch (err) {
      console.error("[AdvancedPanel] Failed to load config:", err);
    }
  }

  private async loadAdvancedStats() {
    if (!this.activeAgent) return;
    this.isStatsLoading = true;
    try {
      const data = await this.wsClient.send<any>("getAgentAdvancedStats", { agentId: this.activeAgent });
      this.promptDrift = data.promptDrift || [];
      this.learningLog = data.learningLog || [];
      this.histogram = data.histogram || {};
    } catch (err) {
      console.error("[AdvancedPanel] Failed to load advanced stats:", err);
    } finally {
      this.isStatsLoading = false;
    }
  }

  private async handleAgentChange(e: any) {
    this.activeAgent = e.target.value;
    await this.loadAdvancedStats();
  }

  private async saveConfigUpdate(updatedAgents: any[]) {
    this.config.agents = updatedAgents;
    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: this.config,
        baseHash: this.baseHash
      });

      if (result.success) {
        this.baseHash = result.hash;
        console.log(`[AdvancedPanel] Agent config updated successfully.`);
      } else {
        alert("Failed to save configuration update.");
      }
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  }

  private async handleUnrestrictedToggle(e: any) {
    if (!this.config || !this.activeAgent) return;
    const isChecked = e.target.checked;
    
    const updated = this.config.agents.map((agent: any) => {
      if (agent.id === this.activeAgent) {
        return {
          ...agent,
          toolPolicy: {
            ...agent.toolPolicy,
            allowUnrestrictedCommands: isChecked
          }
        };
      }
      return agent;
    });
    await this.saveConfigUpdate(updated);
  }

  private async handleSelfImprovementToggle(e: any) {
    if (!this.config || !this.activeAgent) return;
    const isChecked = e.target.checked;
    
    const updated = this.config.agents.map((agent: any) => {
      if (agent.id === this.activeAgent) {
        return {
          ...agent,
          toolPolicy: {
            ...agent.toolPolicy,
            allowSelfImprovement: isChecked
          }
        };
      }
      return agent;
    });
    await this.saveConfigUpdate(updated);
  }

  private async handleContextLimitChange(e: any) {
    if (!this.config || !this.activeAgent) return;
    const val = parseInt(e.target.value, 10);
    
    const updated = this.config.agents.map((agent: any) => {
      if (agent.id === this.activeAgent) {
        return {
          ...agent,
          contextLimit: val,
          toolPolicy: {
            ...agent.toolPolicy,
            contextLimit: val
          }
        };
      }
      return agent;
    });
    await this.saveConfigUpdate(updated);
  }

  render() {
    if (this.isStatsLoading) {
      return html`<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading advanced agent metrics...</div>`;
    }
    const activeAgentConfig = this.agents.find(a => a.id === this.activeAgent);
    const allowUnrestricted = activeAgentConfig?.toolPolicy?.allowUnrestrictedCommands ?? false;
    const allowSelfImprovement = activeAgentConfig?.toolPolicy?.allowSelfImprovement ?? false;
    const contextLimit = activeAgentConfig?.contextLimit ?? activeAgentConfig?.toolPolicy?.contextLimit ?? 15000;
    
    // Calculate stats
    const avgConfidence = this.learningLog.length > 0 
      ? (this.learningLog.reduce((acc, curr) => acc + curr.confidence, 0) / this.learningLog.length * 100).toFixed(0)
      : "N/A";
    const successRate = this.learningLog.length > 0
      ? (this.learningLog.filter(l => l.success).length / this.learningLog.length * 100).toFixed(0)
      : "N/A";

    return html`
      <div class="title-row">
        <div class="title">Advanced AI Settings & Compaction</div>
        <select class="agent-select" .value=${this.activeAgent} @change=${this.handleAgentChange}>
          ${this.agents.map(a => html`
            <option value=${a.id}>${a.name || a.id}</option>
          `)}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="glass-card">
          <div class="section-title">🛡️ Unrestricted Command Gating</div>
          <div class="toggle-row" style="margin-top: 0.5rem">
            <div class="toggle-desc">
              <span class="toggle-label">Bypass Command Approval Gating</span>
              <span class="toggle-sub">
                Allows the agent to execute shell commands (exec) directly without requesting admin Telegram card confirmation.
              </span>
            </div>
            <label class="switch">
              <input type="checkbox" .checked=${allowUnrestricted} @change=${this.handleUnrestrictedToggle} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="glass-card">
          <div class="section-title">🧠 Cognitive Architecture Settings</div>
          <div class="toggle-row" style="margin-top: 0.5rem">
            <div class="toggle-desc">
              <span class="toggle-label">Self-Refinement & Learning Mode</span>
              <span class="toggle-sub">
                Enables the agent to dynamically refine its playbooks, persist daily learnings, and auto-correct strategy on failures.
              </span>
            </div>
            <label class="switch">
              <input type="checkbox" .checked=${allowSelfImprovement} @change=${this.handleSelfImprovementToggle} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="section-title">⚡ Context Compaction Threshold</div>
        <div style="background: rgba(255, 255, 255, 0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span class="toggle-label" style="font-size: 0.95rem">Compaction Threshold Limit</span>
            <span style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: bold; color: var(--accent-secondary)">${contextLimit.toLocaleString()} tokens</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">
            Controls the token limit at which the agent automatically compacts its history to optimize API costs and latency.
          </div>
          <input 
            type="range" 
            min="5000" 
            max="25000" 
            step="1000" 
            .value=${contextLimit} 
            @input=${this.handleContextLimitChange} 
            style="width: 100%; accent-color: var(--accent-primary); cursor: pointer;"
          />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="glass-card">
          <div class="section-title">🧠 Meta-Cognitive Prompt Drift</div>
          ${this.promptDrift.length === 0 ? html`
            <div class="empty-state">No dynamic prompt adjustments recorded yet. The agent is running on its baseline instruction set.</div>
          ` : html`
            <div class="timeline">
              <div class="timeline-line"></div>
              ${this.promptDrift.map(entry => html`
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-time">${new Date(entry.timestamp).toLocaleString()}</div>
                  <div class="timeline-content">${entry.delta}</div>
                </div>
              `)}
            </div>
          `}
        </div>

        <div class="glass-card">
          <div class="section-title">📊 Closed Learning Logs & Confidence</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem">
            <div style="background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 8px; text-align: center">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-primary)">${avgConfidence}%</div>
              <div style="font-size: 0.75rem; color: var(--text-muted)">Avg Confidence Score</div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 8px; text-align: center">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-green)">${successRate}%</div>
              <div style="font-size: 0.75rem; color: var(--text-muted)">Tool Success Rate</div>
            </div>
          </div>

          <div style="margin-top: 0.5rem">
            <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem">Recent Confidence Log</div>
            ${this.learningLog.length === 0 ? html`
              <div class="empty-state">No logs recorded yet.</div>
            ` : html`
              <div class="sparkline-row">
                ${this.learningLog.slice(-20).map(l => html`
                  <div 
                    class="sparkline-bar" 
                    style="height: ${l.confidence * 100}%; background-color: ${l.success ? "var(--accent-primary)" : "var(--status-red)"}"
                    title="Session: ${l.sessionId} | Confidence: ${l.confidence.toFixed(2)}"
                  ></div>
                `)}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="section-title">🧰 Skill Performance Histogram</div>
        ${Object.keys(this.histogram).length === 0 ? html`
          <div class="empty-state">No capability runs recorded in the performance registry.</div>
        ` : html`
          <table class="hist-table">
            <thead>
              <tr>
                <th>Skill Name / Tool</th>
                <th>Runs</th>
                <th>Success Rate</th>
                <th>Avg Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(this.histogram).map(([slug, stats]) => {
                const rate = stats.runs > 0 ? (stats.successes / stats.runs * 100) : 0;
                return html`
                  <tr>
                    <td><code>${slug}</code></td>
                    <td>${stats.runs}</td>
                    <td>
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${rate}%"></div>
                      </div>
                      <span>${rate.toFixed(0)}%</span>
                    </td>
                    <td>${(stats.avgConfidence * 100).toFixed(0)}%</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        `}
      </div>
    `;
  }
}
