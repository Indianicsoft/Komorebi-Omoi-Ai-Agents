import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadConfig, saveConfig, getConfigPath } from "./config.js";
import { execSync, spawn } from "node:child_process";
import {
  existsSync,
  rmSync,
  writeFileSync,
  readdirSync,
  mkdirSync
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tryExec(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function isSystemdServiceActive(): boolean {
  return tryExec("systemctl is-active komorebi-gateway");
}

function isSystemdServiceInstalled(): boolean {
  return existsSync("/etc/systemd/system/komorebi-gateway.service");
}

// ─── Interactive Uninstaller ──────────────────────────────────────────────────

export async function runUninstaller() {
  console.clear();
  p.intro(pc.red("⚠  Komorebi Omoi — System Uninstaller"));
  console.log(
    pc.yellow(
      "\nThis wizard will walk you through uninstalling Komorebi Omoi from your system.\n" +
        "You choose exactly what to remove — nothing happens without confirmation.\n"
    )
  );

  const proceed = await p.confirm({
    message: "Proceed with the uninstall wizard?",
    initialValue: false
  });
  if (p.isCancel(proceed) || !proceed) {
    p.cancel(pc.cyan("Uninstall cancelled. Your system is unchanged."));
    return;
  }

  // ─── Step 1: Gateway daemon ────────────────────────────────────────────────
  const s1 = p.spinner();

  const stopGateway = await p.confirm({
    message: "Stop and remove the background Gateway daemon service?",
    initialValue: true
  });

  if (!p.isCancel(stopGateway) && stopGateway) {
    s1.start("Stopping Gateway daemon...");

    // systemd
    if (isSystemdServiceActive()) {
      tryExec("sudo systemctl stop komorebi-gateway");
    }
    if (isSystemdServiceInstalled()) {
      tryExec("sudo systemctl disable komorebi-gateway");
      tryExec("sudo rm -f /etc/systemd/system/komorebi-gateway.service");
      tryExec("sudo systemctl daemon-reload");
    }

    // macOS launchd
    const launchd = `${homedir()}/Library/LaunchAgents/ai.komorebi.gateway.plist`;
    if (existsSync(launchd)) {
      tryExec(`launchctl unload "${launchd}"`);
      rmSync(launchd);
    }

    // Kill PID file
    const pidFile = join(homedir(), ".komorebi", "gateway.pid");
    if (existsSync(pidFile)) {
      try {
        const pid = parseInt(
          require("node:fs").readFileSync(pidFile, "utf-8"),
          10
        );
        process.kill(pid, "SIGTERM");
      } catch {}
      try { rmSync(pidFile); } catch {}
    }

    s1.stop(pc.green("Gateway daemon stopped and removed."));
  }

  // ─── Step 2: CLI symlink ───────────────────────────────────────────────────
  const removeCli = await p.confirm({
    message: "Remove the global 'komorebi' CLI from /usr/local/bin?",
    initialValue: true
  });

  if (!p.isCancel(removeCli) && removeCli) {
    const s2 = p.spinner();
    s2.start("Removing CLI symlink...");
    tryExec("sudo rm -f /usr/local/bin/komorebi");
    const cliDir = join(__dirname, "..", "..", "cli");
    if (existsSync(cliDir)) {
      tryExec(`cd "${cliDir}" && npm unlink --global`);
    }
    s2.stop(pc.green("CLI removed from system PATH."));
  }

  // ─── Step 3: User data / config ───────────────────────────────────────────
  const komorebiDir = join(homedir(), ".komorebi");
  let purgeData = false;

  if (existsSync(komorebiDir)) {
    console.log(pc.yellow(`\n  Found user data directory: ${komorebiDir}`));

    const agentsDir = join(komorebiDir, "agents");
    let agentCount = 0;
    if (existsSync(agentsDir)) {
      agentCount = readdirSync(agentsDir, { withFileTypes: true }).filter(d =>
        d.isDirectory()
      ).length;
    }

    console.log(
      pc.dim(
        `  Contains: ${agentCount} agent workspace(s), user config, PID state files\n`
      )
    );

    const dataPurgeChoice = await p.select({
      message: "What to do with ~/.komorebi user data?",
      options: [
        {
          value: "keep",
          label: "Keep all data (preserve agent workspaces & config)"
        },
        {
          value: "purge_config",
          label: "Reset config only (delete komorebi.json, keep agent workspaces)"
        },
        {
          value: "purge_all",
          label: pc.red("Delete everything in ~/.komorebi (cannot be undone)")
        }
      ]
    });

    if (!p.isCancel(dataPurgeChoice)) {
      if (dataPurgeChoice === "purge_all") {
        const confirmPurge = await p.confirm({
          message: pc.red(
            `Permanently delete ${komorebiDir} and ALL agent data?`
          ),
          initialValue: false
        });
        if (!p.isCancel(confirmPurge) && confirmPurge) {
          rmSync(komorebiDir, { recursive: true, force: true });
          purgeData = true;
          p.note(pc.green("~/.komorebi purged."), "Data Deleted");
        }
      } else if (dataPurgeChoice === "purge_config") {
        const cfgPath = getConfigPath();
        if (existsSync(cfgPath)) {
          rmSync(cfgPath);
          p.note(pc.green("komorebi.json reset. Agent workspaces preserved."), "Config Reset");
        }
      } else {
        p.note("Agent data and configuration preserved.", "Data Kept");
      }
    }
  }

  // ─── Step 4: node_modules ─────────────────────────────────────────────────
  const removeModules = await p.confirm({
    message: "Remove all node_modules from the project? (saves ~500MB+)",
    initialValue: false
  });

  if (!p.isCancel(removeModules) && removeModules) {
    const s4 = p.spinner();
    s4.start("Removing node_modules...");
    const projectRoot = join(__dirname, "..", "..");
    for (const subDir of [
      "",
      "gateway",
      "agent-runtime",
      "cli",
      "dashboard"
    ]) {
      const nm = join(projectRoot, subDir, "node_modules");
      if (existsSync(nm)) {
        rmSync(nm, { recursive: true, force: true });
      }
    }
    s4.stop(pc.green("node_modules removed."));
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  p.outro(
    pc.green(
      "Komorebi Omoi has been uninstalled.\n\n" +
        pc.dim(
          "  To reinstall:     bash install.sh\n" +
            "  To reconfigure:   bash install.sh  (then choose reconfigure)"
        )
    )
  );
}

// ─── Interactive Reconfigurer ─────────────────────────────────────────────────

export async function runReconfigurer() {
  console.clear();
  p.intro(pc.cyan("🔧  Komorebi Omoi — Reconfigure Wizard"));

  const action = await p.select({
    message: "What would you like to reconfigure?",
    options: [
      {
        value: "rerun_onboard",
        label: "🚀 Re-run full interactive onboarding wizard from scratch"
      },
      {
        value: "gateway",
        label: "🌐 Change Gateway host, port and auth token"
      },
      {
        value: "daemon",
        label: "🛠  Install / reinstall systemd daemon (auto-start on boot)"
      },
      {
        value: "remove_daemon",
        label: "❌ Remove systemd daemon (disable auto-start)"
      },
      {
        value: "reset_config",
        label: "🔄 Reset komorebi.json to factory defaults"
      },
      {
        value: "rebuild",
        label: "🏗  Rebuild all TypeScript packages from source"
      },
      {
        value: "relink_cli",
        label: "🔗 Re-link global 'komorebi' CLI command"
      },
      { value: "exit", label: "Exit" }
    ]
  });

  if (p.isCancel(action) || action === "exit") {
    p.cancel("Reconfigure cancelled.");
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (action === "rerun_onboard") {
    p.note(
      "Re-launching onboarding wizard...",
      "Onboard"
    );
    const onboardScript = join(__dirname, "..", "..", "cli", "dist", "index.js");
    spawn("node", [onboardScript, "onboard"], { stdio: "inherit" });
    return;
  }

  // ─── Gateway settings ─────────────────────────────────────────────────────
  if (action === "gateway") {
    const config = loadConfig();

    const newHost = await p.text({
      message: "Gateway host (bind address):",
      placeholder: "127.0.0.1",
      defaultValue: (config.gateway as any).host ?? "127.0.0.1"
    });
    if (p.isCancel(newHost)) { p.cancel("Cancelled."); return; }

    const newPort = await p.text({
      message: "Gateway port:",
      placeholder: "8000",
      defaultValue: String(config.gateway.port),
      validate: v => (isNaN(Number(v)) || Number(v) < 1 || Number(v) > 65535 ? "Enter a valid port 1–65535" : undefined)
    });
    if (p.isCancel(newPort)) { p.cancel("Cancelled."); return; }

    const newToken = await p.password({
      message: "Gateway auth token:",
      mask: "*"
    });
    if (p.isCancel(newToken)) { p.cancel("Cancelled."); return; }

    (config.gateway as any).host = String(newHost);
    config.gateway.port = Number(newPort);
    if (newToken) config.gateway.authToken = String(newToken);
    saveConfig(config);

    // Also update komorebi.config.json in project root
    const projectConfigPath = join(__dirname, "..", "..", "komorebi.config.json");
    if (existsSync(projectConfigPath)) {
      try {
        const raw = JSON.parse(require("node:fs").readFileSync(projectConfigPath, "utf-8"));
        raw.gateway = raw.gateway || {};
        raw.gateway.host = String(newHost);
        raw.gateway.port = Number(newPort);
        if (newToken) raw.gateway.authToken = String(newToken);
        writeFileSync(projectConfigPath, JSON.stringify(raw, null, 2), "utf-8");
      } catch {}
    }

    p.outro(pc.green(`Gateway updated → ${newHost}:${newPort}\nRestart the gateway to apply changes: komorebi gateway restart`));
    return;
  }

  // ─── Install systemd daemon ────────────────────────────────────────────────
  if (action === "daemon") {
    const projectRoot = join(__dirname, "..", "..");
    const serviceFile = join(projectRoot, "config", "komorebi-gateway.service");

    if (!existsSync(serviceFile)) {
      p.log.error("Service file not found at config/komorebi-gateway.service.");
      return;
    }

    const s = p.spinner();
    s.start("Installing systemd service...");
    const ok =
      tryExec(`sudo cp "${serviceFile}" /etc/systemd/system/`) &&
      tryExec("sudo systemctl daemon-reload") &&
      tryExec("sudo systemctl enable komorebi-gateway") &&
      tryExec("sudo systemctl start komorebi-gateway");
    if (ok) {
      s.stop(pc.green("systemd service installed and started."));
    } else {
      s.stop(pc.red("Failed to install service. Run with sudo or check permissions."));
    }
    p.outro("");
    return;
  }

  // ─── Remove systemd daemon ─────────────────────────────────────────────────
  if (action === "remove_daemon") {
    const s = p.spinner();
    s.start("Removing systemd service...");
    tryExec("sudo systemctl stop komorebi-gateway");
    tryExec("sudo systemctl disable komorebi-gateway");
    tryExec("sudo rm -f /etc/systemd/system/komorebi-gateway.service");
    tryExec("sudo systemctl daemon-reload");
    s.stop(pc.green("systemd service removed. Gateway will no longer auto-start."));
    p.outro("");
    return;
  }

  // ─── Reset config ──────────────────────────────────────────────────────────
  if (action === "reset_config") {
    const confirm = await p.confirm({
      message: pc.red("This will overwrite your komorebi.json with factory defaults. Continue?"),
      initialValue: false
    });
    if (!p.isCancel(confirm) && confirm) {
      const cfgPath = getConfigPath();
      if (existsSync(cfgPath)) rmSync(cfgPath);
      // Re-run onboard to write new defaults
      const { runOnboardWizard } = await import("./onboard.js");
      await runOnboardWizard({});
    } else {
      p.cancel("Reset cancelled.");
    }
    return;
  }

  // ─── Rebuild packages ──────────────────────────────────────────────────────
  if (action === "rebuild") {
    const projectRoot = join(__dirname, "..", "..");
    p.log.info("Rebuilding all TypeScript packages...\n");

    const targets = [
      { name: "gateway", dir: join(projectRoot, "gateway") },
      { name: "agent-runtime", dir: join(projectRoot, "agent-runtime") },
      { name: "cli", dir: join(projectRoot, "cli") },
      { name: "dashboard", dir: join(projectRoot, "dashboard") }
    ];

    for (const t of targets) {
      const s = p.spinner();
      s.start(`Building ${t.name}...`);
      try {
        if (t.name === "dashboard") {
          execSync("npm run build", { cwd: t.dir, stdio: "pipe" });
        } else {
          execSync("node ../gateway/node_modules/.bin/tsc 2>/dev/null || node node_modules/.bin/tsc", {
            cwd: t.dir,
            stdio: "pipe"
          });
        }
        s.stop(pc.green(`${t.name} built successfully.`));
      } catch (err: any) {
        s.stop(pc.red(`${t.name} build failed: ${err.message?.split("\n")[0]}`));
      }
    }
    p.outro(pc.green("Rebuild complete."));
    return;
  }

  // ─── Re-link CLI ───────────────────────────────────────────────────────────
  if (action === "relink_cli") {
    const s = p.spinner();
    const projectRoot = join(__dirname, "..", "..");
    s.start("Re-linking global komorebi CLI...");
    try {
      execSync("npm link --no-bin-links", {
        cwd: join(projectRoot, "cli"),
        stdio: "pipe"
      });
      execSync(`sudo ln -sf "${join(projectRoot, "cli", "dist", "index.js")}" /usr/local/bin/komorebi`);
      s.stop(pc.green("CLI re-linked at /usr/local/bin/komorebi."));
    } catch (err: any) {
      s.stop(pc.red(`Re-link failed: ${err.message?.split("\n")[0]}`));
    }
    p.outro("");
    return;
  }
}
