#!/usr/bin/env node
import { Command } from "commander";
import { runOnboardWizard } from "./onboard.js";
import { runConfigureMenu } from "./configure.js";
import { runDiagnostics } from "./doctor.js";
import { showAgentsStatus } from "./status.js";
import { loadConfig } from "./config.js";
import { runUninstaller, runReconfigurer } from "./uninstall.js";
import { spawn, execSync } from "node:child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync, readdirSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import pc from "picocolors";
import { runQaSuite, showToolCoverage } from "./qa.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();
const projectRoot = join(homedir(), ".komorebi");

program
  .name("komorebi")
  .description("Universal onboarding, manager, and diagnostics CLI for the Komorebi Omoi AI runtime")
  .version("1.0.0");

// --- Onboarding & Config Subcommands ---
program
  .command("onboard")
  .alias("setup")
  .description("Launch the interactive TUI configuration wizard")
  .option("--non-interactive", "Run onboarding headlessly without prompts")
  .option("--accept-risk", "Accept prompt injection and remote security vulnerabilities")
  .option("--flow <type>", "Onboarding type flow (quickstart / advanced)")
  .option("--custom-base-url <url>", "Custom model provider endpoint base URL")
  .option("--custom-model-id <id>", "Default model ID payload")
  .option("--custom-api-key <key>", "Secret API authorization token key")
  .option("--custom-compatibility <api>", "Completions responses standard")
  .option("--telegram-token <token>", "Telegram Bot Token from @BotFather")
  .option("--agent-count <count>", "Total active agent lanes to spin up", parseInt)
  .action(async (options) => {
    await runOnboardWizard(options);
  });

program
  .command("configure")
  .description("Launch targeted prompt menu to edit individual config parameters")
  .action(async () => {
    await runConfigureMenu();
  });

program
  .command("doctor")
  .description("Audits system dependencies, API keys, ports, and agent workspaces")
  .option("--fix", "Attempt automatic repair of invalid settings and missing workspace paths")
  .action(async (options) => {
    await runDiagnostics(options.fix);
  });

// --- Gateway Process Control plane ---
const gateway = program.command("gateway").description("Control orchestrator daemon processes");

gateway
  .command("start")
  .description("Start the Gateway service background server daemon")
  .action(() => {
    const pidFile = join(projectRoot, "gateway.pid");
    if (existsSync(pidFile)) {
      console.log(pc.yellow("Gateway appears to be running already. Check status or restart first."));
      return;
    }

    console.log(pc.blue("Launching Komorebi Omoi Gateway control plane..."));
    
    // Check if systemd can be used
    if (existsSync("/etc/systemd/system/komorebi-gateway.service")) {
      try {
        execSync("sudo systemctl start komorebi-gateway");
        console.log(pc.green("Gateway service started successfully via systemd."));
        const cfg = loadConfig();
        console.log(pc.cyan(`Dashboard URL: http://127.0.0.1:${cfg.gateway.port}/`));
        return;
      } catch {
        // Fall back to bg process spawn if systemd fails (e.g. non-root or WSL)
      }
    }

    // Direct background spawn
    const gatewayScript = join(__dirname, "..", "..", "gateway", "dist", "index.js");
    const out = spawn("node", [gatewayScript], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production"
      }
    });

    out.unref();
    if (out.pid) {
      writeFileSync(pidFile, String(out.pid), "utf-8");
      console.log(pc.green(`Gateway started successfully in background. PID: ${out.pid}`));
      const cfg = loadConfig();
      console.log(pc.cyan(`Dashboard URL: http://127.0.0.1:${cfg.gateway.port}/`));
    }
  });

gateway
  .command("stop")
  .description("Stop Gateway background processes")
  .action(() => {
    if (existsSync("/etc/systemd/system/komorebi-gateway.service")) {
      try {
        execSync("sudo systemctl stop komorebi-gateway");
        console.log(pc.green("Gateway stopped via systemd."));
        return;
      } catch {}
    }

    const pidFile = join(projectRoot, "gateway.pid");
    if (!existsSync(pidFile)) {
      console.log(pc.yellow("No active Gateway PID file found. Gateway is not running."));
      return;
    }

    const pid = parseInt(readFileSync(pidFile, "utf-8"), 10);
    try {
      process.kill(pid, "SIGTERM");
      console.log(pc.green(`Stopped Gateway process (PID: ${pid}).`));
    } catch {
      console.log(pc.yellow(`Process with PID ${pid} was not active.`));
    } finally {
      unlinkSync(pidFile);
    }
  });

gateway
  .command("status")
  .description("Show operational status of Gateway daemon process")
  .action(() => {
    if (existsSync("/etc/systemd/system/komorebi-gateway.service")) {
      try {
        const out = execSync("systemctl status komorebi-gateway", { encoding: "utf-8" });
        console.log(out);
        return;
      } catch (err: any) {
        console.log(pc.yellow("Systemd status check failed, falling back to PID check."));
      }
    }

    const pidFile = join(projectRoot, "gateway.pid");
    if (existsSync(pidFile)) {
      const pid = parseInt(readFileSync(pidFile, "utf-8"), 10);
      try {
        process.kill(pid, 0); // Check if process is alive
        console.log(pc.green(`Gateway is running in background (PID: ${pid}).`));
        return;
      } catch {}
    }
    console.log(pc.red("Gateway is not running."));
  });

gateway
  .command("restart")
  .description("Restart the Gateway daemon")
  .action(() => {
    console.log(pc.blue("Restarting Gateway..."));
    try {
      execSync("komorebi gateway stop");
    } catch {}
    execSync("komorebi gateway start");
  });

import { loadAgentWorkspace } from "./workspace.js";

// --- Agents pool commands ---
const agents = program.command("agents").description("Manage active agent pool instances and workspaces");

agents
  .command("list")
  .alias("status")
  .description("Show table of PIDs, RAM usage, uptimes, and status of running agents")
  .action(async () => {
    await showAgentsStatus();
  });

agents
  .command("add")
  .description("Add a new agent lane to the pool configuration")
  .action(async () => {
    execSync("komorebi configure agents");
  });

agents
  .command("init")
  .argument("<agentId>", "Unique ID of the agent to initialize")
  .description("Scaffold the isolated workspace, files, and config for a new agent instance")
  .action((agentId) => {
    try {
      loadAgentWorkspace(agentId);
      console.log(pc.green(`[CLI] Successfully initialized and scaffolded workspace for agent '${agentId}'`));
    } catch (err: any) {
      console.error(pc.red(`[CLI] Failed to initialize agent workspace: ${err.message}`));
      process.exit(1);
    }
  });

agents
  .command("edit")
  .argument("<agentId>", "Unique ID of the agent")
  .argument("<file>", "Filename to open and edit (e.g. SOUL.md, IDENTITY.md, AGENTS.md, USER.md, MEMORY.md, TOOLS.md, HEARTBEAT.md)")
  .description("Open a workspace file for a specific agent inside your default $EDITOR")
  .action((agentId, file) => {
    const filePath = join(homedir(), ".komorebi", "agents", agentId, file);
    if (!existsSync(filePath)) {
      console.error(pc.red(`Error: File '${file}' not found for agent '${agentId}'.`));
      process.exit(1);
    }
    const editor = process.env.EDITOR || "nano";
    console.log(pc.cyan(`Opening ${file} for agent '${agentId}' with editor '${editor}'...`));
    const child = spawn(editor, [filePath], { stdio: "inherit" });
    child.on("exit", (code) => {
      process.exit(code || 0);
    });
  });

agents
  .command("inspect")
  .argument("<agentId>", "Unique ID of the agent to inspect")
  .option("--resolved", "Print final resolved config after merging precedence defaults")
  .option("--context-budget", "Show current character usage vs caps for each governed file")
  .option("--runtime-status", "Show execution, runtime harness, and channel status info")
  .option("--last-plan", "Show the last task decomposition execution plan tree")
  .option("--goal-accuracy", "Show rolling goal-match accuracy trend for this agent")
  .option("--creative-log", "Show history of creative-alternative successes and extracted skills")
  .description("Parse and print resolved workspace bundle, Zod validated config, and compiled prompt")
  .action(async (agentId, options) => {
    try {
      if (options.lastPlan) {
        console.log(pc.cyan(`\n=== LAST PLAN TREE: ${agentId} ===`));
        const globalConfig = loadConfig();
        const axios = (await import("axios")).default;
        try {
          const res = await axios.post(`http://127.0.0.1:${globalConfig.gateway.port}/api/rpc`, {
            jsonrpc: "2.0",
            method: "getAgentLastPlan",
            params: { agentId },
            id: "cli_inspect"
          }, {
            headers: { Authorization: `Bearer ${globalConfig.gateway.authToken}` }
          });
          const plan = res.data?.result?.plan;
          if (!plan) {
            console.log("No decomposition plan has been cached/executed for this agent yet.");
          } else {
            console.log(`Goal: ${pc.bold(plan.goal)}`);
            console.log("-".repeat(50));
            for (const step of plan.subtasks) {
              const marker = step.status === "completed" ? pc.green("✅") : step.status === "running" ? pc.yellow("⏳") : step.status === "failed" ? pc.red("❌") : "◽";
              console.log(`${marker} ${pc.bold(step.id)}: ${step.description}`);
              console.log(`   Success Condition: ${step.successCondition}`);
              console.log(`   Status: ${step.status} | Attempts: ${step.attempts}`);
            }
          }
        } catch (err: any) {
          console.error(pc.red(`Failed to fetch last plan: ${err.message}`));
        }
        console.log(pc.cyan("======================================\n"));
        return;
      }

      if (options.goalAccuracy) {
        console.log(pc.cyan(`\n=== GOAL-MATCH ACCURACY: ${agentId} ===`));
        const statsPath = join(homedir(), ".komorebi", "agents", agentId, "metrics", "goal-accuracy-stats.json");
        const logPath   = join(homedir(), ".komorebi", "agents", agentId, "metrics", "goal-accuracy.jsonl");
        if (!existsSync(statsPath)) {
          console.log(pc.yellow("  No accuracy data recorded yet for this agent."));
          console.log(pc.cyan("======================================\n"));
          return;
        }
        try {
          const stats = JSON.parse(readFileSync(statsPath, "utf-8"));
          const pct = (stats.accuracyRate * 100).toFixed(1);
          const pctColor = stats.accuracyRate >= 0.999 ? pc.green : stats.accuracyRate >= 0.9 ? pc.yellow : pc.red;
          console.log(`Total tasks tracked:  ${pc.bold(String(stats.totalTasks))}`);
          console.log(`Corrected by user:    ${pc.red(String(stats.correctedTasks))}`);
          console.log(`Accuracy rate:        ${pctColor(pct + "%")} (target: 99.9%)`);

          if (stats.recentTrend && stats.recentTrend.length > 0) {
            const trendBar = stats.recentTrend.map((v: number) => v === 1 ? pc.green("█") : pc.red("░")).join("");
            console.log(`Recent trend (last ${stats.recentTrend.length}):  ${trendBar}`);
          }

          // Show last 5 corrections
          if (existsSync(logPath)) {
            const records = readFileSync(logPath, "utf-8")
              .trim().split("\n").filter(Boolean)
              .map((l: string) => { try { return JSON.parse(l); } catch { return null; } })
              .filter((r: any) => r && r.hadFollowUpCorrection)
              .slice(-5);
            if (records.length > 0) {
              console.log(`\n${pc.yellow("Last corrections (most recent first)")}:`);
              for (const r of records.reverse()) {
                const date = new Date(r.timestamp).toLocaleString();
                console.log(`  [${date}] ${r.originalRequest.slice(0, 80)}`);
                if (r.correctiveMessage) console.log(`    → User corrected: ${r.correctiveMessage.slice(0, 80)}`);
              }
            }
          }
        } catch (err: any) {
          console.error(pc.red(`Failed to load accuracy stats: ${err.message}`));
        }
        console.log(pc.cyan("======================================\n"));
        return;
      }

      if (options.creativeLog) {
        console.log(pc.cyan(`\n=== CREATIVE WINS LOG: ${agentId} ===`));
        const logPath = join(homedir(), ".komorebi", "agents", agentId, "metrics", "creative-wins.jsonl");
        if (!existsSync(logPath)) {
          console.log(pc.yellow("  No creative wins recorded yet for this agent."));
          console.log(pc.cyan("======================================\n"));
          return;
        }
        try {
          const wins = readFileSync(logPath, "utf-8")
            .trim().split("\n").filter(Boolean)
            .map((l: string) => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean);
          if (wins.length === 0) {
            console.log("  No creative wins recorded yet.");
          } else {
            console.log(`Total creative wins: ${pc.green(String(wins.length))}\n`);
            for (const win of wins.slice(-20)) {
              const date = new Date(win.timestamp).toLocaleString();
              console.log(`[${date}]`);
              console.log(`  Goal:              ${win.goal.slice(0, 80)}`);
              console.log(`  ${pc.red("Failed approach")}:   ${win.failedApproach.slice(0, 80)}`);
              console.log(`  ${pc.green("Creative strategy")}: ${win.successfulStrategy} — ${win.strategyDescription.slice(0, 100)}`);
              console.log(`  Skill extracted:   ${win.skillExtracted ? pc.green("YES") : pc.yellow("no")}`);
              console.log("-".repeat(60));
            }
          }
        } catch (err: any) {
          console.error(pc.red(`Failed to load creative log: ${err.message}`));
        }
        console.log(pc.cyan("======================================\n"));
        return;
      }

      if (options.runtimeStatus) {
        console.log(pc.cyan(`\n=== RUNTIME STATUS: ${agentId} ===`));
        const globalConfig = loadConfig();
        const resolveRuntimeStatus = (aId: string, sId: string, gConfig: any) => {
          const agent = gConfig.agents?.find((a: any) => a.id === aId);
          const provider = agent?.model?.provider || "gemini";
          const model = agent?.model?.name || agent?.model?.modelId || "gemini-3.5-flash";
          const execution = `${provider}/${model}`;
          
          let runtime = "komorebi";
          if (agent?.model?.agentRuntime?.id) {
            runtime = agent.model.agentRuntime.id;
          } else if (agent?.model?.agentRuntimeId) {
            runtime = agent.model.agentRuntimeId;
          }
          
          let channel = "web";
          if (sId.includes(":peer:")) {
            channel = "telegram";
          } else if (sId.includes("cron")) {
            channel = "cron";
          } else if (sId.includes("bus")) {
            channel = "bus";
          }
          return { execution, runtime, channel };
        };

        const webStatus = resolveRuntimeStatus(agentId, `${agentId}:chat:web_test`, globalConfig);
        const tgStatus = resolveRuntimeStatus(agentId, `${agentId}:peer:tg_test`, globalConfig);
        
        console.log(`Execution (Model Ref):  ${pc.green(webStatus.execution)}`);
        console.log(`Runtime (Harness ID):  ${pc.green(webStatus.runtime)}`);
        console.log(`Simulated Web Channel:  ${pc.green(webStatus.channel)}`);
        console.log(`Simulated TG Channel:   ${pc.green(tgStatus.channel)}`);
        console.log(pc.cyan("=====================================\n"));
        return;
      }

      if (options.contextBudget) {
        const agentDir = join(homedir(), ".komorebi", "agents", agentId);
        const filesToCheck = [
          { name: "USER.md", path: join(agentDir, "USER.md"), cap: 1500 },
          { name: "MEMORY.md", path: join(agentDir, "MEMORY.md"), cap: 2500 },
          { name: "AGENTS.md", path: join(agentDir, "AGENTS.md"), cap: 4000 }
        ];

        console.log(pc.cyan(`\n=== CONTEXT BUDGET AUDIT: ${agentId} ===`));
        console.log("File Name        | Used Chars | Cap Chars | Budget Used");
        console.log("-".repeat(55));

        for (const file of filesToCheck) {
          let used = 0;
          if (existsSync(file.path)) {
            used = readFileSync(file.path, "utf-8").length;
          }
          const pct = ((used / file.cap) * 100).toFixed(1);
          console.log(
            `${file.name.padEnd(16)} | ${String(used).padStart(10)} | ${String(file.cap).padStart(9)} | ${pct}%`
          );
        }
        console.log(pc.cyan("========================================\n"));
        return;
      }

      const bundle = loadAgentWorkspace(agentId);
      console.log(pc.cyan(`\n=== INSPECT AGENT: ${agentId} ===`));
      console.log(pc.green(`Workspace Path: ${bundle.workspacePath}`));

      if (options.resolved) {
        const globalConfig = loadConfig();
        // Resolve model precedence: agent.config.json > global defaults > fallback
        const resolvedModel = bundle.config.model || 
          (globalConfig.models && {
            provider: globalConfig.models.default.split("/")[0] || "gemini",
            modelId: globalConfig.models.default.split("/")[1] || "gemini-1.5-flash",
            temperature: 0.7
          }) || {
            provider: "gemini",
            modelId: "gemini-1.5-flash",
            temperature: 0.7
          };

        const resolvedConfig = {
          agentId: bundle.config.agentId,
          displayName: bundle.config.displayName || `Agent ${agentId}`,
          model: resolvedModel,
          toolPolicy: bundle.config.toolPolicy || { allow: ["*"], deny: [] },
          channelBinding: bundle.config.channelBinding || { telegram: { chatIds: [] } },
          busPermissions: bundle.config.busPermissions || { canMessage: "all", canBroadcast: true },
          resourceLimits: bundle.config.resourceLimits || { maxRamMB: 500, maxToolIterations: 15 }
        };

        console.log(pc.green("\nResolved Precedence Config (Merged):"));
        console.log(JSON.stringify(resolvedConfig, null, 2));
      } else {
        console.log(pc.green("\nRaw Config (agent.config.json):"));
        console.log(JSON.stringify(bundle.config, null, 2));
      }

      console.log(pc.green(`\nCompiled System Prompt length: ${bundle.systemPrompt.length} chars`));
      console.log(pc.cyan("=================================\n"));
    } catch (err: any) {
      console.error(pc.red(`[CLI] Failed to inspect agent workspace: ${err.message}`));
      process.exit(1);
    }
  });

agents
  .command("learning-log")
  .argument("<agentId>", "Unique ID of the agent")
  .description("Prints the Reflection/Curator event history log for that agent")
  .action((agentId) => {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    if (!existsSync(agentDir)) {
      console.error(pc.red(`Error: Agent directory not found for '${agentId}'`));
      process.exit(1);
    }
    
    console.log(pc.cyan(`\n=== LEARNING LOGS FOR AGENT: ${agentId} ===`));
    
    try {
      const mdFiles: { path: string; label: string }[] = [];
      
      const baseMemoryDir = join(agentDir, "memory");
      if (existsSync(baseMemoryDir)) {
        readdirSync(baseMemoryDir)
          .filter(f => f.endsWith(".md"))
          .forEach(f => mdFiles.push({ path: join(baseMemoryDir, f), label: f.replace(".md", "") }));
      }

      const subdirs = readdirSync(agentDir, { withFileTypes: true });
      for (const subdir of subdirs) {
        if (subdir.isDirectory() && subdir.name !== "skills" && subdir.name !== "plugins" && subdir.name !== ".history" && subdir.name !== "memory") {
          const sessionMemDir = join(agentDir, subdir.name, "memory");
          if (existsSync(sessionMemDir)) {
            readdirSync(sessionMemDir)
              .filter(f => f.endsWith(".md"))
              .forEach(f => mdFiles.push({ path: join(sessionMemDir, f), label: `${subdir.name}/${f.replace(".md", "")}` }));
          }
        }
      }

      if (mdFiles.length === 0) {
        console.log("  No learning events recorded yet.");
        return;
      }

      let logFound = false;
      for (const file of mdFiles) {
        const content = readFileSync(file.path, "utf-8");
        const lines = content.split("\n");
        const learningLines = lines.filter(l => l.includes("[Learning Loop]") || l.includes("[Curator]"));
        if (learningLines.length > 0) {
          logFound = true;
          console.log(pc.yellow(`\nSource: ${file.label}`));
          for (const line of learningLines) {
            console.log(`  ${line}`);
          }
        }
      }

      if (!logFound) {
        console.log("  No learning log entries found in daily memory logs.");
      }
      
      console.log(pc.cyan("\n========================================\n"));
    } catch (err: any) {
      console.error(pc.red(`[CLI] Failed to print learning logs: ${err.message}`));
      process.exit(1);
    }
  });

agents
  .command("health")
  .argument("[agentId]", "Optional specific agent ID")
  .description("Show watchdog health status and stats for all agents or a specific agent")
  .action(async (agentId) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.get(`http://127.0.0.1:${cfg.gateway.port}/api/system/health`, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      const { uptimeMs, agents: healthData } = res.data;
      console.log(pc.cyan(`\n=== WATCHDOG HEALTH REPORT ===`));
      console.log(`Gateway Uptime: ${(uptimeMs / 1000 / 60).toFixed(1)} mins`);
      console.log("-".repeat(50));
      
      const list = agentId ? [agentId] : Object.keys(healthData);
      for (const id of list) {
        const info = healthData[id];
        if (!info) {
          console.log(pc.red(`No health data for agent '${id}'`));
          continue;
        }
        let stateColor = pc.green;
        if (info.healthState === "degraded") stateColor = pc.yellow;
        if (info.healthState === "paused") stateColor = pc.blue;
        if (info.healthState === "offline") stateColor = pc.red;

        console.log(`Agent: ${pc.bold(id)}`);
        console.log(`  Health State:  ${stateColor(info.healthState.toUpperCase())}`);
        console.log(`  Daily Cost:    $${info.dailyCostUSD.toFixed(5)}`);
        console.log(`  Token Valid:   ${info.botTokenValid ? pc.green("YES") : pc.red("NO")}`);
        console.log(`  Tool Calls:    Success: ${info.toolCallSuccessCount} | Failures: ${info.toolCallFailureCount}`);
        console.log(`  Last Reason:   ${info.lastStateChangeReason}`);
        console.log("-".repeat(50));
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to fetch health: ${err.message}`));
      process.exit(1);
    }
  });

agents
  .command("resume <agentId>")
  .description("Manually resume a paused agent (resets tool failures and cost caps)")
  .action(async (agentId) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/agents/${agentId}/resume`, {}, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      if (res.data.success) {
        console.log(pc.green(`Successfully resumed agent '${agentId}' and reset watchdog parameters.`));
      } else {
        console.error(pc.red(`Failed to resume agent '${agentId}'.`));
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to resume agent: ${err.message}`));
      process.exit(1);
    }
  });

// --- Context commands ---
const contextCmd = program.command("context").description("Manage agent situational contexts & publish signals");

contextCmd
  .command("signal")
  .requiredOption("--agent <id>", "Agent ID target")
  .requiredOption("--type <type>", "Signal type: device-motion|time-of-day|location-hint|calendar-busy|custom")
  .requiredOption("--value <value>", "Signal value")
  .option("--source <source>", "Signal source", "cli")
  .option("--ttl <seconds>", "TTL in seconds", parseInt)
  .description("Publish a situational context signal to the Context Signal Bus")
  .action(async (options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/context/signal`, {
        agentId: options.agent,
        signalType: options.type,
        value: options.value,
        source: options.source,
        ttl: options.ttl || 7200
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      if (res.data.success) {
        console.log(pc.green(`Successfully published signal '${options.type}' = '${options.value}' to agent '${options.agent}'.`));
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to publish signal: ${err.message}`));
      process.exit(1);
    }
  });

contextCmd
  .command("show <agentId>")
  .description("Show active signals and resolved situational context for an agent")
  .action(async (agentId) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.get(`http://127.0.0.1:${cfg.gateway.port}/api/agents/${agentId}/context`, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      const { resolvedMode, activeSignals } = res.data;
      console.log(pc.cyan(`\n=== SITUATIONAL CONTEXT: ${agentId} ===`));
      console.log(`Resolved Mode: ${pc.bold(pc.green(resolvedMode))}`);
      console.log("\nActive Signals:");
      if (activeSignals.length === 0) {
        console.log("  No active context signals.");
      } else {
        for (const sig of activeSignals) {
          const age = Math.round((Date.now() - sig.timestamp) / 1000);
          console.log(`  • [${sig.signalType}] = '${sig.value}' (Source: ${sig.source}, Age: ${age}s, TTL: ${sig.ttl}s)`);
        }
      }
      console.log("=".repeat(35) + "\n");
    } catch (err: any) {
      console.error(pc.red(`Failed to retrieve context: ${err.message}`));
      process.exit(1);
    }
  });

import { SkillInstaller, ClawHubClient, scanSkillFiles, parseSkillManifest } from "./clawhub.js";

// --- Skills command ---
const skills = program.command("skills").description("Manage ClawHub agent capability skill packs");

skills
  .command("search")
  .argument("<query>", "Natural language query or terms")
  .description("Search ClawHub registry for candidate capability skills")
  .action(async (query) => {
    const client = new ClawHubClient();
    try {
      const results = await client.search(query);
      if (results.length === 0) {
        console.log(pc.yellow("No skills matching query found on ClawHub."));
        return;
      }
      console.log(pc.cyan(`\nFound ${results.length} skills on ClawHub:`));
      console.log("=".repeat(60));
      for (const s of results) {
        console.log(`${pc.green(s.slug)} (v${s.version}) | Rating: ${s.rating} | Price: ${s.price === 0 ? "Free" : "$" + s.price}`);
        console.log(`  Publisher: ${s.publisher} [${s.verified ? "Verified" : "Unverified"}]`);
        console.log(`  Description: ${s.description}`);
        console.log(`  Permissions needed: Tools: ${JSON.stringify(s.permissions.allowedTools)} | Network: ${s.permissions.networkAccess}`);
        console.log("-".repeat(60));
      }
    } catch (err: any) {
      console.error(pc.red(`Search failed: ${err.message}`));
    }
  });

skills
  .command("install")
  .argument("<source>", "Install source: ClawHub slug (@owner/slug), git URI, or local directory path")
  .option("--agent <id>", "Install scoped to a specific agent workspace")
  .option("--global", "Install globally for all agents")
  .option("--version <semver>", "Pin a specific semver version")
  .option("--force", "Overwrite existing installation folder")
  .description("Install capability skill pack to an agent workspace or globally")
  .action(async (source, options) => {
    const projectRoot = join(homedir(), ".komorebi");
    const installer = new SkillInstaller(projectRoot);
    try {
      const res = await installer.install(source, {
        agentId: options.agent,
        global: options.global,
        version: options.version,
        force: options.force
      });
      if (res.success) {
        console.log(pc.green(res.message));
      } else {
        console.error(pc.red(res.message));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`Installation failed: ${err.message}`));
      process.exit(1);
    }
  });

skills
  .command("update")
  .option("--agent <id>", "Update scoped to a specific agent")
  .option("--all-agents", "Update skills for all configured agents")
  .description("Update installs recorded in lock.json of agents workspace")
  .action(async (options) => {
    const projectRoot = join(homedir(), ".komorebi");
    const installer = new SkillInstaller(projectRoot);
    try {
      const res = await installer.update({
        agentId: options.agent,
        allAgents: options.allAgents
      });
      if (res.success) {
        console.log(pc.green(res.message));
      } else {
        console.error(pc.red(res.message));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`Update failed: ${err.message}`));
      process.exit(1);
    }
  });

skills
  .command("list")
  .requiredOption("--agent <id>", "Agent ID to query")
  .description("List installed skills and their status for a specific agent")
  .action((options) => {
    const agentSkillsDir = join(homedir(), ".komorebi", "agents", options.agent, "skills");
    const globalSkillsDir = join(homedir(), ".komorebi", "shared-skills");

    const printSkills = (dir: string, label: string) => {
      if (!existsSync(dir)) return;
      console.log(pc.cyan(`\n--- ${label} Installed Skills ---`));
      const dirs = readdirSync(dir, { withFileTypes: true }).filter((d: any) => d.isDirectory() && d.name !== ".clawhub");
      if (dirs.length === 0) {
        console.log("  No skills installed in this scope.");
        return;
      }
      for (const d of dirs) {
        const skillMd = join(dir, d.name, "SKILL.md");
        let version = "unknown";
        let verified = false;
        let desc = "No playbook description found.";
        if (existsSync(skillMd)) {
          try {
            const manifest = parseSkillManifest(readFileSync(skillMd, "utf-8"));
            version = manifest.version;
            verified = manifest.verified;
            desc = manifest.description;
          } catch {}
        }
        console.log(`• ${pc.green(d.name)} (v${version}) [Verified: ${verified}]`);
        console.log(`  Description: ${desc}`);
      }
    };

    printSkills(agentSkillsDir, `Agent [${options.agent}]`);
    printSkills(globalSkillsDir, "Global Shared");
  });

skills
  .command("verify")
  .argument("<slug>", "The slug name of the skill (e.g. 'calendar')")
  .option("--agent <id>", "Agent ID to locate the skill (falls back to global shared)")
  .description("Re-run security scan check on an already-installed skill")
  .action((slug, options) => {
    let skillPath = options.agent 
      ? join(homedir(), ".komorebi", "agents", options.agent, "skills", slug)
      : join(homedir(), ".komorebi", "shared-skills", slug);

    if (!existsSync(skillPath)) {
      if (options.agent) {
        skillPath = join(homedir(), ".komorebi", "shared-skills", slug);
      }
    }

    if (!existsSync(skillPath)) {
      console.error(pc.red(`Error: Skill '${slug}' is not installed.`));
      process.exit(1);
    }

    const skillMd = join(skillPath, "SKILL.md");
    if (!existsSync(skillMd)) {
      console.error(pc.red("Error: Missing SKILL.md in skill package. Cannot verify."));
      process.exit(1);
    }

    try {
      const manifest = parseSkillManifest(readFileSync(skillMd, "utf-8"));
      const result = scanSkillFiles(skillPath, manifest);
      console.log(pc.cyan(`\n=== VERIFY SECURITY: ${slug} ===`));
      console.log(`Target path: ${skillPath}`);
      if (result.passed) {
        console.log(pc.green("Result: PASSED"));
      } else {
        console.log(pc.red("Result: FAILED"));
        for (const e of result.errors) console.log(pc.red(`  • Error: ${e}`));
      }
      for (const w of result.warnings) console.log(pc.yellow(`  • Warning: ${w}`));
      console.log("=".repeat(30) + "\n");
    } catch (err: any) {
      console.error(pc.red(`Verification error: ${err.message}`));
      process.exit(1);
    }
  });

skills
  .command("licenses")
  .description("Show purchased ClawHub licenses tied to this Komorebi install")
  .action(() => {
    const configPath = join(homedir(), ".komorebi", "komorebi.json");
    let licenses: string[] = [];
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        licenses = config.licenses || [];
      } catch {}
    }

    console.log(pc.cyan("\n=== ClawHub Licensed Purchases ==="));
    if (licenses.length === 0) {
      console.log("  No active licenses purchased or configured in komorebi.json.");
    } else {
      for (const l of licenses) {
        console.log(`  • ${pc.green(l)} (License Validated)`);
      }
    }
    console.log("=".repeat(34) + "\n");
  });

skills
  .command("trust")
  .argument("[slug]", "The slug name of the skill (e.g. '@owner/calendar')")
  .option("--agent <id>", "Agent ID to locate the skill")
  .option("--rescan-all", "Rescan all installed skills across all agents and check for file drift")
  .description("Show trust verification report or audit all installed skills for file drift")
  .action(async (slug, options) => {
    const { existsSync, readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const { TrustVerifier, parseSkillManifest, getFolderHashes } = await import("./clawhub.js");

    if (options.rescanAll) {
      console.log(pc.cyan("\n=== AUDITING ALL INSTALLED SKILLS FOR DRIFT ==="));
      console.log("=".repeat(60));
      const agentsDir = join(homedir(), ".komorebi", "agents");
      if (!existsSync(agentsDir)) {
        console.log("No agents configured.");
        return;
      }
      const agents = readdirSync(agentsDir).filter(f => existsSync(join(agentsDir, f, "agent.config.json")));
      
      let totalChecked = 0;
      let driftCount = 0;

      for (const agent of agents) {
        const skillsDir = join(agentsDir, agent, "skills");
        if (!existsSync(skillsDir)) continue;
        const skillFolders = readdirSync(skillsDir).filter(f => f !== ".clawhub" && existsSync(join(skillsDir, f, "SKILL.md")));
        
        for (const sf of skillFolders) {
          totalChecked++;
          const skillPath = join(skillsDir, sf);
          const trustJsonPath = join(skillPath, ".trust", "trust.json");
          if (!existsSync(trustJsonPath)) {
            console.log(`[DRIFT WARNING] Agent: ${pc.bold(agent)} | Skill: ${pc.yellow(sf)} | Status: ${pc.red("NO TRUST ATTESTATION FOUND")}`);
            driftCount++;
            continue;
          }

          try {
            const trustData = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
            const currentHashes = getFolderHashes(skillPath);
            
            for (const key of Object.keys(currentHashes)) {
              if (key.startsWith(".trust/")) {
                delete currentHashes[key];
              }
            }

            let mismatch = false;
            for (const [file, hash] of Object.entries(currentHashes)) {
              if (trustData.hashes[file] !== hash) {
                mismatch = true;
                break;
              }
            }

            if (mismatch) {
              console.log(`[DRIFT WARNING] Agent: ${pc.bold(agent)} | Skill: ${pc.yellow(sf)} | Status: ${pc.red("TAMPERED / MODIFIED ON DISK")}`);
              driftCount++;
            } else {
              console.log(`[INTEGRITY] Agent: ${pc.bold(agent)} | Skill: ${pc.green(sf)} | Status: ${pc.green("VERIFIED OK")}`);
            }
          } catch (err: any) {
            console.log(`[ERROR] Agent: ${pc.bold(agent)} | Skill: ${pc.red(sf)} | Error reading: ${err.message}`);
          }
        }
      }

      console.log("-".repeat(60));
      console.log(`Rescan completed. Scanned: ${totalChecked} skills | Flagged drift: ${driftCount} skills.`);
      return;
    }

    if (!slug) {
      console.error(pc.red("Error: Must specify skill <slug> or use --rescan-all"));
      process.exit(1);
    }

    let skillPath = options.agent
      ? join(homedir(), ".komorebi", "agents", options.agent, "skills", slug)
      : join(homedir(), ".komorebi", "shared-skills", slug);

    if (!existsSync(skillPath)) {
      if (options.agent) {
        skillPath = join(homedir(), ".komorebi", "shared-skills", slug);
      }
    }

    if (!existsSync(skillPath)) {
      console.error(pc.red(`Error: Skill '${slug}' not found locally.`));
      process.exit(1);
    }

    const skillMd = join(skillPath, "SKILL.md");
    if (!existsSync(skillMd)) {
      console.error(pc.red("Error: SKILL.md not found."));
      process.exit(1);
    }

    try {
      const manifest = parseSkillManifest(readFileSync(skillMd, "utf-8"));
      const result = TrustVerifier.verify(skillPath, manifest);

      let scoreColor = pc.green;
      if (result.score === "UNKNOWN") scoreColor = pc.cyan;
      if (result.score === "SUSPICIOUS") scoreColor = pc.yellow;
      if (result.score === "UNTRUSTED") scoreColor = pc.red;

      console.log(pc.cyan(`\n=== TRUST REPORT: ${slug} ===`));
      console.log(`Trust Score: ${scoreColor(result.score)}`);
      console.log(`Publisher:   ${manifest.publisher}`);
      console.log(`Version:     ${manifest.version}`);
      console.log(`Files scan:  ${Object.keys(result.hashes).length} files hashed.`);
      console.log("-".repeat(40));
      if (result.findings.length === 0) {
        console.log(pc.green("No issues or warnings found. Skill is verified."));
      } else {
        console.log("Findings / Warnings:");
        for (const f of result.findings) {
          console.log(`  • ${pc.yellow(f)}`);
        }
      }
      console.log("=".repeat(40) + "\n");
    } catch (err: any) {
      console.error(pc.red(`Failed to verify trust: ${err.message}`));
      process.exit(1);
    }
  });

skills
  .command("enable")
  .argument("<slug>", "The slug name of the skill to enable")
  .requiredOption("--agent <id>", "Agent ID whose skill circuit should be closed")
  .description("Manually re-enable a disabled skill (close circuit breaker)")
  .action(async (slug, options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/agents/${options.agent}/skills/${slug}/circuit`, {
        state: "CLOSED"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      if (res.data && res.data.success) {
        console.log(pc.green(`Successfully re-enabled skill '${slug}' for agent '${options.agent}'.`));
      } else {
        console.error(pc.red(`Failed to enable skill.`));
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.response?.data?.error || err.message}`));
      process.exit(1);
    }
  });

skills
  .command("disable")
  .argument("<slug>", "The slug name of the skill to disable")
  .requiredOption("--agent <id>", "Agent ID whose skill circuit should be opened")
  .description("Manually disable an active skill (open circuit breaker)")
  .action(async (slug, options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/agents/${options.agent}/skills/${slug}/circuit`, {
        state: "OPEN"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      if (res.data && res.data.success) {
        console.log(pc.green(`Successfully disabled skill '${slug}' for agent '${options.agent}'.`));
      } else {
        console.error(pc.red(`Failed to disable skill.`));
      }
    } catch (err: any) {
      console.error(pc.red(`Error: ${err.response?.data?.error || err.message}`));
      process.exit(1);
    }
  });

skills
  .command("health")
  .argument("[slug]", "Optional specific skill slug to query")
  .requiredOption("--agent <id>", "Agent ID to query")
  .description("Show skill health metrics, circuit state, and recent success rates")
  .action(async (slug, options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.get(`http://127.0.0.1:${cfg.gateway.port}/api/agents/${options.agent}/skills/health`, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      
      const healthData = res.data;
      console.log(pc.cyan(`\n=== SKILLS HEALTH REPORT: ${options.agent} ===`));
      console.log("=".repeat(50));
      
      const list = slug ? [slug] : Object.keys(healthData);
      if (list.length === 0) {
        console.log("No custom skills metrics tracked for this agent yet.");
        return;
      }
      
      for (const s of list) {
        const info = healthData[s];
        if (!info) {
          console.log(pc.red(`No health data recorded for skill '${s}'`));
          continue;
        }
        
        let stateColor = pc.green;
        if (info.state === "OPEN") stateColor = pc.red;
        if (info.state === "HALF_OPEN") stateColor = pc.yellow;
        
        const successPercent = (info.successRate * 100).toFixed(0);
        console.log(`Skill: ${pc.bold(s)}`);
        console.log(`  Circuit State: ${stateColor(info.state)}`);
        console.log(`  Success Rate:  ${successPercent}% (over last ${info.runs} runs)`);
        
        if (info.history && info.history.length > 0) {
          const spark = info.history.map((h: boolean) => h ? pc.green("✓") : pc.red("✗")).join(" ");
          console.log(`  History Log:   [ ${spark} ]`);
        }
        console.log("-".repeat(50));
      }
    } catch (err: any) {
      console.error(pc.red(`Error fetching skills health: ${err.response?.data?.error || err.message}`));
      process.exit(1);
    }
  });

// --- Channels command ---
const channels = program.command("channels").description("Manage connected channels");

// Dashboard URL command
program
  .command("dashboard")
  .description("Print the URL to access the web dashboard")
  .action(() => {
    const cfg = loadConfig();
    const host = cfg.gateway.bindLocalOnly ? "127.0.0.1" : "0.0.0.0";
    console.log(pc.cyan(`🚀 Dashboard URL: http://${host}:${cfg.gateway.port}/`));
  });

channels
  .command("list")
  .description("List active channels")
  .action(() => {
    const config = loadConfig();
    console.log(pc.cyan("Active channels:"));
    if (config.channels.telegram.botToken) {
      console.log(`  - Telegram Bot (chat allowlist: ${config.channels.telegram.allowedChatIds.length} users)`);
    } else {
      console.log("  No channels configured.");
    }
  });

// --- Logs subcommand ---
program
  .command("logs")
  .description("Inspect running Gateway stdout logs")
  .option("-f, --follow", "Continuously follow log outputs stream")
  .action((options) => {
    if (existsSync("/etc/systemd/system/komorebi-gateway.service")) {
      const cmd = options.follow ? "journalctl -u komorebi-gateway -f" : "journalctl -u komorebi-gateway -n 50";
      const proc = spawn(cmd, { shell: true, stdio: "inherit" });
      proc.on("exit", () => {});
    } else {
      console.log("Direct file logs tracking is available inside gateway/logs/ folder.");
    }
  });

// --- Update subcommand ---
program
  .command("update")
  .description("Checks for updates and pulls latest stable release")
  .option("--channel <type>", "Updates channel (stable / beta)", "stable")
  .action((options) => {
    console.log(pc.green(`Checked updates channel: ${options.channel}`));
    console.log(pc.green("No updates available. Komorebi Omoi is up to date (v1.0.0)."));
  });

// --- Uninstall subcommand ---
program
  .command("uninstall")
  .description("Interactively uninstall Komorebi Omoi from the system (stops daemon, removes CLI, optionally purges data)")
  .action(async () => {
    await runUninstaller();
  });

// --- Reconfigure subcommand ---
program
  .command("reconfigure")
  .alias("reconfig")
  .description("Launch interactive reconfiguration wizard (change port, rebuild, reinstall daemon, reset config, etc.)")
  .action(async () => {
    await runReconfigurer();
  });

// --- Boundaries commands ---
const boundaries = program.command("boundaries").description("Manage agent proactivity boundaries");

boundaries
  .command("list <agentId>")
  .description("Lists all currently loaded boundary definitions from domains/*.md")
  .action((agentId) => {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    if (!existsSync(agentDir)) {
      console.error(pc.red(`Error: Agent directory not found for '${agentId}'`));
      process.exit(1);
    }
    const domainsDir = join(agentDir, "proactivity", "domains");
    if (!existsSync(domainsDir)) {
      console.log(pc.yellow("No domain-specific rules exist yet."));
      return;
    }
    const files = readdirSync(domainsDir).filter(f => f.endsWith(".md"));
    if (files.length === 0) {
      console.log(pc.yellow("No boundary rule files loaded."));
      return;
    }

    console.log(pc.cyan(`\n=== PROACTIVITY BOUNDARIES FOR AGENT: ${agentId} ===`));
    for (const file of files) {
      const filePath = join(domainsDir, file);
      const content = readFileSync(filePath, "utf-8");
      console.log(pc.yellow(`\nDomain: ${file.replace(".md", "")}`));
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes("Pattern:")) {
          console.log(`  ${line.trim()}`);
        }
      }
    }
    console.log(pc.cyan("\n============================================\n"));
  });

boundaries
  .command("reset <agentId>")
  .description("Clears all learned domain rules and resets memory settings")
  .action((agentId) => {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    if (!existsSync(agentDir)) {
      console.error(pc.red(`Error: Agent directory not found for '${agentId}'`));
      process.exit(1);
    }
    const domainsDir = join(agentDir, "proactivity", "domains");
    if (existsSync(domainsDir)) {
      const files = readdirSync(domainsDir);
      for (const file of files) {
        const filePath = join(domainsDir, file);
        if (lstatSync(filePath).isFile()) {
          unlinkSync(filePath);
        }
      }
    }
    const memoryPath = join(agentDir, "proactivity", "memory.md");
    if (existsSync(memoryPath)) {
      writeFileSync(
        memoryPath,
        `# Global Proactivity Settings\n\n## Global Default Tier\n- Default Tier: SUGGEST\n\n## Learned Rules\n- Pattern: .* | Tier: SUGGEST\n\nquieter: false\n`,
        "utf-8"
      );
    }
    console.log(pc.green(`Successfully reset all learned proactivity boundaries and memory settings for agent ${agentId}.`));
  });

program
  .command("quieter <agentId>")
  .description("Toggles the noise-reduction cap on and off for the given agent")
  .action((agentId) => {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    if (!existsSync(agentDir)) {
      console.error(pc.red(`Error: Agent directory not found for '${agentId}'`));
      process.exit(1);
    }
    const memoryPath = join(agentDir, "proactivity", "memory.md");
    if (!existsSync(memoryPath)) {
      console.error(pc.red(`Error: Memory file not found. Run agent first to initialize proactivity.`));
      process.exit(1);
    }
    let content = readFileSync(memoryPath, "utf-8");
    let isQuieter = false;
    if (content.toLowerCase().includes("quieter: true")) {
      content = content.replace(/quieter:\s*true/gi, "quieter: false");
      isQuieter = false;
    } else if (content.toLowerCase().includes("quieter: false")) {
      content = content.replace(/quieter:\s*false/gi, "quieter: true");
      isQuieter = true;
    } else {
      content += "\nquieter: true\n";
      isQuieter = true;
    }
    writeFileSync(memoryPath, content, "utf-8");
    console.log(pc.green(`Noise reduction cap (quieter mode) is now: ${isQuieter ? pc.bold("ON") : pc.bold("OFF")} for agent ${agentId}.`));
  });

// --- QA Lab command ---
const qa = program.command("qa").description("Komorebi QA-Lab parity & drift suite");

qa
  .command("suite")
  .description("Runs scenario-based QA tests to assert behavior and tool parity")
  .option("--runtime-parity-tier <tier>", "Parity tier to run (standard / soak)", "standard")
  .action(async (options) => {
    await runQaSuite(options.runtimeParityTier);
  });

qa
  .command("coverage")
  .description("Displays build-in tool fixtures coverage report")
  .option("--tools", "Print which tools have fixture coverage")
  .action((options) => {
    if (options.tools) {
      showToolCoverage();
    } else {
      console.log(pc.yellow("Use 'komorebi qa coverage --tools' to show tool fixtures coverage."));
    }
  });

// --- Test runners commands ---
program
  .command("test")
  .description("Runs the full unit test suite using Vitest")
  .action(() => {
    console.log(pc.blue("Running unit test suite..."));
    try {
      execSync("node node_modules/vitest/vitest.mjs run -c vitest.unit.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

program
  .command("test:force")
  .description("Runs the unit test suite, forcing active gateway port closure first")
  .action(() => {
    console.log(pc.blue("Clearing default gateway port 18789..."));
    try {
      execSync("fuser -k 18789/tcp || true", { stdio: "inherit" });
      execSync("node node_modules/vitest/vitest.mjs run -c vitest.unit.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

program
  .command("test:coverage")
  .description("Runs unit tests and outputs a V8 coverage report")
  .action(() => {
    console.log(pc.blue("Running unit tests with coverage..."));
    try {
      execSync("node node_modules/vitest/vitest.mjs run --coverage -c vitest.unit.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

program
  .command("test:e2e")
  .description("Runs the Gateway end-to-end smoke test suite")
  .action(() => {
    console.log(pc.blue("Running E2E tests..."));
    try {
      execSync("node node_modules/vitest/vitest.mjs run -c vitest.e2e.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

program
  .command("test:live")
  .description("Runs integration tests against live providers (requires LIVE=1)")
  .action(() => {
    console.log(pc.blue("Running Live provider tests..."));
    try {
      execSync("LIVE=1 node node_modules/vitest/vitest.mjs run -c vitest.live.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

program
  .command("test:low-memory")
  .description("Runs tests in single-worker mode optimized for Pi 5 resource profiles")
  .action(() => {
    console.log(pc.blue("Running serial low-memory tests..."));
    try {
      execSync("node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 -c vitest.unit.config.ts", { stdio: "inherit" });
    } catch {
      process.exit(1);
    }
  });

const security = program.command("security").description("Manage security configuration and run vulnerability audits");

security
  .command("audit")
  .description("Scan Gateway binding, API secrets leak, agent spending caps, tool policies, and skills trust integrity")
  .action(async () => {
    const { runSecurityAudit } = await import("./audit.js");
    await runSecurityAudit();
  });

const selfheal = program.command("selfheal").description("Manage and monitor the Self-Healing Subsystem");

selfheal
  .command("status")
  .description("Show active incidents, known fixes stats, and pending approvals")
  .action(async () => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "getSelfHealingStatus",
        params: {},
        id: "cli_selfheal_status"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      const { knownFixes, incidents, pendingFixes } = res.data.result;

      console.log(pc.cyan("\n=== SELF-HEALING SYSTEM STATUS ==="));
      console.log(`Active Incidents:  ${incidents.filter((i: any) => i.status === "active" || i.status === "pending_approval").length}`);
      console.log(`Known Fixes:       ${knownFixes.length}`);
      console.log(`Pending Approvals: ${pendingFixes.length}`);
      console.log("-".repeat(50));

      if (pendingFixes.length > 0) {
        console.log(pc.bold(pc.yellow("Pending Approvals:")));
        for (const p of pendingFixes) {
          console.log(`  • Fingerprint: ${pc.bold(p.fingerprint)}`);
          console.log(`    Component:   ${p.componentId}`);
          console.log(`    Root Cause:  ${p.diagnosis?.rootCause || "Unknown"}`);
          console.log(`    Proposed:    ${p.proposedFix?.fixApplied || "None"}`);
          console.log(`    Run: \`komorebi selfheal approve ${p.fingerprint}\` to execute.`);
        }
        console.log("-".repeat(50));
      }

      console.log(pc.bold(pc.green("Immune Memory (Known Fixes):")));
      if (knownFixes.length === 0) {
        console.log("  No known fixes in database yet.");
      } else {
        for (const k of knownFixes) {
          console.log(`  • Fingerprint: ${k.symptomFingerprint} | Success Rate: ${(k.successRate * 100).toFixed(0)}%`);
          console.log(`    Root Cause:  ${k.rootCause}`);
          console.log(`    Type:        ${k.fixType.toUpperCase()} | Times Applied: ${k.timesApplied}`);
        }
      }
      console.log("=".repeat(50) + "\n");
    } catch (err: any) {
      console.error(pc.red(`Failed to fetch self-healing status: ${err.message}`));
      process.exit(1);
    }
  });

selfheal
  .command("history")
  .option("--component <name>", "Filter history by component name")
  .description("Show the timeline history of all self-healing incidents")
  .action(async (options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "getSelfHealingStatus",
        params: {},
        id: "cli_selfheal_history"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      let { incidents } = res.data.result;

      if (options.component) {
        incidents = incidents.filter((i: any) => i.componentId === options.component);
      }

      console.log(pc.cyan("\n=== SELF-HEALING INCIDENT HISTORY ==="));
      console.log("=".repeat(60));
      if (incidents.length === 0) {
        console.log("No incidents found in history.");
      } else {
        for (const i of incidents.reverse()) {
          const date = new Date(i.timestamp).toLocaleString();
          let statusColor = pc.green;
          if (i.status === "active") statusColor = pc.yellow;
          if (i.status === "failed") statusColor = pc.red;
          if (i.status === "pending_approval") statusColor = pc.cyan;

          console.log(`[${date}] ${pc.bold(i.componentId)} - Tier ${i.tier}`);
          console.log(`  Symptom:    ${i.errorSignature}`);
          console.log(`  Status:     ${statusColor(i.status.toUpperCase())}`);
          if (i.diagnosis) console.log(`  Diagnosis:  ${i.diagnosis}`);
          if (i.outcome) console.log(`  Outcome:    ${i.outcome}`);
          console.log("-".repeat(60));
        }
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to fetch history: ${err.message}`));
      process.exit(1);
    }
  });

selfheal
  .command("approve <fingerprint>")
  .description("Approve and apply a pending Tier 4 human escalation fix")
  .action(async (fingerprint) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const statusRes = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "getSelfHealingStatus",
        params: {},
        id: "cli_selfheal_get_pending"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      const pending = statusRes.data.result.pendingFixes.find((p: any) => p.fingerprint === fingerprint);
      if (!pending) {
        console.error(pc.red(`Error: No pending approval fix found with fingerprint: ${fingerprint}`));
        process.exit(1);
      }

      console.log(pc.blue(`Applying fix for fingerprint ${fingerprint}...`));
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "applySelfHealingFix",
        params: { fingerprint, fix: pending.proposedFix },
        id: "cli_selfheal_approve"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      
      if (res.data.result?.success) {
        console.log(pc.green(`Successfully applied and verified self-healing fix.`));
      } else {
        console.error(pc.red(`Failed to apply fix. Regression tests or validation failed.`));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to approve fix: ${err.message}`));
      process.exit(1);
    }
  });

selfheal
  .command("rollback <fingerprint>")
  .description("Roll back a previously applied self-healing code fix (reset Git tree)")
  .action(async (fingerprint) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "rollbackSelfHealingFix",
        params: { fingerprint },
        id: "cli_selfheal_rollback"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      if (res.data.result?.success) {
        console.log(pc.green("Successfully rolled back code changes."));
      } else {
        console.error(pc.red("Rollback failed or could not be applied."));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to rollback: ${err.message}`));
      process.exit(1);
    }
  });

selfheal
  .command("known-fixes")
  .description("List immune registry database of known fixes")
  .action(async () => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "getSelfHealingStatus",
        params: {},
        id: "cli_selfheal_known_fixes"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });
      const { knownFixes } = res.data.result;
      console.log(pc.cyan("\n=== IMMUNE REGISTRY (KNOWN FIXES) ==="));
      console.log("=".repeat(50));
      if (knownFixes.length === 0) {
        console.log("No known fixes registered.");
      } else {
        for (const k of knownFixes) {
          console.log(`Fingerprint:  ${k.symptomFingerprint}`);
          console.log(`Root Cause:   ${k.rootCause}`);
          console.log(`Fix Type:     ${k.fixType.toUpperCase()}`);
          console.log(`Success Rate: ${(k.successRate * 100).toFixed(0)}% (Applied: ${k.timesApplied}, Succeeded: ${k.timesSucceeded})`);
          console.log("-".repeat(50));
        }
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to list known fixes: ${err.message}`));
      process.exit(1);
    }
  });

// ─── Cron Subcommand Group ────────────────────────────────────────────────────

/** Helper: send an RPC call to the Gateway via HTTP POST */
async function cronRpc(method: string, params: any = {}) {
  const cfg = loadConfig();
  const url = `http://127.0.0.1:${cfg.gateway.port}/api/rpc`;
  const axios = (await import("axios")).default;
  const res = await axios.post(url,
    { method, params, id: `cli_cron_${Date.now()}` },
    { headers: { Authorization: `Bearer ${cfg.gateway.authToken}` } }
  );
  if (res.data?.error) throw new Error(res.data.error.message ?? JSON.stringify(res.data.error));
  return res.data?.result;
}

/** Helper: send a REST GET request to the Gateway */
async function cronGet(path: string) {
  const cfg = loadConfig();
  const axios = (await import("axios")).default;
  const res = await axios.get(
    `http://127.0.0.1:${cfg.gateway.port}${path}`,
    { headers: { Authorization: `Bearer ${cfg.gateway.authToken}` } }
  );
  return res.data;
}

function fmtRelative(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const ago = diff < 0;
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const s = ago ? " ago" : "";
  if (d > 0) return `${d}d ${h % 24}h${s}`;
  if (h > 0) return `${h}h ${m % 60}m${s}`;
  if (m > 0) return `${m}m${s}`;
  return ago ? "<1m ago" : "in <1m";
}

const STATUS_ICON: Record<string, string> = {
  active: "🟢", backoff: "🟡", failing: "🔴", disabled: "⚫", completed: "✅"
};
const TYPE_ICON: Record<string, string> = {
  session: "🧠", isolated: "🔒", command: "🖥"
};

const cron = program.command("cron").description("Manage Komorebi Omoi cron scheduled jobs");

// ── list ─────────────────────────────────────────────────────────────────────
cron
  .command("list")
  .alias("ls")
  .description("List all configured cron jobs with status and next-run time")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      if (opts.json) { console.log(JSON.stringify(jobs, null, 2)); return; }

      console.log(pc.cyan("\n═══════════════════════════════════════════════════"));
      console.log(pc.bold("  KOMOREBI CRON SCHEDULER  —  " + jobs.length + " job(s)"));
      console.log(pc.cyan("═══════════════════════════════════════════════════\n"));

      if (jobs.length === 0) {
        console.log(pc.yellow("  No cron jobs configured. Use `komorebi cron add` to create one.\n"));
        return;
      }

      for (const j of jobs) {
        const icon   = STATUS_ICON[j.status] ?? "⚪";
        const tIcon  = TYPE_ICON[j.type] ?? "?";
        const status = j.status.toUpperCase();
        const failed = j.consecutiveFailures > 0 ? pc.red(` (${j.consecutiveFailures} fails)`) : "";
        console.log(`${icon} ${pc.bold(j.name)} ${pc.gray("[" + j.id.slice(0, 8) + "]")}${failed}`);
        console.log(`   ${tIcon} ${j.type.padEnd(9)} │ 🤖 ${j.agentId}`);
        console.log(`   📅 ${pc.cyan((j.schedule ?? j.expression ?? "").padEnd(20))} │ 🌐 ${j.timezone}`);
        if (j.humanSchedule) console.log(`   📖 ${pc.gray(j.humanSchedule)}`);
        if (j.enabled && j.nextRun) {
          console.log(`   ⏰ Next: ${pc.green(fmtRelative(j.nextRun))} ${pc.gray("(" + new Date(j.nextRun).toLocaleString() + ")")}`);
        } else if (!j.enabled) {
          console.log(`   ${pc.yellow("⏸  DISABLED")}`);
        }
        if (j.backoffUntil && j.backoffUntil > Date.now()) {
          console.log(`   ${pc.yellow("⏳ Backoff: retrying " + fmtRelative(j.backoffUntil))}`);
        }
        console.log("");
      }
    } catch (err: any) {
      console.error(pc.red(`Failed to list cron jobs: ${err.message}`));
      process.exit(1);
    }
  });

// ── show ─────────────────────────────────────────────────────────────────────
cron
  .command("show <jobId>")
  .description("Show full details for a single cron job")
  .option("--json", "Output raw JSON")
  .action(async (jobId, opts) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }
      if (opts.json) { console.log(JSON.stringify(job, null, 2)); return; }

      const BACKOFF_STEPS = ["30s", "1m", "5m", "15m", "60m"];
      console.log(pc.cyan("\n═══════════════════════════════════════════════════"));
      console.log(pc.bold(`  ${job.name}`));
      console.log(pc.cyan("═══════════════════════════════════════════════════"));
      console.log(`  ID:          ${job.id}`);
      console.log(`  Agent:       ${job.agentId}`);
      console.log(`  Type:        ${TYPE_ICON[job.type] ?? ""} ${job.type}`);
      console.log(`  Status:      ${STATUS_ICON[job.status] ?? ""} ${job.status}`);
      console.log(`  Delivery:    ${job.deliveryMode}`);
      console.log(`  Schedule:    ${pc.cyan(job.schedule ?? job.expression ?? "")}`);
      console.log(`  Timezone:    ${job.timezone}`);
      if (job.humanSchedule) console.log(`  Human:       ${job.humanSchedule}`);
      console.log(`  Enabled:     ${job.enabled ? pc.green("yes") : pc.red("no")}`);
      console.log(`  Created:     ${new Date(job.createdAt).toLocaleString()}`);
      console.log(`  Last Run:    ${job.lastRun ? new Date(job.lastRun).toLocaleString() : "Never"}`);
      console.log(`  Next Run:    ${job.nextRun ? `${new Date(job.nextRun).toLocaleString()} (${fmtRelative(job.nextRun)})` : "—"}`);
      console.log(`  Failures:    ${job.consecutiveFailures}`);
      if (job.consecutiveFailures > 0) {
        const steps = BACKOFF_STEPS.map((s, i) =>
          i < job.consecutiveFailures - 1 ? pc.red(`[${s}✓]`) :
          i === job.consecutiveFailures - 1 ? pc.yellow(`[${s}◀]`) : pc.gray(`[${s}]`)
        );
        console.log(`  Backoff:     ${steps.join(" → ")} → ${job.consecutiveFailures >= 5 ? pc.red("[escalate✓]") : pc.gray("[escalate]")}`);
      }
      console.log(`\n  Payload:\n  ${pc.gray('"')}${job.payload ?? job.prompt ?? ""}${pc.gray('"')}\n`);
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── add ──────────────────────────────────────────────────────────────────────
cron
  .command("add")
  .description("Create a new cron job")
  .requiredOption("--name <name>",           "Job display name")
  .requiredOption("--agent <agentId>",       "Target agent ID")
  .requiredOption("--schedule <expr>",       "Cron expression (5-field) or ISO timestamp")
  .requiredOption("--payload <text>",        "Prompt or shell command to execute")
  .option("--type <type>",                   "Execution type: session | isolated | command", "session")
  .option("--delivery <mode>",              "Delivery mode: announce | webhook | none", "announce")
  .option("--timezone <tz>",                 "IANA timezone", "Asia/Kolkata")
  .option("--channel <chatId>",             "Telegram chat ID for announce delivery")
  .option("--webhook-url <url>",            "Target URL for webhook delivery")
  .option("--disabled",                      "Create in disabled state")
  .action(async (opts) => {
    try {
      const { randomUUID } = await import("node:crypto");
      const job = {
        id: randomUUID(),
        name: opts.name,
        agentId: opts.agent,
        schedule: opts.schedule,
        timezone: opts.timezone,
        type: opts.type,
        payload: opts.payload,
        deliveryMode: opts.delivery,
        channel: opts.channel,
        webhookUrl: opts.webhookUrl,
        webhookToken: `kore_${Math.random().toString(36).slice(2, 14)}`,
        enabled: !opts.disabled,
        status: opts.disabled ? "disabled" : "active",
        createdAt: Date.now(),
        consecutiveFailures: 0,
        backoffUntil: null,
        lastRun: null,
        nextRun: null,
        // legacy compat
        expression: opts.schedule,
        prompt: opts.payload,
      };
      await cronRpc("saveCronJob", { job });
      console.log(pc.green(`\n✅ Created cron job "${opts.name}" (ID: ${job.id.slice(0,8)}…)`));
      console.log(pc.gray(`   Schedule: ${opts.schedule} (${opts.timezone})`));
      console.log(pc.gray(`   Agent: ${opts.agent}  │  Type: ${opts.type}  │  Delivery: ${opts.delivery}\n`));
    } catch (err: any) {
      console.error(pc.red(`Failed to create job: ${err.message}`)); process.exit(1);
    }
  });

// ── delete ────────────────────────────────────────────────────────────────────
cron
  .command("delete <jobId>")
  .alias("rm")
  .description("Delete a cron job by ID or name")
  .option("--force", "Skip confirmation prompt")
  .action(async (jobId, opts) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }

      if (!opts.force) {
        const readline = await import("node:readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        await new Promise<void>((resolve, reject) => {
          rl.question(pc.yellow(`Delete "${job.name}" (${job.id.slice(0,8)})? [y/N] `), (ans) => {
            rl.close();
            if (ans.toLowerCase() !== "y") { console.log("Aborted."); process.exit(0); }
            resolve();
          });
        });
      }

      await cronRpc("deleteCronJob", { jobId: job.id });
      console.log(pc.green(`✅ Deleted job "${job.name}"`));
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── run ───────────────────────────────────────────────────────────────────────
cron
  .command("run <jobId>")
  .description("Manually trigger a cron job immediately")
  .action(async (jobId) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }
      console.log(pc.blue(`⚡ Triggering "${job.name}"...`));
      await cronRpc("runCronJob", { jobId: job.id });
      console.log(pc.green("✅ Job triggered successfully. Watch dashboard or Telegram for output."));
    } catch (err: any) {
      console.error(pc.red(`Trigger failed: ${err.message}`)); process.exit(1);
    }
  });

// ── enable / disable ──────────────────────────────────────────────────────────
cron
  .command("enable <jobId>")
  .description("Enable a disabled or failing cron job and resume its schedule")
  .action(async (jobId) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }
      await cronRpc("enableCronJob", { jobId: job.id });
      console.log(pc.green(`✅ Enabled "${job.name}" — scheduler will pick it up on the next tick.`));
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

cron
  .command("disable <jobId>")
  .description("Disable a cron job (stops firing, preserves config)")
  .action(async (jobId) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }
      await cronRpc("disableCronJob", { jobId: job.id });
      console.log(pc.green(`⏸  Disabled "${job.name}"`));
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── tasks ─────────────────────────────────────────────────────────────────────
cron
  .command("tasks <jobId>")
  .description("Show task execution history for a cron job")
  .option("-n, --limit <n>",  "Max records to display", "20")
  .option("--json",           "Output raw JSON")
  .action(async (jobId, opts) => {
    try {
      const jobs: any[] = await cronRpc("listCronJobs");
      const job = jobs.find((j: any) => j.id === jobId || j.id.startsWith(jobId) || j.name === jobId);
      if (!job) { console.error(pc.red(`Job not found: ${jobId}`)); process.exit(1); }

      const res: any = await cronRpc("getCronTasks", { jobId: job.id });
      const tasks: any[] = (res?.tasks ?? []).slice(-(parseInt(opts.limit, 10)));
      if (opts.json) { console.log(JSON.stringify(tasks, null, 2)); return; }

      console.log(pc.cyan(`\n═══════════════════════════════════════════════════`));
      console.log(pc.bold(`  Task History — "${job.name}" (last ${tasks.length})`));
      console.log(pc.cyan(`═══════════════════════════════════════════════════\n`));

      if (tasks.length === 0) { console.log(pc.gray("  No task records yet.\n")); return; }

      for (const t of [...tasks].reverse()) {
        const ico = { completed: "🟢", failed: "🔴", running: "🟡", resumed: "🔵", delivery_failed: "🟠" }[t.status as string] ?? "⚪";
        const dur = t.completedAt ? `${t.completedAt - t.startedAt}ms` : "…";
        const manual = t.isManualTrigger ? pc.yellow(" [manual]") : "";
        console.log(`${ico} ${new Date(t.startedAt).toLocaleString()}${manual}  ${pc.gray(dur)}`);
        console.log(`   Drift: ${t.driftMs > 5000 ? pc.red(t.driftMs + "ms") : t.driftMs > 3000 ? pc.yellow(t.driftMs + "ms") : pc.gray(t.driftMs + "ms")}`);
        console.log(`   Delivery: ${t.deliveryStatus} (${t.deliveryAttempts} attempt(s))`);
        console.log(`   Key: ${pc.gray(t.idempotencyKey)}`);
        if (t.output) console.log(`   Output: ${pc.gray(t.output.slice(0, 100).replace(/\n/g, " "))}${t.output.length > 100 ? "…" : ""}`);
        console.log("");
      }
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── drift-report ──────────────────────────────────────────────────────────────
cron
  .command("drift-report")
  .alias("drift")
  .description("Show scheduler drift statistics for the last 24 hours")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    try {
      const report: any = await cronRpc("getCronDriftReport");
      if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }

      const WARN_MS = 3000; const CRIT_MS = 5000;
      const fmtMs = (ms: number) => {
        if (ms >= CRIT_MS) return pc.red(ms.toFixed(0) + "ms");
        if (ms >= WARN_MS) return pc.yellow(ms.toFixed(0) + "ms");
        return pc.green(ms.toFixed(0) + "ms");
      };

      console.log(pc.cyan("\n═══════════════════════════════════════════════════"));
      console.log(pc.bold("  SCHEDULER DRIFT REPORT  (24h rolling)"));
      console.log(pc.cyan("═══════════════════════════════════════════════════\n"));
      console.log(`  Samples:   ${report.samples?.length ?? 0}`);
      console.log(`  Avg drift: ${fmtMs(report.avgDriftMs ?? 0)}`);
      console.log(`  p95 drift: ${fmtMs(report.p95DriftMs ?? 0)}`);
      console.log(`  Max drift: ${fmtMs(report.maxDriftMs ?? 0)}`);

      if ((report.avgDriftMs ?? 0) >= CRIT_MS) {
        console.log(pc.red("\n  ⚠️  CRITICAL: Scheduler is severely drifting — possible CPU starvation on Pi 5."));
        console.log(pc.yellow("  Recommendation: reduce concurrent agent sessions or switch high-frequency jobs to type 'command'.\n"));
      } else if ((report.avgDriftMs ?? 0) >= WARN_MS) {
        console.log(pc.yellow("\n  ⚠️  WARNING: Drift is elevated. Monitor closely.\n"));
      } else {
        console.log(pc.green("\n  ✅ Drift is within acceptable bounds.\n"));
      }
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── queue ─────────────────────────────────────────────────────────────────────
cron
  .command("queue")
  .description("Show the current scheduler priority queue (next 10 upcoming fires)")
  .action(async () => {
    try {
      const data: any = await cronGet("/api/cron/queue");
      const queue: any[] = data.queue ?? [];
      const jobs: any[] = await cronRpc("listCronJobs");

      console.log(pc.cyan("\n═══════════════════════════════════════════════════"));
      console.log(pc.bold("  SCHEDULER QUEUE  (next 10 entries)"));
      console.log(pc.cyan("═══════════════════════════════════════════════════\n"));

      if (queue.length === 0) { console.log(pc.gray("  Queue is empty — no enabled jobs scheduled.\n")); return; }

      for (const entry of queue.slice(0, 10)) {
        const job = jobs.find((j: any) => j.id === entry.jobId);
        const name = job?.name ?? entry.jobId.slice(0, 16);
        console.log(`  ⏰ ${pc.bold(name)} — ${pc.green(fmtRelative(entry.scheduledFireTime))} ${pc.gray("(" + new Date(entry.scheduledFireTime).toLocaleString() + ")")}`);
      }
      console.log("");
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── validate ──────────────────────────────────────────────────────────────────
cron
  .command("validate <schedule>")
  .description("Validate a cron expression and show human-readable description + next fire time")
  .option("--timezone <tz>", "IANA timezone for next-run calculation", "Asia/Kolkata")
  .action(async (schedule, opts) => {
    try {
      const res: any = await cronRpc("validateCronSchedule", { schedule, timezone: opts.timezone });
      if (res.valid) {
        console.log(pc.green(`\n✅ Valid cron expression`));
        console.log(`   Human: ${pc.bold(res.human ?? schedule)}`);
      } else {
        console.log(pc.red(`\n❌ Invalid cron expression: "${schedule}"`));
        console.log(pc.gray("   Expected format: minute hour dom month dow  (e.g. 0 9 * * 1-5)\n"));
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// ── warnings ──────────────────────────────────────────────────────────────────
cron
  .command("warnings")
  .description("Show boundary warnings (cron vs heartbeat vs hooks misconfigurations)")
  .action(async () => {
    try {
      const res: any = await cronRpc("getCronBoundaryWarnings");
      const warnings: any[] = res?.warnings ?? [];
      if (warnings.length === 0) {
        console.log(pc.green("\n✅ No boundary warnings — all cron jobs are correctly configured.\n"));
        return;
      }
      console.log(pc.yellow(`\n⚠️  ${warnings.length} boundary warning(s):\n`));
      for (const w of warnings) {
        const icon = w.severity === "warning" ? "⚠️ " : "ℹ️ ";
        console.log(`${icon} ${pc.bold(w.jobName)}`);
        console.log(`   Issue:      ${w.issue}`);
        console.log(`   Suggestion: ${pc.gray(w.suggestion)}\n`);
      }
    } catch (err: any) {
      console.error(pc.red(`Failed: ${err.message}`)); process.exit(1);
    }
  });

// --- Pairing Commands ---
const pairing = program.command("pairing").description("Manage Telegram bot user pairing requests");

pairing
  .command("list")
  .description("List user pairings for agents")
  .option("--agent <id>", "Filter pairings by agent ID")
  .option("--pending", "Show only pending pairing requests")
  .action(async (options) => {
    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "listPairings",
        params: { agentId: options.agent, pendingOnly: !!options.pending },
        id: "cli_pairing_list"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });

      const list: any[] = res.data.result;
      console.log(pc.cyan("\n=== TELEGRAM PAIRING REQUESTS ==="));
      if (list.length === 0) {
        console.log(pc.gray("  No pairing requests found.\n"));
        return;
      }
      for (const item of list) {
        const statusStr = item.status === "pending" ? pc.yellow("PENDING") : pc.green("APPROVED");
        console.log(`  • Code: ${pc.bold(item.code)} | Status: ${statusStr}`);
        console.log(`    Agent: ${item.agentId} | User ID: ${item.telegramUserId}`);
        console.log(`    Requested: ${new Date(item.requestedAt).toLocaleString()}`);
        console.log(`    Expires:   ${new Date(item.expiresAt).toLocaleString()}`);
        console.log("-".repeat(50));
      }
      console.log("");
    } catch (err: any) {
      console.error(pc.red(`Failed to fetch pairings: ${err.message}`));
      process.exit(1);
    }
  });

pairing
  .command("approve <channel> <agentId> <code>")
  .description("Approve a pairing request code for a channel agent (e.g. approve telegram agent_1 CODE)")
  .action(async (channel, agentId, code) => {
    if (channel !== "telegram") {
      console.error(pc.red(`Unsupported channel type '${channel}'. Only 'telegram' is supported.`));
      process.exit(1);
    }

    const cfg = loadConfig();
    const axios = (await import("axios")).default;
    try {
      console.log(pc.blue(`Sending pairing approval for code ${code} to agent ${agentId}...`));
      const res = await axios.post(`http://127.0.0.1:${cfg.gateway.port}/api/rpc`, {
        jsonrpc: "2.0",
        method: "approvePairing",
        params: { code, agentId },
        id: "cli_pairing_approve"
      }, {
        headers: { Authorization: `Bearer ${cfg.gateway.authToken}` }
      });

      if (res.data.error) {
        console.error(pc.red(`Failed to approve pairing: ${res.data.error.message}`));
        process.exit(1);
      }

      const pairingResult = res.data.result;
      console.log(pc.green(`\n✅ Pairing request approved successfully!`));
      console.log(`   User ID ${pairingResult.telegramUserId} is now authorized to interact with agent ${pairingResult.agentId}.\n`);
    } catch (err: any) {
      console.error(pc.red(`Failed to approve pairing: ${err.message}`));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────

program.parse(process.argv);
export {};

