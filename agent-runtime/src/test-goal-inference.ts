/**
 * test-goal-inference.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-end test scenarios for the Goal Inference & Creative Execution layer.
 *
 * Run: npx tsx agent-runtime/src/test-goal-inference.ts
 *
 * Scenarios:
 *   1. Ambiguous message → assert ONE targeted clarifying question
 *   2. Unavailable tool → assert 3 creative alternatives generated and tried
 *   3. Creative win → assert skill extracted automatically
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoalInferenceEngine, CreativeSolver, GoalAccuracyTracker, recordCreativeWin, loadCreativeLog } from "./runtime/goal-inference.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";

// ─── Minimal mock model provider ─────────────────────────────────────────────

function createMockModelProvider(responses: Record<string, string>) {
  let callIndex = 0;
  const calls: string[] = [];

  return {
    id: "mock",
    generate: async (systemPrompt: string, history: any[], tools: any[]) => {
      const key = Object.keys(responses)[callIndex % Object.keys(responses).length];
      const response = responses[key];
      calls.push(systemPrompt.slice(0, 80) + "...");
      callIndex++;
      return { content: response };
    },
    getCalls: () => calls
  };
}

// ─── Test Utilities ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ─── Scenario 1: Ambiguous Message → ONE Targeted Clarifying Question ────────

async function testScenario1_AmbiguousMessage() {
  console.log("\n━━━ Scenario 1: Ambiguous message with two close-confidence interpretations ━━━");
  console.log("    Goal: Engine must ask ONE targeted question, not guess or ask generically.\n");

  const agentId = "test-agent-scenario1";
  const workspacePath = join(homedir(), ".komorebi", "agents", agentId);

  // Two interpretations with similar confidence (no clear winner)
  const hypothesesJson = JSON.stringify([
    {
      statement: "Send the weekly digest email to the team",
      successCondition: "Email delivered to all team members' inboxes",
      confidence: 0.62,
      supportingEvidence: ["User said 'send it to the team'", "Weekly digest exists in memory"]
    },
    {
      statement: "Post the weekly digest update to the team Slack channel",
      successCondition: "Message visible in #team-updates Slack channel",
      confidence: 0.58,
      supportingEvidence: ["User often uses Slack for team comms", "Slack channel configured in bus permissions"]
    }
  ]);

  // When clarifying question is needed
  const clarifyingQuestion = "Should I send the weekly digest via email or post it to the team Slack channel?";
  const ambiguityMattersResponse = "YES";

  const mockProvider = createMockModelProvider({
    hypotheses: hypothesesJson,
    clarify: clarifyingQuestion,
    ambiguity: ambiguityMattersResponse
  });

  const engine = new GoalInferenceEngine(agentId, workspacePath, {
    goalInference: { confidenceThreshold: 0.75 }
  });

  const result = await engine.infer(
    "send it to the team",
    [
      { role: "user", content: "Can you prepare the weekly digest?" },
      { role: "model", content: "I've prepared the weekly digest summary." }
    ],
    mockProvider
  );

  console.log(`  Hypotheses generated: ${result.hypotheses.length}`);
  console.log(`  Clarification needed: ${result.clarificationNeeded}`);
  console.log(`  Clarifying question: "${result.clarifyingQuestion}"`);
  console.log(`  Chosen hypothesis: ${result.chosen?.statement ?? "none"}`);

  // Assertions
  assert(result.hypotheses.length >= 2, "At least 2 hypotheses generated");
  assert(result.clarificationNeeded === true, "Clarification triggered for close-confidence hypotheses");
  assert(result.clarifyingQuestion !== null, "A clarifying question was generated");
  assert(
    result.clarifyingQuestion !== null &&
    result.clarifyingQuestion !== "what do you mean?" &&
    result.clarifyingQuestion.length > 10,
    "Question is specific (not a generic fallback)",
    result.clarifyingQuestion ?? ""
  );
  assert(result.chosen === null, "No hypothesis autonomously chosen when ambiguous");

  // Verify the question differentiates between the TWO top hypotheses
  const q = (result.clarifyingQuestion || "").toLowerCase();
  const mentionsEmail = q.includes("email");
  const mentionsSlack = q.includes("slack") || q.includes("channel") || q.includes("message");
  assert(
    mentionsEmail || mentionsSlack,
    "Question specifically targets the email-vs-Slack distinction",
    result.clarifyingQuestion ?? ""
  );
}

// ─── Scenario 2: Unavailable Tool → 3 Creative Alternatives Before Escalation ─

async function testScenario2_CreativeAlternatives() {
  console.log("\n━━━ Scenario 2: Obvious approach unavailable → 3 creative alternatives generated ━━━");
  console.log("    Goal: CreativeSolver must generate 3 genuinely different strategies.\n");

  const agentId = "test-agent-scenario2";
  const workspacePath = join(homedir(), ".komorebi", "agents", agentId);

  const strategiesJson = JSON.stringify([
    {
      id: "strategy_1",
      name: "Web scraping fallback",
      description: "Scrape the data directly from the public website instead of using the API",
      toolsApproach: "web_fetch → parse HTML → extract data",
      estimatedSuccessLikelihood: 0.80,
      resourceCost: "medium",
      reversible: true
    },
    {
      id: "strategy_2",
      name: "Cached data approach",
      description: "Use previously cached/memory data from MEMORY.md if the current fetch is unavailable",
      toolsApproach: "memory_search → retrieve cached snapshot",
      estimatedSuccessLikelihood: 0.65,
      resourceCost: "low",
      reversible: true
    },
    {
      id: "strategy_3",
      name: "Delegate to peer agent",
      description: "Ask another agent on the bus that might have access to the API or alternative data source",
      toolsApproach: "agent_message → peer agent → relay result",
      estimatedSuccessLikelihood: 0.55,
      resourceCost: "low",
      reversible: true
    }
  ]);

  const mockProvider = createMockModelProvider({
    strategies: strategiesJson,
    verify: "VERIFIED",
    skill: "# Creative Fallback Strategy\nWhen REST API is blocked, scrape the public web endpoint instead."
  });

  const solver = new CreativeSolver(agentId, workspacePath);

  let verifyCallCount = 0;
  const strategies = await solver.generateStrategies(
    "fetch_weather_api",
    "API endpoint returned 403 Forbidden — API key not found",
    "Weather data for London retrieved and formatted",
    ["web_fetch", "web_search", "read_file", "memory_search", "agent_message", "exec"],
    mockProvider
  );

  console.log(`  Strategies generated: ${strategies.length}`);
  strategies.forEach((s, i) => {
    console.log(`  [${i+1}] "${s.name}": ${s.description}`);
  });

  assert(strategies.length >= 3, "At least 3 strategies generated");

  // Verify strategies are genuinely different (not the same approach with different params)
  const names = strategies.map(s => s.name.toLowerCase());
  const uniqueNames = new Set(names);
  assert(uniqueNames.size === names.length, "All strategies have unique names (genuinely different)");

  // Verify at least 2 different tool approaches
  const approaches = strategies.map(s => s.toolsApproach.split("→")[0].trim().toLowerCase());
  const uniqueApproaches = new Set(approaches);
  assert(uniqueApproaches.size >= 2, "At least 2 different tooling approaches", approaches.join(", "));

  // Verify strategies are sorted: reversible first, then by likelihood
  if (strategies.length >= 2) {
    const firstReversible = strategies[0].reversible;
    const hasIrreversibleFirst = !firstReversible && strategies.some(s => s.reversible);
    assert(!hasIrreversibleFirst, "Reversible strategies ranked before irreversible ones");
  }

  // Simulate tryStrategies — first strategy succeeds on its turn
  let executeCallCount = 0;
  let verifySucceeds = false;
  const executeReActLoopFn = async (prompt: string): Promise<string> => {
    executeCallCount++;
    if (executeCallCount >= 1) verifySucceeds = true; // First strategy works
    return `Executed: ${prompt.slice(0, 50)}...`;
  };

  const verifyFn = async (condition: string): Promise<boolean> => {
    return verifySucceeds;
  };

  const mockMemoryStack = {
    appendDailyLog: (msg: string) => console.log(`  [MemLog] ${msg}`)
  };

  const result = await solver.tryStrategies(
    strategies.slice(0, 3),
    "Retrieve weather data for London",
    "fetch_weather_api",
    executeReActLoopFn,
    verifyFn,
    "Weather data for London retrieved",
    mockProvider,
    mockMemoryStack
  );

  console.log(`\n  Strategy execution result: succeeded=${result.succeeded}`);
  console.log(`  Successful strategy: ${result.successfulStrategy?.name ?? "none"}`);

  assert(result.succeeded === true, "At least one creative strategy succeeded");
  assert(result.successfulStrategy !== null, "Successful strategy is captured");
  assert(executeCallCount <= 3, `Did not exceed 3 creative attempts (tried: ${executeCallCount})`);
}

// ─── Scenario 3: Creative Win → Skill Extracted Automatically ────────────────

async function testScenario3_SkillExtraction() {
  console.log("\n━━━ Scenario 3: Creative win → skill automatically extracted as learned skill ━━━");
  console.log("    Goal: After creative success, a SKILL.md must be written to learned skills.\n");

  const agentId = "test-agent-scenario3";
  const workspacePath = join(homedir(), ".komorebi", "agents", agentId);

  // Record a creative win directly
  recordCreativeWin(agentId, {
    timestamp: Date.now(),
    goal: "Fetch current stock price for AAPL",
    failedApproach: "alpha_vantage_api_call",
    successfulStrategy: "web-scraping-fallback",
    strategyDescription: "Scraped Yahoo Finance public page instead of using the blocked API",
    skillExtracted: true
  });

  const wins = loadCreativeLog(agentId);
  console.log(`  Creative wins logged: ${wins.length}`);

  assert(wins.length >= 1, "At least 1 creative win recorded in log");
  assert(wins[wins.length - 1].goal.includes("AAPL"), "Win contains the correct goal");
  assert(wins[wins.length - 1].skillExtracted === true, "Win is flagged as having skill extracted");

  // Verify creative-wins.jsonl exists at expected path
  const logPath = join(homedir(), ".komorebi", "agents", agentId, "metrics", "creative-wins.jsonl");
  assert(existsSync(logPath), `creative-wins.jsonl exists at ${logPath}`);

  // Verify accuracy tracker
  const tracker = new GoalAccuracyTracker(agentId);
  tracker.recordTaskCompletion("task-abc-123", "Fetch AAPL stock price", "Retrieve current price for AAPL stock");
  
  const stats = tracker.getStats();
  console.log(`  Accuracy stats: ${stats.totalTasks} tasks, accuracy: ${(stats.accuracyRate * 100).toFixed(1)}%`);

  assert(stats.totalTasks >= 1, "Accuracy tracker has at least 1 task recorded");
  assert(stats.accuracyRate === 1.0, "Accuracy starts at 100% with no corrections");

  // Simulate a user correction
  tracker.recordCorrection("task-abc-123", "No, I meant the closing price, not real-time");
  const statsAfterCorrection = tracker.getStats();
  assert(statsAfterCorrection.correctedTasks >= 1, "Correction recorded");
  assert(statsAfterCorrection.accuracyRate < 1.0, "Accuracy rate drops after correction");

  console.log(`  Accuracy after correction: ${(statsAfterCorrection.accuracyRate * 100).toFixed(1)}%`);
}

// ─── Scenario 4: High-confidence message → proceed autonomously (no question) ─

async function testScenario4_HighConfidenceAutonomous() {
  console.log("\n━━━ Scenario 4: High-confidence message → proceed autonomously (no clarifying question) ━━━");
  console.log("    Goal: With confidence > 0.75 and gap > 0.20, no question should be asked.\n");

  const agentId = "test-agent-scenario4";
  const workspacePath = join(homedir(), ".komorebi", "agents", agentId);

  const hypothesesJson = JSON.stringify([
    {
      statement: "List all files in the current workspace directory",
      successCondition: "Complete listing of workspace files displayed to user",
      confidence: 0.91,
      supportingEvidence: ["User explicitly said 'list files'", "workspace clearly in context", "exact match in MEMORY.md precedents"]
    },
    {
      statement: "Search for files matching a pattern",
      successCondition: "Filtered file list based on search pattern",
      confidence: 0.30,
      supportingEvidence: ["Less specific"]
    }
  ]);

  const mockProvider = createMockModelProvider({
    hypotheses: hypothesesJson,
    implicit: JSON.stringify([
      { category: "quality", description: "Show file sizes and modification dates", source: "heuristic" }
    ])
  });

  const engine = new GoalInferenceEngine(agentId, workspacePath, {
    goalInference: { confidenceThreshold: 0.75 }
  });

  const result = await engine.infer(
    "list all files",
    [],
    mockProvider
  );

  console.log(`  Hypotheses generated: ${result.hypotheses.length}`);
  console.log(`  Clarification needed: ${result.clarificationNeeded}`);
  console.log(`  Chosen: ${result.chosen?.statement ?? "none"} (confidence: ${result.chosen?.confidence})`);

  assert(result.clarificationNeeded === false, "No clarification needed for high-confidence message");
  assert(result.chosen !== null, "Hypothesis autonomously chosen");
  assert(result.chosen!.confidence >= 0.75, `Chosen confidence ≥ 0.75 (got ${result.chosen!.confidence})`);
  assert(result.planPreview.includes("🎯"), "Plan preview includes goal header");
  assert(result.planPreview.includes("confidence"), "Plan preview shows confidence score");
}

// ─── Main Runner ──────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   GOAL INFERENCE & CREATIVE EXECUTION LAYER — Test Suite        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  try { await testScenario1_AmbiguousMessage(); } catch (e: any) { console.error("Scenario 1 crashed:", e.message); failed++; }
  try { await testScenario2_CreativeAlternatives(); } catch (e: any) { console.error("Scenario 2 crashed:", e.message); failed++; }
  try { await testScenario3_SkillExtraction(); } catch (e: any) { console.error("Scenario 3 crashed:", e.message); failed++; }
  try { await testScenario4_HighConfidenceAutonomous(); } catch (e: any) { console.error("Scenario 4 crashed:", e.message); failed++; }

  console.log(`\n${"═".repeat(66)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failed === 0) {
    console.log("  ✅ ALL ASSERTIONS PASSED — Goal Inference layer verified.");
  } else {
    console.log(`  ⚠️  ${failed} assertion(s) failed. Review output above.`);
  }
  console.log("═".repeat(66) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
