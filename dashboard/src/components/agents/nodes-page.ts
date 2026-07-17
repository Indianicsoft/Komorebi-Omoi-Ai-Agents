import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface PipelineStep {
  id: string;
  name: string;
  desc: string;
  latency: string;
  status: "completed" | "active" | "idle";
}

@customElement("nodes-page")
export class NodesPage extends LitElement {
  @state() private activeAgent = "";
  @state() private config: any = null;
  @state() private agents: any[] = [];
  @state() private wsClient = WsClient.getInstance();
  @state() private steps: PipelineStep[] = [
    { id: "assemble", name: "Prompt Assembler", desc: "Injects workspace variables, MEMORY.md, and tool declarations.", latency: "18ms", status: "completed" },
    { id: "model", name: "Generative Model Loop", desc: "Performs reasoning iterations and returns tool calls/text replies.", latency: "2.8s", status: "completed" },
    { id: "tool", name: "Tool Exec Engine", desc: "Invokes custom terminal commands and file system API tools.", latency: "140ms", status: "completed" },
    { id: "memory", name: "Memory Stack Write", desc: "Appends turn to session.jsonl facts and indexes embeddings.", latency: "12ms", status: "completed" },
    { id: "dispatch", name: "Event Bus Dispatcher", desc: "Broadcasts output frames to connected peer channels and agents.", latency: "4ms", status: "idle" }
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

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    /* Pipeline map styles */
    .pipeline-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      position: relative;
      margin-top: 1rem;
    }

    .pipeline-line {
      position: absolute;
      left: 20px;
      top: 10px;
      bottom: 10px;
      width: 4px;
      background-color: var(--border-color);
      z-index: 1;
    }

    .step-card {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      position: relative;
      z-index: 2;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      transition: all 0.3s;
      cursor: pointer;
    }

    .step-card:hover {
      border-color: var(--accent-primary);
    }

    .step-dot {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--bg-primary);
      border: 3px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: var(--text-muted);
      transition: all 0.3s;
    }

    .step-card.active .step-dot {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      box-shadow: 0 0 10px var(--accent-primary);
      animation: pulseGlow 1.5s infinite;
    }

    .step-card.completed .step-dot {
      border-color: var(--status-green);
      color: var(--status-green);
    }

    .step-card.active {
      background-color: var(--accent-glow);
    }

    .step-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .step-name {
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .step-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .step-latency {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--accent-secondary);
      background: var(--bg-primary);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    this.wsClient.addEventListener(this.handleBusMessage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.wsClient.removeEventListener(this.handleBusMessage);
  }

  private handleBusMessage = (event: string, data: any) => {
    if (event === "busMessage" && data.topic === "loop_progress") {
      const { message } = data;
      if (!message || !message.event) return;

      const eventData = message.event;
      // Filter by active agent if specified
      if (eventData.agentId && eventData.agentId !== this.activeAgent) {
        return;
      }

      this.updatePipelineFromEvent(eventData);
    }
  };

  private updatePipelineFromEvent(event: any) {
    const type = event.type;
    const latency = event.durationMs ? `${event.durationMs}ms` : undefined;

    this.steps = this.steps.map((step) => {
      let status = step.status;

      switch (step.id) {
        case "assemble":
          if (type === "compaction_start" || type === "before_run") {
            status = "active";
          } else if (type === "compaction_end" || type === "thinking_stream" || type === "thinking" || type === "tool_start" || type === "turn_end") {
            status = "completed";
          }
          break;

        case "model":
          if (type === "thinking_stream" || type === "thinking") {
            status = "active";
          } else if (type === "tool_start" || type === "turn_end") {
            status = "completed";
          } else if (type === "compaction_start" || type === "before_run") {
            status = "idle";
          }
          break;

        case "tool":
          if (type === "tool_start") {
            status = "active";
          } else if (type === "tool_end") {
            status = "completed";
          } else if (type === "turn_end") {
            status = "completed";
          } else if (type === "compaction_start" || type === "before_run" || type === "thinking") {
            status = "idle";
          }
          break;

        case "memory":
          if (type === "turn_end") {
            status = "completed";
          } else if (type === "compaction_start" || type === "before_run") {
            status = "idle";
          }
          break;

        case "dispatch":
          if (type === "bus_send") {
            status = "active";
          } else if (type === "turn_end") {
            status = "completed";
          } else if (type === "compaction_start" || type === "before_run") {
            status = "idle";
          }
          break;
      }

      let stepLatency = step.latency;
      if (latency) {
        if (step.id === "tool" && (type === "tool_start" || type === "tool_end")) {
          stepLatency = latency;
        } else if (step.id === "model" && (type === "thinking" || type === "thinking_stream")) {
          stepLatency = latency;
        }
      }

      return {
        ...step,
        status,
        latency: stepLatency
      };
    });
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.agents = this.config.agents || [];
      if (this.agents.length > 0 && !this.activeAgent) {
        this.activeAgent = this.agents[0].id;
      }
    } catch (err) {
      console.error("[NodesPage] Failed to load configuration:", err);
    }
  }

  render() {
    return html`
      <div class="title-row">
        <div class="title">Execution Pipeline Node Graph</div>
        <select .value=${this.activeAgent} @change=${(e: any) => this.activeAgent = e.target.value}>
          ${this.agents.map(a => html`
            <option value=${a.id}>${a.name || a.id}</option>
          `)}
        </select>
      </div>

      <div class="panel">
        <div class="pipeline-container">
          <div class="pipeline-line"></div>
          
          ${this.steps.map((step, index) => html`
            <div class="step-card ${step.status}">
              <div class="step-dot">
                ${step.status === "completed" ? "✓" : index + 1}
              </div>
              <div class="step-details">
                <div class="step-name">${step.name}</div>
                <div class="step-desc">${step.desc}</div>
              </div>
              <div>
                <span class="step-latency">${step.latency}</span>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
