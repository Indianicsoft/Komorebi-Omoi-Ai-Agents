import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { checkReflectionTriggers, runReflectionExtraction, ProgressiveSkillsLoader, runIntelligentFileCompaction } from "./learning.js";
import { ExecutedToolCall } from "./learning.js";
import { MemoryStack } from "./memory-stack.js";

// Mock model provider for test assertion
class MockModelProvider {
  public async generate(systemPrompt: string, history: any[], tools: any[]) {
    // If it's a skill extraction task
    if (systemPrompt.includes("Extract reusable workflows")) {
      return {
        content: `# Test Recovery Skill\ndescription: "A skill learned from test recovery trace"\n\n## When to Use\nWhen running a diagnostic recovery scenario.\n\n## Step-by-Step Method\n1. Do step A\n2. Recover on step B\n\n## Gotchas\n- Watch out for network failure.`
      };
    }
    // If it's a compaction task
    if (systemPrompt.includes("compaction engine")) {
      return {
        content: `# Curated Long-Term Memory\n\n- [source: compact-test, date-added: 2026-07-11, last-validated: 2026-07-11] Compacted fact successfully verified.`
      };
    }
    return { content: "Mock response" };
  }
}

async function runScenario() {
  console.log("=== RUNNING CLOSED-LOOP LEARNING SCENARIO TEST ===");
  const agentId = "test-agent";
  const agentDir = join(homedir(), ".komorebi", "agents", agentId);
  const workspacePath = join(agentDir, "session_test_run");
  
  if (!existsSync(workspacePath)) {
    mkdirSync(workspacePath, { recursive: true });
  }

  // Ensure MEMORY.md starts clean
  const memoryMdPath = join(agentDir, "MEMORY.md");
  writeFileSync(memoryMdPath, "# Curated Agent Memory\n\n- Initial fact placeholder.", "utf-8");

  const memoryStack = new MemoryStack(workspacePath, "dummy");

  // 1. Task with 7 tool calls, including 1 recovered error
  const traceToolCalls: ExecutedToolCall[] = [
    { name: "read_file", arguments: { path: "a.txt" }, output: "success", isError: false },
    { name: "web_search", arguments: { query: "komorebi" }, output: "Error: server timeout", isError: true },
    { name: "web_search", arguments: { query: "komorebi omoi" }, output: "found runtime repo", isError: false },
    { name: "write_file", arguments: { path: "b.txt" }, output: "success", isError: false },
    { name: "read_file", arguments: { path: "b.txt" }, output: "success", isError: false },
    { name: "exec", arguments: { command: "ls" }, output: "success", isError: false },
    { name: "exec", arguments: { command: "pwd" }, output: "success", isError: false }
  ];

  // 2. Trigger check
  const triggerResult = checkReflectionTriggers(traceToolCalls);
  console.log("Trigger Detected:", triggerResult.triggered, "Type:", triggerResult.type);
  if (!triggerResult.triggered || triggerResult.type !== "complexity") {
    throw new Error("Trigger A (Complexity) should have fired since we have 7 tool calls!");
  }

  // Check Trigger B (Recovery) manually as well
  const checkRecovery = checkReflectionTriggers(traceToolCalls.slice(0, 3));
  console.log("Check Recovery Trigger:", checkRecovery.triggered, "Type:", checkRecovery.type);
  if (!checkRecovery.triggered || checkRecovery.type !== "recovery") {
    throw new Error("Trigger B (Recovery) should have fired for the first 3 calls!");
  }

  // 3. Spawning Extraction Job
  const mockProvider = new MockModelProvider();
  await runReflectionExtraction({
    userQuery: "Optimize system layout configuration",
    toolCalls: traceToolCalls,
    finalResponse: "Successfully completed diagnostic recovery layout optimization.",
    agentId,
    sessionId: "test-session-123",
    workspacePath
  }, mockProvider, memoryStack);

  // 4. Verification of extracted skill in Level-0 loader
  const loader = new ProgressiveSkillsLoader();
  const projectRoot = join(agentDir, "..", "..");
  const l0Headers = loader.loadLevel0Headers(agentId, projectRoot);
  console.log("Level 0 Skill Catalog size:", l0Headers.length);
  const learnedSkill = l0Headers.find(h => h.slug === "test-recovery-skill");
  if (!learnedSkill) {
    throw new Error("Learned skill 'test-recovery-skill' not found in Level-0 catalog!");
  }
  console.log("Learned Skill matched:", learnedSkill.name, "-", learnedSkill.description);

  // 5. Force MEMORY.md past budget and check Intelligent Compaction
  const longText = "A".repeat(3000); // 3000 characters (limit is 2500)
  console.log("Attempting to write 3000 characters to MEMORY.md...");
  
  await runIntelligentFileCompaction(
    memoryMdPath,
    longText,
    2500,
    mockProvider,
    agentId
  );

  const compactedContent = readFileSync(memoryMdPath, "utf-8");
  console.log("Compacted MEMORY.md size:", compactedContent.length);
  if (compactedContent.length > 2500) {
    throw new Error(`MEMORY.md length (${compactedContent.length}) exceeds 2500 cap!`);
  }

  // Verify backup file exists
  const historyDir = join(agentDir, ".history");
  const backups = readdirSync(historyDir).filter(f => f.startsWith("MEMORY.md"));
  console.log("Found backups:", backups);
  if (backups.length === 0) {
    throw new Error("Compaction backup file was not written!");
  }

  console.log("=== SCENARIO TEST COMPLETED SUCCESSFULLY! ===");
}

runScenario().catch(err => {
  console.error("Test scenario failed:", err);
  process.exit(1);
});
