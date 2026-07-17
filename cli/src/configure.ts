import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadConfig, saveConfig, KomorebiConfigSchema } from "./config.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";

export async function runConfigureMenu() {
  const config = loadConfig();

  p.intro(pc.cyan("=== Komorebi Omoi Config Editor ==="));

  while (true) {
    const action = await p.select({
      message: "Select configuration block to modify:",
      options: [
        { value: "model", label: "Modify LLM Provider / Model Settings" },
        { value: "telegram", label: "Modify Telegram bot tokens & allowlists" },
        { value: "agents", label: "Modify active agents pool count" },
        { value: "gateway", label: "Modify gateway port & auth token" },
        { value: "exit", label: "Save & Exit config editor" }
      ]
    });

    if (p.isCancel(action) || action === "exit") {
      saveConfig(config);
      p.outro(pc.green("Configuration changes saved successfully."));
      break;
    }

    switch (action) {
      case "model": {
        const defaultProv = Object.keys(config.models.providers)[0] || "custom-provider";
        const currentProv = config.models.providers[defaultProv] || { baseUrl: "", apiKey: "", api: "openai-responses", models: [] };

        const newUrl = await p.text({
          message: "API Base URL:",
          defaultValue: currentProv.baseUrl
        });
        if (p.isCancel(newUrl)) break;

        const newKey = await p.password({
          message: "API Secret Key:",
          mask: "*"
        });
        if (p.isCancel(newKey)) break;

        const newModel = await p.text({
          message: "Primary Model ID:",
          defaultValue: currentProv.models[0]?.id || "meta-llama-3-8b"
        });
        if (p.isCancel(newModel)) break;

        config.models.providers[defaultProv] = {
          baseUrl: newUrl,
          apiKey: newKey || currentProv.apiKey,
          api: currentProv.api,
          models: [{ id: newModel, name: newModel }]
        };
        config.models.default = `${defaultProv}/${newModel}`;
        p.note("LLM Provider credentials updated.", "Model Config Saved");
        break;
      }

      case "telegram": {
        const newBotToken = await p.text({
          message: "Telegram Bot Token:",
          defaultValue: config.channels.telegram.botToken
        });
        if (p.isCancel(newBotToken)) break;

        const newAllowed = await p.text({
          message: "Allowed Chat IDs (comma-separated):",
          defaultValue: config.channels.telegram.allowedChatIds.join(", ")
        });
        if (p.isCancel(newAllowed)) break;

        config.channels.telegram.botToken = newBotToken;
        config.channels.telegram.allowedChatIds = newAllowed
          ? newAllowed.split(",").map(c => c.trim()).filter(Boolean)
          : [];
        
        p.note("Telegram Bridge parameters updated.", "Telegram Config Saved");
        break;
      }

      case "agents": {
        const newCountStr = await p.text({
          message: "Number of active agents (1-10):",
          defaultValue: String(config.agents.length),
          validate: (val) => {
            const num = Number(val);
            if (isNaN(num) || num < 1 || num > 10) return "Please enter a number between 1 and 10";
            return undefined;
          }
        });
        if (p.isCancel(newCountStr)) break;

        const newCount = Number(newCountStr);
        const updatedAgents = [...config.agents];

        if (newCount > updatedAgents.length) {
          // Add new ones
          const diff = newCount - updatedAgents.length;
          for (let i = 1; i <= diff; i++) {
            const idx = updatedAgents.length + 1;
            const id = `komorebi-${idx}`;
            const workspace = join(homedir(), ".komorebi", "agents", id);
            updatedAgents.push({ id, name: id, workspace });
            if (!existsSync(workspace)) {
              mkdirSync(workspace, { recursive: true });
            }
          }
        } else if (newCount < updatedAgents.length) {
          // Shrink pool
          updatedAgents.splice(newCount);
        }

        config.agents = updatedAgents;
        p.note(`Agent pool adjusted to ${newCount} active instances.`, "Agent Pool Saved");
        break;
      }

      case "gateway": {
        const newPortStr = await p.text({
          message: "Gateway Port:",
          defaultValue: String(config.gateway.port),
          validate: (val) => isNaN(Number(val)) ? "Must be valid number" : undefined
        });
        if (p.isCancel(newPortStr)) break;

        const newToken = await p.text({
          message: "Gateway Authorization Token:",
          defaultValue: config.gateway.authToken
        });
        if (p.isCancel(newToken)) break;

        config.gateway.port = Number(newPortStr);
        config.gateway.authToken = newToken;
        
        p.note("Gateway port and token updated.", "Gateway Config Saved");
        break;
      }
    }
  }
}
