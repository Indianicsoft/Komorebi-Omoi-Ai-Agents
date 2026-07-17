import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface AgentHealthInfo {
  healthState: "healthy" | "degraded" | "paused" | "offline";
  dailyCostUSD: number;
  botTokenValid: boolean;
  toolCallSuccessCount: number;
  toolCallFailureCount: number;
  rollingToolErrors: boolean[];
  lastStateChangeReason: string;
}

@customElement("health-page")
export class HealthPage extends LitElement {
  @state() private systemUptime = "0m";
  @state() private agentsHealth: Record<string, AgentHealthInfo> = {};
  @state() private config: any = null;
  @state() private loading = true;
  
  private wsClient = WsClient.getInstance();
  private pollInterval: any = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .uptime {
      font-size: 0.85rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.75rem;
    }

    .agent-name {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
    }

    .state-badge {
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .state-healthy {
      background: rgba(46, 204, 113, 0.15);
      color: var(--status-green, #2ecc71);
      border: 1px solid rgba(46, 204, 113, 0.3);
    }

    .state-degraded {
      background: rgba(241, 196, 15, 0.15);
      color: #f1c40f;
      border: 1px solid rgba(241, 196, 15, 0.3);
    }

    .state-paused {
      background: rgba(52, 152, 219, 0.15);
      color: var(--accent-secondary, #3498db);
      border: 1px solid rgba(52, 152, 219, 0.3);
    }

    .state-offline {
      background: rgba(231, 76, 60, 0.15);
      color: #e74c3c;
      border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .metric-label {
      color: var(--text-muted);
    }

    .metric-value {
      font-weight: 600;
      color: #fff;
    }

    .cost-progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 0.25rem;
    }

    .cost-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .cost-progress-fill.over {
      background: #e74c3c;
    }

    .error-rate-dots {
      display: flex;
      gap: 3px;
    }

    .error-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
    }

    .error-dot.success {
      background: #2ecc71;
    }

    .error-dot.failure {
      background: #e74c3c;
    }

    .reason-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      font-style: italic;
      word-break: break-word;
    }

    .btn {
      background: var(--accent-primary);
      border: none;
      color: #white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
      width: 100%;
      text-align: center;
    }

    .btn:hover {
      background: var(--accent-secondary);
    }

    .btn-disabled {
      background: rgba(255, 255, 255, 0.05) !important;
      color: var(--text-muted) !important;
      cursor: not-allowed;
    }

    .loading-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
      font-style: italic;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.fetchHealth();
    this.pollInterval = setInterval(() => this.fetchHealth(), 5000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
    } catch (err) {
      console.error("[HealthPage] Failed to load config:", err);
    }
  }

  private async fetchHealth() {
    try {
      const data = await this.wsClient.send<any>("getSystemHealth");
      this.systemUptime = this.formatUptime(data.systemUptimeMs);
      this.agentsHealth = data.agents || {};
    } catch (err) {
      console.error("[HealthPage] Failed to fetch health details:", err);
    } finally {
      this.loading = false;
    }
  }

  private async handleResume(agentId: string) {
    try {
      const data = await this.wsClient.send<any>("resumeAgent", { agentId });
      if (data.success) {
        this.fetchHealth();
      }
    } catch (err) {
      console.error("[HealthPage] Failed to resume agent:", err);
    }
  }

  private formatUptime(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${mins}m`);
    return parts.join(" ");
  }

  render() {
    if (this.loading) {
      return html`<div class="loading-state">Loading system health diagnostics...</div>`;
    }

    const agentList = Object.keys(this.agentsHealth);

    return html`
      <div class="title-row">
        <div class="title">System Health & Watchdog Monitor</div>
        <div class="uptime">Uptime: ${this.systemUptime}</div>
      </div>

      <div class="grid">
        ${agentList.map(agentId => {
          const info = this.agentsHealth[agentId];
          const agentCfg = this.config?.agents?.find((a: any) => a.id === agentId);
          const costCap = agentCfg?.dailyCostCapUSD || 1.0;
          const costPercent = Math.min(100, (info.dailyCostUSD / costCap) * 100);
          
          const rollErrors = info.rollingToolErrors || [];
          // Fill to 20 dots
          const dots = [...rollErrors];
          while (dots.length < 20) {
            dots.push(null as any);
          }

          return html`
            <div class="card">
              <div class="card-header">
                <span class="agent-name">${agentCfg?.name || agentId}</span>
                <span class="state-badge state-${info.healthState}">
                  ${info.healthState}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-label">Daily Cost Tracking</span>
                <span class="metric-value">$${info.dailyCostUSD.toFixed(5)} / $${costCap.toFixed(2)}</span>
              </div>
              <div>
                <div class="cost-progress-bar">
                  <div class="cost-progress-fill ${costPercent >= 100 ? "over" : ""}" style="width: ${costPercent}%"></div>
                </div>
              </div>

              <div class="metric-row">
                <span class="metric-label">Telegram Bot Pairing</span>
                <span class="metric-value" style="color: ${info.botTokenValid ? "#2ecc71" : "#e74c3c"}">
                  ${info.botTokenValid ? "✓ Active" : "✗ Revoked"}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-label">Tool Call Failures</span>
                <span class="metric-value">${info.toolCallFailureCount} failed / ${info.toolCallSuccessCount + info.toolCallFailureCount} total</span>
              </div>

              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.3rem;">Rolling Tool Execution Errors (Last 20)</div>
                <div class="error-rate-dots">
                  ${dots.map(d => {
                    if (d === null) return html`<div class="error-dot"></div>`;
                    return html`<div class="error-dot ${d ? "failure" : "success"}"></div>`;
                  })}
                </div>
              </div>

              <div class="reason-box">
                Reason: ${info.lastStateChangeReason || "Healthy"}
              </div>

              <div>
                <button 
                  class="btn ${info.healthState !== "paused" && info.healthState !== "degraded" ? "btn-disabled" : ""}" 
                  ?disabled=${info.healthState !== "paused" && info.healthState !== "degraded"}
                  @click=${() => this.handleResume(agentId)}
                >
                  Resume Agent Execution
                </button>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}
