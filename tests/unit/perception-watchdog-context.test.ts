import { describe, it, expect, beforeEach, vi } from "vitest";
import { join } from "node:path";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";

// Import components
import { ContextSignalBus } from "../../gateway/src/context-bus.js";
import { GatewayWatchdog } from "../../gateway/src/watchdog.js";
import { understandMedia } from "../../agent-runtime/src/perception.js";

describe("Context Signal Bus & Situational Context", () => {
  const agentId = "test-agent-context";

  beforeEach(() => {
    // Clear signals file
    const bus = ContextSignalBus.getInstance();
    (bus as any).signalsMap.clear();
  });

  it("should resolve to unknown when there are no signals", () => {
    const bus = ContextSignalBus.getInstance();
    expect(bus.resolveSituationalContext(agentId)).toBe("unknown");
  });

  it("should resolve to do-not-disturb when calendar is busy or dnd custom signal is active", () => {
    const bus = ContextSignalBus.getInstance();
    
    // Publish busy calendar signal
    bus.publish(agentId, {
      signalType: "calendar-busy",
      value: "busy",
      source: "calendar",
      ttl: 60,
    });

    expect(bus.resolveSituationalContext(agentId)).toBe("do-not-disturb");
  });

  it("should resolve to mobile-brief when device motion is walking/driving", () => {
    const bus = ContextSignalBus.getInstance();
    
    bus.publish(agentId, {
      signalType: "device-motion",
      value: "walking",
      source: "sensor",
      ttl: 60,
    });

    expect(bus.resolveSituationalContext(agentId)).toBe("mobile-brief");
  });

  it("should resolve to active-desk when location is desk", () => {
    const bus = ContextSignalBus.getInstance();
    
    bus.publish(agentId, {
      signalType: "location-hint",
      value: "desk",
      source: "manual",
      ttl: 60,
    });

    expect(bus.resolveSituationalContext(agentId)).toBe("active-desk");
  });

  it("should filter out expired signals via TTL check", () => {
    const bus = ContextSignalBus.getInstance();
    
    bus.publish(agentId, {
      signalType: "location-hint",
      value: "desk",
      source: "manual",
      ttl: -10, // already expired
    });

    expect(bus.resolveSituationalContext(agentId)).toBe("unknown");
  });
});

describe("Gateway Watchdog Subsystem", () => {
  const agentId = "test-agent-watchdog";
  let mockPoolManager: any;
  let mockSessionManager: any;
  let mockWsServer: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPoolManager = {
      getStatusList: vi.fn().mockReturnValue([{ agentId, status: "running", uptimeMs: 1000 }]),
      terminateSession: vi.fn(),
    };
    mockSessionManager = {};
    mockWsServer = {
      publishToBus: vi.fn(),
      sendDirectTelegram: vi.fn().mockResolvedValue({}),
    };
    mockConfig = {
      agents: [
        {
          id: agentId,
          workspace: join(homedir(), ".komorebi", "agents", agentId),
          dailyCostCapUSD: 0.05,
        }
      ],
      gateway: {
        port: 18789,
        authToken: "test-token",
      }
    };

    const watchdog = GatewayWatchdog.getInstance();
    (watchdog as any).agentStates.clear();
  });

  it("should initialize healthy state", () => {
    const watchdog = GatewayWatchdog.getInstance();
    watchdog.initialize(mockPoolManager, mockSessionManager, () => mockWsServer, mockConfig);

    const state = watchdog.getHealthState(agentId);
    expect(state).toBe("healthy");
  });

  it("should auto-pause when daily cost cap is exceeded", () => {
    const watchdog = GatewayWatchdog.getInstance();
    watchdog.initialize(mockPoolManager, mockSessionManager, () => mockWsServer, mockConfig);

    // Record turn costing $0.06 (Gemini Flash cost rate 0.00000015 -> 400000 tokens)
    watchdog.recordTurnCost(agentId, 400000); 

    const state = watchdog.getHealthState(agentId);
    expect(state).toBe("paused");
    expect(watchdog.getAgentHealthData(agentId).lastStateChangeReason).toContain("Daily cost limit reached");
  });

  it("should transition to degraded state on high tool failure rate", () => {
    const watchdog = GatewayWatchdog.getInstance();
    watchdog.initialize(mockPoolManager, mockSessionManager, () => mockWsServer, mockConfig);

    // Record 10 tool call failures (rolling size >= 10, rate >= 40%)
    for (let i = 0; i < 10; i++) {
      watchdog.recordToolCall(agentId, true);
    }

    const state = watchdog.getHealthState(agentId);
    expect(state).toBe("degraded");
  });

  it("should manually resume to healthy state", () => {
    const watchdog = GatewayWatchdog.getInstance();
    watchdog.initialize(mockPoolManager, mockSessionManager, () => mockWsServer, mockConfig);

    // Exceed cap first
    watchdog.recordTurnCost(agentId, 400000); 
    expect(watchdog.getHealthState(agentId)).toBe("paused");

    // Resume agent
    watchdog.resumeAgent(agentId, "Manually cleared");
    expect(watchdog.getHealthState(agentId)).toBe("healthy");
  });
});

describe("Media Understanding Fallback resolution", () => {
  it("should return native provider mapping when model is Gemini and media type matches native support", async () => {
    const mockAgentConfig = {
      id: "agent-1",
      model: {
        name: "gemini-3.5-flash",
      }
    };
    const mockGlobalConfig = {};
    const mockToolRegistry: any = { has: () => false };
    const mockModelProvider: any = { id: "gemini" };
    
    // Setup a mock attachment path
    const testPath = join(homedir(), ".komorebi", "test-attachment.jpg");
    if (!existsSync(join(homedir(), ".komorebi"))) {
      mkdirSync(join(homedir(), ".komorebi"), { recursive: true });
    }
    writeFileSync(testPath, "mock binary content");

    const attachment = {
      type: "photo",
      fileId: "file123",
      localPath: testPath,
    };

    const res = await understandMedia(attachment, mockAgentConfig, mockGlobalConfig, mockToolRegistry, mockModelProvider);
    expect(res.provider).toBe("native");
    expect(res.nativePart?.mimeType).toBe("image/jpeg");
    expect(res.nativePart?.data).toBe(Buffer.from("mock binary content").toString("base64"));

    // Cleanup
    try {
      rmSync(testPath);
    } catch {}
  });
});
