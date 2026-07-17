import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface Provider {
  id: string;
  name: string;
  baseUrl?: string;
  apiKeyEnv?: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
}

@customElement("models-manager")
export class ModelsManager extends LitElement {
  @state() private config: any = null;
  @state() private baseHash = "";
  @state() private activeTab: "providers" | "models" = "providers";

  // List arrays parsed from config
  @state() private providers: Provider[] = [];
  @state() private models: Model[] = [];

  // Form states
  @state() private isFormOpen = false;
  @state() private formMode: "add" | "edit" = "add";
  
  // Provider Form fields
  @state() private provId = "";
  @state() private provName = "";
  @state() private provBaseUrl = "";
  @state() private provApiKeyEnv = "";

  // Model Form fields
  @state() private modelId = "";
  @state() private modelName = "";
  @state() private modelProv = "";
  @state() private modelCtx = 128000;

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

    .tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .tab {
      background: none;
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95rem;
      position: relative;
    }

    .tab.active {
      color: var(--accent-secondary);
    }

    .tab.active::after {
      content: "";
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background-color: var(--accent-secondary);
      border-radius: 2px;
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

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .card {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: relative;
    }

    .card-title {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .card-sub {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-family: var(--font-mono);
    }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
    }

    /* Form Overlay */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-box {
      width: 450px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
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

    input, select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.5rem 0.6rem;
      outline: none;
      font-size: 0.9rem;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
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

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-danger:hover {
      background-color: var(--status-red-glow);
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

      this.providers = [];
      this.models = [];

      // Check and parse native Komorebi models configuration block
      if (this.config.models && this.config.models.providers) {
        const provs = this.config.models.providers;
        for (const [provId, provData] of Object.entries(provs)) {
          const p = provData as any;
          this.providers.push({
            id: provId,
            name: p.name || provId,
            baseUrl: p.baseUrl || "",
            apiKeyEnv: p.apiKey || ""
          });

          const mList = p.models || [];
          for (const m of mList) {
            this.models.push({
              id: m.id,
              name: m.name || m.id,
              provider: provId,
              contextLength: m.contextWindow || 128000
            });
          }
        }
      } else {
        // initialize structure
        this.config.models = { mode: "merge", providers: {} };
      }
    } catch (err) {
      console.error("[ModelsManager] Failed to load config:", err);
    }
  }

  private async saveToConfig() {
    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: this.config,
        baseHash: this.baseHash
      });

      if (result.success) {
        this.baseHash = result.hash;
        alert("Models config successfully updated.");
        this.loadConfig();
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("[ModelsManager] Failed to save:", err);
    }
  }

  // --- Actions ---
  private openAddProvider() {
    this.formMode = "add";
    this.provId = "";
    this.provName = "";
    this.provBaseUrl = "";
    this.provApiKeyEnv = "";
    this.isFormOpen = true;
  }

  private openEditProvider(p: Provider) {
    this.formMode = "edit";
    this.provId = p.id;
    this.provName = p.name;
    this.provBaseUrl = p.baseUrl || "";
    this.provApiKeyEnv = p.apiKeyEnv || "";
    this.isFormOpen = true;
  }

  private deleteProvider(id: string) {
    if (!confirm(`Are you sure you want to delete provider ${id}?`)) return;
    if (this.config.models?.providers) {
      delete this.config.models.providers[id];
      this.saveToConfig();
    }
  }

  private saveProviderForm() {
    if (!this.provId || !this.provName) {
      alert("ID and Name are required.");
      return;
    }

    if (!this.config.models) this.config.models = { mode: "merge", providers: {} };
    if (!this.config.models.providers) this.config.models.providers = {};

    const existing = this.config.models.providers[this.provId] || {};
    this.config.models.providers[this.provId] = {
      ...existing,
      name: this.provName,
      baseUrl: this.provBaseUrl || undefined,
      apiKey: this.provApiKeyEnv || undefined,
      api: existing.api || "openai-responses",
      models: existing.models || []
    };

    this.isFormOpen = false;
    this.saveToConfig();
  }

  // --- Model Actions ---
  private openAddModel() {
    this.formMode = "add";
    this.modelId = "";
    this.modelName = "";
    this.modelProv = this.providers[0]?.id || "gemini";
    this.modelCtx = 128000;
    this.isFormOpen = true;
  }

  private openEditModel(m: Model) {
    this.formMode = "edit";
    this.modelId = m.id;
    this.modelName = m.name;
    this.modelProv = m.provider;
    this.modelCtx = m.contextLength || 128000;
    this.isFormOpen = true;
  }

  private deleteModel(providerId: string, modelId: string) {
    if (!confirm(`Are you sure you want to delete model ${modelId}?`)) return;
    const provider = this.config.models?.providers?.[providerId];
    if (provider && provider.models) {
      provider.models = provider.models.filter((m: any) => m.id !== modelId);
      this.saveToConfig();
    }
  }

  private saveModelForm() {
    if (!this.modelId || !this.modelName) {
      alert("ID and Name are required.");
      return;
    }

    const provider = this.config.models?.providers?.[this.modelProv];
    if (!provider) {
      alert("Selected provider does not exist.");
      return;
    }

    if (!provider.models) provider.models = [];

    const modelPayload = {
      id: this.modelId,
      name: this.modelName,
      contextWindow: this.modelCtx,
      maxTokens: 4096
    };

    const existingIndex = provider.models.findIndex((m: any) => m.id === this.modelId);
    if (existingIndex > -1) {
      provider.models[existingIndex] = modelPayload;
    } else {
      provider.models.push(modelPayload);
    }

    this.isFormOpen = false;
    this.saveToConfig();
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">LLM Providers & Models Manager</div>
        <button class="btn btn-primary" @click=${this.activeTab === "providers" ? this.openAddProvider : this.openAddModel}>
          ➕ Add ${this.activeTab === "providers" ? "Provider" : "Model"}
        </button>
      </div>

      <div class="tabs">
        <button class="tab ${this.activeTab === "providers" ? "active" : ""}" @click=${() => this.activeTab = "providers"}>
          🔌 API Providers
        </button>
        <button class="tab ${this.activeTab === "models" ? "active" : ""}" @click=${() => this.activeTab = "models"}>
          🧠 Models Catalog
        </button>
      </div>

      <div class="panel">
        ${this.activeTab === "providers" ? this.renderProviders() : this.renderModels()}
      </div>

      <!-- Add/Edit Overlay Modals -->
      ${this.isFormOpen ? html`
        <div class="overlay" @click=${() => this.isFormOpen = false}>
          <div class="modal-box" @click=${(e: Event) => e.stopPropagation()}>
            <h3 style="font-family: var(--font-display)">
              ${this.formMode === "add" ? "Register New" : "Modify"} ${this.activeTab === "providers" ? "Provider" : "Model"}
            </h3>
            
            ${this.activeTab === "providers" ? this.renderProviderFormFields() : this.renderModelFormFields()}

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
              <button class="btn btn-primary" style="flex: 1" @click=${this.activeTab === "providers" ? this.saveProviderForm : this.saveModelForm}>
                💾 Save
              </button>
              <button class="btn" @click=${() => this.isFormOpen = false}>Cancel</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }

  private renderProviders() {
    return html`
      <div class="list-grid">
        ${this.providers.map(p => html`
          <div class="card">
            <div class="card-title">${p.name}</div>
            <div class="card-sub">ID: ${p.id}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary)">
              <div>Base URL: <code>${p.baseUrl || "Default SDK"}</code></div>
              <div>Key/Token: <code>${p.apiKeyEnv ? "••••••••" : "None"}</code></div>
            </div>
            <div class="card-actions">
              <button class="btn" @click=${() => this.openEditProvider(p)}>⚙️ Edit</button>
              <button class="btn btn-danger" @click=${() => this.deleteProvider(p.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderModels() {
    return html`
      <div class="list-grid">
        ${this.models.map(m => html`
          <div class="card">
            <div class="card-title">${m.name}</div>
            <div class="card-sub">ID: ${m.id}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary)">
              <div>Provider: <span style="text-transform: uppercase; font-weight: bold; color: var(--accent-secondary)">${m.provider}</span></div>
              <div>Context: <code>${m.contextLength ? m.contextLength.toLocaleString() : "Unknown"} tokens</code></div>
            </div>
            <div class="card-actions">
              <button class="btn" @click=${() => this.openEditModel(m)}>⚙️ Edit</button>
              <button class="btn btn-danger" @click=${() => this.deleteModel(m.provider, m.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderProviderFormFields() {
    return html`
      <div class="form-group">
        <label for="provId">Provider Identifier ID</label>
        <input 
          type="text" 
          id="provId" 
          placeholder="e.g. ollama or openai-compatible" 
          .value=${this.provId}
          @input=${(e: any) => this.provId = e.target.value}
          ?disabled=${this.formMode === "edit"}
        />
      </div>

      <div class="form-group">
        <label for="provName">Provider Name</label>
        <input 
          type="text" 
          id="provName" 
          placeholder="e.g. Ollama Localhost" 
          .value=${this.provName}
          @input=${(e: any) => this.provName = e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="provBaseUrl">Base API Endpoint URL (Optional)</label>
        <input 
          type="text" 
          id="provBaseUrl" 
          placeholder="e.g. http://localhost:11434/v1" 
          .value=${this.provBaseUrl}
          @input=${(e: any) => this.provBaseUrl = e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="provApiKeyEnv">API Key Token (Optional)</label>
        <input 
          type="password" 
          id="provApiKeyEnv" 
          placeholder="e.g. sk-..." 
          .value=${this.provApiKeyEnv}
          @input=${(e: any) => this.provApiKeyEnv = e.target.value}
        />
      </div>
    `;
  }

  private renderModelFormFields() {
    return html`
      <div class="form-group">
        <label for="modelId">Model ID / Name Identifier</label>
        <input 
          type="text" 
          id="modelId" 
          placeholder="e.g. gpt-4o or llama3" 
          .value=${this.modelId}
          @input=${(e: any) => this.modelId = e.target.value}
          ?disabled=${this.formMode === "edit"}
        />
      </div>

      <div class="form-group">
        <label for="modelName">Model Readable Name</label>
        <input 
          type="text" 
          id="modelName" 
          placeholder="e.g. GPT-4o Enterprise" 
          .value=${this.modelName}
          @input=${(e: any) => this.modelName = e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="modelProv">Provider</label>
        <select id="modelProv" .value=${this.modelProv} @change=${(e: any) => this.modelProv = e.target.value}>
          ${this.providers.map(p => html`
            <option value=${p.id}>${p.name}</option>
          `)}
        </select>
      </div>

      <div class="form-group">
        <label for="modelCtx">Context Window Length (tokens)</label>
        <input 
          type="number" 
          id="modelCtx" 
          .value=${this.modelCtx}
          @input=${(e: any) => this.modelCtx = parseInt(e.target.value, 10)}
        />
      </div>
    `;
  }
}
