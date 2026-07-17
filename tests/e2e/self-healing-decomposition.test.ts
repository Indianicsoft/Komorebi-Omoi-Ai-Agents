import { describe, it, expect, beforeAll } from "vitest";
import { SelfHealingSubsystem } from "../../gateway/src/self-healing.js";
import { DecompositionPlanner, DecompositionExecutor } from "../../agent-runtime/src/runtime/task-decomposition.js";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

describe("Self-Healing and Task Decomposition E2E Suite", () => {
  
  describe("Part A: Self-Healing Subsystem", () => {
    let mockPool: any;
    let mockSession: any;
    let terminateCalled = false;
    let ensureRunningCalled = false;

    beforeAll(() => {
      terminateCalled = false;
      ensureRunningCalled = false;

      mockPool = {
        terminateSession: (sid: string) => {
          terminateCalled = true;
        },
        ensureAgentRunning: (aid: string, sid: string) => {
          ensureRunningCalled = true;
          return Promise.resolve();
        },
        getStatusList: () => [{ agentId: "test-agent", sessionId: "test-agent:session-1", status: "running" }]
      };

      mockSession = {
        getSessionsForAgent: (aid: string) => [{ sessionId: "test-agent:session-1" }],
        getAgentConnection: (sid: string) => ({ readyState: 1 })
      };

      const mockConfig: any = {
        gateway: { host: "127.0.0.1", port: 18999, authToken: "test-token" },
        agents: [
          {
            id: "test-agent",
            model: { provider: "mock-prov", name: "mock-model" }
          }
        ]
      };

      SelfHealingSubsystem.getInstance().initialize(
        mockPool,
        mockSession,
        mockConfig,
        () => null,
        join(homedir(), ".komorebi")
      );
    });

    it("should trigger Tier 1 restart on first process crash strike", async () => {
      await SelfHealingSubsystem.getInstance().recordFailure("agent:test-agent", "process_crashed");
      expect(terminateCalled).toBe(true);
      expect(ensureRunningCalled).toBe(true);
    });

    it("should verify known-fixes DB immune registry updates on successful fix application", async () => {
      const sh = SelfHealingSubsystem.getInstance();
      const mockFix = {
        symptomFingerprint: "test-fingerprint",
        rootCause: "Config port conflict",
        fixApplied: "Auto-re-assigned port to default",
        fixType: "restart",
        successRate: 1.0,
        lastSeen: Date.now(),
        timesApplied: 1,
        timesSucceeded: 1
      };
      
      const success = await sh.applyFix("test-fingerprint", mockFix, true);
      expect(success).toBe(true);

      const fixes = sh.getKnownFixes();
      expect(fixes.some(f => f.symptomFingerprint === "test-fingerprint")).toBe(true);
    });
  });

  describe("Part B: Recursive Task Decomposition", () => {
    it("should classify complex multi-step goals correctly", async () => {
      const mockProvider: any = {
        generate: async () => {
          return { content: "COMPLEX" };
        }
      };

      const isComplex = await DecompositionPlanner.classifyTask(
        "Build a typescript app with 3 files, run vitest, and commit to git",
        mockProvider
      );
      expect(isComplex).toBe(true);
    });

    it("should decompose complex tasks into a sub-task tree", async () => {
      const mockPlan = {
        goal: "Test decompose",
        subtasks: [
          {
            id: "task_1",
            description: "Step 1: Write file",
            successCondition: "file test.txt exists",
            dependencies: []
          }
        ]
      };

      const mockProvider: any = {
        generate: async () => {
          return { content: JSON.stringify(mockPlan) };
        }
      };

      const planTree = await DecompositionPlanner.decomposeTask("Test decompose", mockProvider);
      expect(planTree.goal).toBe("Test decompose");
      expect(planTree.subtasks.length).toBe(1);
      expect(planTree.subtasks[0].id).toBe("task_1");
    });

    it("should execute task plan and verify success condition", async () => {
      const planTree = {
        goal: "Write a verification file",
        subtasks: [
          {
            id: "step_1",
            description: "Write test.txt file",
            successCondition: "file test.txt exists",
            dependencies: [],
            status: "pending" as const,
            attempts: 0
          }
        ]
      };

      const mockSessionState = {
        agentId: "test-agent",
        modelProvider: {},
        memoryStack: {
          appendDailyLog: () => {}
        },
        rpcRequest: async () => ({})
      };

      const reportProgress = async () => {};
      
      // Simulate sub-task writing file and validating
      const executeReActLoopFn = async (prompt: string) => {
        if (prompt.includes("Verify")) {
          // Model verification mock
          return "VERIFIED";
        }
        // Write the file
        writeFileSync("test.txt", "hello", "utf-8");
        return "Write done";
      };

      const executor = new DecompositionExecutor();
      const result = await executor.executePlan(
        { sessionId: "s1", type: "message", payload: { message: "run" } },
        mockSessionState,
        reportProgress,
        executeReActLoopFn,
        planTree
      );

      expect(result).toContain("successfully resolved");
      expect(existsSync("test.txt")).toBe(true);

      // Cleanup
      if (existsSync("test.txt")) {
        unlinkSync("test.txt");
      }
    });
  });
});
