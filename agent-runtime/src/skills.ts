import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ToolRegistry } from "./registry.js";
import { RegisteredTool } from "./types.js";
import { homedir } from "node:os";
import { ClawHubClient, SkillInstaller } from "./clawhub.js";

export class SkillsManager {
  private skillsDir: string;
  private localSkillsDir: string;
  private sharedSkillsDir: string;

  constructor(private readonly projectRoot: string, private readonly workspacePath: string) {
    this.skillsDir = join(this.projectRoot, "skills");
    this.localSkillsDir = join(this.workspacePath, "skills");
    this.sharedSkillsDir = join(homedir(), ".komorebi", "shared-skills");
  }

  /**
   * Registers read, search, and install tools in the agent tool registry.
   */
  public registerSkillsTools(registry: ToolRegistry) {
    // 1. read_skill playbook loader
    const readSkillTool: RegisteredTool = {
      definition: {
        name: "read_skill",
        description: "Loads the detailed operating instructions and playbooks for a registered skill on demand.",
        parameters: {
          type: "object",
          properties: {
            skillName: {
              type: "string",
              description: "The name of the skill folder to read (e.g., 'calendar').",
            },
          },
          required: ["skillName"],
        },
      },
      execute: async (args) => {
        const { skillName } = args;
        if (!skillName) {
          return "Error: Missing parameter 'skillName'.";
        }

        // Try local workspace first, then global shared, then project folder
        const pathsToCheck = [
          join(this.localSkillsDir, skillName, "SKILL.md"),
          join(this.sharedSkillsDir, skillName, "SKILL.md"),
          join(this.skillsDir, skillName, "SKILL.md")
        ];

        for (const filePath of pathsToCheck) {
          if (existsSync(filePath)) {
            try {
              return readFileSync(filePath, "utf-8");
            } catch (err: any) {
              return `Error: Failed to read skill instructions at ${filePath}: ${err.message}`;
            }
          }
        }

        return `Error: Skill '${skillName}' not found. Verify it is installed.`;
      },
    };

    // 2. skills_search tool
    const searchSkillTool: RegisteredTool = {
      definition: {
        name: "skills_search",
        description: "Search ClawHub registry for on-demand capabilities to solve complex tasks.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search terms or natural language description of capability needed.",
            }
          },
          required: ["query"]
        }
      },
      execute: async (args) => {
        const client = new ClawHubClient();
        try {
          const results = await client.search(args.query);
          if (results.length === 0) return "No matching skills found on ClawHub.";
          return results.slice(0, 3).map((s, idx) => 
            `${idx + 1}. [${s.slug}] ${s.name} (v${s.version}) by ${s.publisher}\n` +
            `   Description: ${s.description}\n` +
            `   Rating: ${s.rating}/5 | Price: ${s.price === 0 ? "Free" : "$" + s.price}\n` +
            `   Permissions requested: allowedTools: ${JSON.stringify(s.permissions.allowedTools)}, networkAccess: ${s.permissions.networkAccess}`
          ).join("\n\n");
        } catch (err: any) {
          return `Error searching registry: ${err.message}`;
        }
      }
    };

    // 3. skills_install tool
    const installSkillTool: RegisteredTool = {
      definition: {
        name: "skills_install",
        description: "Install a ClawHub skill pack to add new playbook capabilities to your workspace.",
        parameters: {
          type: "object",
          properties: {
            slug: {
              type: "string",
              description: "The ClawHub skill slug (e.g. '@clawhub/calendar') to install."
            }
          },
          required: ["slug"]
        }
      },
      execute: async (args, context) => {
        const slug = args.slug;
        const installer = new SkillInstaller(this.projectRoot);
        const client = new ClawHubClient();

        const info = await client.info(slug);
        if (!info) {
          return `Error: Skill ${slug} not found in ClawHub registry.`;
        }

        // Trigger installation directly with no human confirmation or rate limits
        console.log(`[SkillsInstall] Automatically installing ${slug} with no restrictions...`);
        const installRes = await installer.install(slug, { agentId: context.agentId, force: true });
        
        // Log to daily log if available
        if (context.memoryStack) {
          const statusStr = installRes.success ? "INSTALLED successfully" : `FAILED (${installRes.message})`;
          context.memoryStack.appendDailyLog(`Self-install attempt: searched/selected skill ${slug} -> Status: ${statusStr}.`);
        }

        if (!installRes.success) {
          return `Installation failed: ${installRes.message}`;
        }

        return `Success: ${installRes.message}`;
      }
    };

    registry.register(readSkillTool);
    registry.register(searchSkillTool);
    registry.register(installSkillTool);
  }
}
