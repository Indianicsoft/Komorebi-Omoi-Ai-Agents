import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface LogMessage {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  text: string;
}

@customElement("logs-page")
export class LogsPage extends LitElement {
  @state() private logs: LogMessage[] = [];
  @state() private levelFilter = "all";
  @state() private sourceFilter = "all"; // 'all', 'gateway', 'agent'
  @state() private searchQuery = "";

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 190px);
      overflow: hidden;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      flex: 1;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      align-items: center;
    }

    select, input {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    input {
      flex: 1;
    }

    .terminal {
      flex: 1;
      background-color: #050508;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      color: #a3c9ae;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .log-line {
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .log-line.info {
      color: #a3c9ae;
    }

    .log-line.warn {
      color: var(--status-yellow);
    }

    .log-line.error {
      color: var(--status-red);
    }

    .log-time {
      color: var(--text-muted);
      margin-right: 0.5rem;
    }

    .btn {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.wsClient.addEventListener(this.handleBusEvent.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.wsClient.removeEventListener(this.handleBusEvent.bind(this));
  }

  private handleBusEvent(event: string, data: any) {
    if (event === "busMessage" && data.topic === "system_logs") {
      const payload = data.message;
      if (payload) {
        const newLog: LogMessage = {
          id: crypto.randomUUID(),
          timestamp: payload.timestamp || Date.now(),
          level: payload.level || "info",
          text: payload.text || ""
        };
        this.logs = [...this.logs, newLog].slice(-1000); // cap to 1000 lines
        this.requestUpdate();

        // Auto-scroll terminal to bottom
        setTimeout(() => {
          const term = this.shadowRoot?.querySelector(".terminal");
          if (term) term.scrollTop = term.scrollHeight;
        }, 10);
      }
    }
  }

  private clearLogs() {
    this.logs = [];
  }

  render() {
    const filteredLogs = this.logs.filter(log => {
      // Level Filter
      if (this.levelFilter !== "all" && log.level !== this.levelFilter) return false;

      // Source Filter
      const isAgent = log.text.includes("[AgentRuntime");
      if (this.sourceFilter === "gateway" && isAgent) return false;
      if (this.sourceFilter === "agent" && !isAgent) return false;

      // Search Filter
      if (this.searchQuery) {
        return log.text.toLowerCase().includes(this.searchQuery.toLowerCase());
      }

      return true;
    });

    return html`
      <div class="title">Live Daemon Logs</div>

      <div class="panel">
        <div class="toolbar">
          <input 
            type="text" 
            placeholder="Search terminal logs..." 
            .value=${this.searchQuery}
            @input=${(e: any) => this.searchQuery = e.target.value}
          />

          <select .value=${this.levelFilter} @change=${(e: any) => this.levelFilter = e.target.value}>
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>

          <select .value=${this.sourceFilter} @change=${(e: any) => this.sourceFilter = e.target.value}>
            <option value="all">All Sources</option>
            <option value="gateway">Gateway Daemon</option>
            <option value="agent">Agent Runtimes</option>
          </select>

          <button class="btn" @click=${this.clearLogs}>🗑️ Clear console</button>
        </div>

        <div class="terminal">
          ${filteredLogs.length === 0 ? html`
            <div style="color: var(--text-muted); font-style: italic">
              Listening for active console stream lines... (Try sending message to trigger agents)
            </div>
          ` : filteredLogs.map(log => html`
            <div class="log-line ${log.level}">
              <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span>${log.text}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
