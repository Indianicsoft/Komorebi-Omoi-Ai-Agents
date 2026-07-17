import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { KomorebiConfig } from "./types.js";
import { SessionManager } from "./session.js";
import { AgentPoolManager } from "./pool.js";
import { LaneCommandQueue } from "./queue.js";
import { GatewayWsServer } from "./server.js";
import { TelegramBridge } from "./telegram.js";
import { GatewayCronScheduler } from "./cron.js";
import { GatewayWatchdog } from "./watchdog.js";
import { SelfHealingSubsystem } from "./self-healing.js";

// Load environment variables (.env files)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Resolve Project Root and Configuration
let projectRoot = join(__dirname, "..", "..");
let configPath = join(projectRoot, "komorebi.config.json");

if (!existsSync(configPath)) {
  // If run from within gateway directory
  projectRoot = join(__dirname, "..");
  configPath = join(projectRoot, "..", "komorebi.config.json");
  if (!existsSync(configPath)) {
    // Fallback to current working directory
    projectRoot = process.cwd();
    configPath = join(projectRoot, "komorebi.config.json");
    if (!existsSync(configPath)) {
      console.error("CRITICAL: komorebi.config.json not found in workspace!");
      process.exit(1);
    }
  }
}

console.log(`[Gateway] Resolved project root: ${projectRoot}`);
console.log(`[Gateway] Reading configuration from: ${configPath}`);

// Read and interpolate environment variables in the configuration JSON
let rawConfig = readFileSync(configPath, "utf-8");
rawConfig = rawConfig.replace(/\${([a-zA-Z0-9_]+)}/g, (_, name) => {
  const value = process.env[name];
  if (value === undefined) {
    console.warn(`[Gateway] Warning: Environment variable '${name}' is referenced in config but not set.`);
    return "";
  }
  return value;
});

const config: KomorebiConfig = JSON.parse(rawConfig);

// Load user overrides from ~/.komorebi/komorebi.json if it exists
const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
if (existsSync(userConfigPath)) {
  try {
    let userConfigRaw = readFileSync(userConfigPath, "utf-8");
    // Interpolate environment variables in user overrides config
    userConfigRaw = userConfigRaw.replace(/\${([a-zA-Z0-9_-]+)}/g, (_, name) => {
      const value = process.env[name];
      if (value === undefined) {
        if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
          return `\${${name}}`;
        }
        return "";
      }
      return value;
    });
    const userConfig = JSON.parse(userConfigRaw);
    console.log(`[Gateway] Loaded user configuration overrides from: ${userConfigPath}`);
    
    if (userConfig.gateway) {
      if (userConfig.gateway.port) {
        config.gateway.port = userConfig.gateway.port;
      }
      if (userConfig.gateway.authToken) {
        config.gateway.authToken = userConfig.gateway.authToken;
        process.env.OPENKOMOREBI_GATEWAY_TOKEN = userConfig.gateway.authToken;
      }
      if (userConfig.gateway.bindLocalOnly !== undefined) {
        config.gateway.host = userConfig.gateway.bindLocalOnly ? "127.0.0.1" : "0.0.0.0";
      }
    }
    
      if (userConfig.channels?.telegram?.botToken) {
        if (!config.telegram) {
          config.telegram = {};
        }
        config.telegram.sharedToken = userConfig.channels.telegram.botToken;
        // Clear bots mapping if a shared bot token is used to prevent mock bots from trying to connect and logging errors
        config.telegram.bots = [];
        (config as any).allowedTelegramChatIds = userConfig.channels.telegram.allowedChatIds
          ? userConfig.channels.telegram.allowedChatIds.map((id: any) => parseInt(String(id), 10)).filter(Number.isInteger)
          : undefined;
      }

      if (userConfig.agents && Array.isArray(userConfig.agents)) {
        console.log(`[Gateway] Overriding agents with ${userConfig.agents.length} user-defined agents.`);
        config.agents = userConfig.agents;
      }
      if (userConfig.telegram && userConfig.telegram.bots) {
        console.log(`[Gateway] Overriding Telegram bots list from user configurations.`);
        if (!config.telegram) config.telegram = {};
        config.telegram.bots = userConfig.telegram.bots;
      }
      if (userConfig.providers) {
        config.providers = userConfig.providers;
      }
      if (userConfig.models) {
        config.models = userConfig.models;
      }
  } catch (err) {
    console.error("[Gateway] Failed to parse user overrides from ~/.komorebi/komorebi.json:", err);
  }
}

// 2. Validate Gateway authentication token
if (!process.env.OPENKOMOREBI_GATEWAY_TOKEN) {
  // Ensure default fallback token is set if not provided, but raise an alert
  console.warn("[Gateway] WARNING: OPENKOMOREBI_GATEWAY_TOKEN not set in environment. Falling back to default token in config file.");
  process.env.OPENKOMOREBI_GATEWAY_TOKEN = config.gateway.authToken || "kore_admin_super_secret_token_change_me_12345";
}

// 3. Initialize Orchestrator Core Modules
const sessionManager = new SessionManager(config.agents, projectRoot);
const poolManager = new AgentPoolManager(config.agents, projectRoot, config.gateway.port || 18789);
sessionManager.setPoolManager(poolManager);

const commandQueue = new LaneCommandQueue(10, 10); // Global concurrency=10, Max agents=10

const telegramBridges = new Map<string, TelegramBridge>();

let wsServer: GatewayWsServer;

// Resolve owner chat ID for cron Telegram reporting
// Try allowedChatIds first (shared bot config), then fallback to first bot's allowedUserIds
const _cronOwnerChatId: number | null = (() => {
  const chatIds = (config as any).allowedTelegramChatIds;
  if (chatIds && chatIds.length > 0) return Number(chatIds[0]);
  const firstBot = config.telegram?.bots?.[0];
  if (firstBot?.allowedUserIds && firstBot.allowedUserIds.length > 0) return Number(firstBot.allowedUserIds[0]);
  return null;
})();

const cronScheduler = new GatewayCronScheduler(sessionManager, () => wsServer, _cronOwnerChatId);

wsServer = new GatewayWsServer(
  config.gateway.host || "127.0.0.1",
  config.gateway.port || 18789,
  poolManager,
  sessionManager,
  (agentId) => telegramBridges.get(agentId)?.getTelegrafInstance(),
  config,
  cronScheduler
);

GatewayWatchdog.getInstance().initialize(
  poolManager,
  sessionManager,
  () => wsServer,
  config
);

SelfHealingSubsystem.getInstance().initialize(
  poolManager,
  sessionManager,
  config,
  () => wsServer,
  projectRoot
);

// Initialize closed-loop Learning Curator
import { LearningCurator } from "./learning-curator.js";
const curator = new LearningCurator(config, async (agentId, systemInstruction, prompt) => {
  const sessionId = `${agentId}:chat:curator_${Date.now()}`;
  await sessionManager.ensureAgentRunning(agentId, sessionId);
  const ws = sessionManager.getAgentConnection(sessionId);
  if (!ws) throw new Error(`Agent connection not active for ${agentId}`);
  const result = await wsServer.sendRequest(ws, "queryModel", { systemInstruction, prompt });
  return result.text;
});
setInterval(() => {
  curator.checkAndCurateAllAgents().catch(err => {
    console.error("[Curator] Background curation interval run failed:", err);
  });
}, 10000);

// Intercept console outputs to broadcast them as system logs on the Event Bus
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

let isLogging = false;

console.log = (...args) => {
  originalLog(...args);
  if (isLogging) return;
  isLogging = true;
  try {
    const text = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    wsServer?.publishToBus("system_logs", { level: "info", text, timestamp: Date.now() });
  } catch {}
  isLogging = false;
};

console.warn = (...args) => {
  originalWarn(...args);
  if (isLogging) return;
  isLogging = true;
  try {
    const text = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    wsServer?.publishToBus("system_logs", { level: "warn", text, timestamp: Date.now() });
  } catch {}
  isLogging = false;
};

console.error = (...args) => {
  originalError(...args);
  if (isLogging) return;
  isLogging = true;
  try {
    const text = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    wsServer?.publishToBus("system_logs", { level: "error", text, timestamp: Date.now() });
  } catch {}
  isLogging = false;
};

// 4. Initialize Telegram Bridges
if (config.telegram) {
  // Option A: Single Shared Telegram Bot routing to agents
  if (config.telegram.sharedToken && !config.telegram.sharedToken.includes("example") && config.telegram.sharedToken.trim() !== "") {
    console.log("[Gateway] Setting up shared Telegram bot bridge...");
    // Shared bots route dynamically. Route to coordinator if available, or first available agent in config.agents
    const targetAgentId = config.agents.find(a => a.id === "coordinator-agent")?.id
      || config.agents[0]?.id
      || "coordinator-agent";
    
    console.log(`[Gateway] Routing shared Telegram bot messages to target agent ID: ${targetAgentId}`);

    const bridge = new TelegramBridge(
      config.telegram.sharedToken,
      targetAgentId,
      "per-channel-peer",
      (config as any).allowedTelegramChatIds,
      sessionManager,
      commandQueue,
      () => wsServer
    );
    telegramBridges.set(targetAgentId, bridge);
  }

  // Option B: Multiple dedicated bots bound per agent
  if (config.telegram.bots && config.telegram.bots.length > 0) {
    for (const botConfig of config.telegram.bots) {
      if (!botConfig.token || botConfig.token.trim() === "" || botConfig.token.includes("example")) {
        console.warn(`[Gateway] Skipping Telegram bridge for agent '${botConfig.agentId}' because token is missing or a placeholder.`);
        continue;
      }
      
      console.log(`[Gateway] Setting up Telegram bot bridge for agent: ${botConfig.agentId}`);
      
      const agent = config.agents.find(a => a.id === botConfig.agentId);
      // Determine DM scope from tool policy or default to per-channel-peer
      const dmScope: any = "per-channel-peer"; 

      const bridge = new TelegramBridge(
        botConfig.token,
        botConfig.agentId,
        dmScope,
        botConfig.allowedUserIds,
        sessionManager,
        commandQueue,
        () => wsServer
      );
      telegramBridges.set(botConfig.agentId, bridge);
    }
  }
}

// 5. Start Telegram Bridges
(async () => {
  for (const [agentId, bridge] of telegramBridges.entries()) {
    bridge.start().catch((err) => {
      console.error(`[Gateway] Failed to start Telegram bot for agent ${agentId}:`, err);
    });
  }
  console.log("[Gateway] All bridges and servers online. Ready for agents.");
})();

// 6. Graceful Shutdown Handler
async function handleShutdown() {
  console.log("\n[Gateway] Shutting down gateway daemon gracefully...");
  
  // Stop bots
  for (const bridge of telegramBridges.values()) {
    try {
      await bridge.stop();
    } catch (err) {
      console.error("[Gateway] Error stopping Telegram bot:", err);
    }
  }

  // Terminate any running agent processes
  try {
    poolManager.close();
  } catch (err) {
    console.error("[Gateway] Error closing PoolManager:", err);
  }

  // Close WebSocket server
  wsServer.close();

  console.log("[Gateway] Cleanup complete. Exiting.");
  process.exit(0);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
