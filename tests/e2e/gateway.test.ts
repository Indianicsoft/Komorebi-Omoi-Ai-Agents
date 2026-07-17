import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GatewayWsServer } from "../../gateway/src/server.js";
import { GatewayCronScheduler } from "../../gateway/src/cron.js";
import { WebSocket } from "ws";

describe("Gateway WebSocket/HTTP Server E2E Smoke Tests", () => {
  let wsServer: GatewayWsServer;
  const testPort = 18899;

  beforeAll(async () => {
    // Spin up gateway server on dynamic test port
    const mockPool: any = { getStatusList: () => [] };
    const mockSession: any = {
      getAgentConnection: () => ({ readyState: 1 }),
      ensureAgentRunning: () => Promise.resolve({ readyState: 1 }),
      terminateSession: () => {}
    };
    wsServer = new GatewayWsServer(
      "127.0.0.1",
      testPort,
      mockPool,
      mockSession,
      () => undefined,
      {
        gateway: { host: "127.0.0.1", port: testPort, authToken: "test-token" },
        bus: { type: "embedded" },
        agents: []
      }
    );
  });

  afterAll(async () => {
    if (wsServer) {
      wsServer.close();
    }
  });

  it("should accept websocket connection with valid auth token", () => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${testPort}?token=test-token`);
      ws.on("open", () => {
        ws.close();
        resolve();
      });
      ws.on("error", (err) => {
        reject(err);
      });
    });
  });

  it("should query agent model and return generated content via POST /api/agents/:agentId/query-model", async () => {
    // Mock wsServer.sendRequest to avoid a real agent connection
    (wsServer as any).sendRequest = async (ws: any, method: string, params: any) => {
      if (method === "queryModel") {
        return { text: "Generated dynamic prompt: " + params.prompt };
      }
      return {};
    };

    const response = await fetch(`http://127.0.0.1:${testPort}/api/agents/test-agent/query-model`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token"
      },
      body: JSON.stringify({
        systemInstruction: "Write a prompt",
        prompt: "hello"
      })
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
    expect(result.success).toBe(true);
    expect(result.text).toBe("Generated dynamic prompt: hello");
  });

  it("should evaluate dynamic prompt using agent model provider during cron job execution", async () => {
    const mockSession: any = {
      getAgentConnection: () => ({ readyState: 1 }),
      ensureAgentRunning: () => Promise.resolve({ readyState: 1 }),
      terminateSession: () => {}
    };

    let queryModelCalled = false;
    let queryModelPrompt = "";

    // Mock sendRequest on wsServer
    (wsServer as any).sendRequest = async (ws: any, method: string, params: any) => {
      if (method === "queryModel") {
        queryModelCalled = true;
        queryModelPrompt = params.prompt;
        return { text: "Generated dynamic prompt output for: " + params.prompt };
      }
      return { reply: "Agent response" };
    };

    // We will intercept handleWakeEvent on messagePipeline to see what prompt is passed to the agent
    let routedPrompt = "";
    (wsServer.messagePipeline as any).handleWakeEvent = async (wakeEvent: any) => {
      routedPrompt = wakeEvent.payload.message;
    };

    const scheduler = new GatewayCronScheduler(
      mockSession,
      () => wsServer,
      null
    );

    const testJob = {
      id: "dynamic-test-job",
      name: "Dynamic E2E Test",
      agentId: "test-agent",
      expression: "0 0 * * *",
      prompt: "Base prompt template instruction",
      enabled: false, // Don't trigger cron runner
      webhookToken: "token123",
      dynamicPrompt: true,
      history: []
    };

    // Register job manually
    scheduler.registerJob(testJob);

    // Trigger runJob
    await scheduler.runJob("dynamic-test-job");

    expect(queryModelCalled).toBe(true);
    expect(queryModelPrompt).toBe("Base prompt template instruction");
    expect(routedPrompt).toBe("Generated dynamic prompt output for: Base prompt template instruction");
  });
});
