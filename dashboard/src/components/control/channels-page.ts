import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

@customElement("channels-page")
export class ChannelsPage extends LitElement {
  @state() private config: any = null;
  @state() private baseHash: string = "";
  
  // Telegram Config settings
  @state() private botToken: string = "";
  @state() private mode: "polling" | "webhook" = "polling";
  @state() private webhookDomain: string = "";
  @state() private allowFrom: string = "";
  @state() private groupPolicy: "allowlist" = "allowlist";
  @state() private dmPolicy: "pairing" | "deny" = "pairing";
  @state() private textChunkLimit: number = 4000;
  @state() private chunkMode: "hard" | "newline" = "newline";
  @state() private historyLimit: number = 50;
  @state() private dmHistoryLimit: number = 10;
  @state() private mediaMaxMb: number = 5;
  @state() private dms: Record<string, { historyLimit: number }> = {};
  @state() private allowedUpdates: string = "";

  // UI state
  @state() private saving = false;
  @state() private status: "connected" | "disconnected" | "error" = "disconnected";
  @state() private botName = "Awaiting Token Setup...";
  @state() private pairings: any[] = [];

  // Override edit fields
  @state() private newOverrideUserId = "";
  @state() private newOverrideLimit = 10;

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      padding-bottom: 3rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .subtitle {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-top: -1.5rem;
      margin-bottom: 1.5rem;
    }

    .card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .channel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }

    .channel-title-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .channel-icon {
      font-size: 2.2rem;
    }

    .channel-name {
      font-family: var(--font-display);
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .badge {
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge.connected {
      background-color: var(--status-green-glow);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .badge.error {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border: 1px solid rgba(255, 51, 102, 0.2);
    }

    .badge.disconnected {
      background-color: rgba(100, 116, 139, 0.1);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select {
      width: 100%;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.65rem 0.85rem;
      outline: none;
      font-family: var(--font-sans);
      font-size: 0.9rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }

    .btn {
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.65rem 1.4rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      background-color: var(--text-muted);
      border-color: var(--text-muted);
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
    }

    .btn-danger {
      background-color: var(--status-red-glow);
      border-color: rgba(255, 51, 102, 0.3);
      color: var(--status-red);
    }

    .btn-danger:hover {
      background-color: rgba(255, 51, 102, 0.2);
    }

    .help-text {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Table styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
    }

    th, td {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9rem;
    }

    th {
      font-weight: 600;
      color: var(--text-secondary);
    }

    td {
      color: var(--text-primary);
    }

    .no-data {
      text-align: center;
      color: var(--text-muted);
      padding: 2rem;
      font-style: italic;
    }

    .pairings-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .pairing-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem 1.25rem;
    }

    .pairing-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .pairing-code {
      font-family: monospace;
      font-weight: 700;
      color: var(--accent-primary);
      font-size: 1.05rem;
    }
  `;

  @state() private activePreviewBlocks: any[] = [];
  @state() private mediaLogs: any[] = [];
  @state() private reactionLogs: any[] = [];
  @state() private reactionNotifications = false;

  private pollInterval: any = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.loadPairings();
    this.loadLiveLogs();
    this.pollInterval = setInterval(() => {
      this.loadLiveLogs();
    }, 3000);
  }

  disconnectedCallback() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async loadLiveLogs() {
    const token = this.wsClient.getToken();
    try {
      const responseBlocks = await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getActivePreviewBlocks",
          params: {},
          id: "dash_list_preview_blocks"
        })
      });
      if (responseBlocks.ok) {
        const data = await responseBlocks.json();
        this.activePreviewBlocks = data.result?.list || [];
      }

      const responseLogs = await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getTelegramLogs",
          params: {},
          id: "dash_get_telegram_logs"
        })
      });
      if (responseLogs.ok) {
        const data = await responseLogs.json();
        this.mediaLogs = data.result?.mediaLogs || [];
        this.reactionLogs = data.result?.reactionLogs || [];
      }
    } catch (err) {
      console.warn("[Channels] Failed to load live logs:", err);
    }
  }

  private async loadConfig() {
    const token = this.wsClient.getToken();
    try {
      const response = await fetch(`${this.wsClient.getGatewayUrl()}/api/config`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        this.config = data.config;
        this.baseHash = data.hash;

        if (this.config.channels?.telegram) {
          const tc = this.config.channels.telegram;
          this.botToken = tc.botToken || "";
          this.mode = tc.mode || "polling";
          this.webhookDomain = tc.webhookDomain || "";
          this.allowFrom = (tc.allowFrom || []).join(", ");
          this.groupPolicy = tc.groupPolicy || "allowlist";
          this.dmPolicy = tc.dmPolicy || "pairing";
          this.textChunkLimit = tc.textChunkLimit ?? 4000;
          this.chunkMode = tc.chunkMode || "newline";
          this.historyLimit = tc.historyLimit ?? 50;
          this.dmHistoryLimit = tc.dmHistoryLimit ?? 10;
          this.mediaMaxMb = tc.mediaMaxMb ?? 5;
          this.dms = tc.dms || {};
          this.allowedUpdates = (tc.allowed_updates || ["message", "callback_query", "message_reaction"]).join(", ");
          this.reactionNotifications = tc.reactionNotifications ?? false;
        }

        this.validateTelegramToken();
      }
    } catch (err) {
      console.error("[Channels] Failed to load configuration:", err);
    }
  }

  private async validateTelegramToken() {
    if (!this.botToken) {
      this.status = "disconnected";
      this.botName = "Awaiting Token Setup...";
      return;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`);
      const body = await res.json();
      if (body.ok) {
        this.status = "connected";
        this.botName = `@${body.result.username} (${body.result.first_name})`;
      } else {
        this.status = "error";
        this.botName = "Invalid Bot Token";
      }
    } catch {
      this.status = "error";
      this.botName = "Telegram API Unreachable";
    }
  }

  private async loadPairings() {
    const token = this.wsClient.getToken();
    try {
      const response = await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "listPairings",
          params: {},
          id: "dash_list_pairings"
        })
      });
      if (response.ok) {
        const data = await response.json();
        this.pairings = data.result || [];
      }
    } catch (err) {
      console.error("[Channels] Failed to load pairings:", err);
    }
  }

  private async approvePairing(code: string, agentId: string) {
    const token = this.wsClient.getToken();
    try {
      const response = await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "approvePairing",
          params: { code, agentId },
          id: "dash_approve_pairing"
        })
      });
      if (response.ok) {
        alert(`Pairing approved successfully for agent '${agentId}'!`);
        await this.loadPairings();
        await this.loadConfig(); // Refresh allowlists
      } else {
        alert("Failed to approve pairing.");
      }
    } catch (err) {
      console.error("[Channels] Failed to approve pairing:", err);
    }
  }

  private async addOverride() {
    if (!this.newOverrideUserId.trim()) {
      alert("Please specify a valid Telegram User ID.");
      return;
    }
    const userId = this.newOverrideUserId.trim();
    this.dms = {
      ...this.dms,
      [userId]: { historyLimit: Number(this.newOverrideLimit) }
    };
    this.newOverrideUserId = "";
    this.newOverrideLimit = 10;
  }

  private removeOverride(userId: string) {
    const updatedDms = { ...this.dms };
    delete updatedDms[userId];
    this.dms = updatedDms;
  }

  private async saveConfig() {
    if (this.saving) return;
    this.saving = true;

    const token = this.wsClient.getToken();

    const allowedChatsArray = this.allowFrom
      ? this.allowFrom.split(",").map(c => Number(c.trim())).filter(c => !isNaN(c))
      : [];

    const allowedUpdatesArray = this.allowedUpdates
      ? this.allowedUpdates.split(",").map(u => u.trim()).filter(Boolean)
      : ["message", "callback_query", "message_reaction"];

    const updatedConfig = {
      ...this.config,
      channels: {
        ...this.config.channels,
        telegram: {
          botToken: this.botToken,
          mode: this.mode,
          webhookDomain: this.webhookDomain,
          allowFrom: allowedChatsArray,
          groupPolicy: this.groupPolicy,
          dmPolicy: this.dmPolicy,
          textChunkLimit: Number(this.textChunkLimit),
          chunkMode: this.chunkMode,
          historyLimit: Number(this.historyLimit),
          dmHistoryLimit: Number(this.dmHistoryLimit),
          mediaMaxMb: Number(this.mediaMaxMb),
          dms: this.dms,
          allowed_updates: allowedUpdatesArray,
          reactionNotifications: this.reactionNotifications
        }
      }
    };

    try {
      const response = await fetch(`${this.wsClient.getGatewayUrl()}/api/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          config: updatedConfig,
          baseHash: this.baseHash
        })
      });

      if (response.status === 409) {
        alert("Conflict Error: The configuration has been modified by another process. Reloading settings...");
        await this.loadConfig();
      } else if (response.ok) {
        const result = await response.json();
        this.baseHash = result.hash;
        alert("Configuration saved successfully. Telegram bot has been re-initialized.");
        await this.validateTelegramToken();
      } else {
        alert("Failed to save configuration.");
      }
    } catch (err) {
      console.error("[Channels] Failed to save configuration:", err);
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div>
        <div class="title">Connected Integrations & Channels</div>
        <div class="subtitle">Configure communication policies, transport envelopes, history limits, and paired users.</div>
      </div>

      <div class="card">
        <div class="channel-header">
          <div class="channel-title-group">
            <span class="channel-icon">✈️</span>
            <div>
              <div class="channel-name">Telegram Bot Bridge</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary)">${this.botName}</div>
            </div>
          </div>
          <div>
            <span class="badge ${this.status}">${this.status.toUpperCase()}</span>
          </div>
        </div>

        <!-- 1. Bot Credentials & Connection Settings -->
        <div class="section-title">Bot Configuration & Transport</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="botToken">Telegram Bot Token</label>
            <input 
              type="password" 
              id="botToken" 
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" 
              .value=${this.botToken}
              @input=${(e: any) => this.botToken = e.target.value}
            />
            <span class="help-text">Obtain a bot token by messaging @BotFather on Telegram.</span>
          </div>

          <div class="form-group">
            <label for="mode">Transport Mode</label>
            <select id="mode" .value=${this.mode} @change=${(e: any) => this.mode = e.target.value}>
              <option value="polling">Long Polling (runner-based)</option>
              <option value="webhook">Webhook Integration (Express-routed)</option>
            </select>
            <span class="help-text">Polling runs in a FIFO concurrent queue. Webhooks require public accessibility.</span>
          </div>
        </div>

        ${this.mode === "webhook" ? html`
          <div class="form-group">
            <label for="webhookDomain">Public Webhook URL Domain Root</label>
            <input 
              type="text" 
              id="webhookDomain" 
              placeholder="e.g. https://my-server.com" 
              .value=${this.webhookDomain}
              @input=${(e: any) => this.webhookDomain = e.target.value}
            />
            <span class="help-text">Must be an https:// domain pointing directly to this Gateway host port.</span>
          </div>
        ` : null}

        <!-- 2. Gating and Policy configuration -->
        <div class="section-title">Access Policy & Allow-Lists</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="dmPolicy">Direct Message (DM) Policy</label>
            <select id="dmPolicy" .value=${this.dmPolicy} @change=${(e: any) => this.dmPolicy = e.target.value}>
              <option value="pairing">Interactive Pairing Mode</option>
              <option value="deny">Deny Unapproved Users</option>
            </select>
            <span class="help-text">Pairing mode sends verification setup codes to unknown accounts.</span>
          </div>

          <div class="form-group">
            <label for="groupPolicy">Group Chat Policy</label>
            <select id="groupPolicy" .value=${this.groupPolicy} @change=${(e: any) => this.groupPolicy = e.target.value}>
              <option value="allowlist">Allowlist Only (ignores other groups)</option>
            </select>
            <span class="help-text">Only allowlisted group IDs will trigger agent ReAct cycles.</span>
          </div>
        </div>

        <div class="form-group">
          <label for="allowFrom">Authorized Numeric Chat & User IDs (Allowlist)</label>
          <input 
            type="text" 
            id="allowFrom" 
            placeholder="e.g. 123456789, 987654321, -1001928374" 
            .value=${this.allowFrom}
            @input=${(e: any) => this.allowFrom = e.target.value}
          />
          <span class="help-text">Comma-separated list of authorized chat or user numeric IDs. Unlisted users will trigger security policies.</span>
        </div>

        <!-- 3. Message Framing & History Limits -->
        <div class="section-title">Envelopes & History Settings</div>
        <div class="grid-3">
          <div class="form-group">
            <label for="textChunkLimit">Outbound Text Chunk Limit</label>
            <input 
              type="number" 
              id="textChunkLimit" 
              min="500" 
              max="4096"
              .value=${this.textChunkLimit}
              @input=${(e: any) => this.textChunkLimit = e.target.value}
            />
          </div>

          <div class="form-group">
            <label for="chunkMode">Chunk Separation Mode</label>
            <select id="chunkMode" .value=${this.chunkMode} @change=${(e: any) => this.chunkMode = e.target.value}>
              <option value="newline">Newline Boundaries</option>
              <option value="hard">Hard Character Chop</option>
            </select>
          </div>

          <div class="form-group">
            <label for="mediaMaxMb">Max Attachment Size (MB)</label>
            <input 
              type="number" 
              id="mediaMaxMb" 
              min="1" 
              max="50"
              .value=${this.mediaMaxMb}
              @input=${(e: any) => this.mediaMaxMb = e.target.value}
            />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="historyLimit">Group Chat History Limit (messages)</label>
            <input 
              type="number" 
              id="historyLimit" 
              min="5" 
              max="200"
              .value=${this.historyLimit}
              @input=${(e: any) => this.historyLimit = e.target.value}
            />
          </div>

          <div class="form-group">
            <label for="dmHistoryLimit">Direct Message (DM) History Limit (turns)</label>
            <input 
              type="number" 
              id="dmHistoryLimit" 
              min="1" 
              max="50"
              .value=${this.dmHistoryLimit}
              @input=${(e: any) => this.dmHistoryLimit = e.target.value}
            />
          </div>
        </div>

        <div class="form-group">
          <label for="allowedUpdates">Allowed Telegram Updates</label>
          <input 
            type="text" 
            id="allowedUpdates" 
            placeholder="e.g. message, callback_query, message_reaction" 
            .value=${this.allowedUpdates}
            @input=${(e: any) => this.allowedUpdates = e.target.value}
          />
          <span class="help-text">Comma-separated list of updates to receive. Must include <code>message_reaction</code> to process message reactions.</span>
        </div>

        <!-- 4. Interactive Pairing Queue Management -->
        <div class="section-title">Pending Pairings Queue</div>
        <div class="pairings-list">
          ${this.pairings.filter(p => p.status === "pending").length === 0 ? html`
            <div class="no-data">No pending pairings awaiting authorization.</div>
          ` : this.pairings.filter(p => p.status === "pending").map(p => html`
            <div class="pairing-item">
              <div class="pairing-info">
                <div>Code: <span class="pairing-code">${p.code}</span></div>
                <div style="font-size: 0.8rem; color: var(--text-secondary)">Agent ID: <code>${p.agentId}</code> | User ID: <code>${p.telegramUserId}</code></div>
                <div style="font-size: 0.75rem; color: var(--text-muted)">Requested: ${new Date(p.requestedAt).toLocaleTimeString()} (Expires ${new Date(p.expiresAt).toLocaleTimeString()})</div>
              </div>
              <button class="btn btn-secondary" @click=${() => this.approvePairing(p.code, p.agentId)}>✅ Approve</button>
            </div>
          `)}
        </div>

        <!-- 5. User-level History Override Table -->
        <div class="section-title">Per-DM History Overrides</div>
        <div class="grid-3" style="align-items: flex-end">
          <div class="form-group">
            <label for="newOverrideUserId">Telegram User ID</label>
            <input 
              type="text" 
              id="newOverrideUserId" 
              placeholder="e.g. 987654321" 
              .value=${this.newOverrideUserId}
              @input=${(e: any) => this.newOverrideUserId = e.target.value}
            />
          </div>
          <div class="form-group">
            <label for="newOverrideLimit">History Limit (turns)</label>
            <input 
              type="number" 
              id="newOverrideLimit" 
              min="1" 
              max="100" 
              .value=${this.newOverrideLimit}
              @input=${(e: any) => this.newOverrideLimit = Number(e.target.value)}
            />
          </div>
          <button class="btn btn-secondary" @click=${this.addOverride}>➕ Add Override</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Telegram User ID</th>
              <th>Turn History Limit</th>
              <th style="width: 100px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(this.dms).length === 0 ? html`
              <tr>
                <td colspan="3" class="no-data">No per-user history overrides configured.</td>
              </tr>
            ` : Object.entries(this.dms).map(([userId, val]: any) => html`
              <tr>
                <td><code>${userId}</code></td>
                <td>
                  <input 
                    type="number" 
                    min="1" 
                    max="100"
                    style="width: 80px; padding: 0.3rem;"
                    .value=${val.historyLimit}
                    @input=${(e: any) => {
                      this.dms = {
                        ...this.dms,
                        [userId]: { historyLimit: Number(e.target.value) }
                      };
                    }}
                  />
                </td>
                <td>
                  <button class="btn btn-danger btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem" @click=${() => this.removeOverride(userId)}>🗑️ Remove</button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>

        <!-- Submit Save -->
        <button class="btn" style="margin-top: 1rem" ?disabled=${this.saving} @click=${this.saveConfig}>
          ${this.saving ? "Saving Configuration..." : "💾 Save Settings"}
        </button>
      </div>

      <!-- 6. Dual-Tier Streaming & Reactions Center -->
      <div class="card">
        <div class="section-title">📺 Dual-Tier Streaming & Reaction Monitor</div>
        
        <!-- Reaction Configuration -->
        <div class="form-group" style="flex-direction: row; align-items: center; gap: 1rem; background-color: var(--bg-primary); padding: 1rem; border: 1px solid var(--border-color); border-radius: 6px;">
          <input 
            type="checkbox" 
            id="reactionNotifications" 
            style="width: 20px; height: 20px; cursor: pointer; margin-right: 0.5rem;"
            .checked=${this.reactionNotifications}
            @change=${(e: any) => this.reactionNotifications = e.target.checked}
          />
          <div>
            <label for="reactionNotifications" style="cursor: pointer; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Enable Reaction Notifications</label>
            <span class="help-text" style="display: block; margin-top: 0.25rem;">Monitor and log inbound Telegram reactions into session memory logs (requires 'message_reaction' in Allowed Updates).</span>
          </div>
        </div>

        <div class="grid-2">
          <!-- Active Preview Blocks -->
          <div>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Active Preview Streaming Blocks</div>
            <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; max-height: 250px; overflow-y: auto;">
              ${this.activePreviewBlocks.length === 0 ? html`
                <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; text-align: center; padding: 1rem;">No active typing streaming sessions.</div>
              ` : this.activePreviewBlocks.map(block => html`
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding: 0.5rem 0; font-size: 0.85rem;">
                  <div>
                    <div style="font-weight: bold; color: var(--accent-primary);">${block.agentId}</div>
                    <div style="color: var(--text-secondary); font-family: monospace; font-size: 0.75rem;">${block.sessionId}</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.75rem; background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                      Rotations: ${block.rotationCount}
                    </span>
                  </div>
                </div>
              `)}
            </div>
          </div>

          <!-- Recent Reactions Log -->
          <div>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Recent Reaction Events</div>
            <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; max-height: 250px; overflow-y: auto;">
              ${this.reactionLogs.length === 0 ? html`
                <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; text-align: center; padding: 1rem;">No recent reaction updates.</div>
              ` : this.reactionLogs.map(log => html`
                <div style="border-bottom: 1px solid var(--border-color); padding: 0.5rem 0; font-size: 0.85rem; line-height: 1.4;">
                  <div style="display: flex; justify-content: space-between;">
                    <strong style="color: var(--text-primary);">${log.fromUser}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style="color: var(--text-secondary); font-size: 0.8rem;">
                    Reacted <span style="background: rgba(255, 255, 255, 0.1); padding: 2px 4px; border-radius: 4px; font-weight: bold;">${log.reactions.join(" ")}</span> on msg #${log.messageId}
                  </div>
                  <div style="color: var(--text-muted); font-size: 0.7rem; font-family: monospace;">Session: ${log.sessionId}</div>
                </div>
              `)}
            </div>
          </div>
        </div>

        <!-- Block Streaming Media Logs -->
        <div>
          <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Block Streaming Media Delivery Log</div>
          <div style="overflow-x: auto; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
            <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
              <thead>
                <tr style="background-color: var(--bg-tertiary);">
                  <th style="padding: 0.5rem 0.75rem;">Time</th>
                  <th style="padding: 0.5rem 0.75rem;">Agent</th>
                  <th style="padding: 0.5rem 0.75rem;">Path</th>
                  <th style="padding: 0.5rem 0.75rem;">Type</th>
                  <th style="padding: 0.5rem 0.75rem;">Idempotency Key / Dedup</th>
                  <th style="padding: 0.5rem 0.75rem;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.mediaLogs.length === 0 ? html`
                  <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 1rem;">No media deliveries logged.</td>
                  </tr>
                ` : this.mediaLogs.map(log => html`
                  <tr>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);">${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${log.agentId}</strong></td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.75rem;">${log.mediaPath}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);"><span style="text-transform: capitalize;">${log.mediaType}</span></td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.7rem; color: var(--text-secondary);">${log.idempotencyKey}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);">
                      <span style="color: ${log.success ? "var(--status-green)" : "var(--status-red)"}; font-weight: bold;">
                        ${log.success ? "DELIVERED / DEDUPED" : "FAILED"}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Scaffolded Discord and Slack integration cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="card" style="opacity: 0.55; filter: grayscale(1)">
          <div class="channel-header">
            <div class="channel-title-group">
              <span class="channel-icon">👾</span>
              <div>
                <div class="channel-name">Discord Channel App</div>
                <div style="font-size: 0.8rem; color: var(--text-muted)">Support coming soon...</div>
              </div>
            </div>
            <span class="badge disconnected">INACTIVE</span>
          </div>
        </div>

        <div class="card" style="opacity: 0.55; filter: grayscale(1)">
          <div class="channel-header">
            <div class="channel-title-group">
              <span class="channel-icon">💬</span>
              <div>
                <div class="channel-name">Slack App Workspace</div>
                <div style="font-size: 0.8rem; color: var(--text-muted)">Support coming soon...</div>
              </div>
            </div>
            <span class="badge disconnected">INACTIVE</span>
          </div>
        </div>
      </div>
    `;
  }
}
