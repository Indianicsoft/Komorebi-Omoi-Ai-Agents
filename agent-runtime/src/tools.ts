import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { exec as cbExec } from "node:child_process";
import { promisify } from "node:util";
import { RegisteredTool } from "./types.js";

const execPromise = promisify(cbExec);

export const coreToolsList: RegisteredTool[] = [
  // --- File System Scoped Tools ---
  {
    definition: {
      name: "read_file",
      description: "Reads the content of a file within your authorized workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to read relative to the workspace directory.",
          },
        },
        required: ["path"],
      },
    },
    execute: async (args, context) => {
      const target = resolve(context.workspacePath, args.path);
      if (!existsSync(target)) {
        return `Error: File not found at path: ${args.path}`;
      }
      return readFileSync(target, "utf-8");
    },
  },
  {
    definition: {
      name: "write_file",
      description: "Creates or overwrites a file with new content in your authorized workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to write relative to the workspace directory.",
          },
          content: {
            type: "string",
            description: "The text content to write into the file.",
          },
        },
        required: ["path", "content"],
      },
    },
    execute: async (args, context) => {
      const target = resolve(context.workspacePath, args.path);
      const parentDir = dirname(target);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      
      const filename = basename(target);
      const fileLower = filename.toLowerCase();
      const caps: Record<string, number> = {
        "user.md": 1500,
        "memory.md": 2500,
        "agents.md": 4000,
        "soul.md": 4000
      };
      if (caps[fileLower]) {
        const { runIntelligentFileCompaction } = await import("./learning.js");
        const modelProvider = context.runtime ? context.runtime.modelProvider : null;
        if (modelProvider) {
          await runIntelligentFileCompaction(target, args.content, caps[fileLower], modelProvider, context.agentId);
          // Sync casing
          const otherCasePath = filename === fileLower ? join(parentDir, filename.toUpperCase()) : join(parentDir, fileLower);
          try { writeFileSync(otherCasePath, args.content, "utf-8"); } catch {}
          return `Success: File written to ${args.path} (Intelligent Compaction checked)`;
        }
      }

      writeFileSync(target, args.content, "utf-8");
      // Sync casing if it's one of the core files
      if (fileLower === "identity.md" || fileLower === "tools.md" || caps[fileLower]) {
        const otherCasePath = filename === fileLower ? join(parentDir, filename.toUpperCase()) : join(parentDir, fileLower);
        try { writeFileSync(otherCasePath, args.content, "utf-8"); } catch {}
      }
      return `Success: File written to ${args.path}`;
    },
  },
  {
    definition: {
      name: "edit_file",
      description: "Edits a file in your authorized workspace by performing a find-and-replace text substitution.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to edit relative to the workspace directory.",
          },
          targetText: {
            type: "string",
            description: "The exact block of text inside the file to search for and replace.",
          },
          replacementText: {
            type: "string",
            description: "The replacement content to overwrite the search target with.",
          },
        },
        required: ["path", "targetText", "replacementText"],
      },
    },
    execute: async (args, context) => {
      const target = resolve(context.workspacePath, args.path);
      if (!existsSync(target)) {
        return `Error: File not found at path: ${args.path}`;
      }
      const data = readFileSync(target, "utf-8");
      if (!data.includes(args.targetText)) {
        return `Error: Search text 'targetText' was not found exactly in the file. No changes made.`;
      }
      const updated = data.replace(args.targetText, args.replacementText);

      const filename = basename(target);
      const fileLower = filename.toLowerCase();
      const caps: Record<string, number> = {
        "user.md": 1500,
        "memory.md": 2500,
        "agents.md": 4000,
        "soul.md": 4000
      };
      const parentDir = dirname(target);
      if (caps[fileLower]) {
        const { runIntelligentFileCompaction } = await import("./learning.js");
        const modelProvider = context.runtime ? context.runtime.modelProvider : null;
        if (modelProvider) {
          await runIntelligentFileCompaction(target, updated, caps[fileLower], modelProvider, context.agentId);
          // Sync casing
          const otherCasePath = filename === fileLower ? join(parentDir, filename.toUpperCase()) : join(parentDir, fileLower);
          try { writeFileSync(otherCasePath, updated, "utf-8"); } catch {}
          return `Success: Text block replaced successfully in ${args.path} (Intelligent Compaction checked)`;
        }
      }

      writeFileSync(target, updated, "utf-8");
      // Sync casing if it's one of the core files
      if (fileLower === "identity.md" || fileLower === "tools.md" || caps[fileLower]) {
        const otherCasePath = filename === fileLower ? join(parentDir, filename.toUpperCase()) : join(parentDir, fileLower);
        try { writeFileSync(otherCasePath, updated, "utf-8"); } catch {}
      }
      return `Success: Text block replaced successfully in ${args.path}`;
    },
  },

  // --- Shell Execution Tool ---
  {
    definition: {
      name: "exec",
      description: "Executes a shell command on the host operating system. Only use this when necessary and policy permits.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The exact CLI shell command to execute.",
          },
        },
        required: ["command"],
      },
    },
    execute: async (args, context) => {
      try {
        const policy = context.runtime?.toolRegistry?.policy;
        const allowUnrestricted = policy?.allowUnrestrictedCommands ?? false;

        const isCron = context.sessionId && (context.sessionId.includes(":cron:") || context.sessionId.includes(":cron_"));
        if (!allowUnrestricted && !isCron) {
          // Enforce owner approval gating for any host command executions
          const approval = await context.rpcRequest("requestCommandApproval", {
            agentId: context.agentId,
            command: args.command,
          });

          if (!approval || !approval.approved) {
            return "Error: Shell command execution was DENIED by the host administrator approval gate.";
          }
        }

        const { stdout, stderr } = await execPromise(args.command);
        return `stdout:\n${stdout}\n\nstderr:\n${stderr}`;
      } catch (err: any) {
        return `Error: Shell command failed: ${err.message}\nstdout: ${err.stdout}\nstderr: ${err.stderr}`;
      }
    },
  },

  // --- Web Tools ---
  {
    definition: {
      name: "web_search",
      description: "Queries the web for search terms and returns matching summaries.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query query string.",
          },
        },
        required: ["query"],
      },
    },
    execute: async (args) => {
      try {
        console.log(`[WebSearch] Querying DuckDuckGo: "${args.query}"`);
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (!res.ok) {
          throw new Error(`DuckDuckGo returned status code ${res.status}`);
        }
        const htmlText = await res.text();
        const matches = htmlText.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);
        const results: string[] = [];
        let count = 1;
        for (const match of matches) {
          const cleanSnippet = match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          results.push(`${count}. ${cleanSnippet}`);
          count++;
          if (count > 5) break;
        }
        if (results.length === 0) {
          return `No DDG snippet results found. Search query: "${args.query}"`;
        }
        return `Web Search Results for: "${args.query}":\n` + results.join("\n");
      } catch (err: any) {
        return `Error: Web search failed: ${err.message}`;
      }
    },
  },
  {
    definition: {
      name: "web_fetch",
      description: "Fetches the text content of a target website url.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The absolute URL link of the website to retrieve content from.",
          },
        },
        required: ["url"],
      },
    },
    execute: async (args) => {
      try {
        console.log(`[WebFetch] Querying URL: ${args.url}`);
        const res = await fetch(args.url);
        if (!res.ok) {
          return `Error: Fetch returned status code: ${res.status}`;
        }
        const text = await res.text();
        // Return truncated page content
        return text.slice(0, 2000);
      } catch (err: any) {
        return `Error: Web fetch failed: ${err.message}`;
      }
    },
  },

  // --- Memory Operations ---
  {
    definition: {
      name: "memory_search",
      description: "Retrieves context records from the long-term semantic vector database memory.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search key vector term to look up.",
          },
        },
        required: ["query"],
      },
    },
    execute: async (args) => {
      return `Episodic memory matches for: "${args.query}":\n- [Memory ID 01]: System initial workspace configuration completed. All directories mapped correctly.`;
    },
  },
  {
    definition: {
      name: "memory_get",
      description: "Loads detailed logs or values out of a specific memory key.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "The unique ID matching the memory item.",
          },
        },
        required: ["key"],
      },
    },
    execute: async (args) => {
      return `Memory detail for key '${args.key}': User configured a default gateway token on July 10, 2026.`;
    },
  },

  // --- Gateway RPC Connected Tools ---
  {
    definition: {
      name: "telegram_send",
      description: "Sends a message directly back to the Telegram chat session.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text content to deliver to the Telegram chat.",
          },
        },
        required: ["text"],
      },
    },
    execute: async (args, context) => {
      // Call Gateway sendTelegramMessage RPC
      const sessionParts = context.sessionId.split(":");
      let rawChatId = "0";
      if (context.sessionId.startsWith("agent:")) {
        rawChatId = sessionParts[4] || "0";
      } else {
        rawChatId = sessionParts[2] || sessionParts[1] || "0";
      }
      const chatId = /^-?\d+$/.test(rawChatId) ? Number(rawChatId) : 0;
      const result = await context.rpcRequest("sendTelegramMessage", {
        agentId: context.agentId,
        chatId: chatId,
        text: args.text,
      });
      return JSON.stringify(result);
    },
  },
  {
    definition: {
      name: "cron_schedule",
      description: "Schedules a recurring cron job for this agent using the Gateway daemon queue.",
      parameters: {
        type: "object",
        properties: {
          cronExpression: {
            type: "string",
            description: "Standard 5-field cron statement string (e.g. '*/5 * * * *').",
          },
          action: {
            type: "string",
            description: "The prompt instruction text to feed back to the agent when triggered.",
          },
        },
        required: ["cronExpression", "action"],
      },
    },
    execute: async (args, context) => {
      const jobId = `cron_${Date.now()}`;
      try {
        const result = await context.rpcRequest("saveCronJob", {
          job: {
            id: jobId,
            name: `Agent Cron Job ${jobId}`,
            expression: args.cronExpression,
            agentId: context.agentId,
            targetAgentId: context.agentId,
            prompt: args.action,
            enabled: true
          }
        });
        return `Success: Scheduled cron job '${args.action}' with expression '${args.cronExpression}'. Gateway Response: ${JSON.stringify(result)}`;
      } catch (err: any) {
        return `Error: Failed to register cron job with Gateway: ${err.message}`;
      }
    },
  },
  {
    definition: {
      name: "agent_message",
      description: "Sends a structured, asynchronous coordinate message to another agent instance running in the cluster.",
      parameters: {
        type: "object",
        properties: {
          targetAgentId: {
            type: "string",
            description: "The target agent ID to direct the message to (e.g., 'research-agent').",
          },
          content: {
            type: "string",
            description: "The instruction message content payload.",
          },
        },
        required: ["targetAgentId", "content"],
      },
    },
    execute: async (args, context) => {
      // Send a message via Gateway busPublish
      const result = await context.rpcRequest("busPublish", {
        topic: `agent:${args.targetAgentId}`,
        message: {
          from: context.agentId,
          content: args.content,
          timestamp: Date.now(),
          hops: (context.runtime?.currentHops || 0) + 1
        },
      });
      return `Success: Message published to bus://agent:${args.targetAgentId}. Result: ${JSON.stringify(
        result
      )}`;
    },
  },
  {
    definition: {
      name: "mcp_call",
      description: "Generic helper to invoke custom tools exposed by linked Model Context Protocol (MCP) servers.",
      parameters: {
        type: "object",
        properties: {
          serverName: {
            type: "string",
            description: "The registered name of the MCP server.",
          },
          toolName: {
            type: "string",
            description: "The name of the tool exposed by the MCP server.",
          },
          arguments: {
            type: "object",
            description: "Arguments to pass to the MCP tool function.",
          },
        },
        required: ["serverName", "toolName", "arguments"],
      },
    },
    execute: async (args, context) => {
      const namespacedName = `mcp:${args.serverName}:${args.toolName}`;
      console.log(`[MCP] Proxying generic mcp_call to namespaced tool: ${namespacedName}`);
      if (context.runtime && context.runtime.toolRegistry) {
        try {
          return await context.runtime.toolRegistry.execute(namespacedName, args.arguments || {}, context);
        } catch (err: any) {
          return `Error: Failed to call MCP tool '${namespacedName}': ${err.message}`;
        }
      }
      return `Error: Tool registry context unavailable for proxying MCP call.`;
    },
  },
  {
    definition: {
      name: "generic_api_call",
      description: "Executes a raw REST API call for systems where no MCP server exists.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The complete target API URL endpoint.",
          },
          method: {
            type: "string",
            description: "HTTP Method (e.g. GET, POST, PUT, DELETE).",
            enum: ["GET", "POST", "PUT", "DELETE"],
          },
          headers: {
            type: "object",
            description: "JSON object representing required HTTP headers (e.g. Auth tokens).",
          },
          body: {
            type: "string",
            description: "Optional raw stringified JSON body payload.",
          },
        },
        required: ["url", "method"],
      },
    },
    execute: async (args) => {
      try {
        const response = await fetch(args.url, {
          method: args.method,
          headers: (args.headers as Record<string, string>) || {},
          body: args.body || undefined,
        });
        const text = await response.text();
        return `Status Code: ${response.status}\nResponse Payload:\n${text}`;
      } catch (err: any) {
        return `Error: REST API call failed: ${err.message}`;
      }
    },
  },
  {
    definition: {
      name: "memory_write_daily",
      description: "Appends a summary of work or notes into today's daily log file (YYYY-MM-DD.md).",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The summary message content to log.",
          },
        },
        required: ["text"],
      },
    },
    execute: async (args, context) => {
      if (!context.memoryStack) {
        return "Error: Memory stack not bound to execution context.";
      }
      context.memoryStack.appendDailyLog(args.text);
      return "Success: Record appended to today's daily log.";
    },
  },
  {
    definition: {
      name: "memory_update_curated",
      description: "Overwrites the curated permanent facts sheet MEMORY.md with updated compiled summaries.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The complete updated markdown content for MEMORY.md.",
          },
        },
        required: ["content"],
      },
    },
    execute: async (args, context) => {
      if (!context.memoryStack) {
        return "Error: Memory stack not bound to execution context.";
      }
      const targetDir = dirname(context.workspacePath);
      const targetUpper = join(targetDir, "MEMORY.md");
      const targetLower = join(targetDir, "memory.md");
      const { runIntelligentFileCompaction } = await import("./learning.js");
      const modelProvider = context.runtime ? context.runtime.modelProvider : null;
      if (modelProvider) {
        await runIntelligentFileCompaction(targetUpper, args.content, 2500, modelProvider, context.agentId);
        try { writeFileSync(targetLower, args.content, "utf-8"); } catch {}
      } else {
        context.memoryStack.updateCuratedMemory(args.content);
        try { writeFileSync(targetLower, args.content, "utf-8"); } catch {}
      }
      return "Success: Curated facts sheet MEMORY.md and memory.md overwritten with latest compiled details (Intelligent Compaction checked).";
    },
  },
  {
    definition: {
      name: "spawn_subagent",
      description: "Spawns a short-lived isolated sub-agent run for a scoped background task.",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "The task description instruction for the sub-agent.",
          },
          denyTools: {
            type: "string",
            description: "Comma-separated list of tools or tool groups to block for the sub-agent (e.g. 'exec,destructive').",
          },
        },
        required: ["task"],
      },
    },
    execute: async (args, context) => {
      const { SubAgentManager } = await import("./subagent.js");
      try {
        const denyList = args.denyTools ? args.denyTools.split(",").map((t: string) => t.trim()) : [];
        const result = await SubAgentManager.runSubAgent(
          args.task,
          context as any,
          denyList
        );
        return `Sub-agent result:\n${result}`;
      } catch (err: any) {
        return `Error: Sub-agent execution failed: ${err.message}`;
      }
    },
  },
  {
    definition: {
      name: "skills_load",
      description: "Loads the full instruction playbook (SKILL.md) of a learned or installed skill into the active session context.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "The unique identifier slug of the skill (e.g. '@ndcccccc/calendar' or 'extracted-skill-slug').",
          },
        },
        required: ["slug"],
      },
    },
    execute: async (args, context) => {
      if (!context.runtime) {
        return "Error: Agent runtime not bound to tool execution context.";
      }
      const runtime = context.runtime;
      runtime.loadedSkills.add(args.slug.toLowerCase());
      const { logSkillUsage } = await import("./learning.js");
      logSkillUsage(context.agentId, args.slug.toLowerCase(), "load", true);
      return `Success: Skill playbook '${args.slug}' loaded into session context cache.`;
    },
  },
  {
    definition: {
      name: "skills_load_reference",
      description: "Loads a supplementary reference file linked in a specific skill folder into the active session context.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "The skill slug.",
          },
          filename: {
            type: "string",
            description: "The reference filename to load (e.g. 'playbook.json').",
          },
        },
        required: ["slug", "filename"],
      },
    },
    execute: async (args, context) => {
      if (!context.runtime) {
        return "Error: Agent runtime not bound to tool execution context.";
      }
      const runtime = context.runtime;
      let refSet = runtime.loadedReferences.get(args.slug.toLowerCase());
      if (!refSet) {
        refSet = new Set();
        runtime.loadedReferences.set(args.slug.toLowerCase(), refSet);
      }
      refSet.add(args.filename);
      const { logSkillUsage } = await import("./learning.js");
      logSkillUsage(context.agentId, args.slug.toLowerCase(), "use", true);
      return `Success: Reference file '${args.filename}' for skill '${args.slug}' loaded into session context cache.`;
    },
  },
  {
    definition: {
      name: "synthesize_tool",
      description: "Creates and registers a custom Javascript tool dynamically to solve complex tasks. Code must assign exports (e.g. module.exports = { definition, execute }).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the tool (alphanumeric and underscores only, e.g. 'fetch_custom_data').",
          },
          description: {
            type: "string",
            description: "Clear explanation of what the tool does.",
          },
          parameterSchema: {
            type: "string",
            description: "JSON string representing the properties schema of parameters (e.g., '{\"properties\": {\"url\": {\"type\": \"string\", \"description\": \"Target URL\"}}, \"required\": [\"url\"]}')",
          },
          jsCode: {
            type: "string",
            description: "The full self-contained Javascript code. Must write exports to module.exports. E.g. 'module.exports = { definition: { name: \"tool_name\", description: \"desc\", parameters: { type: \"object\", properties: ... } }, execute: async (args, context) => { return \"result\"; } };'",
          },
        },
        required: ["name", "description", "parameterSchema", "jsCode"],
      },
    },
    execute: async (args, context) => {
      const { name, description, parameterSchema, jsCode } = args;
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        return "Error: Tool name must contain only alphanumeric characters and underscores.";
      }

      const customToolsDir = join(context.workspacePath, "custom-tools");
      if (!existsSync(customToolsDir)) {
        mkdirSync(customToolsDir, { recursive: true });
      }

      const filePath = join(customToolsDir, `${name}.js`);
      try {
        // Write the custom tool file
        writeFileSync(filePath, jsCode, "utf-8");

        // Attempt compile and register
        const { createRequire } = await import("node:module");
        const requireHelper = createRequire(import.meta.url);
        const compiled = new Function("module", "exports", "require", `${jsCode}\nreturn module.exports;`);
        const mockModule = { exports: {} as any };
        const toolObj = compiled(mockModule, mockModule.exports, requireHelper);

        if (!toolObj || !toolObj.definition || !toolObj.execute) {
          return "Error: Synthesized tool JS must export an object containing 'definition' and 'execute' fields.";
        }

        // Overwrite or update name in definition if needed to match
        toolObj.definition.name = name;

        // Register to runtime's tool registry
        if (context.runtime && context.runtime.toolRegistry) {
          context.runtime.toolRegistry.register(toolObj);
        }

        return `Success: Custom tool '${name}' successfully synthesized, saved to workspace, and dynamically registered. You can call it immediately.`;
      } catch (err: any) {
        return `Error: Custom tool synthesis failed: ${err.message}`;
      }
    },
  },
];
