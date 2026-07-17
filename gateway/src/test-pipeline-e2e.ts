import { MessagePipeline } from "./pipeline.js";

async function runTests() {
  console.log("=== RUNNING MESSAGE PIPELINE E2E TESTS ===");

  const globalConfig = {
    messages: {
      inbound: {
        debounceMs: 500, // short debounce for test speed
      },
      queue: {
        default: "steer",
      },
    },
    agents: [
      {
        id: "test-agent",
        defaults: {
          blockStreamingDefault: true,
        },
        model: {
          provider: "gemini",
          name: "gemini-3.5-flash",
          agentRuntimeId: "komorebi",
        },
      },
    ],
  };

  const wsCalls: { method: string; params: any }[] = [];
  const clientBroadcasts: any[] = [];
  const telegramEdits: { chatId: number; msgId: number; text: string }[] = [];
  const telegramReplies: { chatId: number; text: string }[] = [];

  const mockSessionManager = {
    terminateSession: (sessionId: string) => {
      console.log(`[Mock Session Manager] Terminated session: ${sessionId}`);
    },
    getAgentConnection: (sessionId: string) => {
      return { readyState: 1 }; // Open
    },
    ensureAgentRunning: async (agentId: string, sessionId: string) => {
      return { readyState: 1 };
    },
  };

  let resolveWsRequest: any = null;

  const sendWsRequest = async (ws: any, method: string, params: any) => {
    wsCalls.push({ method, params });
    if (method === "runTurn") {
      return new Promise((resolve) => {
        resolveWsRequest = () => resolve({ reply: "Mocked response from agent harness runTurn" });
      });
    }
    return { success: true };
  };

  const broadcastToClients = (event: any) => {
    clientBroadcasts.push(event);
  };

  const editTelegramMessage = async (chatId: number, msgId: number, text: string, bot: any) => {
    telegramEdits.push({ chatId, msgId, text });
  };

  const replyTelegramMessage = async (chatId: number, text: string, bot: any) => {
    telegramReplies.push({ chatId, text });
    return telegramReplies.length; // mock msg ID
  };

  const getTelegramBot = (agentId: string) => ({});

  const pipeline = new MessagePipeline(
    mockSessionManager,
    globalConfig,
    sendWsRequest,
    broadcastToClients,
    editTelegramMessage,
    replyTelegramMessage,
    getTelegramBot
  );

  // --- Test Case 1: Inbound Debouncing ---
  console.log("1. Testing Rapid Inbound Telegram Message Debounce & Batching...");
  
  const envelope = {
    sender: { id: 12345, firstName: "Alice" },
    chatId: 12345,
    messageId: 100,
    timestamp: Date.now(),
  };

  pipeline.handleInbound("telegram", "alice_acct", "test-agent:peer:12345", "Hello", envelope);
  pipeline.handleInbound("telegram", "alice_acct", "test-agent:peer:12345", "how are", { ...envelope, messageId: 101 });
  pipeline.handleInbound("telegram", "alice_acct", "test-agent:peer:12345", "you?", { ...envelope, messageId: 102 });

  // Wait 700ms for debounce timer to fire
  await new Promise((r) => setTimeout(r, 700));

  // Assert that only 1 runTurn call was made to the WebSocket containing the combined text
  const runTurnCalls = wsCalls.filter(c => c.method === "runTurn");
  if (runTurnCalls.length !== 1) {
    throw new Error(`Expected exactly 1 runTurn call, got ${runTurnCalls.length}`);
  }
  const turnMessage = runTurnCalls[0].params.message;
  console.log(`- Combined message received by runTurn: "${turnMessage}"`);
  if (turnMessage !== "Hello how are you?") {
    throw new Error(`Expected batch to concatenate to 'Hello how are you?', got '${turnMessage}'`);
  }
  console.log("✅ Inbound Telegram Message Debounce & Batching is correct!");

  // --- RESOLVE TEST CASE 1 TURN ---
  if (resolveWsRequest) resolveWsRequest();
  await new Promise((r) => setTimeout(r, 100)); // wait for turn to finish

  // --- Test Case 2: Steer Mode Injection on Active Run ---
  console.log("\n2. Testing Steer Injection during active run...");
  
  // Clear trace logs
  wsCalls.length = 0;

  // Make the run active by initiating another turn (resolveWsRequest is not called yet, so it hangs)
  pipeline.handleInbound("telegram", "alice_acct", "test-agent:peer:12345", "Hang turn", { ...envelope, messageId: 103 });
  await new Promise((r) => setTimeout(r, 600)); // wait for debounce trigger

  // Check that runTurn is pending
  if (wsCalls.filter(c => c.method === "runTurn").length !== 1) {
    throw new Error("Expected runTurn to be active");
  }

  // Send a message during this active run
  pipeline.handleInbound("telegram", "alice_acct", "test-agent:peer:12345", "Interject context", { ...envelope, messageId: 104 });
  await new Promise((r) => setTimeout(r, 600)); // wait for debounce

  // Verify that it triggered steerTurn
  const steerCalls = wsCalls.filter(c => c.method === "steerTurn");
  if (steerCalls.length !== 1) {
    throw new Error(`Expected exactly 1 steerTurn call, got ${steerCalls.length}`);
  }
  if (steerCalls[0].params.message !== "Interject context") {
    throw new Error(`Expected steered message to be 'Interject context', got '${steerCalls[0].params.message}'`);
  }
  console.log("✅ Steer Mode Injection correctly steers context into the active runtime!");

  // Resolve the active runTurn promise
  if (resolveWsRequest) resolveWsRequest();
  await new Promise((r) => setTimeout(r, 100)); // allow runTurn to finalize

  // --- Test Case 3: Real-Time WS Pipeline Status Broadcasts ---
  console.log("\n3. Testing Dashboard Live Pipeline Status Broadcast via WS...");

  const status = pipeline.getSessionPipelineStatus("test-agent:peer:12345");
  console.log(`- Retrieved session pipeline status:`, JSON.stringify(status, null, 2));

  if (status.queueMode !== "steer") {
    throw new Error(`Expected queueMode to be 'steer', got '${status.queueMode}'`);
  }
  if (status.blockStreaming !== true) {
    throw new Error(`Expected blockStreaming default to be true, got ${status.blockStreaming}`);
  }
  if (status.debounceMs !== 500) {
    throw new Error(`Expected debounceMs to be 500, got ${status.debounceMs}`);
  }
  console.log("✅ Live Pipeline Status query attributes are correct!");

  console.log("\n=== ALL PIPELINE E2E TESTS COMPLETED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
