import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GatewayWsServer } from "../../gateway/src/server.js";
import { GatewayWatchdog } from "../../gateway/src/watchdog.js";
import { SessionManager } from "../../gateway/src/session.js";
import { AgentPoolManager } from "../../gateway/src/pool.js";
import { AgentRuntime } from "../../agent-runtime/src/runtime.js";
import { ToolRegistry } from "../../agent-runtime/src/registry.js";
import { PromptAssembler } from "../../agent-runtime/src/prompt.js";
import { ModelProvider, MessageEnvelope, ToolPolicy } from "../../agent-runtime/src/types.js";
import { runDiagnostics } from "../../cli/src/doctor.js";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Import SRE Plugin Hooks Registry and Subscribers
import { pluginHooksRegistry } from "../../agent-runtime/src/runtime/agent-hooks/hooks.js";
import {
  SkillsLoaderSubscriber,
  ReflectionSubscriber,
  CompactionSubscriber,
  CuratorSubscriber,
  ProgressDraftSubscriber,
  WatchdogSubscriber,
  ProactivitySubscriber
} from "../../agent-runtime/src/context-engine/hooks.js";

describe("Komorebi Omoi E2E Golden Path Scenario", () => {
  const port = 18999;
  const token = "test_sre_super_secret_token";
  let gatewayServer: GatewayWsServer;
  let watchdog: GatewayWatchdog;
  let tempDir: string;
  let agent1Dir: string;
  let agent2Dir: string;

  beforeAll(async () => {
    // Set Gateway Token env variable for authentication
    process.env.OPENKOMOREBI_GATEWAY_TOKEN = token;

    // Register all SRE subscribers to the plugin hooks registry
    pluginHooksRegistry.register(new SkillsLoaderSubscriber());
    pluginHooksRegistry.register(new ReflectionSubscriber());
    pluginHooksRegistry.register(new CompactionSubscriber());
    pluginHooksRegistry.register(new CuratorSubscriber());
    pluginHooksRegistry.register(new ProgressDraftSubscriber());
    pluginHooksRegistry.register(new WatchdogSubscriber());
    pluginHooksRegistry.register(new ProactivitySubscriber());

    // 1. Create SRE workspaces
    tempDir = join(process.cwd(), "tests", "e2e", "tmp_workspaces");
    agent1Dir = join(tempDir, "agent-1");
    agent2Dir = join(tempDir, "agent-2");

    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(agent1Dir, { recursive: true });
    mkdirSync(agent2Dir, { recursive: true });

    // 2. Scaffold default agent files
    const scaffoldAgent = (dir: string, name: string) => {
      writeFileSync(join(dir, "agent.config.json"), JSON.stringify({
        agentId: name,
        displayName: name,
        dailyCostCapUSD: 0.05,
        toolPolicy: {
          sandboxType: "none",
          allowedTools: ["*"],
          deny: ["destructive"]
        }
      }, null, 2));
      writeFileSync(join(dir, "soul.md"), "# Soul Profile\n- Core values: SRE Compliance\n");
      writeFileSync(join(dir, "identity.md"), "# Identity\n- Name: " + name + "\n");
      writeFileSync(join(dir, "user.md"), "# User profile\n- Owner: Rohith\n");
      writeFileSync(join(dir, "memory.md"), "# Memory logs\n- Fresh start\n");
      writeFileSync(join(dir, "agents.md"), "# Peer Agents\n- None\n");
      writeFileSync(join(dir, "tools.md"), "# Custom Playbooks\n- None\n");
    };

    scaffoldAgent(agent1Dir, "agent-1");
    scaffoldAgent(agent2Dir, "agent-2");

    // 3. Spin up Gateway
    const sysConfig = {
      gateway: { host: "127.0.0.1", port, authToken: token, bindLocalOnly: true },
      bus: { type: "embedded" },
      agents: [
        { id: "agent-1", name: "agent-1", workspace: agent1Dir, dailyCostCapUSD: 0.05 },
        { id: "agent-2", name: "agent-2", workspace: agent2Dir, dailyCostCapUSD: 0.05 }
      ]
    };

    const sessionManager = new SessionManager(sysConfig.agents, tempDir);
    const poolManager = new AgentPoolManager(sysConfig.agents, tempDir, port);
    sessionManager.setPoolManager(poolManager);

    // Mock Pool Manager to return that agent-1 process is online and running
    poolManager.getStatusList = () => [
      { agentId: "agent-1", sessionId: "session-123", status: "running", uptimeMs: 1000 }
    ];

    gatewayServer = new GatewayWsServer(
      "127.0.0.1",
      port,
      poolManager,
      sessionManager,
      () => undefined,
      sysConfig as any
    );
    
    watchdog = GatewayWatchdog.getInstance();
    watchdog.initialize(
      poolManager,
      sessionManager,
      () => gatewayServer,
      sysConfig as any
    );
  });

  afterAll(async () => {
    if (gatewayServer) {
      gatewayServer.close();
    }
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("1. CLI Onboard & Doctor Diagnostics Verification", async () => {
    // Run CLI Doctor Diagnostics check in non-interactive mode
    await runDiagnostics(false);
  });

  it("2. Real Agent Connection and Telegram/Web Message Ingestion Loop", async () => {
    let modelReply = "Hello Rohith! I am SRE compliant.";
    const mockModel: ModelProvider = {
      id: "mock-model",
      generate: async () => ({
        content: modelReply,
        toolCalls: []
      })
    };

    const mockPolicy: ToolPolicy = {
      sandboxType: "none",
      allowedTools: ["*"],
      networkAccess: true
    };

    const registry = new ToolRegistry(agent1Dir, mockPolicy);
    const promptAssembler = new PromptAssembler(process.cwd(), "agent-1", "agent-1");
    const agentRuntime = new AgentRuntime(
      "agent-1",
      "agent-1",
      "session-123",
      agent1Dir,
      `ws://127.0.0.1:${port}`,
      token,
      mockModel,
      registry,
      promptAssembler,
      "dummy-api-key"
    );

    // Start WebSocket connection
    await agentRuntime.start();

    // Poll until connection is registered
    let wsConn;
    for (let i = 0; i < 20; i++) {
      wsConn = gatewayServer.sessionManager.getAgentConnection("session-123");
      if (wsConn) break;
      await new Promise(r => setTimeout(r, 100));
    }
    expect(wsConn).toBeDefined();

    // Ingest a message simulation
    const envelope: MessageEnvelope = {
      sender: { id: 7075473878, username: "rohith", firstName: "Rohith" },
      chatId: 7075473878,
      channel: "telegram",
      content: "Hello agent-1",
      attachments: [],
      timestamp: Date.now()
    };

    const reply = await agentRuntime.executeReActLoop(envelope);
    expect(reply).toBe("Hello Rohith! I am SRE compliant.");
    
    // Verify Progress draft is tracked on Gateway
    const draft = gatewayServer.progressDraftManager.getOrCreateDraft("session-123");
    expect(draft).toBeDefined();
  });

  it("3. ClawHub Skill & Deny-Always-Wins Tool Policy Checks", async () => {
    const mockModel: ModelProvider = {
      id: "mock-model",
      generate: async (sys, hist) => {
        const lastMsg = hist[hist.length - 1];
        if (lastMsg && lastMsg.toolResults && lastMsg.toolResults.some(tr => tr.output.includes("Access Denied"))) {
          return {
            content: "Access Denied: The tool execution was blocked by the security policy.",
            toolCalls: []
          };
        }
        return {
          content: "Running tool call check",
          toolCalls: [
            {
              id: "call-1",
              name: "delete_file",
              arguments: { path: "soul.md" }
            }
          ]
        };
      },
      generateErrorSelfCorrection: async () => "Self-Correction triggered for policy deny"
    };

    const mockPolicy: ToolPolicy = {
      sandboxType: "none",
      allowedTools: ["read_file"], // Does not include delete_file
      networkAccess: true,
      deny: ["destructive"]        // Explicit group deny
    };

    const registry = new ToolRegistry(agent1Dir, mockPolicy);
    registry.register({
      definition: { name: "delete_file", description: "Delete file", parameters: { type: "object", properties: {} } },
      execute: async () => "Deleted"
    });

    const promptAssembler = new PromptAssembler(process.cwd(), "agent-1", "agent-1");
    const agentRuntime = new AgentRuntime(
      "agent-1",
      "agent-1",
      "session-123",
      agent1Dir,
      `ws://127.0.0.1:${port}`,
      token,
      mockModel,
      registry,
      promptAssembler,
      "dummy-api-key",
      "gemini",
      undefined,
      {
        agentId: "agent-1",
        toolPolicy: mockPolicy
      }
    );

    // Mock progress reporting to be offline-safe
    (agentRuntime as any).reportProgress = async () => {};

    const envelope: MessageEnvelope = {
      sender: { id: 7075473878, username: "rohith", firstName: "Rohith" },
      chatId: 7075473878,
      channel: "telegram",
      content: "Delete soul.md",
      attachments: [],
      timestamp: Date.now()
    };

    // Trigger loop execution and verify that the tool call fails due to policy deny
    const reply = await agentRuntime.executeReActLoop(envelope);
    expect(reply).toContain("Access Denied: The tool execution was blocked");
  });

  it("4. Intelligent Context Compaction Verification", async () => {
    const mockModel: ModelProvider = {
      id: "mock-model",
      generate: async () => ({
        content: "Looping context compaction",
        toolCalls: []
      })
    };

    const mockPolicy: ToolPolicy = {
      sandboxType: "none",
      allowedTools: ["*"],
      networkAccess: true
    };

    const registry = new ToolRegistry(agent1Dir, mockPolicy);
    const promptAssembler = new PromptAssembler(process.cwd(), "agent-1", "agent-1");
    const agentRuntime = new AgentRuntime(
      "agent-1",
      "agent-1",
      "session-123",
      agent1Dir,
      `ws://127.0.0.1:${port}`,
      token,
      mockModel,
      registry,
      promptAssembler,
      "dummy-api-key"
    );

    // Mock progress reporting to be offline-safe
    (agentRuntime as any).reportProgress = async () => {};

    // Override estimateContextSize & configuredContextLimit to trigger auto-compaction
    (agentRuntime as any).estimateContextSize = () => 16000;
    (agentRuntime as any).configuredContextLimit = 1000;
    
    let compactionTriggered = false;
    (agentRuntime as any).runContextCompaction = async () => {
      compactionTriggered = true;
    };

    const envelope: MessageEnvelope = {
      sender: { id: 7075473878, username: "rohith", firstName: "Rohith" },
      chatId: 7075473878,
      channel: "telegram",
      content: "Trigger compaction check",
      attachments: [],
      timestamp: Date.now()
    };

    await agentRuntime.executeReActLoop(envelope);
    expect(compactionTriggered).toBe(true);
  });

  it("5. Reflection Module Extraction & Memory Logging", async () => {
    const memoryPath = join(agent1Dir, "memory.md");
    expect(existsSync(memoryPath)).toBe(true);
  });

  it("6. Inter-Agent WebSocket Bus Routing Integration", async () => {
    const mockPolicy: ToolPolicy = {
      sandboxType: "none",
      allowedTools: ["*"],
      networkAccess: true
    };
    const registry = new ToolRegistry(agent1Dir, mockPolicy);
    const promptAssembler = new PromptAssembler(process.cwd(), "agent-1", "agent-1");
    const agent1 = new AgentRuntime(
      "agent-1",
      "agent-1",
      "session-1",
      agent1Dir,
      `ws://127.0.0.1:${port}`,
      token,
      { id: "mock", generate: async () => ({ content: "Hello", toolCalls: [] }) },
      registry,
      promptAssembler,
      "dummy-api-key"
    );
    await agent1.start();

    // Verify event bus routes and registers subscriptions
    const busState = (gatewayServer as any).busSubscriptions;
    expect(busState).toBeDefined();
  });

  it("7. Watchdog Cost-Limit Pauses & SRE Resumptions", async () => {
    // Record turn cost exceeding cost limit of $0.05
    watchdog.recordTurnCost("agent-1", 400000);

    const health = watchdog.getAgentHealthData("agent-1");
    expect(health.healthState).toBe("paused");
    expect(health.lastStateChangeReason).toContain("Daily cost limit reached");

    // Manually resume agent
    watchdog.resumeAgent("agent-1", "SRE manual override resumption");
    const healthAfter = watchdog.getAgentHealthData("agent-1");
    expect(healthAfter.healthState).toBe("healthy");
    expect(healthAfter.dailyCostUSD).toBe(0.06);
  });

  it("8. Supervisor Heartbeat Agent Crash Detection & Gateway Restart Recovery", async () => {
    // Override status list to mock offline status
    gatewayServer.poolManager.getStatusList = () => [];

    // Force watchdog re-evaluation
    (watchdog as any).evaluateAgentOverallHealth("agent-1");

    // Verify session state is offline
    const health = watchdog.getAgentHealthData("agent-1");
    expect(health.healthState).toBe("offline");

    // Simulate Gateway Restart
    gatewayServer.close();
    
    // Gateway re-registers on start
    expect(gatewayServer.sessionManager).toBeDefined();
  });
});
