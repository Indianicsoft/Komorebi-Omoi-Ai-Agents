import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface SessionItem {
  agentId: string;
  sessionId: string;
  lastMessageTime: number;
  lastText: string;
  turns: number;
  execution?: string;
  runtime?: string;
  channel?: string;
  active?: boolean;
}

interface TranscriptTurn {
  role: "user" | "model" | "system" | "tool";
  content: string;
  timestamp?: number;
  toolCalls?: any[];
  toolResults?: any[];
}

@customElement("sessions-page")
export class SessionsPage extends LitElement {
  @state() private sessions: SessionItem[] = [];
  @state() private filteredSessions: SessionItem[] = [];
  @state() private selectedSession: SessionItem | null = null;
  @state() private transcript: TranscriptTurn[] = [];
  @state() private loadingTranscript = false;
  @state() private searchTranscriptQuery = "";
  @state() private loading = false;
  @state() private bulkMsg = "";
  @state() private bulkPending = false;
  
  // Filters
  @state() private filterAgent = "";
  @state() private filterChannel = "";
  @state() private searchSessionQuery = "";

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      height: 100%;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    /* Container for split view */
    .session-layout {
      display: flex;
      gap: 1.5rem;
      flex: 1;
      height: calc(100vh - 180px);
      overflow: hidden;
    }

    .sessions-list-panel {
      flex: 1;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .transcript-panel {
      width: 450px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-tertiary);
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

    /* Sessions Table */
    .table-container {
      flex: 1;
      overflow-y: auto;
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
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
      cursor: pointer;
    }

    tr.selected td {
      background-color: var(--accent-glow);
    }

    tr:hover td {
      background-color: rgba(255, 255, 255, 0.01);
    }

    /* Transcript Box Styles */
    .transcript-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-tertiary);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .transcript-turns {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background-color: var(--bg-primary);
    }

    .turn {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-width: 85%;
      border-radius: var(--border-radius);
      padding: 0.75rem;
    }

    .turn.user {
      align-self: flex-end;
      background-color: var(--accent-primary);
      color: white;
    }

    .turn.model {
      align-self: flex-start;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .turn.tool {
      align-self: flex-start;
      background-color: rgba(0, 240, 255, 0.05);
      border: 1px solid rgba(0, 240, 255, 0.15);
      color: var(--accent-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      max-width: 95%;
    }

    .turn-meta {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.6);
      align-self: flex-end;
    }

    .turn.model .turn-meta {
      color: var(--text-muted);
    }

    .highlight {
      background-color: rgba(255, 204, 0, 0.3);
      border-bottom: 2px solid var(--status-yellow);
    }

    .delete-btn {
      background: transparent;
      border: none;
      color: var(--status-red, #ff4d4d);
      cursor: pointer;
      font-size: 1.15rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .delete-btn:hover {
      background-color: rgba(255, 77, 77, 0.15);
      transform: scale(1.15);
    }

    /* Bulk action bar */
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.65rem 1rem;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .bulk-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .btn {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.78rem;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.35);
    }

    .btn-danger:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .btn-warn {
      color: #ffaa00;
      border-color: rgba(255, 165, 0, 0.35);
    }

    .btn-warn:hover:not(:disabled) {
      background-color: rgba(255, 165, 0, 0.1);
    }

    .session-count {
      margin-left: auto;
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }

    .bulk-status {
      font-size: 0.78rem;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      background: rgba(0, 255, 102, 0.08);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadSessions();
  }

  private async loadSessions() {
    this.loading = true;
    try {
      const data = await this.wsClient.send<SessionItem[]>("listSessions");
      // Server already deduplicates and sorts newest-first
      this.sessions = data;
      this.applyFilters();
    } catch (err) {
      console.error("[Sessions] Failed to list sessions:", err);
    } finally {
      this.loading = false;
    }
  }

  private async deleteSession(session: SessionItem) {
    if (!confirm(`Are you sure you want to permanently delete session "${session.sessionId}"? This will terminate any active processes and wipe the history.`)) {
      return;
    }

    try {
      await this.wsClient.send("deleteSession", {
        agentId: session.agentId,
        sessionId: session.sessionId
      });

      if (this.selectedSession?.sessionId === session.sessionId) {
        this.selectedSession = null;
        this.transcript = [];
      }

      await this.loadSessions();
    } catch (err: any) {
      console.error("[Sessions] Failed to delete session:", err);
      alert(`Error deleting session: ${err.message || err}`);
    }
  }

  private async deleteAllForAgent(agentId: string) {
    const count = this.sessions.filter(s => s.agentId === agentId).length;
    if (!confirm(`This will permanently delete all ${count} session(s) for agent "${agentId}". This cannot be undone. Continue?`)) {
      return;
    }
    this.bulkPending = true;
    let deleted = 0;
    const targets = this.sessions.filter(s => s.agentId === agentId);
    for (const sess of targets) {
      try {
        await this.wsClient.send("deleteSession", { agentId: sess.agentId, sessionId: sess.sessionId });
        deleted++;
        if (this.selectedSession?.sessionId === sess.sessionId) {
          this.selectedSession = null;
          this.transcript = [];
        }
      } catch (err: any) {
        console.warn(`[Sessions] Failed to delete ${sess.sessionId}:`, err);
      }
    }
    this.setBulkMsg(`Deleted ${deleted} of ${targets.length} session(s) for "${agentId}".`);
    this.bulkPending = false;
    await this.loadSessions();
  }

  private async deleteAllIdle() {
    const targets = this.sessions.filter(s => !s.active);
    if (targets.length === 0) {
      alert("No idle sessions to delete.");
      return;
    }
    if (!confirm(`This will permanently delete ${targets.length} idle session(s). Continue?`)) return;
    this.bulkPending = true;
    let deleted = 0;
    for (const sess of targets) {
      try {
        await this.wsClient.send("deleteSession", { agentId: sess.agentId, sessionId: sess.sessionId });
        deleted++;
        if (this.selectedSession?.sessionId === sess.sessionId) {
          this.selectedSession = null;
          this.transcript = [];
        }
      } catch {}
    }
    this.setBulkMsg(`Deleted ${deleted} idle session(s).`);
    this.bulkPending = false;
    await this.loadSessions();
  }

  private setBulkMsg(msg: string) {
    this.bulkMsg = msg;
    setTimeout(() => { this.bulkMsg = ""; }, 4500);
  }

  private applyFilters() {
    this.filteredSessions = this.sessions.filter(sess => {
      // Agent filter
      if (this.filterAgent && sess.agentId !== this.filterAgent) return false;
      
      // Channel filter (parsed from sessionId, e.g. "telegram" or "cron" or "chat")
      const channel = sess.sessionId.split(":")[1] || "";
      if (this.filterChannel && !channel.includes(this.filterChannel)) return false;

      // Query filter
      if (this.searchSessionQuery) {
        const query = this.searchSessionQuery.toLowerCase();
        return sess.sessionId.toLowerCase().includes(query) || sess.lastText.toLowerCase().includes(query);
      }

      return true;
    });
  }

  private async selectSession(session: SessionItem) {
    this.selectedSession = session;
    this.loadingTranscript = true;
    this.transcript = [];
    try {
      const data = await this.wsClient.send<TranscriptTurn[]>("getSessionTranscript", {
        agentId: session.agentId,
        sessionId: session.sessionId
      });
      this.transcript = data;
    } catch (err) {
      console.error("[Sessions] Failed to get session transcript:", err);
    } finally {
      this.loadingTranscript = false;
    }
  }

  private renderHighlight(text: string) {
    if (!this.searchTranscriptQuery) return html`${text}`;
    const query = this.searchTranscriptQuery.toLowerCase();
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return html`${parts.map(part => part.toLowerCase() === query ? html`<span class="highlight">${part}</span>` : part)}`;
  }

  private getSessionScopeKey(sessionId: string): string {
    if (sessionId.startsWith("agent:")) {
      const parts = sessionId.split(":");
      if (parts[2] === "telegram") {
        const type = parts[3]; // "group" or "dm"
        const id = parts[4];
        if (parts[5] === "topic") {
          return `${type}:${id} (thread:${parts[6]})`;
        }
        return `${type}:${id}`;
      }
    }
    const parts = sessionId.split(":");
    return parts[2] || parts[1] || "default";
  }

  private getSessionScopeType(sessionId: string): string {
    if (sessionId.includes(":telegram:dm:")) {
      return "dm";
    }
    if (sessionId.includes(":telegram:group:")) {
      if (sessionId.includes(":topic:")) {
        return "group+topic";
      }
      return "group";
    }
    return "web / other";
  }

  render() {
    // Unique agents list for dropdown filter
    const uniqueAgents = Array.from(new Set(this.sessions.map(s => s.agentId)));
    const idleCount = this.sessions.filter(s => !s.active).length;
    const activeCount = this.sessions.filter(s => s.active).length;

    return html`
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem">
        <div class="title">Active Conversation Log Sessions</div>
        <button class="btn" @click=${this.loadSessions} ?disabled=${this.loading}>
          ${this.loading ? "🔄 Loading..." : "🔄 Refresh"}
        </button>
      </div>

      <div class="session-layout">
        <!-- Sessions List Panel -->
        <div class="sessions-list-panel">
          <div class="filter-bar">
            <input 
              type="text" 
              placeholder="Search session ID or messages..." 
              .value=${this.searchSessionQuery}
              @input=${(e: any) => { this.searchSessionQuery = e.target.value; this.applyFilters(); }}
            />
            
            <select .value=${this.filterAgent} @change=${(e: any) => { this.filterAgent = e.target.value; this.applyFilters(); }}>
              <option value="">All Agents</option>
              ${uniqueAgents.map(a => html`<option value=${a}>${a}</option>`)}
            </select>

            <select .value=${this.filterChannel} @change=${(e: any) => { this.filterChannel = e.target.value; this.applyFilters(); }}>
              <option value="">All Channels</option>
              <option value="chat">WebChat</option>
              <option value="telegram">Telegram</option>
              <option value="cron">Cron Scheduler</option>
            </select>
          </div>

          <!-- Bulk action bar -->
          <div class="bulk-bar">
            <span class="bulk-label">🛠️ Bulk:</span>

            <button
              class="btn btn-danger"
              @click=${this.deleteAllIdle}
              ?disabled=${this.bulkPending || idleCount === 0}
              title="Delete all idle (non-running) sessions permanently"
            >
              🗑 Delete Idle ${idleCount > 0 ? `(${idleCount})` : ""}
            </button>

            ${this.filterAgent ? html`
              <button
                class="btn btn-danger"
                @click=${() => this.deleteAllForAgent(this.filterAgent)}
                ?disabled=${this.bulkPending}
                title="Delete all sessions for the selected agent"
              >
                💀 Delete All for "${this.filterAgent}"
              </button>
            ` : ""}

            ${this.bulkMsg ? html`<span class="bulk-status">${this.bulkMsg}</span>` : ""}

            <span class="session-count">
              ${this.filteredSessions.length} / ${this.sessions.length} sessions
              &nbsp;·&nbsp; ${activeCount} running &nbsp;·&nbsp; ${idleCount} idle
            </span>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>Session ID</th>
                  <th>Scope Key</th>
                  <th>Scope Type</th>
                  <th>Execution</th>
                  <th>Runtime</th>
                  <th>Channel</th>
                  <th>Queue Mode</th>
                  <th>Streaming</th>
                  <th>Reasoning</th>
                  <th>Debounce</th>
                  <th>Status</th>
                  <th>Turns</th>
                  <th>Last Message Time</th>
                  <th>Last Message Preview</th>
                  <th style="width: 80px; text-align: center">Action</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredSessions.length === 0 ? html`
                  <tr>
                    <td colspan="16" style="text-align: center; color: var(--text-muted); padding: 2rem">
                      No matching conversation sessions found.
                    </td>
                  </tr>
                ` : this.filteredSessions.map(sess => html`
                  <tr 
                    class=${this.selectedSession?.sessionId === sess.sessionId ? "selected" : ""}
                    @click=${() => this.selectSession(sess)}
                  >
                    <td><strong>${sess.agentId}</strong></td>
                    <td><span style="font-family: var(--font-mono); font-size: 0.8rem">${sess.sessionId}</span></td>
                    <td><code style="font-size: 0.8rem">${this.getSessionScopeKey(sess.sessionId)}</code></td>
                    <td><span style="color: var(--accent-primary); font-size: 0.8rem; font-weight: 600">${this.getSessionScopeType(sess.sessionId)}</span></td>
                    <td><span style="color: var(--accent-secondary); font-size: 0.8rem">${sess.execution || "gemini/gemini-3.5-flash"}</span></td>
                    <td><code style="font-size: 0.8rem">${sess.runtime || "komorebi"}</code></td>
                    <td><span style="text-transform: capitalize; font-size: 0.8rem">${sess.channel || "web"}</span></td>
                    <td><span style="font-size: 0.8rem; text-transform: uppercase">${(sess as any).queueMode || "followup"}</span></td>
                    <td><span style="font-size: 0.8rem">${(sess as any).blockStreaming ? "Stream" : "Complete"}</span></td>
                    <td><span style="font-size: 0.8rem; text-transform: capitalize">${(sess as any).reasoning || "off"}</span></td>
                    <td><span style="font-size: 0.8rem">${(sess as any).debounceMs || 2000}ms</span></td>
                    <td>
                      <span class=${(sess as any).active ? "badge-running" : "badge-idle"} style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background-color: ${(sess as any).active ? "rgba(0, 230, 115, 0.15)" : "rgba(255, 255, 255, 0.05)"}; color: ${(sess as any).active ? "#00e673" : "var(--text-muted)"}">
                        ${(sess as any).active ? "RUNNING" : "IDLE"}
                      </span>
                    </td>
                    <td>${sess.turns}</td>
                    <td>${new Date(sess.lastMessageTime).toLocaleTimeString()}</td>
                    <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary)">
                      ${sess.lastText}
                    </td>
                    <td style="text-align: center">
                      <button 
                        class="delete-btn" 
                        @click=${(e: Event) => { e.stopPropagation(); this.deleteSession(sess); }}
                        title="Delete Session"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Transcript Viewer Panel -->
        <div class="transcript-panel">
          ${this.selectedSession ? html`
            <div class="transcript-header">
              <div style="font-weight: 600; font-family: var(--font-display); color: var(--text-primary)">
                Transcript Viewer
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono)">
                ${this.selectedSession.sessionId}
              </div>
              <input 
                type="text" 
                placeholder="Search within transcript..." 
                .value=${this.searchTranscriptQuery}
                @input=${(e: any) => this.searchTranscriptQuery = e.target.value}
                style="padding: 0.35rem 0.5rem; font-size: 0.8rem; margin-top: 0.25rem"
              />
            </div>

            <div class="transcript-turns">
              ${this.loadingTranscript ? html`
                <div style="text-align: center; padding: 2rem; color: var(--text-muted)">
                  Loading transcripts...
                </div>
              ` : this.transcript.length === 0 ? html`
                <div style="text-align: center; padding: 2rem; color: var(--text-muted)">
                  Empty transcript record.
                </div>
              ` : this.transcript.map(turn => html`
                <div class="turn ${turn.role}">
                  <div style="font-size: 0.85rem">${this.renderHighlight(turn.content)}</div>
                  
                  ${turn.toolCalls ? turn.toolCalls.map(tc => html`
                    <div style="margin-top: 0.5rem; padding: 0.4rem; background: rgba(0,0,0,0.2); border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; border-left: 2px solid var(--accent-primary)">
                      🛠️ Tool Call: <strong>${tc.name}</strong>(${JSON.stringify(tc.arguments)})
                    </div>
                  `) : ""}
                  
                  ${turn.timestamp ? html`
                    <span class="turn-meta">${new Date(turn.timestamp).toLocaleTimeString()}</span>
                  ` : ""}
                </div>
              `)}
            </div>
          ` : html`
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center">
              Select a conversation session row to open the log transcript and review details.
            </div>
          `}
        </div>
      </div>
    `;
  }
}
