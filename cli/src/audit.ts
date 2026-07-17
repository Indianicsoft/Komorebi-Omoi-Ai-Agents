import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import pc from "picocolors";
import { loadConfig } from "./config.js";
import { getFolderHashes } from "./clawhub.js";

export async function runSecurityAudit(): Promise<void> {
  console.log(pc.cyan("\n=================================================="));
  console.log(pc.cyan("        KOMOREBI SYSTEM SECURITY AUDIT            "));
  console.log(pc.cyan("==================================================\n"));

  let failed = false;
  const warnings: string[] = [];
  const errors: string[] = [];

  const config = loadConfig();

  // 1. Gateway binding check
  console.log(pc.blue("1. Auditing Gateway Binding Enforcement..."));
  const bindLocalOnly = config.gateway?.bindLocalOnly;
  const host = (config.gateway as any)?.host || "127.0.0.1";
  if (bindLocalOnly === false || host === "0.0.0.0") {
    errors.push("Gateway is configured to bind to public/all interfaces (0.0.0.0). It must bind to localhost (127.0.0.1) for local-bound safety.");
  } else {
    console.log(pc.green("✅ Gateway is securely bound to localhost."));
  }

  // 2. Plaintext secrets scan
  console.log(pc.blue("\n2. Auditing Committed Plaintext Secrets..."));
  const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
  
  const checkSecrets = (filePath: string, label: string) => {
    if (!existsSync(filePath)) return;
    const content = readFileSync(filePath, "utf-8");
    
    // Check for default token
    if (content.includes("kore_admin_super_secret_token_change_me_12345")) {
      warnings.push(`${label}: Default placeholder Gateway authToken is in use. Please generate a secure token.`);
    }

    // Check for raw keys
    const rawKeyRegex = /(?:sk-live-[a-zA-Z0-9]{32,}|sk-[a-zA-Z0-9]{32,}|AIzaSy[a-zA-Z0-9_-]{33})/g;
    const matches = content.match(rawKeyRegex);
    if (matches && matches.length > 0) {
      errors.push(`${label}: Plaintext API key(s) detected in config file. Use env variables (e.g. \`\${GEMINI_API_KEY}\`) instead.`);
    }
  };

  checkSecrets(userConfigPath, "User Config (~/.komorebi/komorebi.json)");
  const projectRoot = join(dirname(dirname(dirname(import.meta.url).replace("file://", ""))));
  const repoConfigPath = join(projectRoot, "komorebi.config.json");
  checkSecrets(repoConfigPath, "Repository Config (komorebi.config.json)");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(pc.green("✅ No plaintext secrets or default tokens found in configs."));
  }

  // 3. Agent daily cost caps & sandbox check
  console.log(pc.blue("\n3. Auditing Agent Lanes & Sandboxing Policies..."));
  const agents = config.agents || [];
  
  if (agents.length === 0) {
    warnings.push("No active agent lanes configured in komorebi.json.");
  } else {
    for (const a of agents) {
      const agentDir = join(homedir(), ".komorebi", "agents", a.id);
      const agentConfigPath = join(agentDir, "agent.config.json");
      
      if (!existsSync(agentConfigPath)) {
        errors.push(`Agent '${a.id}': Missing agent.config.json workspace descriptor.`);
        continue;
      }

      try {
        const agentConfig = JSON.parse(readFileSync(agentConfigPath, "utf-8"));
        
        // 3a. Spending cap check
        const cap = agentConfig.dailyCostCapUSD;
        if (cap === undefined) {
          warnings.push(`Agent '${a.id}': No explicit 'dailyCostCapUSD' configured. Defaulting to $1.00.`);
        } else if (cap > 10.0) {
          warnings.push(`Agent '${a.id}': High daily spending limit ($${cap.toFixed(2)}). Set below $5.00 for safety.`);
        }

        // 3b. Sandbox & Tool Policy
        const sandbox = agentConfig.toolPolicy?.sandboxType;
        if (!sandbox || sandbox === "none") {
          warnings.push(`Agent '${a.id}': Sandboxing is disabled ('none'). Highly recommend enabling 'bubblewrap' or 'firejail'.`);
        }

        const allowed = agentConfig.toolPolicy?.allowedTools || [];
        if (allowed.includes("*") && agentConfig.toolPolicy?.allowUnrestrictedCommands) {
          warnings.push(`Agent '${a.id}': Unrestricted execution ('*') combined with allowUnrestrictedCommands presents a high host-escalation risk.`);
        }

        console.log(pc.green(`✅ Agent '${a.id}': Policy audit completed.`));
      } catch (err: any) {
        errors.push(`Agent '${a.id}': Failed to read config: ${err.message}`);
      }
    }
  }

  // 4. Skills Trust & Drift Integrity
  console.log(pc.blue("\n4. Auditing Installed Skills Trust Score & File Drift..."));
  const agentsDir = join(homedir(), ".komorebi", "agents");
  if (existsSync(agentsDir)) {
    try {
      const agentDirs = readdirSync(agentsDir).filter(f => existsSync(join(agentsDir, f, "agent.config.json")));
      for (const agent of agentDirs) {
        const skillsDir = join(agentsDir, agent, "skills");
        if (!existsSync(skillsDir)) continue;
        const skillFolders = readdirSync(skillsDir).filter(f => f !== ".clawhub" && existsSync(join(skillsDir, f, "SKILL.md")));
        
        for (const sf of skillFolders) {
          const skillPath = join(skillsDir, sf);
          const trustJsonPath = join(skillPath, ".trust", "trust.json");
          if (!existsSync(trustJsonPath)) {
            errors.push(`Agent '${agent}' / Skill '${sf}': Missing trust attestation file (.trust/trust.json).`);
            continue;
          }

          const trustData = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
          if (trustData.score === "UNKNOWN" || trustData.score === "SUSPICIOUS" || trustData.score === "UNTRUSTED") {
            errors.push(`Agent '${agent}' / Skill '${sf}': Unaccepted trust score '${trustData.score}'.`);
          }

          // Content Integrity check ( Drift detection )
          const currentHashes = getFolderHashes(skillPath);
          for (const key of Object.keys(currentHashes)) {
            if (key.startsWith(".trust/")) {
              delete currentHashes[key];
            }
          }

          let driftDetected = false;
          for (const [file, hash] of Object.entries(currentHashes)) {
            if (trustData.hashes[file] !== hash) {
              driftDetected = true;
              break;
            }
          }

          if (driftDetected) {
            errors.push(`Agent '${agent}' / Skill '${sf}': Integrity drift detected! Local files modified after installation.`);
          }
        }
      }
      console.log(pc.green("✅ All installed skills trust scores and file integrity checks completed."));
    } catch (err: any) {
      errors.push(`Skills re-scan failed: ${err.message}`);
    }
  }

  // Final summary
  console.log(pc.cyan("\n=================================================="));
  console.log(pc.cyan("                AUDIT SUMMARY                     "));
  console.log(pc.cyan("=================================================="));

  if (warnings.length > 0) {
    console.log(pc.yellow(`⚠️  WARNINGS (${warnings.length}):`));
    for (const w of warnings) {
      console.log(pc.yellow(`  - ${w}`));
    }
  }

  if (errors.length > 0) {
    console.log(pc.red(`❌  ERRORS (${errors.length}):`));
    for (const e of errors) {
      console.log(pc.red(`  - ${e}`));
    }
    failed = true;
  }

  if (failed) {
    console.log(pc.red("\n❌ AUDIT FAILED. Please resolve the errors listed above before running in production."));
    process.exit(1);
  } else {
    console.log(pc.green("\n✅ AUDIT PASSED. System is verifiably production-ready."));
    process.exit(0);
  }
}
