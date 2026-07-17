import { WebSocket } from "ws";
import { GatewayWsServer } from "./server.js";
import { SessionManager } from "./session.js";
import { AgentPoolManager } from "./pool.js";

const TOKEN = "kore_admin_super_secret_token_change_me_12345";
process.env.OPENKOMOREBI_GATEWAY_TOKEN = TOKEN;

async function runStressTest() {
  console.log("==================================================");
  console.log("KOMOREBI OMOI - AGENT BUS STRESS TEST");
  console.log("==================================================");

  // 1. In-memory manager instantiations
  const poolManager = new AgentPoolManager([], ".");
  const sessionManager = new SessionManager([], ".");
  sessionManager.setPoolManager(poolManager);

  // Spin up WS Server on port 18790 to prevent port collisions
  const port = 18790;
  const wsServer = new GatewayWsServer("127.0.0.1", port, poolManager, sessionManager, () => undefined);

  // Profile RAM before clients connect
  const initialMem = process.memoryUsage().rss / (1024 * 1024);
  console.log(`[StressTest] Initial Gateway RAM footprint: ${initialMem.toFixed(2)} MB`);

  const clientCount = 10;
  const clients: WebSocket[] = [];
  const responsesReceived: any[] = [];

  // Helper promise to wait for a specific condition
  let onThreeResponses: () => void;
  const responsesPromise = new Promise<void>((resolve) => {
    onThreeResponses = resolve;
  });

  console.log(`[StressTest] Connecting ${clientCount} simulated agents...`);

  // 2. Connect 10 WebSocket clients
  for (let i = 1; i <= clientCount; i++) {
    const agentId = `agent-${i}`;
    const sessionId = `stress:peer:${i}`;
    const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${TOKEN}`);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", async () => {
        // Register agent
        ws.send(JSON.stringify({
          type: "req",
          id: `reg-${i}`,
          method: "registerAgent",
          params: { agentId, sessionId }
        }));
        
        // Subscribe to coordination channel
        ws.send(JSON.stringify({
          type: "req",
          id: `sub-${i}`,
          method: "busSubscribe",
          params: { topic: "coordination" }
        }));

        clients.push(ws);
        resolve();
      });

      ws.on("message", (raw) => {
        const frame = JSON.parse(raw.toString());
        
        // Listen to events on coordination bus
        if (frame.type === "evt" && frame.event === "bus:coordination") {
          const payload = frame.data;
          
          // If message is broadcast from agent-1, other agents reply
          if (payload.fromAgentId === "agent-1" && agentId !== "agent-1") {
            // Simulated agents 2, 3, and 4 respond
            if (["agent-2", "agent-3", "agent-4"].includes(agentId)) {
              console.log(`[StressTest - ${agentId}] Received broadcast. Publishing reply...`);
              ws.send(JSON.stringify({
                type: "req",
                id: `reply-pub-${agentId}`,
                method: "busPublish",
                params: {
                  topic: "coordination",
                  message: {
                    fromAgentId: agentId,
                    toAgentId: "agent-1",
                    intent: "taskResult",
                    payload: { result: `Task completed by ${agentId}` },
                    correlationId: payload.correlationId
                  }
                }
              }));
            }
          }

          // Agent 1 collects replies
          if (agentId === "agent-1" && payload.toAgentId === "agent-1") {
            console.log(`[StressTest - agent-1] Received reply from ${payload.fromAgentId}: "${payload.payload.result}"`);
            responsesReceived.push(payload);
            if (responsesReceived.length >= 3) {
              onThreeResponses();
            }
          }
        }
      });

      ws.on("error", reject);
    });
  }

  console.log(`[StressTest] All ${clientCount} agents registered and subscribed.`);

  // Profile RAM during peak connection active pool
  const peakMem = process.memoryUsage().rss / (1024 * 1024);
  console.log(`[StressTest] Peak Gateway RAM footprint: ${peakMem.toFixed(2)} MB`);

  // 3. Agent 1 Broadcasts Task Decomposition Request
  console.log("[StressTest - agent-1] Broadcasting task decomposition request to bus topic 'coordination'...");
  clients[0].send(JSON.stringify({
    type: "req",
    id: "broadcast-req",
    method: "busPublish",
    params: {
      topic: "coordination",
      message: {
        fromAgentId: "agent-1",
        toAgentId: "broadcast",
        intent: "taskDecomposition",
        payload: { task: "Decompose Komorebi Architecture" },
        correlationId: "corr-stress-100"
      }
    }
  }));

  // 4. Await responses under 10 seconds timeout
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout: Failed to receive 3 agent replies under 10 seconds.")), 10000);
  });

  try {
    await Promise.race([responsesPromise, timeoutPromise]);
    console.log("\n==================================================");
    console.log("STRESS TEST SUCCESSFUL!");
    console.log(`Received ${responsesReceived.length} replies on Agent 1 coordination bus.`);
    console.log(`Total RAM increase: ${(peakMem - initialMem).toFixed(2)} MB`);
    console.log("==================================================");
  } catch (err: any) {
    console.error("\n==================================================");
    console.error("STRESS TEST FAILED:", err.message);
    console.error("==================================================");
    process.exit(1);
  } finally {
    // Cleanup
    for (const ws of clients) {
      ws.close();
    }
    wsServer.close();
    console.log("[StressTest] Test completed. Exiting.");
    process.exit(0);
  }
}

runStressTest();
