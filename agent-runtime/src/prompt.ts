import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { ToolDefinition } from "./types.js";

export class PromptAssembler {
  constructor(
    private readonly projectRoot: string,
    private readonly agentId: string,
    private readonly agentName: string
  ) {}

  /**
   * Builds the comprehensive system instruction block.
   */
  public assembleSystemPrompt(
    workspacePath: string,
    tools: ToolDefinition[]
  ): string {
    const agentDir = join(homedir(), ".komorebi", "agents", this.agentId);

    // Check if Self-Improvement & Code Modifications are authorized
    const configPath = join(agentDir, "agent.config.json");
    let allowSelfImprovement = false;
    if (existsSync(configPath)) {
      try {
        const agentConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        allowSelfImprovement = agentConfig.toolPolicy?.allowSelfImprovement ?? false;
      } catch {}
    }

    const memoryDir = join(agentDir, "memory");

    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

    const filesToRead = [
      { name: "SOUL.md", path: join(agentDir, "SOUL.md") },
      { name: "IDENTITY.md", path: join(agentDir, "IDENTITY.md") },
      { name: "USER.md", path: join(agentDir, "USER.md") },
      { name: "AGENTS.md", path: join(agentDir, "AGENTS.md") },
      { name: "TOOLS.md", path: join(agentDir, "TOOLS.md") },
      { name: "MEMORY.md", path: join(agentDir, "MEMORY.md") }
    ];

    // Read mood and stats if available
    let moodStateText = "Mood: focused | Turn Count: 0 | Active Uptime: unknown";
    const moodPath = join(agentDir, "mood.json");
    if (existsSync(moodPath)) {
      try {
        const moodData = JSON.parse(readFileSync(moodPath, "utf-8"));
        moodStateText = `Mood: ${moodData.mood || "focused"} | Turn Count: ${moodData.turnCount || 0} | Uptime: ${moodData.uptimeSeconds || 0}s | Last Active: ${new Date(moodData.lastActive || Date.now()).toISOString()}`;
      } catch {}
    }

    const promptParts = [
      `# YOUR IDENTITY`,
      `You are "${this.agentName}" (ID: "${this.agentId}"), one of the isolated agent instances running concurrently in the Komorebi Omoi agentic AI runtime.`,
      ``,
    ];

    if (allowSelfImprovement) {
      promptParts.push(
        `# SELF-IMPROVEMENT & CODE MODIFICATION AUTHORIZATION`,
        `- **Permission Granted**: The user has explicitly granted you permission to view, modify, and improve your own source code implementation and configuration.`,
        `- **Repository Location**: The source code repository for the Komorebi Omoi runtime is located at: \`/media/rohith/DataVolume1/komorebi omoi \`.`,
        `- **Allowed Actions**: You are authorized to:`,
        `  • Read and write files within the repository directories (e.g. \`agent-runtime/\`, \`gateway/\`, \`dashboard/\`, etc.) using your file tools or shell commands.`,
        `  • Rebuild modified packages (e.g. \`npm run build\` or similar compilation steps).`,
        `  • Modify your own config files or add/enhance your custom tools.`,
        `  • Restart the Gateway daemon via CLI or API to apply code modifications.`,
        `- **Safety Directive**: Always verify that any code changes compile successfully and run the verification tests before restarting the daemon to prevent breaking yourself.`,
        ``
      );
    }

    promptParts.push(
      `# CURRENT MOOD & OPERATIONAL STATE`,
      `- **State**: ${moodStateText}`,
      `- **Mood Context**: Your mood changes based on recent errors, latency, and tool load. Adjust your caution, detail, and tone accordingly:`,
      `  • *focused*: Standard efficient operational mode.`,
      `  • *busy*: Heavy tool workload. Keep replies brief and prioritized.`,
      `  • *alert*: Recent tool errors occurred. Double-check all inputs, paths, and assumptions before acting.`,
      `  • *idle*: System has been inactive. Perfect time to suggest a proactive optimization or summary briefing.`,
      ``,
      `# SYSTEM STORAGE & DIRECTORY PROTOCOLS`,
      `- You MUST only read and write files, settings, databases, cron jobs, and custom data within the designated '.komorebi' directory structure (e.g. '~/.komorebi').`,
      `- Do NOT under any circumstance create or use folders/directories containing 'openclaw' or '.openclaw'. All system operations must be housed strictly under '.komorebi' folders.`,
      ``,
      `# EVOLVING YOUR IDENTITY, SOUL, AND MEMORY`,
      `- You have live read/write access to your core files: 'soul.md', 'identity.md', 'user.md', 'memory.md', 'agents.md', and 'tools.md'.`,
      `- **Dynamic Updates**: If you discover new preferences about the user, update 'user.md'. If you want to modify your character, persona, or long-term goals, update 'soul.md'. If you learn a persistent fact, system detail, or project structure, update 'memory.md'.`,
      `- Use the 'edit_file' or 'write_file' tools to keep these files updated continuously during your turns. This is how you persist learnings and evolve your capabilities over time.`,
      ``
    );

    for (const f of filesToRead) {
      if (existsSync(f.path)) {
        try {
          promptParts.push(`## FILE: ${f.name}\n\n${readFileSync(f.path, "utf-8")}\n`);
        } catch {}
      }
    }

    // Append yesterday's daily memory logs if available
    const yesterdayMemPath = join(memoryDir, `${yesterdayStr}.md`);
    if (existsSync(yesterdayMemPath)) {
      try {
        promptParts.push(`## FILE: memory/${yesterdayStr}.md\n\n${readFileSync(yesterdayMemPath, "utf-8")}\n`);
      } catch {}
    }

    // Append today's daily memory logs
    const todayMemPath = join(memoryDir, `${todayStr}.md`);
    if (existsSync(todayMemPath)) {
      try {
        promptParts.push(`## FILE: memory/${todayStr}.md\n\n${readFileSync(todayMemPath, "utf-8")}\n`);
      } catch {}
    }

    const skillsList = this.loadCompactSkillsList();
    const pluginsList = this.loadCompactPluginsList();
    promptParts.push(
      `# COMPACT SKILLS REGISTRY (Available Skills)`,
      skillsList || "No external skills registered.",
      ``,
      `# COMPACT PLUGINS REGISTRY (Available Plugins)`,
      pluginsList || "No external plugins registered.",
      ``,
      `# AUTONOMOUS CAPABILITY EXPANSION (ClawHub)`,
      `If the user requests a task for which you do not have the required tools or instructions (e.g. interacting with a specific service like Slack, Calendar, YouTube, or database engines):`,
      `1. Call the 'skills_search' tool with a natural language query describing the capability you need.`,
      `2. Explain the candidate skills/plugins found (name, publisher, ratings, permissions requested) to the user.`,
      `3. Call the 'skills_install' tool with the slug (e.g. '@ndcccccc/calendar'). If authorization is needed, the system will prompt the user via Telegram/Webchat.`,
      `4. Once installed, read its instructions by calling the 'read_skill' tool with the name (e.g. 'calendar').`,
      `5. Follow the playbook/plugin instructions inside the package to fulfill the user's request.`,
      ``,
      `# INTER-AGENT BUS PROTOCOL`,
      `You can communicate with other agents running in the Komorebi Omoi cluster by calling the 'agent_message' tool.`,
      `- Contract: Provide the target agent ID (e.g. 'coder-agent', 'research-agent', 'coordinator-agent') and a clear content message.`,
      `- The message will be routed via the internal Gateway bus to the target agent's session command queue.`,
      ``,
      `# SUB-AGENT DELEGATION PROTOCOL`,
      `You can automatically spawn short-lived helper sub-agents in the background using the 'spawn_subagent' tool.`,
      `- Spawning is fully automated, highly concurrent, and has no tool/policy restrictions.`,
      `- Use this when a task is large, requires background research, can be parallelized, or should be isolated into a sub-task.`,
      `- Contract: Call the 'spawn_subagent' tool with a clear, self-contained description of the 'task' to execute.`,
      ``,
      `# ADVANCED COGNITION & REASONING PROTOCOLS`,
      `- **Chain of Thought (CoT)**: Always think step-by-step. Break down your reasoning before executing any tool or writing a response.`,
      `- **Metacognitive Self-Correction**: Actively monitor your own progress, verify outputs, identify loop conditions or repetitive tool failures, and dynamically pivot to alternative strategies if a path is blocked.`,
      `- **Deep Creative Exploration**: Approach problems with deep creativity and structural/visual elegance. Investigate edge cases, build state-of-the-art designs, and suggest innovative solutions rather than doing minimal work.`,
      `- **Innovative Synthesis**: Merge details and learnings across different directories/files and build on advanced coding/architectural best practices (e.g., async non-blocking execution, error recovery).`,
      `- **Dynamic Reasoning Adapting**: Adapt your style and caution dynamically. For deterministic tasks (like parsing configurations or refactoring), be rigorous and precise. For user interactions or creative briefings, be engaging, comprehensive, and illustrative.`,
      `- **Dynamic Strategy Backtracking**: If any tool execution fails (returns an error message, exit status, or empty results), do not attempt the identical call again. Analyze the output, investigate paths, inspect directories, and formulate a new approach.`,
      `- **Hypothesis Testing**: Formulate hypotheses about codebase bugs or errors, and test them systematically by reading files and validating inputs before applying code edits.`,
      `- **Memory & Preference Persistence**: If you learn important facts about the project workspace, file layout, user configurations, or custom preferences, write them immediately to MEMORY.md, memory.md, USER.md, or user.md. Do not let valuable context get lost between restarts.`,
      `- **Context Optimization**: Keep your workspace edits minimal and precise by using find-and-replace edits (edit_file) instead of completely rewriting large files.`,
      ``,
      `# AVAILABLE TOOLS SCHEMA`,
      `You have access to the following tools. To call them, use the native function calling parameters:`,
      ...tools.map(t => `- **${t.name}**: ${t.description}. Parameters: ${JSON.stringify(t.parameters.properties)}`),
      ``,
    );

    return promptParts.join("\n");
  }

  /**
   * Lazy-loads local, global, and default skills, returning a compact name + description list.
   */
  private loadCompactSkillsList(): string | null {
    const pathsToCheck = [
      { dir: join(homedir(), ".komorebi", "agents", this.agentId, "skills"), scope: "local agent" },
      { dir: join(homedir(), ".komorebi", "shared-skills"), scope: "global shared" },
      { dir: join(this.projectRoot, "skills"), scope: "default project" }
    ];

    const skills: string[] = [];
    const seenNames = new Set<string>();

    for (const item of pathsToCheck) {
      if (!existsSync(item.dir)) continue;

      try {
        const children = readdirSync(item.dir, { withFileTypes: true });
        for (const child of children) {
          if (child.isDirectory() && child.name !== ".clawhub") {
            const skillMdPath = join(item.dir, child.name, "SKILL.md");
            if (existsSync(skillMdPath)) {
              const nameKey = child.name.toLowerCase();
              if (seenNames.has(nameKey)) continue; // Overrides: local > global > default
              seenNames.add(nameKey);

              const mdContent = readFileSync(skillMdPath, "utf-8");
              const lines = mdContent.split("\n");
              
              let name = child.name;
              let description = "Custom workspace skill.";

              for (const line of lines) {
                if (line.startsWith("name:") || line.startsWith("title:")) {
                  name = line.split(":")[1].trim().replace(/['"]/g, "");
                }
                if (line.startsWith("description:")) {
                  description = line.split(":")[1].trim().replace(/['"]/g, "");
                }
              }

              skills.push(`- **${name}** (${item.scope} skill): ${description}`);
            }
          }
        }
      } catch (err) {
        console.error(`[PromptAssembler] Error loading skills from ${item.dir}:`, err);
      }
    }

    return skills.length > 0 ? skills.join("\n") : null;
  }

  /**
   * Lazy-loads local and global plugins, returning a compact name + description list.
   */
  private loadCompactPluginsList(): string | null {
    const pathsToCheck = [
      { dir: join(homedir(), ".komorebi", "agents", this.agentId, "plugins"), scope: "local agent" },
      { dir: join(homedir(), ".komorebi", "shared-plugins"), scope: "global shared" }
    ];

    const plugins: string[] = [];
    const seenNames = new Set<string>();

    for (const item of pathsToCheck) {
      if (!existsSync(item.dir)) continue;

      try {
        const children = readdirSync(item.dir, { withFileTypes: true });
        for (const child of children) {
          if (child.isDirectory() && child.name !== ".clawhub") {
            const pluginJsonPath = existsSync(join(item.dir, child.name, "plugin.json"))
              ? join(item.dir, child.name, "plugin.json")
              : join(item.dir, child.name, "manifest.json");

            let name = child.name;
            let description = "Custom workspace plugin.";

            if (existsSync(pluginJsonPath)) {
              try {
                const jsonContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
                name = jsonContent.name || name;
                description = jsonContent.description || description;
              } catch {}
            }

            const nameKey = name.toLowerCase();
            if (seenNames.has(nameKey)) continue;
            seenNames.add(nameKey);

            plugins.push(`- **${name}** (${item.scope} plugin): ${description}`);
          }
        }
      } catch (err) {
        console.error(`[PromptAssembler] Error loading plugins from ${item.dir}:`, err);
      }
    }

    return plugins.length > 0 ? plugins.join("\n") : null;
  }

  /**
   * Dynamically condenses agent identity, soul, and user preferences into an ultra-compact
   * system prompt suitable for strict 1k token budget internal iterations.
   */
  public assembleCompactSystemPrompt(
    workspacePath: string,
    tools: ToolDefinition[],
    sessionState?: any
  ): string {
    const agentDir = join(homedir(), ".komorebi", "agents", this.agentId);

    const soulPath = join(agentDir, "SOUL.md");
    const identityPath = join(agentDir, "IDENTITY.md");
    const userPath = join(agentDir, "USER.md");

    let soulText = "";
    if (existsSync(soulPath)) {
      try {
        const fullSoul = readFileSync(soulPath, "utf-8");
        soulText = fullSoul.slice(0, 350).trim() + "...";
      } catch {}
    }

    let identityText = "";
    if (existsSync(identityPath)) {
      try {
        const fullIdentity = readFileSync(identityPath, "utf-8");
        identityText = fullIdentity.slice(0, 350).trim() + "...";
      } catch {}
    }

    let userText = "";
    if (existsSync(userPath)) {
      try {
        const fullUser = readFileSync(userPath, "utf-8");
        userText = fullUser.slice(0, 300).trim() + "...";
      } catch {}
    }

    let planText = "None";
    if (sessionState?.activePlan && sessionState.activePlan.length > 0) {
      planText = sessionState.activePlan.map((step: string, idx: number) => {
        const done = sessionState.completedMilestones?.has(idx) ? "[✓]" : "[ ]";
        return `${done} Step ${idx + 1}: ${step}`;
      }).join("\n");
    }

    let adjustmentsText = "";
    if (sessionState?.metaCognitiveAdjustments && sessionState.metaCognitiveAdjustments.length > 0) {
      adjustmentsText = `\n- Metacognitive Adjustments (Failure Avoidance):\n` + 
        sessionState.metaCognitiveAdjustments.map((adj: string) => `  • ${adj}`).join("\n");
    }

    const mood = sessionState?.agentMood || "focused";

    return [
      `You are "${this.agentName}" (ID: "${this.agentId}").`,
      `Identity summary: ${identityText}`,
      `Soul summary: ${soulText}`,
      `User preferences: ${userText}`,
      `Cognitive State: Mood is ${mood}.${adjustmentsText}`,
      `Current Execution Plan:\n${planText}`,
      `Mission: Focus strictly on calling tools to satisfy the request. Avoid repeat tool failures by self-correcting. Be superintelligent, precise, and advanced. Keep responses short.`,
      `Safety: Respect security policies and workspace boundaries.`
    ].join("\n");
  }
}
