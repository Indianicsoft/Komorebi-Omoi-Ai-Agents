import * as dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import { createModelProvider } from "./providers/index.js";
import { ToolRegistry } from "./registry.js";
import { PromptAssembler } from "./prompt.js";
import { AgentRuntime } from "./runtime.js";
import { coreToolsList } from "./tools.js";
import { extendedToolsList } from "./tools-extended.js";
import { KomorebiConfig, ToolPolicy, AgentConfig } from "./types.js";
import { McpClientManager } from "./mcp-client.js";
import { SkillsManager } from "./skills.js";

// Load environment variables
dotenv.config();

// Parse Command Line Arguments
const { values } = parseArgs({
  options: {
    "agent-id": { type: "string" },
    "session-id": { type: "string" },
    workspace: { type: "string" },
    "gateway-url": { type: "string" },
  },
});

const agentId = values["agent-id"];
const sessionId = values["session-id"];
const workspacePath = values["workspace"];

// Resolve user config overrides from ~/.komorebi/komorebi.json
const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
let userPort = 18789;
let userAuthToken: string | undefined = undefined;

if (existsSync(userConfigPath)) {
  try {
    const userConfigRaw = readFileSync(userConfigPath, "utf-8");
    const userConfig = JSON.parse(userConfigRaw);
    if (userConfig.gateway) {
      if (userConfig.gateway.port) {
        userPort = userConfig.gateway.port;
      }
      if (userConfig.gateway.authToken) {
        userAuthToken = userConfig.gateway.authToken;
      }
    }
  } catch (err) {
    // Ignore override errors
  }
}

const gatewayUrl = values["gateway-url"] || `ws://127.0.0.1:${userPort}`;

if (!agentId || !sessionId || !workspacePath) {
  console.error("CRITICAL: Missing required CLI arguments: --agent-id, --session-id, and --workspace must be provided.");
  process.exit(1);
}

// 1. Resolve master configuration and find current agent's policy
let projectRoot = process.cwd();
let configPath = join(projectRoot, "komorebi.config.json");

if (!existsSync(configPath)) {
  // Try parent folder
  projectRoot = join(projectRoot, "..");
  configPath = join(projectRoot, "komorebi.config.json");
  if (!existsSync(configPath)) {
    console.error(`CRITICAL: Configuration file not found at: ${configPath}`);
    process.exit(1);
  }
}

// Read configuration and extract values
let rawConfig = readFileSync(configPath, "utf-8");
rawConfig = rawConfig.replace(/\${([a-zA-Z0-9_]+)}/g, (_, name) => process.env[name] || "");
const config: KomorebiConfig = JSON.parse(rawConfig);

if (existsSync(userConfigPath)) {
  try {
    const userConfigRaw = readFileSync(userConfigPath, "utf-8");
    const userConfig = JSON.parse(userConfigRaw);
    if (userConfig.agents && Array.isArray(userConfig.agents)) {
      config.agents = userConfig.agents;
    }
    if (userConfig.providers) {
      config.providers = userConfig.providers;
    }
    if (userConfig.models) {
      config.models = userConfig.models;
    }
    if (userConfig.mcpServers) {
      config.mcpServers = userConfig.mcpServers;
    }
  } catch (err) {
    // Ignore overrides errors
  }
}

if (userAuthToken) {
  config.gateway.authToken = userAuthToken;
  process.env.OPENKOMOREBI_GATEWAY_TOKEN = userAuthToken;
}

const agentConfig = config.agents.find((a: AgentConfig) => a.id === agentId);
if (!agentConfig) {
  console.error(`CRITICAL: Agent configuration not found for ID: ${agentId}`);
  process.exit(1);
}

// 2. Setup Tool Registry with configurations
const defaultPolicy: ToolPolicy = {
  sandboxType: "bubblewrap",
  allowedTools: ["*"],
  networkAccess: false,
};

const policy = agentConfig.toolPolicy || defaultPolicy;
const registry = new ToolRegistry(workspacePath, policy);

// Attach core built-in tools
for (const tool of coreToolsList) {
  registry.register(tool);
}

// Attach extended tool surface (list_dir, append_file, think, http_stream, read_skill, skills_search)
for (const tool of extendedToolsList) {
  registry.register(tool);
}

// 3. Setup generative AI provider
const providerId = agentConfig.model.provider || "gemini";
let providerConfig = (config.providers || []).find((p: any) => p.id === providerId);
if (!providerConfig && config.models?.providers?.[providerId]) {
  providerConfig = { id: providerId, ...config.models.providers[providerId] };
}

let baseUrl = providerConfig?.baseUrl;
let apiKey: string | undefined = agentConfig.model.apiKey;

// Resolve API Key dynamically from providerConfig or env
if (!apiKey || apiKey.startsWith("$")) {
  if (providerConfig) {
    if (providerConfig.apiKey) {
      apiKey = providerConfig.apiKey;
    } else if (providerConfig.apiKeyEnv) {
      if (process.env[providerConfig.apiKeyEnv]) {
        apiKey = process.env[providerConfig.apiKeyEnv];
      } else {
        apiKey = providerConfig.apiKeyEnv;
      }
    }
  }
}

// Fallback to provider-specific environment variable lookups
if (!apiKey || apiKey.startsWith("$")) {
  const envVarName = `${providerId.toUpperCase()}_API_KEY`;
  apiKey = process.env[envVarName] || apiKey;
}

// Final fallback to clean template variable formatting
if (apiKey && apiKey.startsWith("$")) {
  const envKey = apiKey.replace(/[\${}]/g, "");
  if (process.env[envKey]) {
    apiKey = process.env[envKey];
  } else if (!/^[A-Z_][A-Z0-9_]*$/.test(envKey)) {
    // If the template key does not look like a standard environment variable name,
    // it is likely a literal API key that was mistakenly wrapped in `${}` (e.g. `${sk-live-...}`).
    apiKey = envKey;
  } else {
    apiKey = apiKey;
  }
}

// 5. Connect and start execution loop
(async () => {
  try {
    const finalApiKey: string = apiKey || "dummy";
    const modelProvider = createModelProvider(
      providerId,
      finalApiKey,
      agentConfig.model.name,
      providerConfig,
      {
        temperature: agentConfig.model.temperature,
        maxOutputTokens: agentConfig.model.maxOutputTokens
      }
    );

    // 4. Setup Prompt Assembler, Skills, and MCP connectors
    const promptAssembler = new PromptAssembler(projectRoot, agentId, agentConfig.name);
    const gatewayToken = process.env.OPENKOMOREBI_GATEWAY_TOKEN || config.gateway.authToken || "kore_admin_super_secret_token_change_me_12345";

    const runtime = new AgentRuntime(
      agentId,
      agentConfig.name,
      sessionId,
      workspacePath,
      gatewayUrl,
      gatewayToken,
      modelProvider,
      registry,
      promptAssembler,
      finalApiKey,
      providerId,
      baseUrl,
      agentConfig
    );

    const mcpManager = new McpClientManager(workspacePath, config.mcpServers || {});
    const skillsManager = new SkillsManager(projectRoot, workspacePath);

    // Dynamically query and attach MCP tools
    await mcpManager.initializeAll(registry);
    
    // Attach on-demand skills reader and clawhub self-install tools
    skillsManager.registerSkillsTools(registry);

    // Initialize & Register Context Engine Hook Subscribers
    const { pluginHooksRegistry } = await import("./runtime/agent-hooks/hooks.js");
    const { 
      SkillsLoaderSubscriber, 
      ReflectionSubscriber, 
      CompactionSubscriber,
      CuratorSubscriber,
      ProgressDraftSubscriber,
      WatchdogSubscriber,
      ProactivitySubscriber
    } = await import("./context-engine/hooks.js");
    pluginHooksRegistry.register(new SkillsLoaderSubscriber());
    pluginHooksRegistry.register(new ReflectionSubscriber());
    pluginHooksRegistry.register(new CompactionSubscriber());
    pluginHooksRegistry.register(new CuratorSubscriber());
    pluginHooksRegistry.register(new ProgressDraftSubscriber());
    pluginHooksRegistry.register(new WatchdogSubscriber());
    pluginHooksRegistry.register(new ProactivitySubscriber());

    // Register Context Engine History limits subscriber
    const { contextEngine } = await import("./context-engine/index.js");
    const { HistoryLimitSubscriber } = await import("./context-engine/history-limit-subscriber.js");
    contextEngine.register(new HistoryLimitSubscriber());

    await runtime.start();
    console.log(`[AgentMain - ${agentId}] Runtime successfully bound to Gateway. Listening for tasks...`);
  } catch (err) {
    console.error(`[AgentMain - ${agentId}] Failed to initialize runtime client:`, err);
    process.exit(1);
  }
})();
