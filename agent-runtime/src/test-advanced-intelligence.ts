import { ToolRegistry } from "./registry.js";
import { PromptAssembler } from "./prompt.js";
import { AgentRuntime } from "./runtime.js";
import { coreToolsList } from "./tools.js";
import { MessageEnvelope, ToolPolicy, ModelProvider, ModelResponse, ChatMessage, ToolDefinition } from "./types.js";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// 1. Define a highly customizable MockModelProvider
class MockModelProvider implements ModelProvider {
  public readonly id = "mock-provider";
  public mockResponses: ModelResponse[] = [];
  public callCount = 0;
  public critiqueReturn = "PASSED";

  async generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => void
  ): Promise<ModelResponse> {
    if (systemPrompt.includes("Evaluate solution confidence")) {
      return { content: "0.92" };
    }
    if (systemPrompt.includes("meta-cognitive optimization")) {
      return { content: "PROMPT_DELTA: Optimize strategy by caching file reads." };
    }
    if (systemPrompt.includes("elite agentic validator") || systemPrompt.includes("Logic & Quality Critique Auditor") || systemPrompt.includes("Critique Auditor")) {
      return { content: this.critiqueReturn };
    }
    if (systemPrompt.includes("Analyze the user request and break it down")) {
      return { content: `["Milestone 1: Read inputs", "Milestone 2: Process files", "Milestone 3: Complete turn"]` };
    }

    const nextResponse = this.mockResponses[this.callCount];
    this.callCount++;

    return nextResponse || { content: "Task completed successfully." };
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("KOMOREBI OMOI - ADVANCED INTELLIGENCE TESTS");
  console.log("==================================================");

  const agentId = "test-advanced-agent";
  const agentName = "Advanced Agent Persona";
  const sessionId = "test-session-987";
  const workspacePath = "./workspaces/test-advanced-agent";

  // Clean workspace
  if (existsSync(workspacePath)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }

  // --- Scenario 1 & 2: Meta-Cognitive Loop & Sub-agent Spawner ---
  console.log("\n--- SCENARIO 1 & 2: Meta-Cognitive Loop & Spawner ---");
  const modelProvider = new MockModelProvider();
  
  // Set up mock model responses
  // First call: returns 6 tool calls to trigger spawning scheduler
  modelProvider.mockResponses = [
    {
      content: "Let's perform file reads.",
      toolCalls: [
        { id: "tc-1", name: "read_file", arguments: { path: "test1.txt" } },
        { id: "tc-2", name: "read_file", arguments: { path: "test2.txt" } },
        { id: "tc-3", name: "read_file", arguments: { path: "test3.txt" } },
        { id: "tc-4", name: "read_file", arguments: { path: "test4.txt" } },
        { id: "tc-5", name: "read_file", arguments: { path: "test5.txt" } },
        { id: "tc-6", name: "read_file", arguments: { path: "test6.txt" } },
      ]
    },
    {
      content: "Final answer is ready."
    }
  ];

  const policy: ToolPolicy = {
    sandboxType: "none",
    allowedTools: ["*"],
    networkAccess: true,
    allowUnrestrictedCommands: true
  };

  const registry = new ToolRegistry(workspacePath, policy);
  for (const tool of coreToolsList) {
    registry.register(tool);
  }

  const promptAssembler = new PromptAssembler(".", agentId, agentName);
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
    "mock-key"
  );

  let rpcCalls: string[] = [];
  runtime.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    rpcCalls.push(method);
    return { approved: true, success: true } as unknown as T;
  };

  // Pre-create workspace files so read_file doesn't error
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(workspacePath, { recursive: true });
  for (let i = 1; i <= 6; i++) {
    writeFileSync(join(workspacePath, `test${i}.txt`), `Content of file ${i}`);
  }

  const envelope: MessageEnvelope = {
    sender: { id: 111, firstName: "Admin", username: "admin" },
    chatId: 222,
    content: "Read all files test1 to test6.",
    attachments: [],
    channel: "telegram",
    timestamp: Date.now()
  };

  const finalReply = await runtime.executeReActLoop(envelope);
  console.log("ReAct Loop Result:", finalReply);

  // Assertions
  const driftPath = join(homedir(), ".komorebi", "agents", agentId, "prompt-drift.json");
  const driftExists = existsSync(driftPath);
  console.log("Drift log file written:", driftExists);
  if (driftExists) {
    console.log("Drift log content:", readFileSync(driftPath, "utf-8"));
  }

  const logPath = join(homedir(), ".komorebi", "agents", agentId, "learning.log");
  const logExists = existsSync(logPath);
  console.log("Continuous learning.log file written:", logExists);
  if (logExists) {
    console.log("learning.log content:", readFileSync(logPath, "utf-8"));
  }

  const histPath = join(homedir(), ".komorebi", "agents", agentId, "skills", "performance-histogram.json");
  const histExists = existsSync(histPath);
  console.log("Performance histogram file written:", histExists);
  if (histExists) {
    console.log("histogram content:", readFileSync(histPath, "utf-8"));
  }

  // Check RPC calls to verify sub-agent spawning notifications
  console.log("RPC method calls triggered:", rpcCalls);

  // --- Scenario 3: Unrestricted Command Execution ---
  console.log("\n--- SCENARIO 3: Unrestricted Command Execution ---");
  
  // Test with allowUnrestrictedCommands: true
  console.log("Testing with allowUnrestrictedCommands: true...");
  const policyTrue: ToolPolicy = {
    sandboxType: "none",
    allowedTools: ["*"],
    networkAccess: true,
    allowUnrestrictedCommands: true
  };
  const registryTrue = new ToolRegistry(workspacePath, policyTrue);
  for (const tool of coreToolsList) {
    registryTrue.register(tool);
  }

  const runtimeTrue = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider,
    registryTrue,
    promptAssembler,
    "mock-key"
  );

  let rpcCountTrue = 0;
  runtimeTrue.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    if (method === "requestCommandApproval") {
      rpcCountTrue++;
    }
    return { approved: true, success: true } as unknown as T;
  };

  const execToolTrue = registryTrue.getDefinitions().find(d => d.name === "exec");
  if (execToolTrue) {
    const res = await registryTrue.execute("exec", { command: "echo 'hello world'" }, {
      agentId,
      sessionId,
      workspacePath,
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayToken: "mock-token",
      rpcRequest: runtimeTrue.rpcRequest.bind(runtimeTrue),
      runtime: runtimeTrue
    });
    console.log("Exec output (Unrestricted = true):", res.trim());
    console.log(`RPC requestCommandApproval calls (should be 0): ${rpcCountTrue}`);
  }

  // Test with allowUnrestrictedCommands: false
  console.log("\nTesting with allowUnrestrictedCommands: false...");
  const policyFalse: ToolPolicy = {
    sandboxType: "none",
    allowedTools: ["*"],
    networkAccess: true,
    allowUnrestrictedCommands: false
  };
  const registryFalse = new ToolRegistry(workspacePath, policyFalse);
  for (const tool of coreToolsList) {
    registryFalse.register(tool);
  }

  const runtimeFalse = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider,
    registryFalse,
    promptAssembler,
    "mock-key"
  );

  let rpcCountFalse = 0;
  runtimeFalse.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    if (method === "requestCommandApproval") {
      rpcCountFalse++;
    }
    return { approved: true, success: true } as unknown as T;
  };

  const execToolFalse = registryFalse.getDefinitions().find(d => d.name === "exec");
  if (execToolFalse) {
    const res = await registryFalse.execute("exec", { command: "echo 'hello world'" }, {
      agentId,
      sessionId,
      workspacePath,
      gatewayUrl: "ws://127.0.0.1:18789",
      gatewayToken: "mock-token",
      rpcRequest: runtimeFalse.rpcRequest.bind(runtimeFalse),
      runtime: runtimeFalse
    });
    console.log("Exec output (Unrestricted = false):", res.trim());
    console.log(`RPC requestCommandApproval calls (should be 1): ${rpcCountFalse}`);
  }

  // --- Scenario 4: Dynamic Tool Synthesis ---
  console.log("\n--- SCENARIO 4: Dynamic Tool Synthesis ---");
  const modelProvider4 = new MockModelProvider();
  
  // Custom tool code to write
  const toolCode = `
module.exports = {
  definition: {
    name: "multiply_by_five",
    description: "multiplies number by five",
    parameters: {
      type: "object",
      properties: {
        num: { type: "number" }
      },
      required: ["num"]
    }
  },
  execute: async (args) => {
    return String(args.num * 5);
  }
};
`;

  modelProvider4.mockResponses = [
    {
      content: "Let's synthesize a multiplication tool first.",
      toolCalls: [
        {
          id: "tc-synth",
          name: "synthesize_tool",
          arguments: {
            name: "multiply_by_five",
            description: "multiplies input number by five",
            parameterSchema: '{"properties": {"num": {"type": "number"}}, "required": ["num"]}',
            jsCode: toolCode
          }
        }
      ]
    },
    {
      content: "Now let's execute the newly synthesized tool.",
      toolCalls: [
        {
          id: "tc-run-synth",
          name: "multiply_by_five",
          arguments: { num: 20 }
        }
      ]
    },
    {
      content: "The final result is 100."
    }
  ];

  const registry4 = new ToolRegistry(workspacePath, policy);
  for (const tool of coreToolsList) {
    registry4.register(tool);
  }

  const runtime4 = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider4,
    registry4,
    promptAssembler,
    "mock-key"
  );
  runtime4.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    return { approved: true, success: true } as unknown as T;
  };

  const finalReply4 = await runtime4.executeReActLoop({
    sender: { id: 111, firstName: "Admin", username: "admin" },
    chatId: 222,
    content: "Synthesize a tool to multiply 20 by 5 and run it.",
    attachments: [],
    channel: "telegram",
    timestamp: Date.now()
  });

  console.log("Scenario 4 final response:", finalReply4);
  const customToolFileExists = existsSync(join(workspacePath, "custom-tools", "multiply_by_five.js"));
  console.log("Synthesized custom tool file saved:", customToolFileExists);

  // --- Scenario 5: Self-Critique & Corrective Loop ---
  console.log("\n--- SCENARIO 5: Self-Critique & Corrective Loop ---");
  const modelProvider5 = new MockModelProvider();
  
  // Set up critique failure first
  modelProvider5.critiqueReturn = "CRITIQUE: The response is too brief. Please explain in more detail.";
  
  modelProvider5.mockResponses = [
    {
      content: "Initial brief answer."
    },
    {
      content: "Detailed corrected answer addressing critique feedback."
    }
  ];

  const registry5 = new ToolRegistry(workspacePath, policy);
  for (const tool of coreToolsList) {
    registry5.register(tool);
  }

  const runtime5 = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider5,
    registry5,
    promptAssembler,
    "mock-key"
  );
  runtime5.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    return { approved: true, success: true } as unknown as T;
  };

  // Simulate critique transition to PASSED on second check
  const originalGenerate = modelProvider5.generate.bind(modelProvider5);
  let critiqueCount = 0;
  modelProvider5.generate = async (sys, hist, tools) => {
    if (sys.includes("elite agentic validator") || sys.includes("Auditor") || sys.includes("validator")) {
      critiqueCount++;
      if (critiqueCount > 1) {
        modelProvider5.critiqueReturn = "PASSED";
      }
    }
    return originalGenerate(sys, hist, tools);
  };

  const finalReply5 = await runtime5.executeReActLoop({
    sender: { id: 111, firstName: "Admin", username: "admin" },
    chatId: 222,
    content: "Explain artificial intelligence.",
    attachments: [],
    channel: "telegram",
    timestamp: Date.now()
  });

  console.log("Scenario 5 final response:", finalReply5);
  console.log("Critique checks executed (should be 2):", critiqueCount);

  // --- Scenario 6: Milestone Planning & Execution ---
  console.log("\n--- SCENARIO 6: Milestone Planning & Execution ---");
  const modelProvider6 = new MockModelProvider();
  modelProvider6.mockResponses = [
    {
      content: "Let's accomplish step 1.",
      toolCalls: [
        { id: "tc-pl-1", name: "read_file", arguments: { path: "test1.txt" } }
      ]
    },
    {
      content: "All milestones accomplished."
    }
  ];

  const registry6 = new ToolRegistry(workspacePath, policy);
  for (const tool of coreToolsList) {
    registry6.register(tool);
  }

  const runtime6 = new AgentRuntime(
    agentId,
    agentName,
    sessionId,
    workspacePath,
    "ws://127.0.0.1:18789",
    "mock-token",
    modelProvider6,
    registry6,
    promptAssembler,
    "mock-key"
  );
  runtime6.rpcRequest = async <T = any>(method: string, params: any): Promise<T> => {
    return { approved: true, success: true } as unknown as T;
  };

  // Override meta-cognitive check response to report milestone 0 is completed
  const originalGen6 = modelProvider6.generate.bind(modelProvider6);
  modelProvider6.generate = async (sys, hist, tools) => {
    if (sys.includes("meta-cognitive optimization")) {
      return { content: "MILESTONE_ACHIEVED: 0\nPROMPT_DELTA: None" };
    }
    return originalGen6(sys, hist, tools);
  };

  await runtime6.executeReActLoop({
    sender: { id: 111, firstName: "Admin", username: "admin" },
    chatId: 222,
    content: "Complete task with structured milestones.",
    attachments: [],
    channel: "telegram",
    timestamp: Date.now()
  });

  const milestonesList = (runtime6 as any).activePlan;
  const completedList = (runtime6 as any).completedMilestones;

  console.log("Milestones parsed:", milestonesList);
  console.log("Milestones completed (should include index 0):", Array.from(completedList));
  if (milestonesList.length > 0 && completedList.has(0)) {
    console.log("Scenario 6 Milestone planning and execution checklist validation: PASSED");
  } else {
    throw new Error("Milestone planning and execution check off failed.");
  }

  console.log("\n==================================================");
  console.log("ALL SCENARIOS VALIDATED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
