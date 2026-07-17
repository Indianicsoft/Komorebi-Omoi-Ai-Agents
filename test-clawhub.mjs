import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const projectRoot = join(homedir(), ".komorebi");
const backupPath = join(projectRoot, "komorebi.json.bak");
const configPath = join(projectRoot, "komorebi.json");

console.log("=== STARTING CLAWHUB SKILLS SYSTEM INTEGRATION TEST ===");

// 1. Back up existing configuration
let backupExists = false;
if (existsSync(configPath)) {
  console.log("Backing up current komorebi.json...");
  execSync(`cp "${configPath}" "${backupPath}"`);
  backupExists = true;
}

// 2. Setup 10 mock agents for the test
console.log("Configuring 10 test agents in komorebi.json...");
const testAgents = Array.from({ length: 10 }, (_, i) => ({
  id: `agent-${i + 1}`,
  name: `Test Agent ${i + 1}`,
  workspace: join(projectRoot, "agents", `agent-${i + 1}`)
}));

const testConfig = {
  models: {
    mode: "merge",
    providers: {
      "openai-compatible": {
        baseUrl: "https://api.openai.com/v1",
        apiKey: "mock-key",
        api: "openai-responses",
        models: [{ id: "gpt-4o", name: "GPT-4o" }]
      }
    },
    default: "openai-compatible/gpt-4o"
  },
  gateway: {
    port: 18789,
    bindLocalOnly: true,
    authToken: "kore_admin_super_secret_token_change_me_12345"
  },
  channels: {
    telegram: {
      botToken: "",
      allowedChatIds: []
    }
  },
  agents: testAgents
};

mkdirSync(projectRoot, { recursive: true });
writeFileSync(configPath, JSON.stringify(testConfig, null, 2), "utf-8");

// Scaffold agent workspace configs
for (const agent of testAgents) {
  mkdirSync(agent.workspace, { recursive: true });
  const agentConfig = {
    agentId: agent.id,
    displayName: agent.name,
    toolPolicy: {
      allowedTools: ["read_file", "write_file", "exec", "web_fetch", "web_search"],
      networkAccess: true
    }
  };
  writeFileSync(join(agent.workspace, "agent.config.json"), JSON.stringify(agentConfig, null, 2), "utf-8");
  // Clean up any existing skills inside agent folder
  const skillsDir = join(agent.workspace, "skills");
  if (existsSync(skillsDir)) {
    rmSync(skillsDir, { recursive: true, force: true });
  }
}

// Clean up global skills too
const globalSkillsDir = join(projectRoot, "shared-skills");
if (existsSync(globalSkillsDir)) {
  rmSync(globalSkillsDir, { recursive: true, force: true });
}

// Ensure the CLI package is built so we can run it
console.log("Compiling CLI package...");
execSync("npm run build", { cwd: "/media/rohith/DataVolume1/komorebi omoi /cli" });

const cliScript = "/media/rohith/DataVolume1/komorebi omoi /cli/dist/index.js";

try {
  // Test 1: ClawHub search
  console.log("\n--- TEST 1: Searching for 'calendar' skill ---");
  const searchOut = execSync(`node "${cliScript}" skills search calendar`, { encoding: "utf-8" });
  console.log(searchOut);
  if (!searchOut.includes("@ndcccccc/calendar")) {
    throw new Error("ClawHub search failed to find '@ndcccccc/calendar' skill.");
  }

  // Test 2: Per-agent install to agent-1 only
  console.log("\n--- TEST 2: Installing to agent-1 only ---");
  const installOut = execSync(`node "${cliScript}" skills install @ndcccccc/calendar --agent agent-1`, { encoding: "utf-8" });
  console.log(installOut);

  // Test 3: Confirm isolation boundaries
  console.log("\n--- TEST 3: Verifying isolation boundaries ---");
  const listAgent1 = execSync(`node "${cliScript}" skills list --agent agent-1`, { encoding: "utf-8" });
  console.log("Agent-1 Skill List:\n", listAgent1);
  if (!listAgent1.includes("calendar")) {
    throw new Error("Skill was not installed to agent-1 workspace.");
  }

  // Check agent-2 to agent-10 list
  for (let i = 2; i <= 10; i++) {
    const listAgentN = execSync(`node "${cliScript}" skills list --agent agent-${i}`, { encoding: "utf-8" });
    if (listAgentN.includes("calendar")) {
      throw new Error(`Security isolation breach: calendar skill leaked to agent-${i}!`);
    }
  }
  console.log("✔ Isolation verified. Calendar skill did NOT appear for any of the other 9 agents.");

  // Test 4: Global installation
  console.log("\n--- TEST 4: Installing globally ---");
  const installGlobalOut = execSync(`node "${cliScript}" skills install @ndcccccc/calendar --global`, { encoding: "utf-8" });
  console.log(installGlobalOut);

  // Confirm it appears for all 10 agents
  console.log("\n--- TEST 5: Verifying global inheritance ---");
  for (let i = 1; i <= 10; i++) {
    const listAgentN = execSync(`node "${cliScript}" skills list --agent agent-${i}`, { encoding: "utf-8" });
    if (!listAgentN.includes("calendar")) {
      throw new Error(`Global skill inheritance failed: calendar skill did not appear in agent-${i}!`);
    }
  }
  console.log("✔ Global inheritance verified. Calendar skill now successfully appears for all 10 agents.");
  console.log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");

} finally {
  // 3. Restore and clean up
  console.log("\nCleaning up test folders...");
  for (const agent of testAgents) {
    if (existsSync(agent.workspace)) {
      rmSync(agent.workspace, { recursive: true, force: true });
    }
  }
  if (existsSync(globalSkillsDir)) {
    rmSync(globalSkillsDir, { recursive: true, force: true });
  }

  if (backupExists) {
    console.log("Restoring original komorebi.json configuration...");
    execSync(`mv "${backupPath}" "${configPath}"`);
  } else {
    rmSync(configPath, { force: true });
  }
}
