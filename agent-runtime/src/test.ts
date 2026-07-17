import { createModelProvider } from "./providers/index.js";
import { ToolRegistry } from "./registry.js";
import { PromptAssembler } from "./prompt.js";
import { AgentRuntime } from "./runtime.js";
import { coreToolsList } from "./tools.js";
import { MessageEnvelope, ToolPolicy } from "./types.js";

async function runMockTest() {
  console.log("==================================================");
  console.log("KOMOREBI OMOI - AGENT RUNTIME TEST RUN (MOCK KEY)");
  console.log("==================================================");

  const agentId = "test-agent";
  const agentName = "Komorebi Coder Test";
  const sessionId = "test-agent:peer:12345";
  const workspacePath = "./workspaces/test-agent";
  
  // 1. Tool registry setup
  const policy: ToolPolicy = {
    sandboxType: "bubblewrap",
    allowedTools: ["*"],
    networkAccess: false,
  };
  const registry = new ToolRegistry(workspacePath, policy);
  for (const tool of coreToolsList) {
    registry.register(tool);
  }

  // 2. Model setup (using mock-key to trigger mock model generate content responses)
  const modelProvider = createModelProvider("gemini", "mock-key", "gemini-1.5-flash");

  // 3. Prompt setup
  const promptAssembler = new PromptAssembler(".", agentId, agentName);

  // 4. Runtime setup (mocking WebSocket by passing stub functions since test runs locally without connection)
  const runtime = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider,
    registry,
    promptAssembler,
    "mock-key",
    "gemini",
    undefined
  );

  // Mock RPC request handler since WebSocket is not active in this test run
  runtime.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    console.log(`[MockRPC] Method call: ${method}`, JSON.stringify(params));
    return { success: true } as unknown as T;
  };

  // 5. Build mock user Message Envelope
  const envelope: MessageEnvelope = {
    sender: {
      id: 12345,
      firstName: "TestUser",
      username: "test_uname",
    },
    chatId: 99999,
    content: "Search the web to see what Komorebi Omoi is.",
    attachments: [],
    channel: "telegram",
    timestamp: Math.floor(Date.now() / 1000),
  };

  console.log(`[Test] Ingesting mock message: "${envelope.content}"`);

  // 6. Execute ReAct Loop
  try {
    const finalReply = await runtime.executeReActLoop(envelope);
    console.log("\n==================================================");
    console.log("TEST SUCCESSFUL!");
    console.log("==================================================");
    console.log(`FINAL AGENT RESPONSE:\n${finalReply}`);
    console.log("==================================================");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  }
}

runMockTest();
