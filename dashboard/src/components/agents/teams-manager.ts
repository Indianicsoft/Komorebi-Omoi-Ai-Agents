import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface Team {
  id: string;
  name: string;
  leaderAgentId?: string;
  memberAgentIds: string[];
}

@customElement("teams-manager")
export class TeamsManager extends LitElement {
  @state() private config: any = null;
  @state() private baseHash = "";
  @state() private teams: Team[] = [];
  @state() private agents: any[] = [];

  // Form states
  @state() private isFormOpen = false;
  @state() private formMode: "add" | "edit" = "add";

  // Form fields
  @state() private teamId = "";
  @state() private teamName = "";
  @state() private leaderAgentId = "";
  @state() private memberAgentIds: string[] = [];

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

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    .card-name {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .card-id {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .card-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent-secondary);
      margin-top: 0.25rem;
    }

    .card-details {
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }

    /* Modal styles */
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

    /* Members checkbox grid */
    .members-check-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background-color: var(--bg-primary);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      max-height: 150px;
      overflow-y: auto;
    }

    .member-check-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.45rem 0.9rem;
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

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background-color: var(--bg-primary);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: var(--accent-secondary);
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

      this.agents = this.config.agents || [];
      this.teams = this.config.teams || [];
    } catch (err) {
      console.error("[TeamsManager] Failed to load configurations:", err);
    }
  }

  private async saveConfig() {
    const updatedConfig = {
      ...this.config,
      teams: this.teams
    };

    try {
      const result = await this.wsClient.send<any>("saveSystemConfig", {
        config: updatedConfig,
        baseHash: this.baseHash
      });

      if (result.success) {
        this.baseHash = result.hash;
        alert("Teams configuration updated successfully.");
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("[TeamsManager] Failed to save config:", err);
    }
  }

  private openAddTeam() {
    this.formMode = "add";
    this.teamId = "";
    this.teamName = "";
    this.leaderAgentId = "";
    this.memberAgentIds = [];
    this.isFormOpen = true;
  }

  private openEditTeam(team: Team) {
    this.formMode = "edit";
    this.teamId = team.id;
    this.teamName = team.name;
    this.leaderAgentId = team.leaderAgentId || "";
    this.memberAgentIds = [...team.memberAgentIds];
    this.isFormOpen = true;
  }

  private deleteTeam(id: string) {
    if (!confirm(`Are you sure you want to completely delete team ${id}?`)) return;
    this.teams = this.teams.filter(t => t.id !== id);
    this.saveConfig();
  }

  private handleMemberToggle(agentId: string, isChecked: boolean) {
    if (isChecked) {
      if (!this.memberAgentIds.includes(agentId)) {
        this.memberAgentIds = [...this.memberAgentIds, agentId];
      }
    } else {
      this.memberAgentIds = this.memberAgentIds.filter(id => id !== agentId);
    }
  }

  private saveTeamForm() {
    if (!this.teamId || !this.teamName) {
      alert("Team ID and Team Name are required.");
      return;
    }

    const teamPayload: Team = {
      id: this.teamId,
      name: this.teamName,
      leaderAgentId: this.leaderAgentId || undefined,
      memberAgentIds: this.memberAgentIds
    };

    if (this.formMode === "add") {
      if (this.teams.find(t => t.id === this.teamId)) {
        alert("A team with this ID already exists.");
        return;
      }
      this.teams = [...this.teams, teamPayload];
    } else {
      this.teams = this.teams.map(t => t.id === this.teamId ? teamPayload : t);
    }

    this.isFormOpen = false;
    this.saveConfig();
  }

  private getAgentName(id: string): string {
    const agent = this.agents.find(a => a.id === id);
    return agent ? agent.name : id;
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">Teams Registry</div>
        <button class="btn btn-primary" @click=${this.openAddTeam}>➕ Create Team</button>
      </div>

      <div class="list-grid">
        ${this.teams.length === 0 ? html`
          <div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 3rem">
            No teams configured yet. Click "Create Team" to group your agents together!
          </div>
        ` : this.teams.map(team => html`
          <div class="card">
            <div class="card-title-row">
              <div>
                <div class="card-name">${team.name}</div>
                <div class="card-id">ID: ${team.id}</div>
              </div>
            </div>
            
            <div class="card-section-title">👑 Team Leader</div>
            <div class="card-details">
              ${team.leaderAgentId ? html`
                <div>${this.getAgentName(team.leaderAgentId)} <code>${team.leaderAgentId}</code></div>
              ` : html`
                <div style="color: var(--text-muted); font-style: italic">No leader assigned</div>
              `}
            </div>

            <div class="card-section-title">🤖 Members (${team.memberAgentIds.length})</div>
            <div class="card-details" style="max-height: 80px; overflow-y: auto; gap: 0.15rem">
              ${team.memberAgentIds.length === 0 ? html`
                <div style="color: var(--text-muted); font-style: italic">No member agents added</div>
              ` : team.memberAgentIds.map(id => html`
                <div>• ${this.getAgentName(id)} <code>${id}</code></div>
              `)}
            </div>

            <div class="card-actions">
              <button class="btn" @click=${() => this.openEditTeam(team)}>⚙️ Edit Settings</button>
              <button class="btn btn-danger" @click=${() => this.deleteTeam(team.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>

      <!-- Add/Edit Overlay Form -->
      ${this.isFormOpen ? html`
        <div class="overlay" @click=${() => this.isFormOpen = false}>
          <div class="modal-box" @click=${(e: Event) => e.stopPropagation()}>
            <h3 style="font-family: var(--font-display); margin-top: 0">
              ${this.formMode === "add" ? "Create New" : "Configure"} Team
            </h3>

            <div style="display: flex; flex-direction: column; gap: 1rem">
              <div class="form-group">
                <label for="teamId">Team ID</label>
                <input 
                  type="text" 
                  id="teamId" 
                  placeholder="e.g. backend-crew" 
                  .value=${this.teamId}
                  @input=${(e: any) => this.teamId = e.target.value}
                  ?disabled=${this.formMode === "edit"}
                />
              </div>

              <div class="form-group">
                <label for="teamName">Team Name</label>
                <input 
                  type="text" 
                  id="teamName" 
                  placeholder="e.g. Backend Engineering Crew" 
                  .value=${this.teamName}
                  @input=${(e: any) => this.teamName = e.target.value}
                />
              </div>

              <div class="form-group">
                <label for="teamLeader">Team Leader (Optional)</label>
                <select id="teamLeader" .value=${this.leaderAgentId} @change=${(e: any) => this.leaderAgentId = e.target.value}>
                  <option value="">None</option>
                  ${this.agents.map(a => html`
                    <option value=${a.id}>${a.name || a.id}</option>
                  `)}
                </select>
              </div>

              <div class="form-group">
                <label>Select Team Members</label>
                <div class="members-check-grid">
                  ${this.agents.length === 0 ? html`
                    <div style="color: var(--text-muted); font-size: 0.8rem; font-style: italic">No agents created to select from</div>
                  ` : this.agents.map(agent => {
                    const checked = this.memberAgentIds.includes(agent.id);
                    return html`
                      <div class="member-check-item">
                        <input 
                          type="checkbox" 
                          .checked=${checked}
                          @change=${(e: any) => this.handleMemberToggle(agent.id, e.target.checked)}
                          style="width: auto; cursor: pointer"
                        />
                        <span>${agent.name || agent.id} <code>${agent.id}</code></span>
                      </div>
                    `;
                  })}
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
              <button class="btn btn-primary" style="flex: 1" @click=${this.saveTeamForm}>
                💾 Save Team
              </button>
              <button class="btn" @click=${() => this.isFormOpen = false}>Cancel</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }
}
