import { pluginHooksRegistry } from "./runtime/agent-hooks/hooks.js";
import { ChatMessage, ToolDefinition, ToolResult, ModelResponse } from "./types.js";
import { ModelProvider } from "./providers/index.js";
import { ToolRegistry } from "./registry.js";
import { PromptAssembler } from "./prompt.js";
import { MemoryStack } from "./memory-stack.js";
import { FinishedTurn } from "./context-engine/index.js";
import { komorebiHarness } from "./runtime/harness/komorebi.js";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";

// Hook sequence tracker
const hookSequence: string[] = [];

// 1. Define E2E Hook Subscribers
class TestHookSubscriber {
  public async onBeforeAgentRun(sessionId: string, message: string, runContext: any) {
    hookSequence.push("assemble");
  }

  public async onAfterToolCall(sessionId: string, toolName: string, args: any, result: any, runContext: any) {
    hookSequence.push(`ingest:${toolName}`);
  }

  public async onAgentRunComplete(sessionId: string, finishedTurn: FinishedTurn, runContext: any) {
    hookSequence.push("afterTurn");
  }

  public async onCompactionTriggered(sessionId: string, compactionEvent: any, runContext: any) {
    hookSequence.push("compaction");
  }
}

// 2. Mock Model Provider to generate 4 tool calls sequentially and then return final response
class MockMultiToolProvider implements ModelProvider {
  public readonly id = "mock-provider";
  private callCount = 0;

  public async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[]
  ): Promise<ModelResponse> {
    this.callCount++;
    
    if (this.callCount === 1) {
      return {
        toolCalls: [{ id: "c1", name: "tool_one", arguments: {} }]
      };
    } else if (this.callCount === 2) {
      return {
        toolCalls: [{ id: "c2", name: "tool_two", arguments: {} }]
      };
    } else if (this.callCount === 3) {
      return {
        toolCalls: [{ id: "c3", name: "tool_three", arguments: {} }]
      };
    } else if (this.callCount === 4) {
      return {
        toolCalls: [{ id: "c4", name: "tool_four", arguments: {} }]
      };
    } else {
      return {
        content: "All 4 mock tools executed successfully. Parity confirmed."
      };
    }
  }
}

// 3. E2E execution test runner
async function runE2ETest() {
  console.log("=== STARTING KOMOREBI OMOI E2E VERIFICATION TEST ===");

  // Setup directory for agent-specific mock files
  const agentDir = join(homedir(), ".komorebi", "agents", "e2e-agent");
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, "soul.md"), "# Mock Soul", "utf-8");

  // Setup tools registry
  const mockRegistry = new ToolRegistry("/tmp", { allowedTools: ["*"], sandboxType: "bubblewrap", networkAccess: false });
  mockRegistry.register({
    definition: {
      name: "tool_one",
      description: "First mock tool",
      parameters: { type: "object", properties: {} }
    },
    execute: async () => "result_one"
  });
  mockRegistry.register({
    definition: {
      name: "tool_two",
      description: "Second mock tool",
      parameters: { type: "object", properties: {} }
    },
    execute: async () => "result_two"
  });
  mockRegistry.register({
    definition: {
      name: "tool_three",
      description: "Third mock tool",
      parameters: { type: "object", properties: {} }
    },
    execute: async () => "result_three"
  });
  mockRegistry.register({
    definition: {
      name: "tool_four",
      description: "Fourth mock tool",
      parameters: { type: "object", properties: {} }
    },
    execute: async () => "result_four"
  });

  const promptAssembler = new PromptAssembler("/tmp", "e2e-agent", "E2E Agent");
  const memoryStack = new MemoryStack("/tmp", "mock", undefined, "dummy-key");

  // Mock Session State
  const mockSessionState = {
    agentId: "e2e-agent",
    workspacePath: "/tmp",
    gatewayUrl: "ws://localhost",
    gatewayToken: "token",
    modelProvider: new MockMultiToolProvider(),
    toolRegistry: mockRegistry,
    promptAssembler,
    memoryStack,
    conversationHistory: [] as ChatMessage[],
    configuredContextLimit: 975, // set small to force compaction check
    estimateContextSize: (systemPrompt?: string) => {
      let size = systemPrompt ? systemPrompt.length : 0;
      for (const msg of mockSessionState.conversationHistory) {
        if (msg.content) size += msg.content.length;
        if (msg.toolCalls) size += JSON.stringify(msg.toolCalls).length;
        if (msg.toolResults) size += JSON.stringify(msg.toolResults).length;
      }
      return size;
    },
    runContextCompaction: async () => {
      hookSequence.push("compaction");
    },
    rpcRequest: async () => {},
    getLastModelResponse: () => "Halted."
  };

  // Register E2E Hook listener
  pluginHooksRegistry.register(new TestHookSubscriber());

  const progressEvents: any[] = [];
  const sessionId = "e2e-agent:chat:e2e_test";

  const wakeEvent = {
    type: "message" as const,
    sessionId,
    agentId: "e2e-agent",
    payload: {
      message: "Run verification checks."
    },
    timestamp: Date.now()
  };

  // Run the loop turn
  const finishedTurn = await komorebiHarness.runTurn(
    wakeEvent,
    mockSessionState,
    async (event: any) => {
      progressEvents.push(event);
      console.log(`[Progress Event] ${event.type} (Iteration: ${event.loopState?.iterationCount})`);
    }
  );

  console.log("\nFinished Turn Output:", finishedTurn);
  console.log("\nHook Sequence Fired:", hookSequence);

  // Assertions
  const hasAssemble = hookSequence.includes("assemble");
  const hasIngestOne = hookSequence.includes("ingest:tool_one");
  const hasIngestFour = hookSequence.includes("ingest:tool_four");
  const hasCompaction = hookSequence.includes("compaction");
  const hasAfterTurn = hookSequence.includes("afterTurn");

  if (!hasAssemble || !hasIngestOne || !hasIngestFour || !hasCompaction || !hasAfterTurn) {
    console.error("\n❌ E2E Hook Execution Order assertion FAILED.");
    process.exit(1);
  }

  // Verify sequence logic: assemble -> ingest -> compaction -> afterTurn
  const firstAssembleIdx = hookSequence.indexOf("assemble");
  const firstIngestIdx = hookSequence.indexOf("ingest:tool_one");
  const compactionIdx = hookSequence.indexOf("compaction");
  const afterTurnIdx = hookSequence.indexOf("afterTurn");

  if (!(firstAssembleIdx < firstIngestIdx && firstIngestIdx < compactionIdx && compactionIdx < afterTurnIdx)) {
    console.error("\n❌ Lifecycle sequence ordering assertion FAILED.");
    process.exit(1);
  }

  // Assert progress telemetry events
  const toolStartEvents = progressEvents.filter(e => e.type === "tool_start");
  if (toolStartEvents.length !== 4) {
    console.error(`\n❌ Expected 4 tool_start events, found ${toolStartEvents.length}`);
    process.exit(1);
  }

  console.log("\n✅ E2E VERIFICATION TEST PASSED SUCCESSFULLY!");
  process.exit(0);
}

runE2ETest().catch((err) => {
  console.error("❌ E2E test failed with error:", err);
  process.exit(1);
});
