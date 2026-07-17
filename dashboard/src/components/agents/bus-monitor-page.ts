import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface BusMessageLog {
  id: string;
  timestamp: number;
  topic: string;
  sender: string;
  receiver: string;
  content: string;
}

@customElement("bus-monitor-page")
export class BusMonitorPage extends LitElement {
  @state() private logs: BusMessageLog[] = [];
  @state() private config: any = null;
  @state() private agents: any[] = [];
  @state() private activeAnimation: {
    senderId?: string;
    receiverId?: string;
    senderX?: number;
    senderY?: number;
    receiverX?: number;
    receiverY?: number;
  } = {};

  private wsClient = WsClient.getInstance();

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

    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
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

    /* Live events terminal */
    .terminal {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-secondary);
      height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .log-entry {
      border-bottom: 1px solid rgba(255,255,255,0.03);
      padding-bottom: 0.25rem;
      word-break: break-all;
    }

    .log-time {
      color: var(--text-muted);
    }

    .log-topic {
      color: var(--accent-secondary);
    }

    /* Graph Visuals */
    .graph-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      position: relative;
    }

    svg {
      width: 100%;
      max-width: 500px;
      height: 280px;
    }

    .node-circle {
      fill: var(--bg-tertiary);
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: all 0.3s;
    }

    .node-circle.active {
      stroke: var(--accent-secondary);
      fill: rgba(0, 240, 255, 0.1);
      filter: drop-shadow(0px 0px 8px var(--accent-secondary));
    }

    .link-line {
      fill: none;
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: stroke 0.3s;
    }

    /* Glowing Flow Particle */
    .particle {
      fill: var(--accent-secondary);
      filter: drop-shadow(0px 0px 4px var(--accent-secondary));
    }

    .text-name {
      font-weight: 600;
      font-size: 12px;
      fill: var(--text-primary);
      text-anchor: middle;
      font-family: var(--font-sans);
    }

    .text-title {
      font-size: 10px;
      fill: var(--text-muted);
      text-anchor: middle;
      font-family: var(--font-sans);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.wsClient.addEventListener(this.handleBusEvent.bind(this));
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
        this.config = data.config;
        this.agents = this.config.agents || [];
      }
    } catch (err) {
      console.error("[BusMonitor] Failed to load configuration:", err);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.wsClient.removeEventListener(this.handleBusEvent.bind(this));
  }

  private handleBusEvent(event: string, data: any) {
    if (event === "busMessage") {
      const { topic, message } = data;
      const parsedMsg = typeof message === "string" ? message : JSON.stringify(message);

      let senderId = message.from || "gateway";
      let receiverId = "gateway";

      if (topic.startsWith("agent:")) {
        receiverId = topic.split(":")[1];
      } else if (topic.startsWith("chat:")) {
        receiverId = "gateway";
      }

      // Calculate node positions to find coordinates
      const N = this.agents.length;
      const cx = 200;
      const cy = 130;
      const R = 80;

      const nodePositions = this.agents.map((agent, idx) => {
        const angle = (idx * 2 * Math.PI) / (N || 1) - Math.PI / 2;
        return {
          id: agent.id,
          x: cx + R * Math.cos(angle),
          y: cy + R * Math.sin(angle),
        };
      });

      const getPos = (id: string) => {
        if (id === "gateway") return { x: cx, y: cy };
        const found = nodePositions.find(p => p.id === id);
        return found ? { x: found.x, y: found.y } : { x: cx, y: cy };
      };

      const fromPos = getPos(senderId);
      const toPos = getPos(receiverId);

      this.triggerMessageAnimation(senderId, receiverId, fromPos.x, fromPos.y, toPos.x, toPos.y);

      const newLog: BusMessageLog = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        topic,
        sender: senderId,
        receiver: receiverId,
        content: parsedMsg
      };

      this.logs = [newLog, ...this.logs].slice(0, 50); // Keep last 50
    }
  }

  private triggerMessageAnimation(senderId: string, receiverId: string, senderX: number, senderY: number, receiverX: number, receiverY: number) {
    this.activeAnimation = { senderId, receiverId, senderX, senderY, receiverX, receiverY };
    
    // Auto clear animation after 1.2 seconds
    setTimeout(() => {
      if (this.activeAnimation.senderId === senderId && this.activeAnimation.receiverId === receiverId) {
        this.activeAnimation = {};
      }
    }, 1200);
  }

  render() {
    const N = this.agents.length;
    const cx = 200;
    const cy = 130;
    const R = 80;

    const nodePositions = this.agents.map((agent, idx) => {
      const angle = (idx * 2 * Math.PI) / (N || 1) - Math.PI / 2;
      return {
        id: agent.id,
        name: agent.name || agent.id,
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle),
      };
    });

    const centerNode = { id: "gateway", name: "Gateway Hub", x: cx, y: cy };

    return html`
      <div class="title">Event Bus Messaging Monitor</div>

      <div class="grid">
        <!-- SVG Node Graph -->
        <div class="panel" style="align-items: center">
          <div class="panel-header" style="width: 100%">Bus Visualizer</div>
          <div class="graph-container">
            <svg viewBox="0 0 400 260">
              <!-- Central Hub Links -->
              ${nodePositions.map(p => html`
                <line 
                  class="link-line" 
                  x1=${p.x} y1=${p.y} 
                  x2=${centerNode.x} y2=${centerNode.y} 
                  style="stroke: var(--border-color); stroke-width: 1.5px; opacity: 0.5;"
                />
              `)}

              <!-- Traveling particle animations -->
              ${this.activeAnimation.senderX !== undefined && this.activeAnimation.receiverX !== undefined ? html`
                <path 
                  id="active-flow-path" 
                  class="link-line" 
                  d="M ${this.activeAnimation.senderX} ${this.activeAnimation.senderY} L ${this.activeAnimation.receiverX} ${this.activeAnimation.receiverY}" 
                  style="stroke: var(--accent-secondary); stroke-width: 2.5px; stroke-dasharray: 4; animation: dash 1s linear infinite;"
                />
                <circle class="particle" r="6">
                  <animateMotion 
                    dur="0.8s" 
                    repeatCount="1" 
                    fill="remove"
                  >
                    <mpath href="#active-flow-path" />
                  </animateMotion>
                </circle>
              ` : ""}

              <!-- Center Hub Node -->
              <g transform="translate(${centerNode.x}, ${centerNode.y})">
                <circle class="node-circle active" r="28" style="fill: rgba(138, 43, 226, 0.15); stroke: var(--accent-primary);" />
                <text class="text-name" y="4" style="font-size: 10px;">GATEWAY</text>
              </g>

              <!-- Agent Nodes -->
              ${nodePositions.map(p => {
                const isActive = this.activeAnimation.senderId === p.id || this.activeAnimation.receiverId === p.id;
                return html`
                  <g transform="translate(${p.x}, ${p.y})">
                    <circle class="node-circle ${isActive ? "active" : ""}" r="22" />
                    <text class="text-name" y="4" style="font-size: 9px;">${p.name.slice(0, 7)}</text>
                    <text class="text-title" y="32">${p.id}</text>
                  </g>
                `;
              })}
            </svg>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div class="panel">
          <div class="panel-header">Live Event Streaming Logs</div>
          <div class="terminal">
            ${this.logs.length === 0 ? html`
              <div style="color: var(--text-muted); font-style: italic">
                Listening for messages on global bus topic (*) ...
              </div>
            ` : this.logs.map(log => html`
              <div class="log-entry">
                <span class="log-time">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span class="log-topic">topic:${log.topic}</span>
                <span><strong>${log.sender}</strong> ➔ <strong>${log.receiver}</strong>: ${log.content}</span>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}
