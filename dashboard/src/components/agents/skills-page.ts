import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface AgentConfig {
  id: string;
  name: string;
  tools?: string[];
  toolPolicy?: {
    allowedTools?: string[];
  };
}

@customElement("skills-page")
export class SkillsPage extends LitElement {
  @state() private config: any = null;
  @state() private baseHash: string = "";
  @state() private selectedAgentId = "";
  @state() private envKeys: Record<string, string> = {};

  // Tab state
  @state() private currentTab: "capabilities" | "clawhub" | "installed" | "learned" = "capabilities";
  @state() private filterType: "all" | "skills" | "plugins" = "all";
  @state() private installedSkills: any[] = [];
  @state() private installedPlugins: any[] = [];
  @state() private learnedSkills: any[] = [];
  @state() private isInstalledLoading = false;
  @state() private skillsHealth: Record<string, any> = {};
  @state() private expandedFindings: Record<string, boolean> = {};

  // ClawHub Browse state
  @state() private searchQuery = "";
  @state() private searchResults: any[] = [];
  @state() private isSearching = false;
  @state() private licenses: string[] = [];

  // Install Modal state
  @state() private isInstallModalOpen = false;
  @state() private selectedSkill: any = null;
  @state() private targetAgentId = "global";
  @state() private installStatus = "";
  @state() private isInstalling = false;
  @state() private securityResult: { passed: boolean; error?: string; warnings: string[] } | null = null;

  private wsClient = WsClient.getInstance();

  private availableTools = [
    { name: "read_file", desc: "Allows agent to view file contents recursively.", category: "File Systems" },
    { name: "write_file", desc: "Allows agent to create and overwrite project files.", category: "File Systems" },
    { name: "edit_file", desc: "Performs targeted, inline edits of lines in place.", category: "File Systems" },
    { name: "exec", desc: "Runs CLI commands inside sandbox workspace shell.", category: "Shell Operations" },
    { name: "web_search", desc: "Performs search engine crawls for data lookups.", category: "Web Services" },
    { name: "web_fetch", desc: "Fetches and converts webpage HTML content to markdown.", category: "Web Services" },
    { name: "telegram_reply", desc: "Dispatches outbound messages back to Telegram channels.", category: "Integrations" }
  ];

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

    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      gap: 1rem;
    }

    .tab-item {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-item:hover {
      color: var(--text-primary);
    }

    .tab-item.active {
      color: var(--accent-secondary);
      border-bottom-color: var(--accent-secondary);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 1.5rem;
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

    .panel-header {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Capabilities list styles */
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .skill-card {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      transition: border-color 0.2s;
    }

    .skill-card:hover {
      border-color: var(--accent-primary);
    }

    .skill-checkbox {
      width: auto;
      margin-top: 0.2rem;
      cursor: pointer;
    }

    .skill-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .skill-name {
      font-weight: 600;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .skill-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.3;
    }

    .skill-category {
      font-size: 0.7rem;
      background: var(--bg-primary);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
      border: 1px solid var(--border-color);
      align-self: flex-start;
    }

    .env-form {
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
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background-color: var(--bg-tertiary);
      border-color: var(--border-color);
    }

    .btn-secondary:hover {
      background-color: var(--border-color);
    }

    /* ClawHub Browse Grid */
    .clawhub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .ch-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .ch-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ch-name {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .ch-slug {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .ch-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
      flex: 1;
    }

    .ch-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      border-top: 1px dashed var(--border-color);
      padding-top: 0.5rem;
    }

    .badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }

    .badge.verified {
      background-color: var(--status-green-glow);
      color: var(--status-green);
    }

    .badge.unverified {
      background-color: var(--status-yellow-glow);
      color: var(--status-yellow);
    }

    .badge.price {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
    }

    .badge.plugin {
      background-color: rgba(168, 85, 247, 0.15);
      color: rgb(192, 132, 252);
      border: 1px solid rgba(168, 85, 247, 0.3);
    }

    .badge.skill {
      background-color: rgba(59, 130, 246, 0.15);
      color: rgb(147, 197, 253);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    /* Modal Overlay */
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
      width: 500px;
      max-height: 85vh;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
    }

    .security-panel {
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      font-size: 0.8rem;
    }

    .security-panel.pass {
      background-color: var(--status-green-glow);
      border-color: rgba(0, 255, 100, 0.2);
    }

    .security-panel.fail {
      background-color: var(--status-red-glow);
      border-color: rgba(255, 51, 102, 0.2);
    }

    .security-panel.warn {
      background-color: var(--status-yellow-glow);
      border-color: rgba(255, 170, 0, 0.2);
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background-color: var(--bg-primary);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }

    /* Filters row */
    .filters-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .segment-bar {
      display: flex;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }

    .segment-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .segment-btn:hover {
      color: var(--text-primary);
    }

    .segment-btn.active {
      background-color: var(--border-color);
      color: var(--accent-secondary);
    }

    .trust-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .trust-verified {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .trust-trusted {
      background-color: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .trust-unknown {
      background-color: rgba(156, 163, 175, 0.15);
      color: #9ca3af;
      border: 1px solid rgba(156, 163, 175, 0.3);
    }
    .trust-suspicious {
      background-color: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .trust-untrusted {
      background-color: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .circuit-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }
    .circuit-closed {
      background-color: rgba(16, 185, 129, 0.2);
      color: #34d399;
    }
    .circuit-open {
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .circuit-half {
      background-color: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }

    .health-stats {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 0.5rem;
      border-radius: 6px;
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .sparkline {
      display: flex;
      gap: 0.15rem;
      align-items: center;
      margin-top: 0.2rem;
    }
    .spark-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .spark-success {
      background-color: #10b981;
    }
    .spark-fail {
      background-color: #ef4444;
    }

    .findings-btn {
      background: none;
      border: none;
      color: var(--accent-secondary);
      font-size: 0.75rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      align-self: flex-start;
      margin-top: 0.25rem;
    }

    .findings-detail {
      font-size: 0.7rem;
      color: var(--text-muted);
      background: rgba(0,0,0,0.2);
      padding: 0.4rem;
      border-radius: 4px;
      margin-top: 0.25rem;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.loadLicenses();
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.baseHash = data.hash;

      this.envKeys = this.config.env || {
        GEMINI_API_KEY: "",
        OPENAI_API_KEY: "",
        TELEGRAM_BOT_TOKEN: ""
      };

      if (this.config.agents && this.config.agents.length > 0 && !this.selectedAgentId) {
        this.selectedAgentId = this.config.agents[0].id;
      }

      this.loadInstalledPackages();
    } catch (err) {
      console.error("[Skills] Failed to load configuration:", err);
    }
  }

  private handleAgentChange(e: any) {
    this.selectedAgentId = e.target.value;
    this.loadInstalledPackages();
  }

  private async loadInstalledPackages() {
    if (!this.selectedAgentId) return;
    this.isInstalledLoading = true;
    try {
      const data = await this.wsClient.send<any>("listAgentSkills", { agentId: this.selectedAgentId });
      this.installedSkills = data.skills || [];
      this.installedPlugins = data.plugins || [];
      this.learnedSkills = data.learnedSkills || [];

      this.skillsHealth = await this.wsClient.send<any>("getAgentSkillsHealth", { agentId: this.selectedAgentId });
    } catch (err) {
      console.error("[Skills] Failed to load installed packages or health:", err);
    } finally {
      this.isInstalledLoading = false;
    }
  }

  private async toggleCircuitBreaker(skillName: string, currentState: string) {
    const nextState = currentState === "OPEN" ? "CLOSED" : "OPEN";
    try {
      await this.wsClient.send("toggleSkillCircuit", {
        agentId: this.selectedAgentId,
        skillName,
        state: nextState
      });
      this.loadInstalledPackages();
    } catch (err: any) {
      alert(`Error toggling circuit state: ${err.message}`);
    }
  }

  private toggleFindings(name: string) {
    this.expandedFindings = {
      ...this.expandedFindings,
      [name]: !this.expandedFindings[name]
    };
  }

  private async uninstallPackage(name: string, type: "skill" | "plugin", global: boolean) {
    if (!confirm(`Are you sure you want to uninstall the ${type} '${name}'?`)) {
      return;
    }

    try {
      await this.wsClient.send("uninstallSkill", {
        agentId: this.selectedAgentId,
        name,
        type,
        global
      });
      alert(`Successfully uninstalled ${type} '${name}'.`);
      this.loadInstalledPackages();
    } catch (err: any) {
      alert(`Error uninstalling: ${err.message}`);
    }
  }

  private async loadLicenses() {
    try {
      const data = await this.wsClient.send<any>("listClawhubLicenses");
      this.licenses = data.licenses || [];
    } catch (err) {
      console.error("[Skills] Failed to load licenses:", err);
    }
  }

  private async searchClawHub() {
    this.isSearching = true;
    try {
      const data = await this.wsClient.send<any>("searchClawhubSkills", { query: this.searchQuery });
      this.searchResults = data.results || [];
    } catch (err) {
      console.error("[Skills] ClawHub search failed:", err);
    } finally {
      this.isSearching = false;
    }
  }

  private openInstallDialog(skill: any) {
    this.selectedSkill = skill;
    this.targetAgentId = this.config.agents[0]?.id || "global";
    this.installStatus = "";
    this.isInstalling = false;
    this.checkSecurityPolicy();
    this.isInstallModalOpen = true;
  }

  private checkSecurityPolicy() {
    if (!this.selectedSkill) return;
    
    const skill = this.selectedSkill;
    const warnings: string[] = [];
    let passed = true;
    let error = "";

    // 1. Check unverified publisher warning
    if (!skill.verified) {
      warnings.push("Unverified publisher capability. Code has not been audited by ClawHub.");
    }

    // 2. Check if agent supports requested tools
    if (this.targetAgentId !== "global") {
      const targetAgent = this.config.agents.find((a: any) => a.id === this.targetAgentId);
      const allowedTools = targetAgent?.toolPolicy?.allowedTools || targetAgent?.tools || [];
      for (const t of skill.permissions.allowedTools) {
        if (!allowedTools.includes(t)) {
          passed = false;
          error = `Target agent '${this.targetAgentId}' does not have allowed permission for required tool '${t}'. Deny-always-wins security rule violated.`;
          break;
        }
      }
    }

    this.securityResult = { passed, error, warnings };
  }

  private handleTargetAgentChange(e: any) {
    this.targetAgentId = e.target.value;
    this.checkSecurityPolicy();
  }

  private async installSkill() {
    if (!this.selectedSkill) return;
    this.isInstalling = true;
    this.installStatus = "Validating security checklist...";
    
    try {
      await this.wsClient.send("installSkill", {
        agentId: this.targetAgentId,
        packageUrl: this.selectedSkill.slug,
        type: "skill",
        name: this.selectedSkill.name
      });

      this.installStatus = "Installation succeeded! Capability hot-loaded.";
      setTimeout(() => {
        this.isInstallModalOpen = false;
        this.loadConfig();
      }, 1500);
    } catch (err: any) {
      this.installStatus = `Installation rejected: ${err.message}`;
    } finally {
      this.isInstalling = false;
    }
  }

  private handleToolToggle(toolName: string, isChecked: boolean) {
    if (!this.config) return;

    this.config.agents = this.config.agents.map((agent: AgentConfig) => {
      if (agent.id === this.selectedAgentId) {
        let toolsList = [...(agent.tools || [])];
        if (isChecked) {
          if (!toolsList.includes(toolName)) toolsList.push(toolName);
        } else {
          toolsList = toolsList.filter(t => t !== toolName);
        }
        return { ...agent, tools: toolsList };
      }
      return agent;
    });

    this.requestUpdate();
  }

  private async saveSettings() {
    const updatedConfig = {
      ...this.config,
      env: this.envKeys
    };

    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: updatedConfig,
        baseHash: this.baseHash
      });

      if (result.conflict) {
        alert("Conflict Error: Config modified. Reloading...");
        await this.loadConfig();
      } else if (result.success) {
        this.baseHash = result.hash;
        alert("Agent capabilities updated successfully.");
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("[Skills] Failed to save capabilities:", err);
    }
  }

  render() {
    if (!this.config) {
      return html`<div>Loading agent settings...</div>`;
    }

    return html`
      <div class="title-row">
        <div class="title">Agent Capabilities & Skills Manager</div>
      </div>

      <div class="tab-bar">
        <button class="tab-item ${this.currentTab === "capabilities" ? "active" : ""}" @click=${() => this.currentTab = "capabilities"}>
          🛠️ Agent Capabilities
        </button>
        <button class="tab-item ${this.currentTab === "installed" ? "active" : ""}" @click=${() => { this.currentTab = "installed"; this.loadInstalledPackages(); }}>
          📦 Installed Packages
        </button>
        <button class="tab-item ${this.currentTab === "learned" ? "active" : ""}" @click=${() => { this.currentTab = "learned"; this.loadInstalledPackages(); }}>
          🧠 Learned Skills
        </button>
        <button class="tab-item ${this.currentTab === "clawhub" ? "active" : ""}" @click=${() => { this.currentTab = "clawhub"; this.searchClawHub(); }}>
          🌍 Browse ClawHub Registry
        </button>
      </div>

      ${this.currentTab === "capabilities" 
        ? this.renderCapabilitiesTab() 
        : this.currentTab === "installed"
          ? this.renderInstalledTab()
          : this.currentTab === "learned"
            ? this.renderLearnedTab()
            : this.renderClawHubTab()}

      <!-- Install Confirm Modal -->
      ${this.isInstallModalOpen && this.selectedSkill ? html`
        <div class="overlay" @click=${() => this.isInstallModalOpen = false}>
          <div class="modal-box" @click=${(e: Event) => e.stopPropagation()}>
            <h3 style="margin-top: 0">Install ClawHub Skill / Plugin</h3>
            <div>Installing <strong>${this.selectedSkill.name}</strong> (<code>${this.selectedSkill.slug}</code>)</div>

            <div class="form-group">
              <label for="installTarget">Target Agent Scope</label>
              <select id="installTarget" .value=${this.targetAgentId} @change=${this.handleTargetAgentChange}>
                <option value="global">Global (Shared by all agents)</option>
                ${this.config.agents.map((a: any) => html`
                  <option value=${a.id}>${a.name || a.id}</option>
                `)}
              </select>
            </div>

            <!-- Security Audit Pre-check -->
            ${this.securityResult ? html`
              <div class="security-panel ${this.securityResult.passed ? (this.securityResult.warnings.length > 0 ? 'warn' : 'pass') : 'fail'}">
                <div style="font-weight: bold; margin-bottom: 0.25rem;">
                  🛡️ Security Audit: ${this.securityResult.passed ? (this.securityResult.warnings.length > 0 ? "WARNINGS" : "PASSED") : "FAILED"}
                </div>
                ${!this.securityResult.passed ? html`
                  <div style="color: var(--status-red);">${this.securityResult.error}</div>
                ` : html`
                  <div style="color: var(--status-green);">This capability complies with the target agent's tool policy boundaries.</div>
                `}
                ${this.securityResult.warnings.map(w => html`
                  <div style="color: var(--status-yellow); margin-top: 0.25rem;">• ${w}</div>
                `)}
              </div>
            ` : ""}

            ${this.installStatus ? html`
              <div style="font-size: 0.85rem; color: var(--accent-secondary); background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; font-family: var(--font-mono)">
                ${this.installStatus}
              </div>
            ` : ""}

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button 
                class="btn" 
                style="flex: 1;" 
                @click=${this.installSkill}
                ?disabled=${this.isInstalling || (this.securityResult && !this.securityResult.passed)}
              >
                📥 Confirm Install
              </button>
              <button class="btn btn-secondary" @click=${() => this.isInstallModalOpen = false}>Cancel</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }

  private renderCapabilitiesTab() {
    const currentAgent = this.config.agents.find((a: any) => a.id === this.selectedAgentId);
    const activeTools: string[] = currentAgent ? currentAgent.tools || currentAgent.toolPolicy?.allowedTools || [] : [];

    return html`
      <div class="layout">
        <!-- Tools List Grid -->
        <div class="panel">
          <div class="panel-header">
            <span>Enabled Tool System APIs</span>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map((a: any) => html`
                <option value=${a.id}>${a.name || a.id}</option>
              `)}
            </select>
          </div>

          <div class="skills-grid">
            ${this.availableTools.map(tool => {
              const isEnabled = activeTools.includes(tool.name);
              return html`
                <div class="skill-card">
                  <input 
                    type="checkbox" 
                    class="skill-checkbox" 
                    .checked=${isEnabled}
                    @change=${(e: any) => this.handleToolToggle(tool.name, e.target.checked)}
                  />
                  <div class="skill-info">
                    <div style="display:flex; align-items:center; gap:0.5rem">
                      <span class="skill-name">${tool.name}</span>
                      <span class="skill-category">${tool.category}</span>
                    </div>
                    <span class="skill-desc">${tool.desc}</span>
                  </div>
                </div>
              `;
            })}
          </div>
        </div>

        <!-- Right Side Env Setup -->
        <div class="panel">
          <div class="panel-header">
            <span>Security Key Vault</span>
          </div>

          <div class="env-form">
            <div class="form-group">
              <label for="geminiKey">Gemini AI API Key</label>
              <input 
                type="password" 
                id="geminiKey" 
                placeholder="AIzaSy..." 
                .value=${this.envKeys.GEMINI_API_KEY || ""}
                @input=${(e: any) => this.envKeys = { ...this.envKeys, GEMINI_API_KEY: e.target.value }}
              />
            </div>

            <div class="form-group">
              <label for="openaiKey">OpenAI API Key (Optional)</label>
              <input 
                type="password" 
                id="openaiKey" 
                placeholder="sk-proj-..." 
                .value=${this.envKeys.OPENAI_API_KEY || ""}
                @input=${(e: any) => this.envKeys = { ...this.envKeys, OPENAI_API_KEY: e.target.value }}
              />
            </div>

            <div class="form-group">
              <label for="anthropicKey">Anthropic API Key (Optional)</label>
              <input 
                type="password" 
                id="anthropicKey" 
                placeholder="sk-ant-..." 
                .value=${this.envKeys.ANTHROPIC_API_KEY || ""}
                @input=${(e: any) => this.envKeys = { ...this.envKeys, ANTHROPIC_API_KEY: e.target.value }}
              />
            </div>

            <button class="btn" @click=${this.saveSettings}>💾 Save capabilities</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderClawHubTab() {
    const filteredResults = this.searchResults.filter(item => {
      const isPlugin = item.category?.toLowerCase().includes("plugin") || 
                       item.slug?.toLowerCase().includes("plugin") ||
                       item.name?.toLowerCase().includes("plugin") ||
                       item.description?.toLowerCase().includes("plugin");

      if (this.filterType === "skills" && isPlugin) return false;
      if (this.filterType === "plugins" && !isPlugin) return false;
      return true;
    });

    return html`
      <div class="panel">
        <div class="panel-header">Browse & Search ClawHub Skills and Plugins</div>
        
        <div class="filters-row">
          <div style="display: flex; gap: 0.5rem; flex: 1;">
            <input 
              type="text" 
              placeholder="Search ClawHub (e.g. calendar, slack, database)..." 
              style="flex: 1;"
              .value=${this.searchQuery}
              @input=${(e: any) => this.searchQuery = e.target.value}
              @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.searchClawHub()}
            />
            <button class="btn" @click=${this.searchClawHub} ?disabled=${this.isSearching}>
              ${this.isSearching ? "Searching..." : "🔍 Search ClawHub"}
            </button>
          </div>

          <div class="segment-bar">
            <button class="segment-btn ${this.filterType === 'all' ? 'active' : ''}" @click=${() => this.filterType = 'all'}>
              All
            </button>
            <button class="segment-btn ${this.filterType === 'skills' ? 'active' : ''}" @click=${() => this.filterType = 'skills'}>
              📖 Skills
            </button>
            <button class="segment-btn ${this.filterType === 'plugins' ? 'active' : ''}" @click=${() => this.filterType = 'plugins'}>
              🔌 Plugins
            </button>
          </div>
        </div>

        <div class="clawhub-grid">
          ${filteredResults.length === 0 ? html`
            <div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 2rem;">
              No ClawHub packages found. Try typing 'calendar' or 'slack'.
            </div>
          ` : filteredResults.map(item => {
            const isPlugin = item.category?.toLowerCase().includes("plugin") || 
                             item.slug?.toLowerCase().includes("plugin") ||
                             item.name?.toLowerCase().includes("plugin") ||
                             item.description?.toLowerCase().includes("plugin");

            const isLicensed = item.price === 0 || this.licenses.includes(item.slug);
            return html`
              <div class="ch-card">
                <div class="ch-title-row">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div class="ch-name">${item.name}</div>
                    <span class="badge ${isPlugin ? 'plugin' : 'skill'}">
                      ${isPlugin ? '🔌 Plugin' : '📖 Skill'}
                    </span>
                  </div>
                  <span class="badge ${item.verified ? 'verified' : 'unverified'}">
                    ${item.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div class="ch-slug">${item.slug}</div>
                <div class="ch-desc">${item.description}</div>
                
                <div class="ch-meta">
                  <div>Publisher: <strong>${item.publisher}</strong></div>
                  <div>Rating: 🌟 <strong>${item.rating} / 5</strong></div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                    <span class="badge price">${item.price === 0 ? "FREE" : "$" + item.price}</span>
                    <button 
                      class="btn btn-secondary" 
                      style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      @click=${() => this.openInstallDialog(item)}
                    >
                      ${isLicensed ? "📥 Install" : "🔒 Buy & Install"}
                    </button>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderInstalledTab() {
    const allInstalled = [
      ...this.installedSkills.map(s => ({ ...s, type: "skill" })),
      ...this.installedPlugins.map(p => ({ ...p, type: "plugin" }))
    ];

    const filtered = allInstalled.filter(item => {
      if (this.filterType === "skills" && item.type !== "skill") return false;
      if (this.filterType === "plugins" && item.type !== "plugin") return false;
      return true;
    });

    return html`
      <div class="panel">
        <div class="panel-header">
          <span>Installed ClawHub Skills & Plugins</span>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <label style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Active Agent:</label>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map((a: any) => html`
                <option value=${a.id}>${a.name || a.id}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="filters-row">
          <div style="font-size: 0.85rem; color: var(--text-secondary)">
            Showing ${filtered.length} installed packages
          </div>

          <div class="segment-bar">
            <button class="segment-btn ${this.filterType === 'all' ? 'active' : ''}" @click=${() => this.filterType = 'all'}>
              All
            </button>
            <button class="segment-btn ${this.filterType === 'skills' ? 'active' : ''}" @click=${() => this.filterType = 'skills'}>
              📖 Skills
            </button>
            <button class="segment-btn ${this.filterType === 'plugins' ? 'active' : ''}" @click=${() => this.filterType = 'plugins'}>
              🔌 Plugins
            </button>
          </div>
        </div>

        ${this.isInstalledLoading ? html`
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Loading installed packages...
          </div>
        ` : filtered.length === 0 ? html`
          <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-tertiary); border-radius: 8px; border: 1px dashed var(--border-color)">
            No skills or plugins installed for this agent.
            <div style="margin-top: 1rem;">
              <button class="btn btn-secondary" style="font-size: 0.85rem;" @click=${() => { this.currentTab = "clawhub"; this.searchClawHub(); }}>
                Browse ClawHub Registry
              </button>
            </div>
          </div>
        ` : html`
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${filtered.map(item => {
              const health = this.skillsHealth[item.name] || { state: "CLOSED", successRate: 1.0, runs: 0, history: [] };
              const isExpanded = !!this.expandedFindings[item.name];
              const scoreClass = `trust-${(item.trustScore || "unknown").toLowerCase()}`;

              return html`
                <div class="ch-card">
                  <div class="ch-title-row">
                    <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                      <div class="ch-name" style="font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title=${item.name}>${item.name}</div>
                      <span class="badge ${item.type === 'plugin' ? 'plugin' : 'skill'}">
                        ${item.type === 'plugin' ? '🔌 Plugin' : '📖 Skill'}
                      </span>
                    </div>
                    <span class="trust-badge ${scoreClass}">
                      ${item.trustScore || "unknown"}
                    </span>
                  </div>
                  <div class="ch-slug" style="font-size: 0.7rem; color: var(--text-muted);">Version: ${item.version || "1.0.0"} | Scope: ${item.scope}</div>
                  <div class="ch-desc" style="font-size: 0.8rem; margin: 0.25rem 0 0.5rem 0;">${item.description || "No description provided."}</div>
                  
                  <!-- Health & Circuit Telemetry -->
                  <div class="health-stats">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>Circuit State:</span>
                      <span class="circuit-badge ${health.state === 'OPEN' ? 'circuit-open' : health.state === 'HALF_OPEN' ? 'circuit-half' : 'circuit-closed'}">
                        ${health.state}
                      </span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                      <span>Success Rate:</span>
                      <strong>${(health.successRate * 100).toFixed(0)}% (${health.runs} runs)</strong>
                    </div>
                    ${health.history && health.history.length > 0 ? html`
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Recent:</span>
                        <div class="sparkline">
                          ${health.history.map((h: boolean) => html`
                            <span class="spark-dot ${h ? 'spark-success' : 'spark-fail'}"></span>
                          `)}
                        </div>
                      </div>
                    ` : ""}
                  </div>

                  <!-- Trust Findings -->
                  ${item.trustFindings && item.trustFindings.length > 0 ? html`
                    <button class="findings-btn" @click=${() => this.toggleFindings(item.name)}>
                      ${isExpanded ? "Hide Trust Details" : "Show Trust Details"}
                    </button>
                    ${isExpanded ? html`
                      <div class="findings-detail">
                        <strong>Verification Findings:</strong>
                        ${item.trustFindings.map((f: string) => html`<div style="margin-top: 0.15rem;">• ${f}</div>`)}
                      </div>
                    ` : ""}
                  ` : ""}

                  <div class="ch-meta" style="margin-top: auto; padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>Publisher: <strong>${item.publisher || "Community"}</strong></div>
                    <div style="display: flex; gap: 0.4rem;">
                      <button 
                        class="btn btn-secondary" 
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem; ${health.state === 'OPEN' ? 'border-color: var(--status-green); color: var(--status-green);' : 'border-color: var(--status-yellow); color: var(--status-yellow);'} background: transparent;"
                        @click=${() => this.toggleCircuitBreaker(item.name, health.state)}
                      >
                        ${health.state === "OPEN" ? "⚡ Enable" : "🛑 Disable"}
                      </button>
                      <button 
                        class="btn btn-secondary" 
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-color: var(--status-red); color: var(--status-red); background: transparent;"
                        @click=${() => this.uninstallPackage(item.name, item.type, item.scope === 'global')}
                      >
                        🗑️ Uninstall
                      </button>
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>
        `}
      </div>
    `;
  }

  private renderLearnedTab() {
    return html`
      <div class="panel">
        <div class="panel-header">
          <span>🧠 Closed-Loop Learned Skills</span>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <label style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Active Agent:</label>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map((a: any) => html`
                <option value=${a.id}>${a.name || a.id}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="filters-row">
          <div style="font-size: 0.85rem; color: var(--text-secondary)">
            Showing ${this.learnedSkills.length} learned skills
          </div>
        </div>

        ${this.isInstalledLoading ? html`
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Loading learned skills...
          </div>
        ` : this.learnedSkills.length === 0 ? html`
          <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-tertiary); border-radius: 8px; border: 1px dashed var(--border-color)">
            No skills learned by this agent yet.
            <div style="margin-top: 0.5rem; font-size: 0.8rem;">
              Skills are automatically learned from experience through Reflection triggers.
            </div>
          </div>
        ` : html`
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${this.learnedSkills.map(item => html`
              <div class="ch-card">
                <div class="ch-title-row">
                  <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                    <div class="ch-name" style="font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title=${item.name}>${item.name}</div>
                  </div>
                  <span class="badge ${item.status === 'promoted' ? 'verified' : item.status === 'archived' ? 'unverified' : 'skill'}" style="text-transform: uppercase;">
                    ${item.status}
                  </span>
                </div>
                <div class="ch-slug" style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono)">Slug: ${item.slug}</div>
                <div class="ch-desc" style="font-size: 0.8rem; margin: 0.25rem 0 0.5rem 0;">${item.description || "No description provided."}</div>
                
                <div class="ch-meta" style="margin-top: auto; padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary);">
                  <div>Trigger: <strong>${item.triggerType}</strong></div>
                  <div>Created: <strong>${item.createdDate}</strong></div>
                  <div>Usage Count: <strong>${item.usageCount}</strong></div>
                  <div>Success Rate: <strong>${item.successRate.toFixed(1)}%</strong></div>
                </div>
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
