# Komorebi Omoi - System Architecture

Komorebi Omoi is a self-hosted, lightweight, and highly modular agentic AI runtime built to run efficiently on resource-constrained hardware like the Raspberry Pi 5. Its architectural blueprint is inspired by OpenClaw, optimized for low resource overhead, process isolation, and dynamic inter-agent messaging.

---

## 1. System Overview & Data Flow

Komorebi Omoi is structured as a **three-layer architecture** designed to decouple client-facing channels, core orchestration, and the isolated agent execution runtimes.

```mermaid
graph TD
    %% Channel Layer
    subgraph Channel Layer [Channel Layer]
        TelegramBot[grammY Telegram Bridge]
    end

    %% Gateway/Orchestrator Layer
    subgraph Gateway Layer [Gateway & Orchestrator Layer]
        GatewayAPI[Gateway API Service]
        SessionMgr[Session Manager]
        CommandQueue[Command Queue]
        AgentPoolMgr[Agent Pool Manager]
        InternalBus[Inter-Agent Bus]
    end

    %% Agent Runtime Layer
    subgraph Agent Runtime Layer [Agent Runtime Layer]
        subgraph Agent 1 [Agent Instance 1 - Isolated Process]
            ReAct[ReAct Loop Engine]
            PromptAss[Prompt Assembler]
            MCPClient[MCP Client]
            MemoryStore[SQLite / Vector Memory]
            Workspace[Isolated Workspace Directory]
        end
        subgraph Agent N [Agent Instance N - Isolated Process]
            ReActN[ReAct Loop Engine]
            PromptAssN[Prompt Assembler]
            MCPClientN[MCP Client]
            MemoryStoreN[SQLite / Vector Memory]
            WorkspaceN[Isolated Workspace Directory]
        end
    end

    %% External & Sandbox
    subgraph Sandbox [Execution Sandbox]
        Bwrap[Bubblewrap / nsjail Sandbox]
        LocalTools[Local System Tools]
    end
    
    LLM[Gemini 3.5 Flash API]
    MCPServer[External MCP Servers]

    %% Connections
    TelegramBot <-->|HTTP/WS| GatewayAPI
    GatewayAPI <--> SessionMgr
    SessionMgr <--> CommandQueue
    CommandQueue <--> AgentPoolMgr
    AgentPoolMgr <-->|Spawns / Monitors| Agent 1
    AgentPoolMgr <-->|Spawns / Monitors| Agent N
    
    Agent 1 <-->|Pub/Sub JSON| InternalBus
    Agent N <-->|Pub/Sub JSON| InternalBus
    
    ReAct <--> PromptAss
    ReAct <--> MCPClient
    ReAct <--> MemoryStore
    ReAct <--> Bwrap
    Bwrap <--> LocalTools
    
    PromptAss <-->|API Calls| LLM
    MCPClient <-->|Model Context Protocol| MCPServer
```

---

## 2. Layer 1: Channel Layer (Telegram Bridge)

The **Channel Layer** serves as the system's entry point, bridging external client interfaces with the core gateway. While designed to be extensible (supporting Discord, Web, etc. in the future), the primary channel is Telegram.

### Key Components
1. **Telegram Bridge (`channels/telegram/`)**:
   - Built using **Node.js + TypeScript** and the **grammY** framework (or a lightweight equivalent).
   - Functions in either webhook or long-polling mode (configurable).
   - Translates incoming Telegram updates (text, documents, buttons, media) into standardized, transport-independent **User Messages** sent to the Gateway.
2. **Session Mapper**:
   - Maps unique Telegram `chat_id`s and `user_id`s to specific **Agent Instance IDs** based on the system configuration (`komorebi.config.json`).
   - Supports multi-tenant routing, allowing a single Telegram bot to route messages to different agents depending on user permissions, or enabling multiple Telegram bots to bind to individual agents.
3. **Outbound Formatter**:
   - Receives rich text, markdown, or file buffers from the Gateway and formats them dynamically to comply with Telegram's HTML/MarkdownV2 syntax limitations.
   - Implements rate-limiting queues to respect Telegram’s message limits (maximum 30 messages per second).

---

## 3. Layer 2: Gateway / Orchestrator Layer

The **Gateway/Orchestrator Layer** acts as the central brain of the runtime control plane. Written in **TypeScript**, it is responsible for lifecycle management, scheduling, and message routing.

### Key Components
1. **Session Manager**:
   - Maintains the active registry of user-to-agent sessions.
   - Caches conversation metadata, tracking which agent is currently assigned to a user and the status of that agent (e.g., `Idle`, `Thinking`, `Executing Tool`, `Errored`).
2. **Command Queue**:
   - A sequential task queue implemented per agent instance.
   - Prevents race conditions by ensuring that if a user sends multiple Telegram messages rapidly, they are queued and processed sequentially, allowing the ReAct loop of the agent to finish its current turn before ingesting the next message.
3. **Agent Pool Manager**:
   - Manages the lifecycle of up to 10 concurrent agent runtime processes.
   - Spawns independent agent processes (using Node's `child_process.spawn`) when a session becomes active, and terminates them or puts them into a low-memory sleep state after a configurable inactivity timeout.
   - Implements health-checks, automatically restarting crashed agent processes and reporting telemetry data (CPU/RAM usage) to the main controller.
4. **Inter-Agent Bus (`bus/`)**:
   - An internal, low-overhead event bus allowing agents to communicate with each other.
   - Implemented via a lightweight local broker (like **Redis** running in-memory or a fast, embedded **WebSockets/IPC** broker in Node.js).
   - Uses structured JSON payloads. For instance, Agent A can publish a message to `bus://agent-B` asking for data processing, and await a structured response.

---

## 4. Layer 3: Agent Runtime Layer

The **Agent Runtime Layer** is where the actual LLM interaction and tool execution happen. Implemented in **Python** (for rich AI and library support) or **TypeScript**, each agent runs as a completely isolated OS process.

### Key Components
1. **Prompt Assembler**:
   - Compiles the final LLM payload dynamically.
   - Pulls short-term context (recent conversation history), system directives, user details, and long-term vector/semantic memories.
   - Formats the tools system prompt (detailing available functions and their JSON schemas) to inject into the Gemini context.
2. **ReAct Tool-Execution Loop**:
   - Executes the traditional **Reasoning-Action-Observation** loop.
   - Formulates a system message for Gemini 3.5 Flash, receives the structured tool calls, executes the tools, captures stdout/stderr/files as observations, and feeds them back into the next loop iteration.
   - Enforces a maximum recursion depth (e.g., 10 iterations) to prevent runaway API spend.
3. **Memory Persistence (`memory/`)**:
   - **Short-Term Memory**: Stored in a local, fast **SQLite** database containing exact message transcripts and execution trace logs.
   - **Long-Term Memory**: Stored using an embedded vector store (such as a local, serverless **ChromaDB** or **Qdrant** in-memory/file-based instance) that saves semantic summaries of previous tasks and document embeddings.
4. **Model Context Protocol (MCP) Client (`mcp-connectors/`)**:
   - Implements the client side of the Model Context Protocol (MCP).
   - Allows the agent to query and invoke external tools or read resources exposed by separate MCP servers (e.g., filesystem tools, database inspect, or search servers).
5. **Sandboxed Tool Runner (`sandbox/`)**:
   - Wraps sensitive tool executions (like running arbitrary Python code or shell commands) in a secure wrapper.
   - Recommends using OS-level sandboxing tool **Bubblewrap** (`bwrap`) to lock down the file system, network access, and environment variables of the tool subprocess.
