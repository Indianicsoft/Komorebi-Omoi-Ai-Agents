import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ConfigModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface ConfigProvider {
  baseUrl: string;
  apiKey: string;
  api: "openai-completions" | "openai-responses" | "anthropic" | "gemini";
  models: ConfigModel[];
}

export interface KomorebiConfigSchema {
  models: {
    mode: "merge" | "override";
    providers: Record<string, ConfigProvider>;
    default: string;
  };
  gateway: {
    port: number;
    bindLocalOnly: boolean;
    authToken: string;
  };
  channels: {
    telegram: {
      botToken: string;
      allowedChatIds: string[];
    };
  };
  agents: Array<{
    id: string;
    name: string;
    workspace: string;
  }>;
}

export function getConfigPath(): string {
  return join(homedir(), ".komorebi", "komorebi.json");
}

export function loadConfig(): KomorebiConfigSchema {
  const path = getConfigPath();
  let config: KomorebiConfigSchema;
  if (existsSync(path)) {
    try {
      const data = readFileSync(path, "utf-8");
      config = JSON.parse(data) as KomorebiConfigSchema;
    } catch {
      config = getDefaults();
    }
  } else {
    config = getDefaults();
  }

  // Try to override the agents with the ones in the repository's komorebi.config.json if running in dev workspace
  const repoConfigPath = join(__dirname, "..", "..", "komorebi.config.json");
  if (existsSync(repoConfigPath)) {
    try {
      const repoConfigRaw = readFileSync(repoConfigPath, "utf-8");
      const repoConfig = JSON.parse(repoConfigRaw);
      if (repoConfig.agents && Array.isArray(repoConfig.agents)) {
        config.agents = repoConfig.agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          workspace: a.workspace
        }));
      }
    } catch (err) {
      // Ignore errors when loading repo-wide config
    }
  }

  return config;
}

function getDefaults(): KomorebiConfigSchema {
  return {
    models: {
      mode: "merge",
      providers: {
        "openai-compatible": {
          baseUrl: "https://api.openai.com/v1",
          apiKey: "",
          api: "openai-responses",
          models: [
            { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxTokens: 4096 },
            { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, maxTokens: 4096 }
          ]
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
    agents: [
      { id: "komorebi-1", name: "Komorebi-1", workspace: join(homedir(), ".komorebi", "agents", "komorebi-1") }
    ]
  };
}

export function saveConfig(config: KomorebiConfigSchema) {
  const path = getConfigPath();
  const parent = join(homedir(), ".komorebi");
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}
