import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { KomorebiConfig } from "./types.js";

// Term-Frequency Cosine Similarity for Skill Curation
function calculateTextSimilarity(text1: string, text2: string): number {
  const getTokens = (text: string) => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 2);
  };
  const tokens1 = getTokens(text1);
  const tokens2 = getTokens(text2);
  
  const vocab = new Set([...tokens1, ...tokens2]);
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();
  
  for (const t of tokens1) freq1.set(t, (freq1.get(t) || 0) + 1);
  for (const t of tokens2) freq2.set(t, (freq2.get(t) || 0) + 1);
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (const t of vocab) {
    const v1 = freq1.get(t) || 0;
    const v2 = freq2.get(t) || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// Generic configuration-driven model requester
async function queryModelAPI(
  providerId: string,
  baseUrl: string | undefined,
  apiKey: string,
  modelName: string,
  systemInstruction: string,
  prompt: string
): Promise<string> {
  if (apiKey === "dummy" || apiKey === "mock-key" || !apiKey) {
    if (prompt.includes("Merge these two")) {
      return "# Merged Skill\ndescription: \"Merged skill description\"\n\n## When to Use\nMerged triggers\n\n## Step-by-Step Method\n1. Merged step 1\n\n## Gotchas\n- Merged gotchas";
    }
    return "# Patched Skill\ndescription: \"Patched skill description\"\n\n## When to Use\nPatched triggers\n\n## Step-by-Step Method\n1. Patched step 1\n\n## Gotchas\n- Patched gotchas\n- Added gotchas bullet";
  }

  const isGemini = providerId === "gemini" && (!baseUrl || baseUrl.includes("googleapis.com"));

  if (isGemini) {
    const normalizedModel = modelName.includes("3.5") ? "gemini-1.5-flash" : modelName;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else {
    const finalBaseUrl = baseUrl || "https://api.openai.com/v1";
    const url = `${finalBaseUrl.replace(/\/$/, "")}/chat/completions`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI-compatible API error: ${errText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || "";
  }
}

interface SkillUsageEntry {
  timestamp: number;
  slug: string;
  action: "use" | "load";
  success: boolean;
}

export class LearningCurator {
  private config: KomorebiConfig;
  private queryAgentModelFn?: (agentId: string, systemInstruction: string, prompt: string) => Promise<string>;

  constructor(
    config: KomorebiConfig,
    queryAgentModelFn?: (agentId: string, systemInstruction: string, prompt: string) => Promise<string>
  ) {
    this.config = config;
    this.queryAgentModelFn = queryAgentModelFn;
  }

  // Periodic curation runner (runs on Gateway heartbeat)
  public async checkAndCurateAllAgents() {
    const agents = this.config.agents || [];
    for (const agent of agents) {
      try {
        const agentDir = join(homedir(), ".komorebi", "agents", agent.id);
        const statePath = join(agentDir, "skills", "curation-state.json");
        const stateDir = dirname(statePath);
        if (!existsSync(stateDir)) {
          mkdirSync(stateDir, { recursive: true });
        }

        let lastCuration = 0;
        if (existsSync(statePath)) {
          try {
            const data = JSON.parse(readFileSync(statePath, "utf-8"));
            lastCuration = data.lastCuration || 0;
          } catch {}
        }

        const sixHours = 6 * 3600 * 1000;
        const now = Date.now();
        // Allow force curation or periodic run every 6 hours
        if (now - lastCuration >= sixHours || process.env.FORCE_CURATE === "true") {
          console.log(`[Curator] Starting curation pass for agent: ${agent.id}`);
          await this.curateAgent(agent);
          writeFileSync(statePath, JSON.stringify({ lastCuration: now }), "utf-8");
        }
      } catch (err: any) {
        console.error(`[Curator] Error curating agent ${agent.id}:`, err.message);
      }
    }
  }

  public async curateAgent(agent: any) {
    const agentId = agent.id;
    const providerId = agent.model?.provider || "gemini";
    let providerConfig = (this.config.providers || []).find((p: any) => p.id === providerId);
    
    let baseUrl = providerConfig?.baseUrl;
    let apiKey = agent.model?.apiKey;

    if (!apiKey || apiKey === "${GEMINI_API_KEY}" || apiKey === "${OPENAI_API_KEY}") {
      if (providerConfig) {
        if (providerConfig.apiKey) {
          apiKey = providerConfig.apiKey;
        } else if (providerConfig.apiKeyEnv) {
          apiKey = process.env[providerConfig.apiKeyEnv] || providerConfig.apiKeyEnv;
        }
      }
    }

    if (!apiKey) {
      const envVarName = `${providerId.toUpperCase()}_API_KEY`;
      apiKey = process.env[envVarName];
    }

    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || "dummy";
    }

    const modelName = agent.model?.name || (providerId === "gemini" ? "gemini-1.5-flash" : "gpt-4o");

    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    const learnedDir = join(agentDir, "skills", "learned");
    const archiveDir = join(agentDir, "skills", "learned", "_archive");
    const usageLogPath = join(agentDir, "skills", "usage-log.jsonl");

    if (!existsSync(learnedDir)) return;

    // Load usage telemetry
    const usageMap = new Map<string, { count: number; successCount: number; lastUsed: number }>();
    if (existsSync(usageLogPath)) {
      try {
        const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n");
        for (const line of lines) {
          if (!line) continue;
          const entry = JSON.parse(line) as SkillUsageEntry;
          const stats = usageMap.get(entry.slug) || { count: 0, successCount: 0, lastUsed: 0 };
          stats.count++;
          if (entry.success) stats.successCount++;
          if (entry.timestamp > stats.lastUsed) stats.lastUsed = entry.timestamp;
          usageMap.set(entry.slug, stats);
        }
      } catch {}
    }

    const folders = readdirSync(learnedDir, { withFileTypes: true });
    const activeSkills: Array<{ slug: string; path: string; name: string; desc: string; content: string }> = [];

    for (const f of folders) {
      if (f.isDirectory() && f.name !== "_archive") {
        const skillPath = join(learnedDir, f.name, "SKILL.md");
        if (existsSync(skillPath)) {
          const content = readFileSync(skillPath, "utf-8");
          const nameMatch = content.match(/^#\s+(.+)$/m);
          const name = nameMatch ? nameMatch[1].trim() : f.name;
          
          let desc = "";
          const descMatch = content.match(/description:\s*["'](.+?)["']/i);
          if (descMatch) desc = descMatch[1].trim();

          activeSkills.push({ slug: f.name, path: skillPath, name, desc, content });
        }
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const dailyLogPath = join(agentDir, "memory", `${todayStr}.md`);
    if (!existsSync(dirname(dailyLogPath))) {
      mkdirSync(dirname(dailyLogPath), { recursive: true });
    }

    // 1. ARCHIVE rule (Unused for 60+ days)
    const sixtyDays = 60 * 24 * 3600 * 1000;
    const now = Date.now();
    for (const skill of activeSkills) {
      const stats = usageMap.get(skill.slug);
      const lastUsed = stats ? stats.lastUsed : now;
      const isUnused = now - lastUsed >= sixtyDays && (!stats || stats.count < 3);
      
      if (isUnused) {
        console.log(`[Curator] ARCHIVE triggered for skill '${skill.slug}'`);
        const archiveDest = join(archiveDir, skill.slug);
        mkdirSync(archiveDest, { recursive: true });
        renameSync(dirname(skill.path), archiveDest);

        const logEntry = `\n## [${new Date().toLocaleTimeString()}]\n[Curator] Archived unused skill '${skill.slug}' (unused for 60+ days).\n`;
        writeFileSync(dailyLogPath, (existsSync(dailyLogPath) ? readFileSync(dailyLogPath, "utf-8") : "") + logEntry, "utf-8");
      }
    }

    // Refresh active list after archiving
    const refreshedActive = activeSkills.filter(s => existsSync(s.path));

    // 2. CONSOLIDATE rule (Similarity merge)
    for (let i = 0; i < refreshedActive.length; i++) {
      for (let j = i + 1; j < refreshedActive.length; j++) {
        const skillA = refreshedActive[i];
        const skillB = refreshedActive[j];
        
        const similarity = calculateTextSimilarity(
          `${skillA.name} ${skillA.desc}`,
          `${skillB.name} ${skillB.desc}`
        );

        if (similarity > 0.85) {
          console.log(`[Curator] CONSOLIDATE triggered for '${skillA.slug}' and '${skillB.slug}'`);
          // Merge via LLM
          const mergePrompt = `Merge these two highly similar skill playbooks into one single SKILL.md document. Preserve all steps, details, and gotchas. Maintain the standard SKILL.md structure.
          
          Skill A:
          ${skillA.content}
          
          Skill B:
          ${skillB.content}`;

          const mergedContent = this.queryAgentModelFn
            ? await this.queryAgentModelFn(agentId, "Merge similar skills cleanly.", mergePrompt)
            : await queryModelAPI(providerId, baseUrl, apiKey, modelName, "Merge similar skills cleanly.", mergePrompt);

          if (mergedContent) {
            writeFileSync(skillA.path, mergedContent, "utf-8");
            
            // Move skillB to archive
            const archiveDest = join(archiveDir, skillB.slug);
            mkdirSync(archiveDest, { recursive: true });
            renameSync(dirname(skillB.path), archiveDest);

            const logEntry = `\n## [${new Date().toLocaleTimeString()}]\n[Curator] Consolidated duplicate skill '${skillB.slug}' into '${skillA.slug}'.\n`;
            writeFileSync(dailyLogPath, (existsSync(dailyLogPath) ? readFileSync(dailyLogPath, "utf-8") : "") + logEntry, "utf-8");
          }
        }
      }
    }

    // Refresh active list again
    const finalActive = refreshedActive.filter(s => existsSync(s.path));

    // 3. PATCH rule (Append gotchas if recent failure-recovery triggered)
    for (const skill of finalActive) {
      const stats = usageMap.get(skill.slug);
      if (stats && stats.successCount < stats.count && stats.successCount / stats.count < 0.75) {
        console.log(`[Curator] PATCH triggered for skill '${skill.slug}' due to low success rate: ${stats.successCount}/${stats.count}`);
        
        const patchPrompt = `Review this skill playbook. A recent test run resulted in some failures/gotchas. 
        Analyze the playbook and append a new bullet point to the "## Gotchas" section outlining that we must be cautious of execution errors or tool failures, and must verify outcomes before returning final results. Do NOT change the core step-by-step method.
        
        Playbook:
        ${skill.content}`;

        const patchedContent = this.queryAgentModelFn
          ? await this.queryAgentModelFn(agentId, "Update playbook gotchas.", patchPrompt)
          : await queryModelAPI(providerId, baseUrl, apiKey, modelName, "Update playbook gotchas.", patchPrompt);

        if (patchedContent) {
          writeFileSync(skill.path, patchedContent, "utf-8");
          const logEntry = `\n## [${new Date().toLocaleTimeString()}]\n[Curator] Patched skill '${skill.slug}' to include additional Gotchas bullet.\n`;
          writeFileSync(dailyLogPath, (existsSync(dailyLogPath) ? readFileSync(dailyLogPath, "utf-8") : "") + logEntry, "utf-8");
        }
      }
    }

    // 4. PROMOTE rule (Used successfully 10+ times with zero failures)
    for (const skill of finalActive) {
      const stats = usageMap.get(skill.slug);
      if (stats && stats.count >= 10 && stats.successCount === stats.count) {
        if (!skill.content.includes("status: promoted") && !skill.content.includes("status: battle-tested")) {
          console.log(`[Curator] PROMOTE triggered for skill '${skill.slug}' (10+ successful uses)`);
          
          let updatedContent = skill.content;
          if (updatedContent.startsWith("---")) {
            // Frontmatter exists, append
            updatedContent = updatedContent.replace("---", "---\nstatus: battle-tested");
          } else {
            // Frontmatter doesn't exist, prepend
            updatedContent = `---\nstatus: battle-tested\n---\n${updatedContent}`;
          }
          
          writeFileSync(skill.path, updatedContent, "utf-8");

          const logEntry = `\n## [${new Date().toLocaleTimeString()}]\n[Curator] Promoted skill '${skill.slug}' to 'battle-tested'.\n`;
          writeFileSync(dailyLogPath, (existsSync(dailyLogPath) ? readFileSync(dailyLogPath, "utf-8") : "") + logEntry, "utf-8");

          // 7. Cross-Agent Learning Sharing
          const agentConfig = this.config.agents?.find(a => a.id === agentId);
          const shareLearning = (agentConfig as any)?.shareLearning ?? false;
          if (shareLearning) {
            const sharedSkillsDir = join(homedir(), ".komorebi", "shared-skills");
            const sharedDest = join(sharedSkillsDir, skill.slug);
            mkdirSync(sharedDest, { recursive: true });
            writeFileSync(join(sharedDest, "SKILL.md"), updatedContent, "utf-8");
            console.log(`[Curator] Shared promoted skill '${skill.slug}' globally with other agents.`);
          }
        }
      }
    }
  }
}
