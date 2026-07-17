import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface AgentTelemetry {
  agentId: string;
  sessionId: string;
  pid: number | null;
  ramUsageMb: number;
  uptimeMs: number;
  status: string;
}

@customElement("overview-page")
export class OverviewPage extends LitElement {
  @state() private activeInstances: AgentTelemetry[] = [];
  @state() private config: any = null;
  @state() private agents: any[] = [];
  @state() private teams: any[] = [];
  @state() private agentStats: Record<string, any> = {};
  @state() private systemStats = {
    totalSessions: 0,
    uptime: "0d 0h 0m",
    ramTotal: 0
  };
  @state() private intelligenceData: Record<string, any> = {};
  @state() private curatingAgentId: string | null = null;
  @state() private curateMsg = "";
  @state() private liveCognitiveFeed: any[] = [];

  private wsClient = WsClient.getInstance();
  private statsInterval: any = null;
  private startTime = Date.now() - 3600000;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Grid Layouts */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.25rem;
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .card-info { display: flex; flex-direction: column; gap: 0.25rem; }
    .card-label { font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 1.8rem; font-weight: 700; color: #fff; }
    .card-icon {
      font-size: 2.2rem; background: rgba(255,255,255,0.02); width: 50px; height: 50px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 1px solid rgba(255,255,255,0.05);
    }

    .panel {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
    }

    .panel-header {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .stats-layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 768px) { .stats-layout { grid-template-columns: 1fr; } }

    .mood-stat-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .mood-stat-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; border-radius: 8px;
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    }
    .mood-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }

    .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-focused { background: rgba(16,185,129,0.15); color: #34d399; }
    .badge-busy { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .badge-idle { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge-alert { background: rgba(239,68,68,0.15); color: #f87171; }

    /* Intelligence Panel */
    .intel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .intel-card {
      background: rgba(10, 10, 20, 0.5);
      border: 1px solid rgba(167, 139, 250, 0.12);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: border-color 0.3s, box-shadow 0.3s;
    }

    .intel-card:hover {
      border-color: rgba(167, 139, 250, 0.4);
      box-shadow: 0 0 20px rgba(167, 139, 250, 0.07);
    }

    .intel-card-name { font-weight: 700; font-size: 1rem; color: #e5e7eb; }

    .intel-bar-row { display: flex; align-items: center; gap: 0.75rem; }
    .intel-bar-label { font-size: 0.72rem; color: #9ca3af; width: 90px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.4px; }
    .intel-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .intel-bar-fill { height: 100%; border-radius: 99px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .intel-bar-val { font-size: 0.75rem; font-weight: 700; color: #e5e7eb; width: 38px; text-align: right; flex-shrink: 0; }

    .intel-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .intel-chip {
      font-size: 0.7rem; padding: 0.2rem 0.45rem; border-radius: 4px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); color: #9ca3af;
    }

    .iq-score { font-size: 1.5rem; font-weight: 800; }

    .curate-btn {
      background: none; border: 1px solid rgba(167,139,250,0.3); color: #a78bfa;
      padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;
      align-self: flex-start;
    }
    .curate-btn:hover { background: rgba(167,139,250,0.1); }
    .curate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .curate-msg { font-size: 0.78rem; color: #34d399; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.wsClient.addStatusListener((status) => {
      if (status === "connected") {
        this.loadConfig();
        this.startPolling();
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.statsInterval) clearInterval(this.statsInterval);
  }

  private startPolling() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.pollData();
    this.statsInterval = setInterval(() => this.pollData(), 5000);
  }

  private async pollData() {
    try {
      // 1. Fetch running agents
      this.activeInstances = await this.wsClient.send<AgentTelemetry[]>("getAgentsTelemetry").catch(() => []);
      this.systemStats.ramTotal = this.activeInstances.reduce((s, i) => s + i.ramUsageMb, 0);

      // 2. Fetch gateway active sessions
      const sessions = await this.wsClient.send<any[]>("listSessions").catch(() => []);
      this.systemStats.totalSessions = sessions.length;

      // 3. Fetch mood metrics per agent
      const statsList: any = {};
      for (const agent of this.agents) {
        try {
          statsList[agent.id] = await this.wsClient.send<any>("getAgentStats", { agentId: agent.id });
        } catch {}
      }
      this.agentStats = statsList;

      // 4. Fetch fleet intelligence data
      const intelRes = await this.wsClient.send<any>("getFleetIntelligence").catch(() => ({ agents: {} }));
      this.intelligenceData = intelRes.agents || {};

      // 5. Fetch and compile live cognitive feed
      const feed: any[] = [];
      for (const agent of this.agents) {
        try {
          const adv = await this.wsClient.send<any>("getAgentAdvancedStats", { agentId: agent.id });
          const promptDrift = adv.promptDrift || [];
          const learningLog = adv.learningLog || [];

          for (const d of promptDrift) {
            feed.push({
              agentName: agent.name || agent.id,
              type: "drift",
              timestamp: d.timestamp,
              detail: d.delta
            });
          }

          for (const l of learningLog) {
            feed.push({
              agentName: agent.name || agent.id,
              type: "learning",
              timestamp: l.timestamp,
              detail: `Completed session with ${l.toolCallsCount} tool calls (confidence: ${(l.confidence * 100).toFixed(0)}%)`,
              success: l.success
            });
          }
        } catch {}
      }
      this.liveCognitiveFeed = feed.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

      // Uptime conversion
      this.calculateUptime();
    } catch {}
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.agents = this.config.agents || [];
      this.teams = this.config.teams || [];
      if (this.config.gatewayStartTime) {
        this.startTime = this.config.gatewayStartTime;
      }
    } catch {}
  }

  private async triggerCuration(agentId: string) {
    this.curatingAgentId = agentId;
    this.curateMsg = "";
    try {
      const data = await this.wsClient.send<any>("curateAgentSkills", { agentId });
      this.curateMsg = `✓ ${data.message || "Curation triggered"}`;
      setTimeout(() => this.pollData(), 2500);
    } catch (err: any) {
      this.curateMsg = `✗ ${err.message || "Curation failed"}`;
    } finally {
      this.curatingAgentId = null;
      setTimeout(() => { this.curateMsg = ""; }, 5000);
    }
  }

  private calculateUptime() {
    const diff = Date.now() - this.startTime;
    const days = Math.floor(diff / (24 * 3600 * 1000));
    const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    this.systemStats.uptime = `${days}d ${hours}h ${mins}m`;
  }

  private getMoodCount(mood: string): number {
    return Object.values(this.agentStats).filter((s: any) => s.mood === mood && s.status === "running").length;
  }

  /** Composite IQ score 0–100 derived from skill success rate, turns, learned skills, memory */
  private computeIQ(intel: any): number {
    if (!intel) return 0;
    const sr = (intel.skillSuccessRate ?? 0) * 50;
    const turnBonus = Math.min(intel.totalTurns ?? 0, 500) / 500 * 20;
    const skillBonus = Math.min(intel.learnedSkillCount ?? 0, 20) / 20 * 15;
    const memBonus = Math.min(intel.memorySizeKb ?? 0, 64) / 64 * 15;
    return Math.min(100, Math.round(sr + turnBonus + skillBonus + memBonus));
  }

  render() {
    const activeCount = this.activeInstances.filter((i) => i.status === "running").length;

    return html`
      <div class="title">Gateway Fleet Overview</div>

      <!-- Quick Metrics Grid -->
      <div class="grid">
        <div class="card">
          <div class="card-info">
            <div class="card-label">Active Agents</div>
            <div class="card-value">${activeCount}</div>
          </div>
          <div class="card-icon" style="color: #a78bfa">🤖</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Active Sessions</div>
            <div class="card-value">${this.systemStats.totalSessions}</div>
          </div>
          <div class="card-icon" style="color: #ec4899">💬</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Fleet RAM RSS</div>
            <div class="card-value">${this.systemStats.ramTotal} MB</div>
          </div>
          <div class="card-icon" style="color: #10b981">🧠</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Gateway Uptime</div>
            <div class="card-value" style="font-size: 1.4rem">${this.systemStats.uptime}</div>
          </div>
          <div class="card-icon" style="color: #fbbf24">⚡</div>
        </div>
      </div>

      <div class="stats-layout">
        <!-- Topology / Agent list -->
        <div class="panel">
          <div class="panel-header">Fleet Members & Topology</div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem">
            ${this.agents.map(agent => {
              const stats = this.agentStats[agent.id] || { status: "offline", mood: "offline" };
              const isRunning = stats.status === "running";
              return html`
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04)">
                  <div>
                    <div style="font-weight: 700; color: #fff">${agent.name}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af">
                      ${agent.id} • ${agent.model?.name} • Runtime: ${agent.model?.agentRuntime?.id || agent.model?.agentRuntimeId || "komorebi"}
                    </div>
                  </div>
                  <div>
                    <span class="badge badge-${isRunning ? (stats.mood || "focused") : "offline"}">
                      ${isRunning ? (stats.mood || "focused").toUpperCase() : "OFFLINE"}
                    </span>
                  </div>
                </div>
              `;
            })}
          </div>
          
          <!-- Collaboration Teams -->
          <div class="panel-header" style="margin-top: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">Collaboration Teams</div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem">
            ${this.teams.length === 0 ? html`
              <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; padding: 0.5rem">
                No teams configured yet. Create one in the Teams Registry.
              </div>
            ` : this.teams.map(team => html`
              <div style="background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04)">
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <div>
                    <div style="font-weight: 700; color: #fff">${team.name}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af">
                      ID: ${team.id} • Leader: <code>${team.leaderAgentId || "None"}</code>
                    </div>
                  </div>
                  <span class="badge badge-focused">${team.memberAgentIds.length} Members</span>
                </div>
              </div>
            `)}
          </div>
        </div>

        <!-- Fleet Mood Analytics -->
        <div style="display: flex; flex-direction: column; gap: 1rem">
          <div class="panel">
            <div class="panel-header">Fleet Mood Distribution</div>
            <div class="mood-stat-list">
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #10b981"></span>Focused</span>
                <span class="badge badge-focused">${this.getMoodCount("focused")}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #f59e0b"></span>Busy</span>
                <span class="badge badge-busy">${this.getMoodCount("busy")}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #3b82f6"></span>Idle</span>
                <span class="badge badge-idle">${this.getMoodCount("idle")}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #ef4444"></span>Alert</span>
                <span class="badge badge-alert">${this.getMoodCount("alert")}</span>
              </div>
            </div>
          </div>

          <!-- Live Cognitive Activity Feed -->
          <div class="panel">
            <div class="panel-header">🧠 Live Cognitive Feed</div>
            ${this.liveCognitiveFeed.length === 0 ? html`
              <div style="color: #9ca3af; font-size: 0.82rem; font-style: italic; padding: 0.25rem">
                No learning events or strategy adjustments recorded yet.
              </div>
            ` : html`
              <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 380px; overflow-y: auto; padding-right: 0.25rem">
                ${this.liveCognitiveFeed.map(item => {
                  const isDrift = item.type === "drift";
                  const badgeColor = isDrift ? "rgba(167, 139, 250, 0.12)" : (item.success ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)");
                  const textColor = isDrift ? "#a78bfa" : (item.success ? "#34d399" : "#f87171");
                  const typeLabel = isDrift ? "SELF-CORRECT" : (item.success ? "SUCCESS" : "FAILURE");
                  
                  return html`
                    <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); padding: 0.6rem 0.8rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.25rem">
                      <div style="display: flex; justify-content: space-between; align-items: center">
                        <span style="font-weight: 700; font-size: 0.8rem; color: #fff">${item.agentName}</span>
                        <span class="badge" style="background: ${badgeColor}; color: ${textColor}; font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 4px">
                          ${typeLabel}
                        </span>
                      </div>
                      <div style="font-size: 0.76rem; color: #d1d5db; font-family: monospace; word-break: break-word">
                        ${item.detail}
                      </div>
                      <div style="font-size: 0.65rem; color: #4b5563; text-align: right">
                        ${new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- ===== AGENT INTELLIGENCE PANEL ===== -->
      <div class="panel">
        <div class="panel-header">
          <span>🧠 Agent Intelligence Scores</span>
          ${this.curateMsg ? html`<span class="curate-msg">${this.curateMsg}</span>` : ""}
        </div>

        ${this.agents.length === 0 ? html`
          <div style="color: #9ca3af; font-style: italic; font-size: 0.85rem">No agents configured.</div>
        ` : html`
          <div class="intel-grid">
            ${this.agents.map(agent => {
              const intel = this.intelligenceData[agent.id] || {};
              const iq = this.computeIQ(intel);
              const successRate = intel.skillSuccessRate ?? 0;
              const learnedCount = intel.learnedSkillCount ?? 0;
              const totalTurns = intel.totalTurns ?? 0;
              const memorySizeKb = intel.memorySizeKb ?? 0;
              const lastCuration = intel.lastCuration
                ? new Date(intel.lastCuration).toLocaleDateString()
                : "Never";

              const iqColor = iq >= 75 ? "#34d399" : iq >= 45 ? "#fbbf24" : "#f87171";
              const srColor = successRate >= 0.75 ? "#34d399" : successRate >= 0.4 ? "#fbbf24" : "#f87171";
              const learnedPct = Math.min(learnedCount / 20, 1);

              return html`
                <div class="intel-card">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start">
                    <div>
                      <div class="intel-card-name">${agent.name}</div>
                      <div style="font-size: 0.72rem; color: #6b7280; font-family: monospace">${agent.id}</div>
                    </div>
                    <div style="text-align: right">
                      <div class="iq-score" style="background: linear-gradient(135deg, ${iqColor}, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent">${iq}</div>
                      <div style="font-size: 0.65rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px">IQ Score</div>
                    </div>
                  </div>

                  <div class="intel-bar-row">
                    <span class="intel-bar-label">Success Rate</span>
                    <div class="intel-bar-track">
                      <div class="intel-bar-fill" style="width: ${(successRate * 100).toFixed(0)}%; background: ${srColor}"></div>
                    </div>
                    <span class="intel-bar-val" style="color: ${srColor}">${(successRate * 100).toFixed(0)}%</span>
                  </div>

                  <div class="intel-bar-row">
                    <span class="intel-bar-label">Learned Skills</span>
                    <div class="intel-bar-track">
                      <div class="intel-bar-fill" style="width: ${(learnedPct * 100).toFixed(0)}%; background: #a78bfa"></div>
                    </div>
                    <span class="intel-bar-val">${learnedCount}</span>
                  </div>

                  <div class="intel-meta">
                    <span class="intel-chip">💬 ${totalTurns} turns</span>
                    <span class="intel-chip">💾 ${memorySizeKb} KB mem</span>
                    <span class="intel-chip">🕒 ${lastCuration}</span>
                  </div>

                  <button
                    class="curate-btn"
                    @click=${() => this.triggerCuration(agent.id)}
                    ?disabled=${this.curatingAgentId !== null}
                  >
                    ${this.curatingAgentId === agent.id ? "⏳ Curating..." : "⚡ Curate Skills Now"}
                  </button>
                </div>
              `;
            })}
          </div>
        `}
      </div>
    `;
  }
}
