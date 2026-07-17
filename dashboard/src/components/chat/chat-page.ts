import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface Message {
  id: string;
  role: "user" | "model" | "system" | "tool" | "collab";
  content: string;
  timestamp: number;
  pinned?: boolean;
  toolCalls?: any[];
  toolResults?: any[];
  from?: string;
  to?: string;
}

interface Team {
  id: string;
  name: string;
  leaderAgentId?: string;
  memberAgentIds: string[];
}

@customElement("chat-page")
export class ChatPage extends LitElement {
  @state() private activeAgent = "";
  @state() private activeSession = "";
  @state() private messages: Message[] = [];
  @state() private inputMessage = "";
  @state() private isGenerating = false;
  @state() private activeModel = "";
  @state() private chatSearchQuery = "";
  @state() private pinnedMessages: Message[] = [];
  @state() private agents: any[] = [];
  @state() private models: any[] = [];

  // Collaboration state
  @state() private chatMode: "agent" | "team" = "agent";
  @state() private activeTeam = "";
  @state() private teams: Team[] = [];
  @state() private activeTeamNodeAnimation: {
    senderId?: string;
    receiverId?: string;
    senderX?: number;
    senderY?: number;
    receiverX?: number;
    receiverY?: number;
  } = {};

  // Stream simulation buffer
  @state() private streamingText = "";
  @state() private currentPlan: any = null;
  @state() private reasoningSetting: "on" | "off" | "stream" = "off";

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 190px);
      overflow: hidden;
    }

    .chat-layout {
      display: flex;
      gap: 1rem;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(12px);
    }

    .chat-sidebar {
      width: 260px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
      backdrop-filter: blur(12px);
    }

    /* Top Control Bar */
    .control-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .controls-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .controls-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Custom Switch button group */
    .mode-switch-group {
      display: flex;
      background: var(--bg-primary);
      padding: 0.2rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      gap: 0.15rem;
    }

    .switch-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .switch-btn.active {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color: white;
      box-shadow: 0 2px 10px rgba(167, 139, 250, 0.25);
    }

    select, input {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    select:focus, input:focus {
      border-color: var(--accent-secondary);
    }

    /* Radial Team Visualizer in main layout */
    .team-visualizer-panel {
      background: rgba(0, 0, 0, 0.15);
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .team-visualizer-header {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-secondary);
      margin-bottom: 0.25rem;
      align-self: flex-start;
    }

    .visualizer-svg {
      width: 100%;
      height: 110px;
      max-width: 600px;
    }

    /* Messages Area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background-color: var(--bg-primary);
    }

    /* Scrollbar Styling */
    .messages-area::-webkit-scrollbar, .chat-sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .messages-area::-webkit-scrollbar-track, .chat-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    .messages-area::-webkit-scrollbar-thumb, .chat-sidebar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    .messages-area::-webkit-scrollbar-thumb:hover, .chat-sidebar::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .msg-bubble-container {
      display: flex;
      flex-direction: column;
      max-width: 80%;
      position: relative;
    }

    .msg-bubble-container.user {
      align-self: flex-end;
    }

    .msg-bubble-container.model {
      align-self: flex-start;
    }

    .msg-bubble-container.system {
      align-self: center;
      max-width: 90%;
      text-align: center;
      font-style: italic;
      opacity: 0.85;
    }

    .msg-bubble-container.collab {
      align-self: center;
      max-width: 85%;
      width: 100%;
      animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .msg-bubble {
      padding: 0.85rem 1.1rem;
      border-radius: var(--border-radius);
      font-size: 0.95rem;
      line-height: 1.5;
      position: relative;
      word-break: break-word;
    }

    .user .msg-bubble {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color: white;
      border-bottom-right-radius: 2px;
      box-shadow: 0 4px 15px rgba(167, 139, 250, 0.2);
    }

    .model .msg-bubble {
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-bottom-left-radius: 2px;
    }

    .system .msg-bubble {
      background-color: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    /* Collaboration Bubble card */
    .collab .msg-bubble {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(167, 139, 250, 0.35);
      border-radius: 12px;
      color: var(--text-primary);
      padding: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(8px);
    }

    .collab-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .agent-tag {
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-weight: bold;
    }

    .agent-tag.sender {
      background: rgba(167, 139, 250, 0.15);
      color: #c084fc;
      border: 1px solid rgba(167, 139, 250, 0.3);
    }

    .agent-tag.receiver {
      background: rgba(0, 240, 255, 0.1);
      color: #22d3ee;
      border: 1px solid rgba(0, 240, 255, 0.2);
    }

    .arrow-icon {
      color: var(--text-muted);
      font-weight: bold;
    }

    .msg-meta {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      display: flex;
      gap: 0.5rem;
      align-self: flex-end;
    }

    .user .msg-meta {
      align-self: flex-end;
      color: rgba(255, 255, 255, 0.6);
    }

    .pin-btn {
      cursor: pointer;
      opacity: 0.3;
      transition: opacity 0.2s;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 0.8rem;
    }

    .msg-bubble-container:hover .pin-btn, .pin-btn.pinned {
      opacity: 1;
    }

    /* Plan Panel */
    .plan-panel {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 12px;
      padding: 1rem;
      margin: 1rem 1.5rem 0 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .plan-header {
      font-weight: 700;
      color: #fff;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }
    .plan-steps {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .plan-step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }
    .plan-step.completed {
      color: #10b981;
    }
    .plan-step.running {
      color: #f59e0b;
      font-weight: bold;
    }
    .plan-step.failed {
      color: #ef4444;
    }
    .step-verify {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    /* Input Footer */
    .input-footer {
      padding: 1rem;
      background-color: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .btn {
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.7rem 1.2rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn-abort {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-abort:hover {
      background-color: var(--status-red);
      color: white;
    }

    .pinned-item {
      padding: 0.5rem;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.8rem;
      position: relative;
    }

    /* Graph Visualizer nodes */
    .node-circle {
      fill: var(--bg-tertiary);
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: all 0.3s;
    }

    .node-circle.active {
      stroke: var(--accent-secondary);
      fill: rgba(0, 240, 255, 0.1);
      filter: drop-shadow(0px 0px 4px var(--accent-secondary));
    }

    .node-circle.leader {
      stroke: var(--accent-primary);
      fill: rgba(167, 139, 250, 0.1);
      filter: drop-shadow(0px 0px 4px var(--accent-primary));
    }

    .link-line {
      fill: none;
      stroke: var(--border-color);
      stroke-dasharray: 2 2;
    }

    .particle {
      fill: var(--accent-secondary);
      filter: drop-shadow(0px 0px 3px var(--accent-secondary));
    }

    .text-name {
      font-weight: bold;
      fill: var(--text-primary);
      text-anchor: middle;
      font-family: var(--font-mono);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.5; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig().then(() => {
      this.startNewSession();
    });
    this.wsClient.addEventListener(this.handleBusMessage.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.wsClient.removeEventListener(this.handleBusMessage.bind(this));
  }

  private async loadConfig() {
    const token = this.wsClient.getToken();
    try {
      const response = await fetch(`${this.wsClient.getGatewayUrl()}/api/config`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const config = data.config;

        this.agents = config.agents || [];
        this.teams = config.teams || [];
        
        // Load custom models
        const extractedModels: any[] = [];
        if (config.models && config.models.providers) {
          const provs = config.models.providers;
          for (const [provId, provData] of Object.entries(provs)) {
            const mList = (provData as any).models || [];
            for (const m of mList) {
              const mId = typeof m === "string" ? m : m.id;
              if (!extractedModels.find(x => x.id === mId && x.provider === provId)) {
                extractedModels.push({
                  id: mId,
                  name: typeof m === "string" ? m : (m.name || m.id),
                  provider: provId
                });
              }
            }
          }
        }

        if (config.models && Array.isArray(config.models)) {
          config.models.forEach((m: any) => {
            if (m && m.id) {
              const mProv = m.provider || "gemini";
              if (!extractedModels.find(x => x.id === m.id && x.provider === mProv)) {
                extractedModels.push({
                  id: m.id,
                  name: m.name || m.id,
                  provider: mProv
                });
              }
            }
          });
        }
        
        this.models = extractedModels;

        // Fallbacks
        if (this.agents.length === 0) this.agents = [];
        if (this.models.length === 0) {
          this.models = [{ id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "gemini" }];
        }

        // Set active targets
        if (this.agents.length > 0 && !this.activeAgent) {
          this.activeAgent = this.agents[0].id;
        }
        if (this.teams.length > 0 && !this.activeTeam) {
          this.activeTeam = this.teams[0].id;
        }
        if (this.models.length > 0 && !this.activeModel) {
          this.activeModel = this.models[0].id;
        }
      }
    } catch (err) {
      console.error("[ChatPage] Failed to load config options:", err);
    }
  }

  private startNewSession() {
    this.messages = [];
    this.streamingText = "";
    this.currentPlan = null;
    this.isGenerating = false;
    this.activeTeamNodeAnimation = {};

    if (this.chatMode === "agent") {
      if (!this.activeAgent) return;
      this.activeSession = `${this.activeAgent}:chat:web_${Date.now()}`;
    } else {
      if (!this.activeTeam) return;
      const team = this.teams.find(t => t.id === this.activeTeam);
      const leaderId = team?.leaderAgentId || team?.memberAgentIds[0] || "";
      if (!leaderId) {
        alert("Selected team has no agents.");
        return;
      }
      this.activeSession = `${leaderId}:chat:team_${this.activeTeam}_${Date.now()}`;
    }

    this.wsClient.send("setReasoningSetting", { sessionId: this.activeSession, value: this.reasoningSetting }).catch(() => {});
  }

  private handleBusMessage(event: string, data: any) {
    if (event === "busMessage") {
      const topic = data.topic;
      const message = data.message;
      
      // 1. Single mode & team mode standard logs matching the session
      if (topic === "loop_progress" && message.sessionId === this.activeSession) {
        const ev = message.event;
        if (ev && ev.type === "thinking_stream" && ev.chunk) {
          this.streamingText += ev.chunk;
          this.isGenerating = true;
          this.requestUpdate();
          this.scrollToBottom();
        } else if (ev && ev.type === "plan_progress") {
          this.currentPlan = ev.plan;
          this.requestUpdate();
        }
      }
      
      if (topic === "agent_message" && message.sessionId === this.activeSession) {
        this.isGenerating = false;
        this.streamingText = "";
        
        const alreadyExists = this.messages.some(m => m.role === "model" && m.content === message.content && m.timestamp === message.timestamp);
        if (!alreadyExists) {
          this.messages = [
            ...this.messages,
            {
              id: crypto.randomUUID(),
              role: "model",
              content: message.content,
              timestamp: message.timestamp || Date.now()
            }
          ];
          this.requestUpdate();
          this.scrollToBottom();
        }
      }

      // 2. Event bus agent communication parsing (Team collaboration)
      if (this.chatMode === "team" && topic.startsWith("agent:")) {
        const receiverId = topic.split(":")[1];
        const senderId = message.from;
        const team = this.teams.find(t => t.id === this.activeTeam);

        if (team) {
          const allTeamMembers = [...team.memberAgentIds];
          if (team.leaderAgentId && !allTeamMembers.includes(team.leaderAgentId)) {
            allTeamMembers.push(team.leaderAgentId);
          }

          // If both sender and receiver belong to this team, capture it!
          if (allTeamMembers.includes(senderId) && allTeamMembers.includes(receiverId)) {
            const alreadyExists = this.messages.some(
              m => m.role === "collab" && m.from === senderId && m.to === receiverId && m.content === message.content
            );

            if (!alreadyExists) {
              this.messages = [
                ...this.messages,
                {
                  id: crypto.randomUUID(),
                  role: "collab",
                  from: senderId,
                  to: receiverId,
                  content: message.content,
                  timestamp: message.timestamp || Date.now()
                }
              ];

              // Calculate positions for visual flow animation
              this.triggerCollaborationAnimation(senderId, receiverId, allTeamMembers);

              this.requestUpdate();
              this.scrollToBottom();
            }
          }
        }
      }
    }
  }

  private triggerCollaborationAnimation(senderId: string, receiverId: string, members: string[]) {
    // Generate positions based on radial layout
    const N = members.length;
    const cx = 300;
    const cy = 55;
    const R = 38;

    const leaderIdx = members.indexOf(this.teams.find(t => t.id === this.activeTeam)?.leaderAgentId || "");

    const getPos = (id: string) => {
      const idx = members.indexOf(id);
      if (idx === -1) return { x: cx, y: cy };
      
      // If it is the leader, place it in the center. Otherwise place radially
      if (idx === leaderIdx && leaderIdx !== -1) {
        return { x: cx, y: cy };
      }

      // Distribute radially
      const angle = (idx * 2 * Math.PI) / (N - 1 || 1) - Math.PI / 2;
      return {
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle)
      };
    };

    const fromPos = getPos(senderId);
    const toPos = getPos(receiverId);

    this.activeTeamNodeAnimation = {
      senderId,
      receiverId,
      senderX: fromPos.x,
      senderY: fromPos.y,
      receiverX: toPos.x,
      receiverY: toPos.y
    };

    // Reset animation frame after 1s
    setTimeout(() => {
      if (this.activeTeamNodeAnimation.senderId === senderId && this.activeTeamNodeAnimation.receiverId === receiverId) {
        this.activeTeamNodeAnimation = {};
      }
    }, 1000);
  }

  private switchMode(mode: "agent" | "team") {
    this.chatMode = mode;
    this.startNewSession();
  }

  private scrollToBottom() {
    const area = this.shadowRoot?.querySelector(".messages-area");
    if (area) {
      setTimeout(() => {
        area.scrollTop = area.scrollHeight;
      }, 50);
    }
  }

  private async sendMessage() {
    if (!this.inputMessage.trim() || this.isGenerating) return;
    
    const userPrompt = this.inputMessage;
    this.inputMessage = "";
    
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userPrompt,
      timestamp: Date.now()
    };
    
    this.messages = [...this.messages, userMsg];
    this.isGenerating = true;

    let targetAgentId = this.activeAgent;
    if (this.chatMode === "team") {
      const team = this.teams.find(t => t.id === this.activeTeam);
      targetAgentId = team?.leaderAgentId || team?.memberAgentIds[0] || "";
    }

    try {
      await this.wsClient.send("sendMessageToAgent", {
        agentId: targetAgentId,
        sessionId: this.activeSession,
        text: userPrompt
      });
    } catch (err: any) {
      alert(`Message dispatch failed: ${err.message}`);
      this.isGenerating = false;
    }
  }

  private async abortGeneration() {
    if (!this.isGenerating) return;
    try {
      await this.wsClient.send("stopAgent", { sessionId: this.activeSession });
      this.isGenerating = false;
      this.streamingText = "";
      this.messages = [
        ...this.messages,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "❌ Generation Aborted by Host Operator.",
          timestamp: Date.now()
        }
      ];
    } catch (err: any) {
      alert(`Abort command failed: ${err.message}`);
    }
  }

  private togglePin(msg: Message) {
    msg.pinned = !msg.pinned;
    if (msg.pinned) {
      this.pinnedMessages = [...this.pinnedMessages, msg];
    } else {
      this.pinnedMessages = this.pinnedMessages.filter(m => m.id !== msg.id);
    }
    this.requestUpdate();
  }

  private exportChat(format: "json" | "md") {
    let content = "";
    if (format === "json") {
      content = JSON.stringify(this.messages, null, 2);
    } else {
      content = `# Chat Transcript: ${this.activeSession}\n\n`;
      for (const m of this.messages) {
        if (m.role === "collab") {
          content += `### **COLLABORATION** _(${new Date(m.timestamp).toLocaleTimeString()})_\nFrom: **${m.from}** ➔ To: **${m.to}**\n${m.content}\n\n`;
        } else {
          content += `### **${m.role.toUpperCase()}** _(${new Date(m.timestamp).toLocaleTimeString()})_\n${m.content}\n\n`;
        }
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `komorebi_chat_${this.activeSession}.${format === "json" ? "json" : "md"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private getAgentName(id: string): string {
    const agent = this.agents.find(a => a.id === id);
    return agent ? agent.name : id;
  }

  render() {
    const filteredMessages = this.messages.filter(m => {
      if (!this.chatSearchQuery) return true;
      return m.content.toLowerCase().includes(this.chatSearchQuery.toLowerCase());
    });

    const activeTeamObj = this.chatMode === "team" ? this.teams.find(t => t.id === this.activeTeam) : null;
    const teamMembers = activeTeamObj ? [...activeTeamObj.memberAgentIds] : [];
    if (activeTeamObj?.leaderAgentId && !teamMembers.includes(activeTeamObj.leaderAgentId)) {
      teamMembers.push(activeTeamObj.leaderAgentId);
    }

    const cx = 300;
    const cy = 55;
    const R = 38;

    const nodePositions = teamMembers.map((mId, idx) => {
      const isLeader = mId === activeTeamObj?.leaderAgentId;
      if (isLeader) {
        return { id: mId, name: this.getAgentName(mId), x: cx, y: cy, isLeader };
      }
      const angle = (idx * 2 * Math.PI) / (teamMembers.length - 1 || 1) - Math.PI / 2;
      return {
        id: mId,
        name: this.getAgentName(mId),
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle),
        isLeader: false
      };
    });

    return html`
      <div class="chat-layout">
        <!-- Main Panel -->
        <div class="chat-main">
          <!-- Top Control Bar -->
          <div class="control-bar">
            <div class="controls-left">
              <!-- Mode Switch -->
              <div class="mode-switch-group">
                <button class="switch-btn ${this.chatMode === "agent" ? "active" : ""}" @click=${() => this.switchMode("agent")}>
                  🤖 Single Agent
                </button>
                <button class="switch-btn ${this.chatMode === "team" ? "active" : ""}" @click=${() => this.switchMode("team")}>
                  👥 Agent Team
                </button>
              </div>

              <!-- Selection Dropdowns based on Mode -->
              ${this.chatMode === "agent" ? html`
                <select .value=${this.activeAgent} @change=${(e: any) => { this.activeAgent = e.target.value; this.startNewSession(); }}>
                  ${this.agents.map(a => html`
                    <option value=${a.id}>${a.name || a.id}</option>
                  `)}
                </select>
              ` : html`
                <select .value=${this.activeTeam} @change=${(e: any) => { this.activeTeam = e.target.value; this.startNewSession(); }}>
                  ${this.teams.map(t => html`
                    <option value=${t.id}>${t.name}</option>
                  `)}
                </select>
              `}

              <select .value=${this.activeModel} @change=${(e: any) => this.activeModel = e.target.value}>
                ${this.models.map(m => html`
                  <option value=${m.id}>${m.name} (${m.provider})</option>
                `)}
              </select>

              <select .value=${this.reasoningSetting} @change=${async (e: any) => { 
                this.reasoningSetting = e.target.value; 
                await this.wsClient.send("setReasoningSetting", { sessionId: this.activeSession, value: this.reasoningSetting });
              }}>
                <option value="off">Reasoning: Hidden</option>
                <option value="on">Reasoning: Visible</option>
                <option value="stream">Reasoning: Streamed</option>
              </select>
            </div>

            <div class="controls-right">
              <input 
                type="text" 
                placeholder="Search history..." 
                .value=${this.chatSearchQuery}
                @input=${(e: any) => this.chatSearchQuery = e.target.value}
                style="padding: 0.3rem; font-size: 0.8rem; width: 140px;"
              />
              <button class="btn" style="padding: 0.35rem 0.6rem; font-size: 0.8rem" @click=${this.startNewSession}>
                🧹 Reset
              </button>
            </div>
          </div>

          <!-- Team visualizer node chart inside chat container -->
          ${this.chatMode === "team" && activeTeamObj ? html`
            <div class="team-visualizer-panel">
              <div class="team-visualizer-header">👥 Team Collaboration Live Stream</div>
              <svg class="visualizer-svg" viewBox="240 10 120 90">
                <!-- Connect Radial nodes to center leader -->
                ${nodePositions.filter(p => !p.isLeader).map(p => html`
                  <line 
                    class="link-line"
                    x1=${p.x} y1=${p.y}
                    x2=${cx} y2=${cy}
                    style="stroke: rgba(255,255,255,0.06); stroke-width: 1px;"
                  />
                `)}

                <!-- Traveling packet particle flow -->
                ${this.activeTeamNodeAnimation.senderX !== undefined ? html`
                  <path 
                    id="flow-path-anim"
                    class="link-line"
                    d="M ${this.activeTeamNodeAnimation.senderX} ${this.activeTeamNodeAnimation.senderY} L ${this.activeTeamNodeAnimation.receiverX} ${this.activeTeamNodeAnimation.receiverY}"
                    style="stroke: var(--accent-secondary); stroke-width: 1.5px; opacity: 0.8;"
                  />
                  <circle class="particle" r="2.5">
                    <animateMotion dur="0.6s" repeatCount="1" fill="remove">
                      <mpath href="#flow-path-anim" />
                    </animateMotion>
                  </circle>
                ` : ""}

                <!-- Radial Nodes -->
                ${nodePositions.map(p => {
                  const isActive = this.activeTeamNodeAnimation.senderId === p.id || this.activeTeamNodeAnimation.receiverId === p.id;
                  return html`
                    <g transform="translate(${p.x}, ${p.y})">
                      <circle 
                        class="node-circle ${p.isLeader ? "leader" : ""} ${isActive ? "active" : ""}" 
                        r=${p.isLeader ? 8 : 6}
                      />
                      <text class="text-name" y="14" style="font-size: 3.5px;">${p.name.split(" ")[0].toUpperCase()}</text>
                    </g>
                  `;
                })}
              </svg>
            </div>
          ` : ""}

          ${this.currentPlan ? html`
            <div class="plan-panel">
              <div class="plan-header">📋 Task Plan: ${this.currentPlan.goal}</div>
              <div class="plan-steps">
                ${this.currentPlan.subtasks.map((s: any) => {
                  const marker = s.status === "completed" ? "✅" : s.status === "running" ? "⏳" : s.status === "failed" ? "❌" : "◽";
                  return html`
                    <div class="plan-step ${s.status}">
                      <span class="step-marker">${marker}</span>
                      <span class="step-desc">${s.description}</span>
                      <span class="step-verify">(${s.successCondition})</span>
                    </div>
                  `;
                })}
              </div>
            </div>
          ` : ""}

          <!-- Messages Area -->
          <div class="messages-area">
            ${filteredMessages.length === 0 && !this.streamingText && !this.isGenerating ? html`
              <div style="text-align: center; color: var(--text-muted); margin: auto; max-width: 380px; font-size: 0.9rem">
                👋 Send a task instruction to begin. 
                ${this.chatMode === "team" ? html`
                  The <strong>Team Leader</strong> will ingest the instruction and coordinate with other members of the <strong>${activeTeamObj?.name || ""}</strong> team using event bus message topics. All agent discussions will render below live.
                ` : html`
                  The agent will execute its ReAct loop, call tools, write files, and output replies.
                `}
              </div>
            ` : filteredMessages.map(msg => {
              if (msg.role === "collab") {
                return html`
                  <div class="msg-bubble-container collab">
                    <div class="msg-bubble">
                      <div class="collab-header">
                        <span class="agent-tag sender">${msg.from}</span>
                        <span class="arrow-icon">➔</span>
                        <span class="agent-tag receiver">${msg.to}</span>
                      </div>
                      <div style="font-size: 0.9rem; line-height: 1.45; white-space: pre-wrap;">${msg.content}</div>
                    </div>
                    <div class="msg-meta">
                      <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                `;
              }

              return html`
                <div class="msg-bubble-container ${msg.role}">
                  <div class="msg-bubble">
                    <div style="white-space: pre-wrap;">${msg.content}</div>
                  </div>
                  <div class="msg-meta">
                    <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
                    <button class="pin-btn ${msg.pinned ? "pinned" : ""}" @click=${() => this.togglePin(msg)}>
                      ${msg.pinned ? "📌 Pinned" : "📌"}
                    </button>
                  </div>
                </div>
              `;
            })}

            <!-- Live Streaming Text simulated response -->
            ${this.streamingText ? html`
              <div class="msg-bubble-container model">
                <div class="msg-bubble" style="white-space: pre-wrap;">${this.streamingText}<span style="display:inline-block; width:8px; height:15px; background:var(--text-primary); animation:pulse 0.8s infinite; margin-left:2px"></span></div>
              </div>
            ` : ""}

            <!-- Thinking loop animations -->
            ${this.isGenerating && !this.streamingText ? html`
              <div class="msg-bubble-container model">
                <div class="msg-bubble" style="display: flex; align-items: center; gap: 0.5rem">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent-secondary); animation: pulse 1s infinite"></div>
                  <span style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic">Agent processing ReAct loop & invoking tools...</span>
                </div>
              </div>
            ` : ""}
          </div>

          <!-- Input Footer -->
          <div class="input-footer">
            <input 
              type="text" 
              class="chat-input" 
              placeholder=${this.chatMode === "team" ? "Instruct the agent team to collaborate and solve the task..." : "Ask the agent to perform analysis, run scripts, compile plans..."}
              .value=${this.inputMessage}
              @input=${(e: any) => this.inputMessage = e.target.value}
              @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this.sendMessage()}
            />
            
            ${this.isGenerating ? html`
              <button class="btn btn-abort" @click=${this.abortGeneration}>🛑 Abort</button>
            ` : html`
              <button class="btn" @click=${this.sendMessage}>🚀 Send</button>
            `}
          </div>
        </div>

        <!-- Pinned Messages Sidebar -->
        <div class="chat-sidebar">
          <div style="font-weight: 600; font-family: var(--font-display); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem">
            📌 Pinned Messages
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1">
            ${this.pinnedMessages.length === 0 ? html`
              <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 1rem">
                No pinned messages. Hover chat messages to pin.
              </div>
            ` : this.pinnedMessages.map(msg => html`
              <div class="pinned-item">
                <div style="font-weight: 600; font-size: 0.7rem; color: var(--accent-secondary); margin-bottom: 0.2rem">
                  ${msg.role.toUpperCase()}
                </div>
                <div style="font-size: 0.75rem; text-overflow: ellipsis; overflow: hidden; max-height: 50px; line-height: 1.3">
                  ${msg.content}
                </div>
              </div>
            `)}
          </div>
          
          <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem">
            <button class="btn" style="font-size: 0.8rem; padding: 0.4rem; background: var(--bg-tertiary)" @click=${() => this.exportChat("md")}>
              Export Markdown
            </button>
            <button class="btn" style="font-size: 0.8rem; padding: 0.4rem; background: var(--bg-tertiary)" @click=${() => this.exportChat("json")}>
              Export JSON
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
