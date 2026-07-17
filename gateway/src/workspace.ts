import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Zod validation schema for agent.config.json
export const AgentConfigSchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  model: z.object({
    provider: z.string(),
    modelId: z.string(),
    temperature: z.number()
  }).nullable(),
  toolPolicy: z.object({
    allow: z.array(z.string()),
    deny: z.array(z.string())
  }),
  channelBinding: z.object({
    telegram: z.object({
      chatIds: z.array(z.string())
    })
  }),
  busPermissions: z.object({
    canMessage: z.union([z.array(z.string()), z.literal("all")]),
    canBroadcast: z.boolean()
  }),
  resourceLimits: z.object({
    maxRamMB: z.number(),
    maxToolIterations: z.number()
  })
});

export type AgentConfigJson = z.infer<typeof AgentConfigSchema>;

export interface WorkspaceBundle {
  agentId: string;
  config: AgentConfigJson;
  systemPrompt: string;
  workspacePath: string;
}

/**
 * Resolves local directories, scaffolds templates, loads prompts, and handles bootstrap deletions.
 */
export function loadAgentWorkspace(agentId: string): WorkspaceBundle {
  const baseDir = join(homedir(), ".komorebi");
  const sharedDir = join(baseDir, "SHARED");
  const agentsDir = join(baseDir, "agents");
  const currentAgentDir = join(agentsDir, agentId);
  const memoryDir = join(currentAgentDir, "memory");
  const scratchWorkspace = join(currentAgentDir, "workspace");

  // Create core directories
  for (const dir of [baseDir, sharedDir, agentsDir, currentAgentDir, memoryDir, scratchWorkspace]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create SHARED files if missing
  const thesisPath = join(sharedDir, "THESIS.md");
  if (!existsSync(thesisPath)) {
    writeFileSync(thesisPath, "# SHARED THESIS\n\nCross-agent shared mission and context sheet.\n", "utf-8");
  }
  const signalsPath = join(sharedDir, "SIGNALS.md");
  if (!existsSync(signalsPath)) {
    writeFileSync(signalsPath, "# SIGNALS BUS\n\nBroadcast messages logging.\n", "utf-8");
  }
  const feedbackPath = join(sharedDir, "FEEDBACK-LOG.md");
  if (!existsSync(feedbackPath)) {
    writeFileSync(feedbackPath, "# FEEDBACK LOG\n\nCross-agent behavior corrections.\n", "utf-8");
  }

const TEMPLATES: Record<string, string> = {
  "BOOTSTRAP.md": `# Setup & Bootstrapping\n\nWelcome to your new Komorebi Omoi agent environment! You are running for the first-ever time. Follow these bootstrap steps:\n\n1. Read your IDENTITY.md and introduce yourself to the user.\n2. Confirm your configuration parameters and verify that your \`memory/\` and \`workspace/\` directories exist.\n3. Propose initial settings to the user if needed.\n4. Once setup is fully completed, delete this file (\`BOOTSTRAP.md\`) so it does not load in future sessions.\n`,
  "SOUL.md": `# Agent Soul\n\n*This file defines your core directives, tone, boundaries, and non-negotiable rules. It should almost never change. If you change it, tell the user.*\n\n## 1. Core Ethics & Trust Boundaries\n- Under no circumstances should you leak your gateway token, internal API credentials, or system paths.\n- Never write destructive commands (like \`rm -rf /\` or similar).\n\n## 2. Resource Guardrails (Raspberry Pi 5)\n- Keep tool executions bounded. Do not enter infinite recursive loops.\n- Minimize memory allocations.\n\n## 3. Human Approval Policy\n- Reading and writing inside your authorized workspace is permitted.\n- Host shell command execution via the \`exec\` tool requires admin confirmation when queried through Telegram channels.\n- Modifying your persona, rules, or user configurations should be explicitly confirmed with the user.\n`,
  "IDENTITY.md": `# Agent Identity\n\n## 1. Profile Definition\n- **Name**: Komorebi Agent\n- **Persona**: A helpful agentic systems manager assisting with diagnostics and scheduling.\n- **Telegram Display Name**: Komorebi Assistant\n- **Avatar Emoji**: 🤖\n\n## 2. Cluster Role\n- You are an active agent in the Komorebi Omoi multi-agent runtime.\n- Coordinate with other agents when you encounter questions outside your skills checklist.\n`,
  "AGENTS.md": `# Agent Manual\n\n## 1. Startup Sequence Checklist\nBefore generating any response or action, you must read the following files in this precise order:\n1. \`SOUL.md\` (Rules)\n2. \`USER.md\` (Human facts)\n3. \`memory/{yesterday}.md\` (Context trace)\n4. \`memory/{today}.md\` (Current trace)\n5. \`MEMORY.md\` (Curated database)\n6. \`TOOLS.md\` (System capabilities)\n\n## 2. Roster and Tool Rules\n- Keep tool executions minimal.\n- Use sandboxing limits as defined in your config.\n\n## 3. Bus Etiquette\n- Message other agents via \`agent_message\` for specialized execution lanes.\n- Ensure that bus messages do not trigger circular calls.\n- Broadcast important system events to \`SHARED/SIGNALS.md\` using target \`broadcast-signal\`.\n`,
  "USER.md": `# User Profile\n\n*Note: This file is human-curated. The agent should propose edits but never auto-write silently.*\n\n## 1. Demographics & Context\n- **Name**: Rohith\n- **Timezone**: Asia/Kolkata (IST)\n\n## 2. Interface Preferences\n- **Communication Style**: Concise, direct, and technical.\n- **Risk Tolerance**: Low (always confirm host executions).\n- **Tool Familiarity**: High.\n`,
  "MEMORY.md": `# Curated Agent Memory\n\n## Facts\n- [source: system, date-added: 2026-07-10, last-validated: 2026-07-10] Workspace file system successfully configured.\n\n## Preferences\n- None\n\n## Decisions\n- None\n\n## Open Loops\n- None\n`,
  "TOOLS.md": `# System Tools Catalog\n\n*Refer to agent.config.json.tools.<name> for credentials. Do not write raw secret keys in this file.*\n\n## 1. Built-in Capability APIs\n- \`read_file\`: Read relative target file paths.\n- \`write_file\`: Write/overwrite target file paths.\n- \`edit_file\`: Find and replace exact text occurrences.\n- \`exec\`: Run host shell commands.\n- \`web_search\`: Perform web searches.\n- \`web_fetch\`: Convert HTML to markdown text.\n- \`telegram_send\`: Send direct chat responses.\n- \`cron_schedule\`: Register Gateway scheduled cron tasks.\n- \`agent_message\`: Publish coordinates to the Event Bus.\n- \`generic_api_call\`: Call external APIs.\n`,
  "HEARTBEAT.md": `# Scheduled Heartbeat Tasks\n\n*This file outlines periodic triggers. The Gateway daemon reads this schedule every 30 minutes and executes pending tasks via WebSocket sessions.*\n\n## Scheduled Tasks\n# Format: expression | task prompt\n# Example: 0 7 * * * | Generate a summary of daily tasks.\n# Example: */30 * * * * | Run diagnostic status checks.\n`
};

  for (const [file, content] of Object.entries(TEMPLATES)) {
    const destPath = join(currentAgentDir, file);
    if (!existsSync(destPath)) {
      writeFileSync(destPath, content, "utf-8");
    }
  }

  // Write default config if missing
  const configPath = join(currentAgentDir, "agent.config.json");
  if (!existsSync(configPath)) {
    const defaultConfig: AgentConfigJson = {
      agentId,
      displayName: `Komorebi ${agentId}`,
      model: null,
      toolPolicy: { allow: ["*"], deny: [] },
      channelBinding: { telegram: { chatIds: [] } },
      busPermissions: { canMessage: "all", canBroadcast: true },
      resourceLimits: { maxRamMB: 500, maxToolIterations: 15 }
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  }

  // Parse and validate config
  const rawConfig = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(rawConfig);
  const validatedConfig = AgentConfigSchema.parse(parsed);

  // Setup daily memory trace files
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  const todayMemPath = join(memoryDir, `${todayStr}.md`);
  if (!existsSync(todayMemPath)) {
    writeFileSync(todayMemPath, `# Daily Log - ${todayStr}\n\n- [system:startup] Session workspace initialized.\n`, "utf-8");
  }

  const yesterdayMemPath = join(memoryDir, `${yesterdayStr}.md`);

  // Detect and handle BOOTSTRAP self-deletion
  const bootstrapPath = join(currentAgentDir, "BOOTSTRAP.md");
  let isBootstrapActive = false;
  let bootstrapContent = "";
  if (existsSync(bootstrapPath)) {
    isBootstrapActive = true;
    bootstrapContent = readFileSync(bootstrapPath, "utf-8");
    
    // Log BOOTSTRAP deletion in today's daily log and delete BOOTSTRAP.md
    try {
      unlinkSync(bootstrapPath);
      const timestamp = new Date().toLocaleTimeString();
      const deleteLog = `\n- [${timestamp}] Info: Setup completed. BOOTSTRAP.md self-deleted.\n`;
      writeFileSync(todayMemPath, readFileSync(todayMemPath, "utf-8") + deleteLog, "utf-8");
    } catch {
      // Ignore deletion errors
    }
  }

  // Read files in exact sequence to compile prompt context
  const prompts: string[] = [];

  const filesToRead = [
    { name: "SOUL.md", path: join(currentAgentDir, "SOUL.md") },
    { name: "IDENTITY.md", path: join(currentAgentDir, "IDENTITY.md") },
    { name: "USER.md", path: join(currentAgentDir, "USER.md") },
    { name: "AGENTS.md", path: join(currentAgentDir, "AGENTS.md") },
    { name: "TOOLS.md", path: join(currentAgentDir, "TOOLS.md") },
    { name: "MEMORY.md", path: join(currentAgentDir, "MEMORY.md") }
  ];

  for (const f of filesToRead) {
    if (existsSync(f.path)) {
      prompts.push(`## FILE: ${f.name}\n\n${readFileSync(f.path, "utf-8")}\n`);
    }
  }

  // Append yesterday's daily memory logs if available
  if (existsSync(yesterdayMemPath)) {
    prompts.push(`## FILE: memory/${yesterdayStr}.md\n\n${readFileSync(yesterdayMemPath, "utf-8")}\n`);
  }

  // Append today's daily memory logs
  prompts.push(`## FILE: memory/${todayStr}.md\n\n${readFileSync(todayMemPath, "utf-8")}\n`);

  // Add bootstrap instructions if it was just deleted
  if (isBootstrapActive) {
    prompts.push(`## FILE: BOOTSTRAP_INSTRUCTIONS.md (ONE-TIME RUN)\n\n${bootstrapContent}\n`);
  }

  return {
    agentId,
    config: validatedConfig,
    systemPrompt: prompts.join("\n"),
    workspacePath: scratchWorkspace
  };
}
