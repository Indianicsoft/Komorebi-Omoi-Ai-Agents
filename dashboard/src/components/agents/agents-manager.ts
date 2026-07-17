import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface Provider {
  id: string;
  name: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
}

@customElement("agents-manager")
export class AgentsManager extends LitElement {
  @state() private config: any = null;
  @state() private baseHash = "";
  @state() private agents: any[] = [];
  @state() private providers: Provider[] = [];
  @state() private models: Model[] = [];
  @state() private agentStats: Record<string, any> = {};
  @state() private agentIntelligence: Record<string, any> = {};
  @state() private curatingAgentId: string | null = null;
  @state() private curateStatusMsg = "";

  // Form & Wizard states
  @state() private isWizardOpen = false;
  @state() private wizardStep = 1;
  @state() private isConfigPanelOpen = false;
  @state() private activeTab = "identity"; // identity, model, tools, telegram, memory
  @state() private inlineMemoryContent = "";

  // Fields for Wizard/Edit panel
  @state() private agentId = "";
  @state() private agentName = "";
  @state() private agentWorkspace = "";
  @state() private agentProv = "";
  @state() private agentModel = "";
  @state() private agentTemp = 0.4;
  @state() private agentMaxTokens = 4096;
  @state() private agentSandbox = "none";
  @state() private agentTools: string[] = [];
  @state() private agentBotToken = "";
  @state() private agentBotAllowedUsers = "";
  @state() private allowUnrestrictedCommands = false;
  @state() private allowSelfImprovement = false;
  @state() private agentApiKey = "";

  private wsClient = WsClient.getInstance();
  private statsInterval: any = null;

  private availableTools = [
    { name: "read_file", desc: "View file contents recursively.", category: "File Systems" },
    { name: "write_file", desc: "Create and overwrite workspace files.", category: "File Systems" },
    { name: "edit_file", desc: "Inline find-and-replace line edits.", category: "File Systems" },
    { name: "append_file", desc: "Append text to files without overwriting.", category: "File Systems" },
    { name: "list_dir", desc: "Tree-style view of directories.", category: "File Systems" },
    { name: "exec", desc: "Run terminal shell commands on host.", category: "Shell Operations" },
    { name: "web_search", desc: "Search the web using DuckDuckGo snippets.", category: "Web Services" },
    { name: "web_fetch", desc: "Fetch webpage HTML converted to text.", category: "Web Services" },
    { name: "http_stream", desc: "Stream large REST API payloads.", category: "Web Services" },
    { name: "think", desc: "Private agent reasoning scratchpad.", category: "Cognitive" },
    { name: "spawn_subagent", desc: "Spawn background helper sub-agents.", category: "Collaboration" }
  ];

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
      margin-bottom: 0.5rem;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    /* Premium Pulsing Mood Card */
    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 2px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
    }

    /* Pulsing Mood Borders */
    .card.mood-focused { border-color: rgba(52, 211, 153, 0.4); box-shadow: 0 0 15px rgba(52, 211, 153, 0.15); }
    .card.mood-busy { border-color: rgba(251, 191, 36, 0.4); box-shadow: 0 0 15px rgba(251, 191, 36, 0.15); }
    .card.mood-idle { border-color: rgba(96, 165, 250, 0.4); box-shadow: 0 0 15px rgba(96, 165, 250, 0.15); }
    .card.mood-alert { border-color: rgba(248, 113, 113, 0.4); box-shadow: 0 0 15px rgba(248, 113, 113, 0.15); }

    .mood-ring {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .mood-focused .mood-ring { background-color: #10b981; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
    .mood-busy .mood-ring { background-color: #f59e0b; box-shadow: 0 0 8px #f59e0b; animation: pulse 2s infinite; }
    .mood-idle .mood-ring { background-color: #3b82f6; box-shadow: 0 0 8px #3b82f6; animation: pulse 2s infinite; }
    .mood-alert .mood-ring { background-color: #ef4444; box-shadow: 0 0 8px #ef4444; animation: pulse 1s infinite; }
    .mood-offline .mood-ring { background-color: #6b7280; }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.5; }
    }

    .card-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .card-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
    }

    .card-id {
      font-size: 0.8rem;
      color: var(--text-muted, #9ca3af);
      font-family: monospace;
    }

    /* Telemetry Grid */
    .telemetry-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.75rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .telemetry-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .telemetry-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
    }

    .telemetry-value {
      font-size: 0.9rem;
      font-weight: 600;
      color: #e5e7eb;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-focused { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .badge-busy { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge-idle { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .badge-alert { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .badge-offline { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Modal / Configuration Side-Panel */
    .side-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 500px;
      height: 100vh;
      background: #111118;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
      z-index: 150;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .side-panel.open {
      transform: translateX(0);
    }

    .panel-header {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0 1rem;
    }

    .tab-btn {
      padding: 0.75rem 1rem;
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-btn.active {
      color: #a78bfa;
      border-bottom-color: #a78bfa;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.01);
      display: flex;
      gap: 0.75rem;
    }

    /* Create Wizard Styles */
    .wizard-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .wizard-box {
      width: 550px;
      background: #111118;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .wizard-progress {
      display: flex;
      justify-content: space-between;
      position: relative;
      margin-bottom: 1rem;
    }

    .wizard-progress::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 2px;
      background: rgba(255, 255, 255, 0.08);
      z-index: 1;
    }

    .wizard-step-indicator {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #1e1e28;
      border: 2px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      z-index: 2;
      transition: all 0.3s;
    }

    .wizard-step-indicator.active {
      background: #a78bfa;
      border-color: #a78bfa;
      box-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
    }

    .wizard-step-indicator.completed {
      background: #10b981;
      border-color: #10b981;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, select, textarea {
      background: #181824;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #fff;
      padding: 0.6rem 0.8rem;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #a78bfa;
    }

    /* Tools check grid */
    .tools-check-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      background: #181824;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      max-height: 200px;
      overflow-y: auto;
    }

    .tool-check-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .btn {
      background: #1e1e28;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-primary {
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      border: none;
      color: #fff;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-danger {
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.2);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    code {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: #f472b6;
    }

    .memory-viewer {
      background: #09090d;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.8rem;
      color: #34d399;
      height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.wsClient.addStatusListener((status) => {
      if (status === "connected") {
        this.loadConfig();
        this.startStatsPolling();
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.statsInterval) clearInterval(this.statsInterval);
  }

  private startStatsPolling() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.pollStats();
    this.statsInterval = setInterval(() => this.pollStats(), 5000);
  }

  private async pollStats() {
    try {
      const statsList: any = {};
      for (const agent of this.agents) {
        try {
          const stats = await this.wsClient.send<any>("getAgentStats", { agentId: agent.id });
          statsList[agent.id] = stats;
        } catch {}
      }
      this.agentStats = statsList;

      // Also refresh fleet intelligence
      const body = await this.wsClient.send<any>("getSystemIntelligence");
      this.agentIntelligence = body.agents || {};
    } catch {}
  }

  /** On-demand skill curation trigger — called from Memory tab button */
  private async curateAgentSkills(agentId: string) {
    this.curatingAgentId = agentId;
    this.curateStatusMsg = "";
    try {
      const data = await this.wsClient.send<any>("curateAgentSkills", { agentId });
      this.curateStatusMsg = `✓ ${data.message || "Done"}`;
      setTimeout(() => this.pollStats(), 2000);
    } catch (err: any) {
      this.curateStatusMsg = `✗ ${err.message || "Failed"}`;
    } finally {
      this.curatingAgentId = null;
      setTimeout(() => { this.curateStatusMsg = ""; }, 5000);
    }
  }

  /** Compute composite IQ score 0-100 */
  private computeIQ(intel: any): number {
    if (!intel) return 0;
    const sr = (intel.skillSuccessRate ?? 0) * 50;
    const tb = Math.min(intel.totalTurns ?? 0, 500) / 500 * 20;
    const sb = Math.min(intel.learnedSkillCount ?? 0, 20) / 20 * 15;
    const mb = Math.min(intel.memorySizeKb ?? 0, 64) / 64 * 15;
    return Math.min(100, Math.round(sr + tb + sb + mb));
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.baseHash = data.hash;
      this.agents = this.config.agents || [];

      this.providers = [];
      this.models = [];

      // 1. Try parsing from config.models.providers (object structure)
      if (this.config.models && this.config.models.providers) {
        const provs = this.config.models.providers;
        for (const [provId, provData] of Object.entries(provs)) {
          const p = provData as any;
          if (!this.providers.find(x => x.id === provId)) {
            this.providers.push({
              id: provId,
              name: p.name || provId
            });
          }

          const mList = p.models || [];
          for (const m of mList) {
            const mId = typeof m === "string" ? m : m.id;
            if (!this.models.find(x => x.id === mId && x.provider === provId)) {
              this.models.push({
                id: mId,
                name: typeof m === "string" ? m : (m.name || m.id),
                provider: provId
              });
            }
          }
        }
      }

      // 2. Try parsing from config.providers and config.models (array structure)
      if (this.config.providers) {
        if (Array.isArray(this.config.providers)) {
          this.config.providers.forEach((p: any) => {
            if (p && p.id && !this.providers.find(x => x.id === p.id)) {
              this.providers.push({ id: p.id, name: p.name || p.id });
            }
          });
        } else if (typeof this.config.providers === "object") {
          for (const [provId, p] of Object.entries(this.config.providers)) {
            if (!this.providers.find(x => x.id === provId)) {
              this.providers.push({ id: provId, name: (p as any).name || provId });
            }
          }
        }
      }

      if (this.config.models) {
        if (Array.isArray(this.config.models)) {
          this.config.models.forEach((m: any) => {
            if (m && m.id) {
              const mProv = m.provider || (this.providers[0]?.id || "");
              if (!this.models.find(x => x.id === m.id && x.provider === mProv)) {
                this.models.push({ id: m.id, name: m.name || m.id, provider: mProv });
              }
            }
          });
        }
      }

      // 3. Dynamic default selections
      if (this.providers.length > 0 && !this.agentProv) {
        this.agentProv = this.providers[0].id;
        const firstModel = this.models.find(m => m.provider === this.agentProv);
        this.agentModel = firstModel ? firstModel.id : "";
      }
    } catch (err) {
      console.error("[AgentsManager] Failed to load config:", err);
    }
  }

  private async saveConfig() {
    const updatedConfig = { ...this.config, agents: this.agents };

    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: updatedConfig,
        baseHash: this.baseHash
      });

      if (result.success) {
        this.baseHash = result.hash;
        this.pollStats();
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("[AgentsManager] Failed to save config:", err);
    }
  }

  private getTelegramBot(agentId: string) {
    if (!this.config?.telegram?.bots) return null;
    return this.config.telegram.bots.find((b: any) => b.agentId === agentId) || null;
  }

  private handleProviderChange(e: any) {
    this.agentProv = e.target.value;
    const firstModel = this.models.find(m => m.provider === this.agentProv);
    this.agentModel = firstModel ? firstModel.id : "";
  }

  // --- Actions ---
  private async restartAgent(agentId: string) {
    try {
      await this.wsClient.send("restartAgent", { agentId });
      alert(`Agent '${agentId}' restart request sent.`);
      this.pollStats();
    } catch {}
  }

  private async restartGateway() {
    if (!confirm("Are you sure you want to restart the Gateway daemon?")) return;
    try {
      await this.wsClient.send("restartGateway");
      alert("Gateway restarting...");
    } catch {}
  }

  // --- Wizard handlers ---
  private openWizard() {
    this.agentId = "";
    this.agentName = "";
    this.agentWorkspace = "";
    this.agentProv = this.providers[0]?.id || "";
    this.agentModel = this.models.find(m => m.provider === this.agentProv)?.id || "";
    this.agentTemp = 0.4;
    this.agentMaxTokens = 4096;
    this.agentSandbox = "none";
    this.agentTools = ["read_file", "write_file", "edit_file", "list_dir", "think"];
    this.agentBotToken = "";
    this.agentBotAllowedUsers = "";
    this.allowUnrestrictedCommands = false;
    this.allowSelfImprovement = false;
    this.agentApiKey = "";
    this.wizardStep = 1;
    this.isWizardOpen = true;
  }

  private wizardNext() {
    if (this.wizardStep === 1 && (!this.agentId || !this.agentName)) {
      alert("Please provide an ID and display name.");
      return;
    }
    if (this.wizardStep === 1) {
      this.agentWorkspace = `/home/rohith/.komorebi/agents/${this.agentId}`;
    }
    this.wizardStep++;
  }

  private wizardPrev() {
    this.wizardStep--;
  }

  private finishWizard() {
    let apiKeyVal = this.agentApiKey.trim();
    if (!apiKeyVal) {
      const selectedProvider = this.config.models?.providers?.[this.agentProv];
      const provApiKey = selectedProvider?.apiKey || "";
      if (provApiKey && !provApiKey.startsWith("$") && provApiKey !== "mock-key" && provApiKey !== "dummy") {
        apiKeyVal = `\${${provApiKey}}`;
      } else {
        apiKeyVal = provApiKey || `\${${this.agentProv.toUpperCase()}_API_KEY}`;
      }
    }

    const agentPayload = {
      id: this.agentId,
      name: this.agentName,
      workspace: this.agentWorkspace,
      model: {
        provider: this.agentProv,
        name: this.agentModel,
        apiKey: apiKeyVal,
        temperature: this.agentTemp,
        maxOutputTokens: this.agentMaxTokens
      },
      toolPolicy: {
        sandboxType: this.agentSandbox,
        allowedTools: this.agentTools,
        networkAccess: true,
        allowUnrestrictedCommands: this.allowUnrestrictedCommands,
        allowSelfImprovement: this.allowSelfImprovement
      },
      tools: this.agentTools
    };

    if (this.agents.find(a => a.id === this.agentId)) {
      alert("Agent with this ID already exists.");
      return;
    }

    this.agents = [...this.agents, agentPayload];

    if (this.agentBotToken) {
      if (!this.config.telegram) this.config.telegram = { bots: [] };
      if (!this.config.telegram.bots) this.config.telegram.bots = [];
      this.config.telegram.bots.push({
        token: this.agentBotToken,
        agentId: this.agentId,
        allowedUserIds: this.agentBotAllowedUsers
          ? this.agentBotAllowedUsers.split(",").map(u => parseInt(u.trim(), 10)).filter(Number.isInteger)
          : []
      });
    }

    this.isWizardOpen = false;
    this.saveConfig();
  }

  // --- Configuration Panel handlers ---
  private async openConfigPanel(agent: any) {
    this.agentId = agent.id;
    this.agentName = agent.name;
    this.agentWorkspace = agent.workspace || "";
    this.agentProv = agent.model?.provider || (this.providers[0]?.id || "");
    this.agentModel = agent.model?.name || (this.models.find(m => m.provider === this.agentProv)?.id || "");
    this.agentTemp = agent.model?.temperature ?? 0.4;
    this.agentMaxTokens = agent.model?.maxOutputTokens || 4096;
    this.agentSandbox = agent.toolPolicy?.sandboxType || "none";
    this.agentTools = agent.tools || agent.toolPolicy?.allowedTools || [];
    this.allowUnrestrictedCommands = agent.toolPolicy?.allowUnrestrictedCommands ?? false;
    this.allowSelfImprovement = agent.toolPolicy?.allowSelfImprovement ?? false;
    this.agentApiKey = agent.model?.apiKey || "";

    const bot = this.getTelegramBot(agent.id);
    this.agentBotToken = bot ? bot.token : "";
    this.agentBotAllowedUsers = bot ? (bot.allowedUserIds || []).join(", ") : "";

    this.activeTab = "identity";
    this.isConfigPanelOpen = true;

    // Load memory content
    this.inlineMemoryContent = "Loading memory.md...";
    try {
      const res = await this.wsClient.send<any>("readAgentFile", {
        agentId: agent.id,
        filename: "memory.md"
      });
      this.inlineMemoryContent = res.content || "Empty memory file.";
    } catch {
      this.inlineMemoryContent = "No memory.md file initialized yet.";
    }
  }

  private saveConfigPanel() {
    let apiKeyVal = this.agentApiKey.trim();
    if (!apiKeyVal) {
      const selectedProvider = this.config.models?.providers?.[this.agentProv];
      const provApiKey = selectedProvider?.apiKey || "";
      if (provApiKey && !provApiKey.startsWith("$") && provApiKey !== "mock-key" && provApiKey !== "dummy") {
        apiKeyVal = `\${${provApiKey}}`;
      } else {
        apiKeyVal = provApiKey || `\${${this.agentProv.toUpperCase()}_API_KEY}`;
      }
    }

    const agentPayload = {
      id: this.agentId,
      name: this.agentName,
      workspace: this.agentWorkspace,
      model: {
        provider: this.agentProv,
        name: this.agentModel,
        apiKey: apiKeyVal,
        temperature: this.agentTemp,
        maxOutputTokens: this.agentMaxTokens
      },
      toolPolicy: {
        sandboxType: this.agentSandbox,
        allowedTools: this.agentTools,
        networkAccess: true,
        allowUnrestrictedCommands: this.allowUnrestrictedCommands,
        allowSelfImprovement: this.allowSelfImprovement
      },
      tools: this.agentTools
    };

    this.agents = this.agents.map(a => a.id === this.agentId ? agentPayload : a);

    if (this.agentBotToken) {
      if (!this.config.telegram) this.config.telegram = { bots: [] };
      if (!this.config.telegram.bots) this.config.telegram.bots = [];
      const botPayload = {
        token: this.agentBotToken,
        agentId: this.agentId,
        allowedUserIds: this.agentBotAllowedUsers
          ? this.agentBotAllowedUsers.split(",").map(u => parseInt(u.trim(), 10)).filter(Number.isInteger)
          : []
      };
      const idx = this.config.telegram.bots.findIndex((b: any) => b.agentId === this.agentId);
      if (idx > -1) {
        this.config.telegram.bots[idx] = botPayload;
      } else {
        this.config.telegram.bots.push(botPayload);
      }
    } else {
      if (this.config.telegram?.bots) {
        this.config.telegram.bots = this.config.telegram.bots.filter((b: any) => b.agentId !== this.agentId);
      }
    }

    this.isConfigPanelOpen = false;
    this.saveConfig();
  }

  private deleteAgent(id: string) {
    if (!confirm(`Are you sure you want to delete agent ${id}?`)) return;
    this.agents = this.agents.filter(a => a.id !== id);
    if (this.config.telegram?.bots) {
      this.config.telegram.bots = this.config.telegram.bots.filter((b: any) => b.agentId !== id);
    }
    this.saveConfig();
  }

  private handleToolToggle(toolName: string, isChecked: boolean) {
    if (isChecked) {
      if (!this.agentTools.includes(toolName)) this.agentTools = [...this.agentTools, toolName];
    } else {
      this.agentTools = this.agentTools.filter(t => t !== toolName);
    }
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">Agent Fleet Coordinator</div>
        <div style="display: flex; gap: 0.5rem">
          <button class="btn btn-primary" @click=${this.openWizard}>➕ Create Agent</button>
          <button class="btn btn-danger" @click=${this.restartGateway}>🔄 Restart Gateway</button>
        </div>
      </div>

      <div class="list-grid">
        ${this.agents.map(agent => {
          const stats = this.agentStats[agent.id] || { status: "offline", ramUsageMb: 0, cpuPercent: 0, uptimeMs: 0, mood: "offline", turnCount: 0 };
          const moodClass = `mood-${stats.mood || "offline"}`;
          const isRunning = stats.status === "running";

          return html`
            <div class="card ${moodClass}">
              <div class="mood-ring"></div>
              <div class="card-header">
                <div class="card-name">${agent.name}</div>
                <div class="card-id">ID: ${agent.id}</div>
              </div>

              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="telemetry-label">Status</span>
                  <span class="telemetry-value">
                    <span class="badge badge-${stats.status === "running" ? (stats.mood || "focused") : "offline"}">
                      ${stats.status === "running" ? (stats.mood || "focused").toUpperCase() : "OFFLINE"}
                    </span>
                  </span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Model</span>
                  <span class="telemetry-value" style="font-family: monospace; font-size: 0.75rem">${agent.model?.name || "None"}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">RAM Usage</span>
                  <span class="telemetry-value">${isRunning ? `${stats.ramUsageMb} MB` : "—"}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">CPU Load</span>
                  <span class="telemetry-value">${isRunning ? `${stats.cpuPercent}%` : "—"}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Uptime</span>
                  <span class="telemetry-value">${isRunning ? `${Math.round(stats.uptimeMs / 60000)}m` : "—"}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Turns Run</span>
                  <span class="telemetry-value">${isRunning ? stats.turnCount : "—"}</span>
                </div>
                <div class="telemetry-item" style="grid-column: 1 / -1">
                  ${(() => {
                    const intel = this.agentIntelligence[agent.id] || {};
                    const iq = this.computeIQ(intel);
                    const iqColor = iq >= 75 ? "#34d399" : iq >= 45 ? "#fbbf24" : "#f87171";
                    const learnedSkills = intel.learnedSkillCount ?? 0;
                    return html`
                      <div style="display:flex; align-items:center; gap:0.75rem">
                        <span class="telemetry-label">IQ Score</span>
                        <div style="flex:1; height:4px; background:rgba(255,255,255,0.06); border-radius:99px; overflow:hidden">
                          <div style="height:100%; width:${iq}%; background:${iqColor}; border-radius:99px; transition: width 0.8s"></div>
                        </div>
                        <span style="font-size:0.8rem; font-weight:800; color:${iqColor}">${iq}</span>
                        <span style="font-size:0.7rem; color:#6b7280">${learnedSkills} learned</span>
                      </div>
                    `;
                  })()}
                </div>
                ${stats.latestThoughts ? html`
                  <div style="grid-column: 1 / -1; margin-top: 0.5rem; background: rgba(0,0,0,0.12); border: 1px solid rgba(255,255,255,0.03); padding: 0.6rem 0.8rem; border-radius: 8px;">
                    <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--accent-secondary); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.25rem">
                      <span>🧠</span> Latest Thought
                    </div>
                    <div style="font-size: 0.76rem; color: #cbd5e1; font-family: var(--font-mono, monospace); line-height: 1.3">
                      "${stats.latestThoughts}"
                    </div>
                  </div>
                ` : ""}
              </div>

              <div class="card-actions">
                <button class="btn" @click=${() => this.openConfigPanel(agent)}>⚙️ Configure</button>
                <button class="btn btn-primary" ?disabled=${!isRunning} @click=${() => this.restartAgent(agent.id)}>🔄 Restart</button>
                <button class="btn btn-danger" @click=${() => this.deleteAgent(agent.id)}>✕ Delete</button>
              </div>
            </div>
          `;
        })}
      </div>

      <!-- Create Agent Wizard -->
      ${this.isWizardOpen ? html`
        <div class="wizard-overlay">
          <div class="wizard-box">
            <h2 style="margin: 0; background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Agent Creator Wizard
            </h2>
            
            <div class="wizard-progress">
              <div class="wizard-step-indicator ${this.wizardStep >= 1 ? "active" : ""}">1</div>
              <div class="wizard-step-indicator ${this.wizardStep >= 2 ? "active" : ""}">2</div>
              <div class="wizard-step-indicator ${this.wizardStep >= 3 ? "active" : ""}">3</div>
            </div>

            ${this.wizardStep === 1 ? html`
              <div class="form-group">
                <label>Agent Identifier (Process ID)</label>
                <input type="text" placeholder="e.g. coder-agent" .value=${this.agentId} @input=${(e: any) => this.agentId = e.target.value}/>
              </div>
              <div class="form-group">
                <label>Display / Persona Name</label>
                <input type="text" placeholder="e.g. Code Architect" .value=${this.agentName} @input=${(e: any) => this.agentName = e.target.value}/>
              </div>
            ` : ""}

            ${this.wizardStep === 2 ? html`
              <div class="form-group">
                <label>Provider</label>
                <select .value=${this.agentProv} @change=${this.handleProviderChange}>
                  ${this.providers.map(p => html`<option value=${p.id}>${p.name}</option>`)}
                </select>
              </div>
              <div class="form-group">
                <label>Model Name</label>
                ${this.models.filter(m => m.provider === this.agentProv).length > 0 ? html`
                  <select .value=${this.agentModel} @change=${(e: any) => this.agentModel = e.target.value}>
                    ${this.models.filter(m => m.provider === this.agentProv).map(m => html`<option value=${m.id}>${m.name}</option>`)}
                    <option value="custom">-- Custom Model --</option>
                  </select>
                ` : ""}
                ${this.models.filter(m => m.provider === this.agentProv).length === 0 || this.agentModel === "custom" ? html`
                  <input 
                    type="text" 
                    placeholder="Enter custom model name (e.g. gpt-4o)" 
                    .value=${this.agentModel === "custom" ? "" : this.agentModel} 
                    @input=${(e: any) => this.agentModel = e.target.value}
                    style="margin-top: 0.5rem"
                  />
                ` : ""}
              </div>
              <div class="form-group">
                <label>Custom API Key (Optional)</label>
                <input 
                  type="password" 
                  placeholder="e.g. sk-... (leave empty to use global provider key)" 
                  .value=${this.agentApiKey} 
                  @input=${(e: any) => this.agentApiKey = e.target.value}
                />
              </div>
              <div class="form-group">
                <label>System Sandbox Isolation</label>
                <select .value=${this.agentSandbox} @change=${(e: any) => this.agentSandbox = e.target.value}>
                  <option value="none">none (Unjail / Host OS)</option>
                  <option value="bubblewrap">bubblewrap (Sandboxed FS)</option>
                </select>
              </div>
            ` : ""}

            ${this.wizardStep === 3 ? html`
              <div class="form-group">
                <label>Telegram Bot Token (Optional)</label>
                <input type="password" placeholder="e.g. 123456:AAFFGG..." .value=${this.agentBotToken} @input=${(e: any) => this.agentBotToken = e.target.value}/>
              </div>
              <div class="form-group">
                <label>Allowed Telegram Chat IDs (Comma-separated)</label>
                <input type="text" placeholder="e.g. 987654321" .value=${this.agentBotAllowedUsers} @input=${(e: any) => this.agentBotAllowedUsers = e.target.value}/>
              </div>
            ` : ""}

            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem">
              ${this.wizardStep > 1 ? html`<button class="btn" @click=${this.wizardPrev}>Back</button>` : ""}
              ${this.wizardStep < 3 
                ? html`<button class="btn btn-primary" @click=${this.wizardNext}>Next</button>` 
                : html`<button class="btn btn-primary" @click=${this.finishWizard}>Create Agent</button>`}
              <button class="btn" @click=${() => this.isWizardOpen = false}>Cancel</button>
            </div>
          </div>
        </div>
      ` : ""}

      <!-- Slide-Out Configuration & Persona Panel -->
      <div class="side-panel ${this.isConfigPanelOpen ? "open" : ""}">
        <div class="panel-header">
          <h2 style="margin:0; font-size:1.4rem">${this.agentName} Config</h2>
          <button class="btn" @click=${() => this.isConfigPanelOpen = false}>✕</button>
        </div>

        <div class="panel-tabs">
          <button class="tab-btn ${this.activeTab === "identity" ? "active" : ""}" @click=${() => this.activeTab = "identity"}>Identity</button>
          <button class="tab-btn ${this.activeTab === "model" ? "active" : ""}" @click=${() => this.activeTab = "model"}>Model</button>
          <button class="tab-btn ${this.activeTab === "tools" ? "active" : ""}" @click=${() => this.activeTab = "tools"}>Tools</button>
          <button class="tab-btn ${this.activeTab === "telegram" ? "active" : ""}" @click=${() => this.activeTab = "telegram"}>Telegram</button>
          <button class="tab-btn ${this.activeTab === "memory" ? "active" : ""}" @click=${() => this.activeTab = "memory"}>Memory</button>
        </div>

        <div class="panel-content">
          ${this.activeTab === "identity" ? html`
            <div class="form-group">
              <label>Agent Name</label>
              <input type="text" .value=${this.agentName} @input=${(e: any) => this.agentName = e.target.value}/>
            </div>
            <div class="form-group">
              <label>Workspace Path</label>
              <input type="text" .value=${this.agentWorkspace} @input=${(e: any) => this.agentWorkspace = e.target.value}/>
            </div>
          ` : ""}

          ${this.activeTab === "model" ? html`
            <div class="form-group">
              <label>Provider</label>
              <select .value=${this.agentProv} @change=${this.handleProviderChange}>
                ${this.providers.map(p => html`<option value=${p.id}>${p.name}</option>`)}
              </select>
            </div>
            <div class="form-group">
              <label>Model Name</label>
              ${this.models.filter(m => m.provider === this.agentProv).length > 0 ? html`
                <select .value=${this.agentModel} @change=${(e: any) => this.agentModel = e.target.value}>
                  ${this.models.filter(m => m.provider === this.agentProv).map(m => html`<option value=${m.id}>${m.name}</option>`)}
                  <option value="custom">-- Custom Model --</option>
                </select>
              ` : ""}
              ${this.models.filter(m => m.provider === this.agentProv).length === 0 || this.agentModel === "custom" ? html`
                <input 
                  type="text" 
                  placeholder="Enter custom model name (e.g. gpt-4o)" 
                  .value=${this.agentModel === "custom" ? "" : this.agentModel} 
                  @input=${(e: any) => this.agentModel = e.target.value}
                  style="margin-top: 0.5rem"
                />
              ` : ""}
            </div>
            <div class="form-group">
              <label>Custom API Key (Optional)</label>
              <input 
                type="password" 
                placeholder="e.g. sk-... (leave empty to use global provider key)" 
                .value=${this.agentApiKey} 
                @input=${(e: any) => this.agentApiKey = e.target.value}
              />
            </div>
            <div class="form-group">
              <label>Temperature (${this.agentTemp})</label>
              <input type="range" min="0" max="1" step="0.05" .value=${this.agentTemp} @input=${(e: any) => this.agentTemp = parseFloat(e.target.value)}/>
            </div>
          ` : ""}

          ${this.activeTab === "tools" ? html`
            <div class="form-group">
              <label>Allowed Tools Checklist</label>
              <div class="tools-check-grid" style="max-height: none">
                ${this.availableTools.map(t => html`
                  <div class="tool-check-item">
                    <input type="checkbox" .checked=${this.agentTools.includes(t.name)} @change=${(e: any) => this.handleToolToggle(t.name, e.target.checked)}/>
                    <span><code>${t.name}</code></span>
                  </div>
                `)}
              </div>
            </div>
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 1rem;">
                <input type="checkbox" .checked=${this.allowUnrestrictedCommands} @change=${(e: any) => this.allowUnrestrictedCommands = e.target.checked} style="width: auto;"/>
                <span>Bypass Telegram command approvals</span>
              </label>
            </div>
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.5rem;">
                <input type="checkbox" .checked=${this.allowSelfImprovement} @change=${(e: any) => this.allowSelfImprovement = e.target.checked} style="width: auto;"/>
                <span>Allow Self-Improvement & Code Modifications</span>
              </label>
            </div>
          ` : ""}

          ${this.activeTab === "telegram" ? html`
            <div class="form-group">
              <label>Bot Token</label>
              <input type="password" placeholder="Token" .value=${this.agentBotToken} @input=${(e: any) => this.agentBotToken = e.target.value}/>
            </div>
            <div class="form-group">
              <label>Allowed User IDs</label>
              <input type="text" placeholder="Allowed IDs" .value=${this.agentBotAllowedUsers} @input=${(e: any) => this.agentBotAllowedUsers = e.target.value}/>
            </div>
          ` : ""}

          ${this.activeTab === "memory" ? html`
            <div class="form-group">
              <label>MEMORY.md contents</label>
              <div class="memory-viewer">${this.inlineMemoryContent}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.06)">
              <button
                class="btn btn-primary"
                style="flex:1"
                @click=${() => this.curateAgentSkills(this.agentId)}
                ?disabled=${this.curatingAgentId === this.agentId}
              >
                ${this.curatingAgentId === this.agentId ? "⏳ Curating Skills..." : "✨ Curate Skills Now"}
              </button>
              ${this.curateStatusMsg ? html`<span style="font-size:0.8rem;color:#34d399">${this.curateStatusMsg}</span>` : ""}
            </div>
          ` : ""}
        </div>

        <div class="panel-footer">
          <button class="btn btn-primary" style="flex:1" @click=${this.saveConfigPanel}>Save Changes</button>
          <button class="btn" @click=${() => this.isConfigPanelOpen = false}>Cancel</button>
        </div>
      </div>
    `;
  }
}
