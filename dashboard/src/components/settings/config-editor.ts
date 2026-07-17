import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

@customElement("config-editor")
export class ConfigEditor extends LitElement {
  @state() private config: any = null;
  @state() private baseHash = "";
  @state() private editorMode: "form" | "raw" = "form";
  @state() private rawText = "";
  @state() private isSaving = false;
  
  // Concurrency Conflict state
  @state() private conflictDetected = false;
  @state() private serverConfigText = "";
  @state() private serverHash = "";

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

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Form Styles */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select, textarea {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.55rem 0.7rem;
      outline: none;
      font-size: 0.9rem;
      font-family: var(--font-sans);
    }

    /* Raw textarea editor */
    textarea.raw-textarea {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      min-height: 380px;
      line-height: 1.4;
      white-space: pre;
      resize: vertical;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    /* Conflict Layout styles */
    .conflict-banner {
      background-color: var(--status-red-glow);
      border: 1px solid var(--status-red);
      color: var(--text-primary);
      padding: 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .diff-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .diff-box-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--accent-secondary);
    }

    .diff-pre {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      max-height: 250px;
      overflow: auto;
      white-space: pre-wrap;
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
      this.rawText = JSON.stringify(this.config, null, 2);
      this.conflictDetected = false;
    } catch (err) {
      console.error("[ConfigEditor] Failed to load config:", err);
    }
  }

  private updateConfigField(path: string, val: any) {
    if (!this.config) return;
    
    // Simple deep nested setter (e.g. "gateway.port")
    const parts = path.split(".");
    let current = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = val;
    this.rawText = JSON.stringify(this.config, null, 2);
    this.requestUpdate();
  }

  private async saveConfig(force = false) {
    if (this.isSaving) return;
    this.isSaving = true;

    let payload: any;
    if (this.editorMode === "raw") {
      try {
        payload = JSON.parse(this.rawText);
      } catch (err: any) {
        alert(`JSON Syntactical Error: ${err.message}`);
        this.isSaving = false;
        return;
      }
    } else {
      payload = this.config;
    }

    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: payload,
        baseHash: force ? this.serverHash : this.baseHash
      });

      if (result.conflict) {
        this.conflictDetected = true;
        this.serverConfigText = JSON.stringify(result.config, null, 2);
        this.serverHash = result.hash;
        alert("Warning: Configuration has been modified by another process. Review conflict diffs.");
      } else if (result.success) {
        this.baseHash = result.hash;
        this.conflictDetected = false;
        alert("Configuration saved successfully.");
        await this.loadConfig();
      } else {
        alert("Failed to save configuration.");
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      this.isSaving = false;
    }
  }

  render() {
    if (!this.config) {
      return html`<div>Loading configuration editor...</div>`;
    }

    return html`
      <div class="title-row">
        <div class="title">System Configuration Editor</div>
        <div style="display: flex; gap: 0.5rem">
          <button 
            class="btn ${this.editorMode === "form" ? "btn-primary" : ""}" 
            @click=${() => this.editorMode = "form"}
          >
            📋 Form UI
          </button>
          <button 
            class="btn ${this.editorMode === "raw" ? "btn-primary" : ""}" 
            @click=${() => this.editorMode = "raw"}
          >
            💻 Raw JSON
          </button>
        </div>
      </div>

      ${this.conflictDetected ? this.renderConflictView() : ""}

      <div class="panel">
        ${this.editorMode === "raw" ? html`
          <div class="form-group">
            <label for="rawText">Raw Settings JSON File</label>
            <textarea 
              id="rawText" 
              class="raw-textarea"
              .value=${this.rawText}
              @input=${(e: any) => this.rawText = e.target.value}
            ></textarea>
          </div>
        ` : html`
          <!-- Form View -->
          <div class="form-grid">
            <div class="form-group">
              <label>Gateway Host Name</label>
              <input 
                type="text" 
                placeholder="127.0.0.1"
                .value=${this.config.gateway?.host ?? ""}
                @input=${(e: any) => this.updateConfigField("gateway.host", e.target.value)}
              />
            </div>
            
            <div class="form-group">
              <label>Gateway Port</label>
              <input 
                type="number" 
                placeholder="7328"
                .value=${this.config.gateway?.port ?? ""}
                @input=${(e: any) => this.updateConfigField("gateway.port", e.target.value ? parseInt(e.target.value, 10) : "")}
              />
            </div>

            <div class="form-group">
              <label>Authorization Token</label>
              <input 
                type="text" 
                placeholder="Required"
                .value=${this.config.gateway?.authToken ?? ""}
                @input=${(e: any) => this.updateConfigField("gateway.authToken", e.target.value)}
              />
            </div>

            <div class="form-group">
              <label>Telegram Shared Token</label>
              <input 
                type="text" 
                placeholder="Optional"
                .value=${this.config.telegram?.sharedToken ?? ""}
                @input=${(e: any) => this.updateConfigField("telegram.sharedToken", e.target.value)}
              />
            </div>

            <div class="form-group" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem">
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 0.95rem">Runtime Execution Policy</h3>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem">
                Select target execution harnesses or model overrides for active agents in this fleet configuration.
              </div>
            </div>

            <div class="form-group" style="grid-column: span 2">
              <label>Default Runtime Harness Override</label>
              <select 
                .value=${this.config.agents?.[0]?.model?.agentRuntimeId ?? "auto"}
                @change=${(e: any) => {
                  if (this.config.agents && this.config.agents.length > 0) {
                    for (const agent of this.config.agents) {
                      if (!agent.model) agent.model = {};
                      agent.model.agentRuntimeId = e.target.value;
                    }
                    this.rawText = JSON.stringify(this.config, null, 2);
                    this.requestUpdate();
                  }
                }}
              >
                <option value="auto">Auto (Resolved to komorebi)</option>
                <option value="komorebi">komorebi (Embedded OpenClaw Harness)</option>
                <option value="unregistered-test">unregistered-test (Fail-closed simulation)</option>
              </select>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; line-height: 1.3">
                Precedence: Model-scoped override (\`agentRuntimeId\`) &gt; Provider-scoped override (\`providers[id].agentRuntimeId\`) &gt; Auto-fallback (\`"komorebi"\`). Set to <strong>"unregistered-test"</strong> to simulate fail-closed resolution.
              </div>
            </div>

            <div class="form-group" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem">
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 0.95rem">Message Pipeline Policy</h3>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem">
                Configure debounce delay, command queue behavior (when active runs are steerable or interrupted), and default block-streaming preferences.
              </div>
            </div>

            <div class="form-group">
              <label>Inbound Debounce Delay (ms)</label>
              <input 
                type="number" 
                placeholder="2000"
                .value=${this.config.messages?.inbound?.debounceMs ?? 2000}
                @input=${(e: any) => {
                  if (!this.config.messages) this.config.messages = {};
                  if (!this.config.messages.inbound) this.config.messages.inbound = {};
                  this.config.messages.inbound.debounceMs = parseInt(e.target.value, 10) || 2000;
                  this.rawText = JSON.stringify(this.config, null, 2);
                }}
              />
            </div>

            <div class="form-group">
              <label>Command Queue Mode</label>
              <select 
                .value=${this.config.messages?.queue?.default ?? "followup"}
                @change=${(e: any) => {
                  if (!this.config.messages) this.config.messages = {};
                  if (!this.config.messages.queue) this.config.messages.queue = {};
                  this.config.messages.queue.default = e.target.value;
                  this.rawText = JSON.stringify(this.config, null, 2);
                }}
              >
                <option value="followup">Follow-up (Run turns sequentially)</option>
                <option value="steer">Steer (Inject context on active loop)</option>
                <option value="interrupt">Interrupt (Cancel active loop and restart)</option>
                <option value="collect">Collect (Batch turns after completion)</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: span 2">
              <label>Default Block-Streaming Preference</label>
              <select 
                .value=${this.config.agentsDefaults?.blockStreamingDefault ? "true" : "false"}
                @change=${(e: any) => {
                  if (!this.config.agentsDefaults) this.config.agentsDefaults = {};
                  this.config.agentsDefaults.blockStreamingDefault = e.target.value === "true";
                  this.rawText = JSON.stringify(this.config, null, 2);
                }}
              >
                <option value="false">Off (Complete answers only)</option>
                <option value="true">On (Stream chunks progressively)</option>
              </select>
            </div>
          </div>
        `}

        <div style="display: flex; gap: 0.5rem">
          <button class="btn btn-primary" @click=${() => this.saveConfig(false)}>
            ${this.isSaving ? "Saving Config..." : "💾 Save Settings"}
          </button>
          <button class="btn" @click=${this.loadConfig}>Reset Changes</button>
        </div>
      </div>
    `;
  }

  private renderConflictView() {
    return html`
      <div class="conflict-banner">
        ⚠️ <strong>Concurrency Conflict Detected</strong>: Another client or command-line execution has saved configuration changes since you opened the editor. Please review the differences below and choose whether to force overwrite their changes or reload.
        
        <div class="diff-container">
          <div class="diff-box">
            <div class="diff-box-title">Your Changes</div>
            <pre class="diff-pre">${this.rawText}</pre>
          </div>
          <div class="diff-box-title" style="grid-column: 2">
            Server Version
            <pre class="diff-pre" style="color: var(--status-red)">${this.serverConfigText}</pre>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
          <button class="btn btn-danger" @click=${() => this.saveConfig(true)}>
            💥 Force Overwrite Server
          </button>
          <button class="btn" @click=${this.loadConfig}>
            🔄 Discard & Reload
          </button>
        </div>
      </div>
    `;
  }
}
