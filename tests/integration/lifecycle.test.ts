import { describe, it, expect } from "vitest";
import { PluginHooksRegistry } from "../../agent-runtime/src/runtime/agent-hooks/hooks.js";

describe("Context Engine Lifecycle & Hook Firing Order", () => {
  it("should trigger hooks in correct order during agent run execution", async () => {
    const registry = new PluginHooksRegistry();
    const sequence: string[] = [];

    registry.register({
      onBeforeAgentRun: () => {
        sequence.push("onBeforeAgentRun");
      },
      onToolCall: () => {
        sequence.push("onToolCall");
      },
      onAfterToolCall: () => {
        sequence.push("onAfterToolCall");
      },
      onAgentRunComplete: () => {
        sequence.push("onAgentRunComplete");
      }
    });

    await registry.triggerOnBeforeAgentRun("session-1", "test message", {});
    await registry.triggerOnToolCall("session-1", "read_file", {}, {});
    await registry.triggerOnAfterToolCall("session-1", "read_file", {}, "file content", {});
    await registry.triggerOnAgentRunComplete("session-1", { reply: "Done", toolTrace: [], tokensUsed: 10, compactionEvents: [] }, {});

    expect(sequence).toEqual([
      "onBeforeAgentRun",
      "onToolCall",
      "onAfterToolCall",
      "onAgentRunComplete"
    ]);
  });
});
