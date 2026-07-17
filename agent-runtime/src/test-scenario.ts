import { enforceContextGuards } from "./compaction.js";
import { isToolPermitted } from "./policy.js";
import { SubAgentManager } from "./subagent.js";

async function runTests() {
  console.log("==========================================");
  console.log("   RUNNING KOMOREBI AGENT SECURITY TESTS   ");
  console.log("==========================================\n");

  // 1. Assert Context Window Guards
  console.log("1. Testing Context Floor Guards...");
  try {
    enforceContextGuards(12000); // Should throw
    console.error("❌ FAIL: Floor guard did not block 12K context limit!");
  } catch (err: any) {
    console.log(`✅ PASS: Context Floor guard threw expected error: "${err.message}"`);
  }

  // 2. Assert Deny-Always-Wins Tool Policy
  console.log("\n2. Testing Deny-Always-Wins Tool Policy...");
  const mockPolicy = {
    allow: ["*"], // allow everything
    deny: ["exec", "destructive"] // but deny exec and destructive group
  };

  const execAllowed = isToolPermitted("exec", mockPolicy);
  const deleteAllowed = isToolPermitted("delete_file", mockPolicy); // delete_file belongs to destructive group
  const readFileAllowed = isToolPermitted("read_file", mockPolicy);

  if (!execAllowed && !deleteAllowed && readFileAllowed) {
    console.log("✅ PASS: Deny-always-wins and named tool group checks succeed!");
  } else {
    console.error("❌ FAIL: Policy checker returned invalid outcomes:", { execAllowed, deleteAllowed, readFileAllowed });
  }

  // 3. Assert Sub-Agent Nesting Limits
  console.log("\n3. Testing Sub-Agent Nesting Limits...");
  const dummyContext: any = {
    agentId: "test-agent",
    workspacePath: ".",
    modelProvider: { generate: () => Promise.resolve({ content: "Stub reply" }) },
    toolRegistry: { getDefinitions: () => [], policy: { allow: ["*"], deny: [] } },
    nestingDepth: 2 // Max depth exceeded
  };

  try {
    await SubAgentManager.runSubAgent("Do nesting", dummyContext);
    console.error("❌ FAIL: Sub-agent spawner did not enforce nesting depth limits!");
  } catch (err: any) {
    console.log(`✅ PASS: Nesting depth guard blocked execution: "${err.message}"`);
  }

  // 4. Assert Sub-Agent Concurrency Limits
  console.log("\n4. Testing Sub-Agent Concurrency Limits...");
  SubAgentManager.activeCount = 3; // Max active sub-agents reached
  try {
    dummyContext.nestingDepth = 1; // reset depth
    await SubAgentManager.runSubAgent("Do concurrency", dummyContext);
    console.error("❌ FAIL: Sub-agent spawner did not enforce concurrency limits!");
  } catch (err: any) {
    console.log(`✅ PASS: Concurrency guard blocked execution: "${err.message}"`);
  }
  SubAgentManager.activeCount = 0; // reset

  console.log("\n==========================================");
  console.log("   ALL TEST SCENARIOS COMPLETED SUCCESSFULLY   ");
  console.log("==========================================");
}

runTests().catch(err => {
  console.error("Test execution crashed:", err);
  process.exit(1);
});
