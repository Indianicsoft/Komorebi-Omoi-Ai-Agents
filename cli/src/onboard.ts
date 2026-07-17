import * as p from "@clack/prompts";
import pc from "picocolors";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig, saveConfig, getConfigPath, KomorebiConfigSchema, ConfigProvider, ConfigModel } from "./config.js";

// Helper secure token generator
function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "kore_";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export interface OnboardOptions {
  nonInteractive?: boolean;
  acceptRisk?: boolean;
  flow?: "quickstart" | "advanced";
  customBaseUrl?: string;
  customModelId?: string;
  customApiKey?: string;
  customCompatibility?: "openai-completions" | "openai-responses" | "anthropic" | "gemini";
  telegramToken?: string;
  agentCount?: number;
}

export async function runOnboardWizard(opts: OnboardOptions) {
  // Support headless scripted flows
  if (opts.nonInteractive) {
    if (!opts.acceptRisk) {
      console.error(pc.red("Error: --non-interactive requires --accept-risk acknowledgement."));
      process.exit(1);
    }
    await runHeadlessOnboard(opts);
    return;
  }

  p.intro(pc.green(
    "\n" +
    "  _  __                                _      _    ____                 _ \n" +
    " | |/ /___  _ __ ___   ___  _ __ ___  | |__  (_)  / __ \\ _ __ ___   ___ (_)\n" +
    " | ' // _ \\| '_ ` _ \\ / _ \\| '__/ _ \\ | '_ \\ | | / / _` | '_ ` _ \\ / _ \\| |\n" +
    " | . \\ (_) | | | | | | (_) | | |  __/ | |_) || | \\ \\__,| | | | | | (_) | |\n" +
    " |_|\\_\\___/|_| |_| |_|\\___/|_|  \\___| |_.__/ |_|  \\____/|_| |_| |_|\\___/|_|\n" +
    "                                                                          \n" +
    "   -- Self-Hosted Multi-Agent AI Runtime Dashboard & Gateway --\n"
  ));

  const flowType = opts.flow || await p.select({
    message: "Select your onboarding flow:",
    options: [
      { value: "quickstart", label: "QuickStart (sane defaults, 2-minute setup)", hint: "Recommended" },
      { value: "advanced", label: "Advanced (full endpoint, port, and security control)" }
    ]
  });

  if (p.isCancel(flowType)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }

  // --- Step 1: Model Provider Configuration ---
  p.note("Configure your primary LLM endpoint. We recommend custom OpenAI-compatible APIs (Ollama, DeepSeek, Local Llama, OpenRouter).", "Step 1: AI Provider Setup");
  
  const providerType = await p.select({
    message: "Select your AI provider:",
    options: [
      { value: "openai-compatible", label: "Custom Provider (OpenAI-compatible)", hint: "Primary path (Ollama, DeepSeek, etc.)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "openai", label: "OpenAI Direct" },
      { value: "anthropic", label: "Anthropic Claude" }
    ]
  });

  if (p.isCancel(providerType)) {
    p.cancel("Onboarding cancelled.");
    process.exit(0);
  }

  let baseUrl = "https://api.openai.com/v1";
  let apiType: "openai-responses" | "openai-completions" | "anthropic" | "gemini" = "openai-responses";
  
  if (providerType === "gemini") {
    baseUrl = "https://generativelanguage.googleapis.com";
    apiType = "gemini";
  } else if (providerType === "anthropic") {
    baseUrl = "https://api.anthropic.com";
    apiType = "anthropic";
  } else if (providerType === "openai-compatible") {
    const customUrl = await p.text({
      message: "API Base URL:",
      placeholder: "e.g., http://localhost:11434/v1 or https://api.deepseek.com",
      defaultValue: "http://localhost:11434/v1"
    });
    if (p.isCancel(customUrl)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    baseUrl = customUrl;
  }

  const apiKey = await p.password({
    message: "API Secret Key (leave empty to configure via env variable later):",
    mask: "*"
  });

  if (p.isCancel(apiKey)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const defaultModelId = providerType === "gemini" ? "gemini-1.5-flash" : providerType === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20240620";
  const modelId = await p.text({
    message: "Primary Model ID:",
    placeholder: `e.g. ${defaultModelId} or meta-llama/llama-3-70b-instruct`,
    defaultValue: providerType === "openai-compatible" ? "meta-llama/llama-3-8b-instruct" : defaultModelId
  });

  if (p.isCancel(modelId)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  // Live model verification
  const verifySpinner = p.spinner();
  verifySpinner.start("Verifying connection to model provider...");
  let verified = false;
  let verifyError = "";

  if (apiKey) {
    try {
      if (providerType === "gemini") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        await model.embedContent("Komorebi Validation");
        verified = true;
      } else {
        // Send a cheap mock call to verify api key
        const response = await axios.post(
          `${baseUrl}/chat/completions`,
          {
            model: modelId,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            timeout: 7000
          }
        );
        if (response.status === 200) {
          verified = true;
        }
      }
    } catch (err: any) {
      verifyError = err.message;
      if (err.response && err.response.data) {
        verifyError += ` - ${JSON.stringify(err.response.data)}`;
      }
    }
  }

  if (verified) {
    verifySpinner.stop(pc.green("Verification successful ✅"));
  } else {
    verifySpinner.stop(pc.yellow(`Verification skipped or failed: ${verifyError || "No API Key provided to test."}`));
  }

  // --- Step 2: Gateway Configuration ---
  p.note("Configure connection details for the Komorebi Gateway daemon.", "Step 2: Gateway Setup");
  
  let port = 18789;
  let bindLocalOnly = true;

  if (flowType === "advanced") {
    const customPort = await p.text({
      message: "Gateway Port:",
      defaultValue: "18789",
      validate: (val) => isNaN(Number(val)) ? "Must be a valid port number" : undefined
    });
    if (p.isCancel(customPort)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    port = Number(customPort);

    const bindChoice = await p.select({
      message: "Network Binding:",
      options: [
        { value: "local", label: "Local-only (127.0.0.1)", hint: "Secure: only visible on this device" },
        { value: "lan", label: "LAN-exposed (0.0.0.0)", hint: "Allows agents on other devices to connect" }
      ]
    });
    if (p.isCancel(bindChoice)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    bindLocalOnly = bindChoice === "local";
  }

  const authToken = generateToken();
  p.note(`Auth Token generated: ${authToken}\nSecure this key for agents to authenticate.`, "Gateway Token generated");

  // --- Step 3: Channel Integration ---
  p.note("Telegram is the primary communication channel. Setup the Telegram Bot bridge.", "Step 3: Telegram Setup");
  
  const botToken = await p.text({
    message: "Telegram Bot Token (Get from @BotFather):",
    placeholder: "e.g., 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
  });

  if (p.isCancel(botToken)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  // Verify Telegram Bot Token
  if (botToken) {
    const tgSpinner = p.spinner();
    tgSpinner.start("Testing Telegram Bot connection...");
    try {
      const res = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 5000 });
      if (res.data && res.data.ok) {
        tgSpinner.stop(pc.green(`Verification successful ✅ Bot: @${res.data.result.username}`));
      } else {
        tgSpinner.stop(pc.red("Telegram bot verification failed: Invalid token."));
      }
    } catch (err: any) {
      tgSpinner.stop(pc.yellow(`Telegram validation skipped: ${err.message}`));
    }
  }

  const allowedChats = await p.text({
    message: "Allowed Telegram Chat IDs / Usernames (comma-separated, optional):",
    placeholder: "e.g., 987654321, @rohith"
  });

  if (p.isCancel(allowedChats)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const allowedChatIdsArray = allowedChats
    ? allowedChats.split(",").map(c => c.trim()).filter(Boolean)
    : [];

  // --- Step 4: Agent Pool Setup ---
  p.note("Configure isolated agent workspace lanes (maximum 10 active sessions).", "Step 4: Agent Pool Setup");
  
  const agentCountStr = await p.text({
    message: "How many active agents do you want to configure? (1-10):",
    defaultValue: "3",
    validate: (val) => {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 10) return "Please enter a number between 1 and 10";
      return undefined;
    }
  });

  if (p.isCancel(agentCountStr)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const agentCount = Number(agentCountStr);
  const agents: Array<{ id: string; name: string; workspace: string }> = [];

  for (let i = 1; i <= agentCount; i++) {
    const name = await p.text({
      message: `Name/Persona for Agent #${i}:`,
      defaultValue: `komorebi-${i}`
    });
    if (p.isCancel(name)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
    const id = `komorebi-${i}`;
    const workspace = join(homedir(), ".komorebi", "agents", id);
    agents.push({ id, name, workspace });
  }

  // --- Step 5: Skills Pack ---
  const installSkills = await p.confirm({
    message: "Install default skill templates pack (Telegram Broadcast, MCP proxying)?",
    active: "yes",
    inactive: "no"
  });

  if (p.isCancel(installSkills)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  // --- Compile final configuration file ---
  const providerKey = providerType as string;
  const newConfig: KomorebiConfigSchema = {
    models: {
      mode: "merge",
      providers: {
        [providerKey]: {
          baseUrl,
          apiKey,
          api: apiType,
          models: [{ id: modelId, name: modelId }]
        }
      },
      default: `${providerType}/${modelId}`
    },
    gateway: {
      port,
      bindLocalOnly,
      authToken
    },
    channels: {
      telegram: {
        botToken,
        allowedChatIds: allowedChatIdsArray
      }
    },
    agents
  };

  // Re-write config
  saveConfig(newConfig);

  // Re-create workspaces
  for (const agent of agents) {
    if (!existsSync(agent.workspace)) {
      mkdirSync(agent.workspace, { recursive: true });
    }
  }

  p.note(`Configuration written to: ${getConfigPath()}`, "Setup files serialized");

  p.outro(pc.green(
    "Onboarding Completed Successfully! 🎉\n\n" +
    `  * Gateway Port: ${port}\n` +
    `  * Configured Agents: ${agentCount}\n` +
    `  * Admin Token: ${authToken}\n\n` +
    "To start the system gateway control plane, execute:\n" +
    "  komorebi gateway start\n\n" +
    "Or open the local dashboard panel in your web browser."
  ));
}

/**
 * Scripted headless flow.
 */
async function runHeadlessOnboard(opts: OnboardOptions) {
  console.log("[Onboard] Running non-interactive headless setup...");
  
  const baseUrl = opts.customBaseUrl || "http://localhost:11434/v1";
  const modelId = opts.customModelId || "meta-llama-3-8b-instruct";
  const apiKey = opts.customApiKey || "";
  const compatibility = opts.customCompatibility || "openai-responses";
  const botToken = opts.telegramToken || "";
  const agentCount = opts.agentCount || 3;

  const agents: Array<{ id: string; name: string; workspace: string }> = [];
  for (let i = 1; i <= agentCount; i++) {
    const id = `komorebi-${i}`;
    const workspace = join(homedir(), ".komorebi", "agents", id);
    agents.push({ id, name: id, workspace });
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
    }
  }

  const newConfig: KomorebiConfigSchema = {
    models: {
      mode: "merge",
      providers: {
        "custom-provider": {
          baseUrl,
          apiKey,
          api: compatibility,
          models: [{ id: modelId, name: modelId }]
        }
      },
      default: `custom-provider/${modelId}`
    },
    gateway: {
      port: 18789,
      bindLocalOnly: true,
      authToken: generateToken()
    },
    channels: {
      telegram: {
        botToken,
        allowedChatIds: []
      }
    },
    agents
  };

  saveConfig(newConfig);
  console.log(`[Onboard] Sane headless settings written successfully to ${getConfigPath()}`);
}
