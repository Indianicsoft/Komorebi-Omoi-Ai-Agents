import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface LatencyLog {
  id: string;
  method: string;
  latencyMs: number;
  timestamp: number;
  status: "OK" | "FAIL";
  error?: string;
}

@customElement("debug-page")
export class DebugPage extends LitElement {
  @state() private latencyLogs: LatencyLog[] = [];
  @state() private avgLatency = 0;
  @state() private activeLoops: Record<string, {
    agentId: string;
    sessionId: string;
    iterationCount: number;
    elapsedTime: number;
    pendingToolCalls: any[];
    lastActive: number;
  }> = {};
  
  private wsClient = WsClient.getInstance();
  private pollInterval: any = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .panel-header {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    /* Metric stats */
    .metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }

    .metric-value {
      font-size: 2.2rem;
      font-weight: bold;
      color: var(--accent-secondary);
      font-family: var(--font-mono);
    }

    .metric-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-top: 0.25rem;
    }

    /* Timing logs table */
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
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
      font-family: var(--font-sans);
    }

    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .badge.ok {
      background-color: var(--status-green-glow);
      color: var(--status-green);
    }

    .badge.fail {
      background-color: var(--status-red-glow);
      color: var(--status-red);
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.measureLatency();
    this.pollInterval = setInterval(this.measureLatency.bind(this), 5000);
    this.wsClient.addEventListener(this.handleBusMessage.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.wsClient.removeEventListener(this.handleBusMessage.bind(this));
  }

  private handleBusMessage(event: string, data: any) {
    if (event === "busMessage" && data.topic === "loop_progress") {
      const { sessionId, event: progressEvent } = data.message;
      if (!sessionId || !progressEvent) return;

      const agentId = progressEvent.agentId || sessionId.split(":")[0];
      
      if (progressEvent.type === "turn_end") {
        const updated = { ...this.activeLoops };
        delete updated[sessionId];
        this.activeLoops = updated;
      } else {
        const loopState = progressEvent.loopState;
        if (loopState) {
          this.activeLoops = {
            ...this.activeLoops,
            [sessionId]: {
              agentId,
              sessionId,
              iterationCount: loopState.iterationCount || 0,
              elapsedTime: loopState.elapsedTime || 0,
              pendingToolCalls: loopState.pendingToolCalls || [],
              lastActive: Date.now()
            }
          };
        }
      }
    }
  }

  private async measureLatency() {
    const startTime = performance.now();
    let status: "OK" | "FAIL" = "OK";
    let errorMsg: string | undefined = undefined;

    try {
      // Execute a quick listActiveAgents call to gauge latency
      await this.wsClient.send("listActiveAgents");
    } catch (err: any) {
      status = "FAIL";
      errorMsg = err.message || "Unknown Error";
    } finally {
      const latencyMs = Math.round(performance.now() - startTime);
      const newLog: LatencyLog = {
        id: crypto.randomUUID().slice(0, 8),
        method: "listActiveAgents",
        latencyMs,
        timestamp: Date.now(),
        status,
        error: errorMsg
      };

      this.latencyLogs = [newLog, ...this.latencyLogs].slice(0, 30); // keep 30

      // Calculate average
      const okLogs = this.latencyLogs.filter(l => l.status === "OK");
      if (okLogs.length > 0) {
        this.avgLatency = Math.round(okLogs.reduce((sum, l) => sum + l.latencyMs, 0) / okLogs.length);
      }

      // Cleanup stale active loops (older than 60s without updates)
      const now = Date.now();
      const cleaned = { ...this.activeLoops };
      let changed = false;
      for (const [sid, loop] of Object.entries(cleaned)) {
        if (now - loop.lastActive > 60000) {
          delete cleaned[sid];
          changed = true;
        }
      }
      if (changed) {
        this.activeLoops = cleaned;
      }
    }
  }

  render() {
    return html`
      <div class="title">System Timing & Latency Diagnostics</div>

      <div class="layout">
        <!-- Metric panel -->
        <div class="panel">
          <div class="panel-header">Diagnostics Stats</div>
          <div class="metric">
            <div class="metric-value">${this.avgLatency} ms</div>
            <div class="metric-label">Avg WS Latency</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4">
            Measures response execution delays for WebSocket RPC frames dispatched between browser dashboard client and user decided gateway port.
          </div>
        </div>

        <!-- Latency log lists -->
        <div class="panel">
          <div class="panel-header">Dispatched API Trace Logs</div>
          <div style="overflow-y: auto; max-height: 400px">
            <table>
              <thead>
                <tr>
                  <th>Trace ID</th>
                  <th>Method Called</th>
                  <th>Latency</th>
                  <th>Timestamp</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                ${this.latencyLogs.map(log => html`
                  <tr>
                    <td><code>#${log.id}</code></td>
                    <td><strong>${log.method}</strong></td>
                    <td style="font-family: var(--font-mono); font-weight: 500">${log.latencyMs}ms</td>
                    <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span class="badge ${log.status.toLowerCase()}">${log.status}</span>
                      ${log.error ? html`<div style="font-size: 0.75rem; color: var(--status-red); margin-top: 0.2rem">${log.error}</div>` : ""}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Live Active Harness Loops -->
        <div class="panel" style="grid-column: span 2; margin-top: 1rem">
          <div class="panel-header">Live Active Harness Loops (Real-Time)</div>
          <div style="overflow-y: auto; max-height: 250px">
            ${Object.values(this.activeLoops).length === 0 ? html`
              <div style="color: var(--text-secondary); text-align: center; padding: 1.5rem">
                No active execution harness loops currently running.
              </div>
            ` : html`
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Agent ID</th>
                    <th>Harness ID</th>
                    <th>Harness Resolution Reason</th>
                    <th>Iteration Count</th>
                    <th>Elapsed Time</th>
                    <th>Pending Tool Calls</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.values(this.activeLoops).map(loop => html`
                    <tr>
                      <td><code>${loop.sessionId}</code></td>
                      <td><strong>${loop.agentId}</strong></td>
                      <td><code style="color: var(--accent-secondary)">${(loop as any).runtime || "komorebi"}</code></td>
                      <td><span style="font-size: 0.8rem; color: var(--text-secondary)">${(loop as any).reason || "auto-fallback to built-in komorebi-harness"}</span></td>
                      <td>${loop.iterationCount} / 15</td>
                      <td>${loop.elapsedTime}s</td>
                      <td>
                        ${loop.pendingToolCalls.length === 0 ? html`<span style="color: var(--text-secondary)">None</span>` : loop.pendingToolCalls.map((tc: any) => html`
                          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-secondary)">
                            🛠️ ${tc.name}
                          </div>
                        `)}
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }
}
