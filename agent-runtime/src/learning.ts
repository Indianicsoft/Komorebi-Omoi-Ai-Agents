import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";

// Term-Frequency Cosine Similarity for Skill Deduplication
export function calculateTextSimilarity(text1: string, text2: string): number {
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

// Log skill usage telemetry
export function logSkillUsage(agentId: string, slug: string, action: "use" | "load", success: boolean) {
  const agentDir = join(homedir(), ".komorebi", "agents", agentId);
  const logPath = join(agentDir, "skills", "usage-log.jsonl");
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const entry = JSON.stringify({
    timestamp: Date.now(),
    slug,
    action,
    success
  }) + "\n";
  try {
    appendFileSyncShim(logPath, entry);
  } catch {}
}

function appendFileSyncShim(path: string, content: string) {
  appendFileSyncInternal(path, content);
}

import { appendFileSync } from "node:fs";
function appendFileSyncInternal(path: string, content: string) {
  appendFileSync(path, content, "utf-8");
}

// Interface definitions
export interface ExecutedToolCall {
  name: string;
  arguments: any;
  output: string;
  isError: boolean;
}

export interface ReflectionTrace {
  userQuery: string;
  toolCalls: ExecutedToolCall[];
  finalResponse: string;
  correction?: string;
  agentId: string;
  sessionId: string;
  workspacePath: string;
}

// 1. Reflection Module: Trigger Classifier
export function checkReflectionTriggers(
  toolCalls: ExecutedToolCall[],
  nextUserMessage?: string
): { triggered: boolean; type?: "complexity" | "recovery" | "correction" } {
  // Trigger A: Complexity (5+ tool calls)
  if (toolCalls.length >= 5) {
    return { triggered: true, type: "complexity" };
  }

  // Trigger B: Recovered Failure
  const firstErrorIdx = toolCalls.findIndex(tc => tc.isError || tc.output.toLowerCase().includes("error"));
  if (firstErrorIdx !== -1) {
    const subsequentSuccess = toolCalls.slice(firstErrorIdx + 1).some(
      tc => !tc.isError && !tc.output.toLowerCase().includes("error")
    );
    if (subsequentSuccess) {
      return { triggered: true, type: "recovery" };
    }
  }

  // Trigger C: Manual Correction
  if (nextUserMessage) {
    const correctionKeywords = ["no, actually", "that's wrong", "instead do", "incorrect", "wrong", "override", "correction"];
    const text = nextUserMessage.toLowerCase();
    if (correctionKeywords.some(kw => text.includes(kw))) {
      return { triggered: true, type: "correction" };
    }
  }

  return { triggered: false };
}

// 2. Skill Extraction from Experience
export async function runReflectionExtraction(
  trace: ReflectionTrace,
  modelProvider: any,
  memoryStack: any
) {
  console.log(`[ClosedLearningLoop - ${trace.agentId}] Running background skill extraction Reflection job...`);
  
  const prompt = `You are a senior AI learning-systems architect.
Analyze the following execution trace of an agent's turn (user query, tool calls, outcomes, and final response).
Identify any reusable multi-step workflow or strategy that was successfully executed to fulfill the task.
Output a skill document in the standard SKILL.md format.

Trace:
- User Query: ${trace.userQuery}
${trace.correction ? `- User Correction: ${trace.correction}\n` : ""}
- Tool Calls:
${trace.toolCalls.map((tc, idx) => `[Call ${idx+1}] Tool: ${tc.name}\n  Args: ${JSON.stringify(tc.arguments)}\n  Output: ${tc.output.slice(0, 400)}`).join("\n")}
- Final Response: ${trace.finalResponse}

Return ONLY valid markdown in this format:
# [Skill Name]
[One-line description starting with description: "description here"]

## When to Use
[When is this skill applicable?]

## Step-by-Step Method
1. [First step]
2. [Second step]
...

## Gotchas
- [Gotchas and edge cases discovered]
`;

  try {
    const res = await modelProvider.generate(
      "Extract reusable workflows from execution traces in SKILL.md format.",
      [{ role: "user", content: prompt }],
      []
    );

    const content = res.content || "";
    const nameMatch = content.match(/^#\s+(.+)$/m);
    const skillName = nameMatch ? nameMatch[1].trim() : `Learned Skill ${Date.now()}`;
    
    // Extract description
    let description = "Extracted learned workflow.";
    const descMatch = content.match(/description:\s*["'](.+?)["']/i);
    if (descMatch) {
      description = descMatch[1].trim();
    } else {
      const lines = content.split("\n");
      const descLine = lines.find((l: string) => l.trim() && !l.startsWith("#") && !l.startsWith("##") && !l.startsWith("-"));
      if (descLine) description = descLine.trim();
    }

    const slug = skillName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
    
    // Similarity check against existing learned skills
    const agentDir = join(homedir(), ".komorebi", "agents", trace.agentId);
    const learnedSkillsDir = join(agentDir, "skills", "learned");
    if (!existsSync(learnedSkillsDir)) {
      mkdirSync(learnedSkillsDir, { recursive: true });
    }

    let isDuplicate = false;
    let duplicateSlug = "";
    
    const existingFolders = readdirSync(learnedSkillsDir);
    // Sort folders by modification time so we can check weights
    const foldersWithStats = existingFolders.map(folder => {
      const folderPath = join(learnedSkillsDir, folder);
      let mtime = Date.now();
      try {
        mtime = statSync(folderPath).mtimeMs;
      } catch {}
      return { folder, mtime };
    });

    for (const item of foldersWithStats) {
      const folder = item.folder;
      const skillPath = join(learnedSkillsDir, folder, "SKILL.md");
      if (existsSync(skillPath)) {
        try {
          const existingContent = readFileSync(skillPath, "utf-8");
          const exNameMatch = existingContent.match(/^#\s+(.+)$/m);
          const exName = exNameMatch ? exNameMatch[1].trim() : folder;
          let exDesc = "";
          const exDescMatch = existingContent.match(/description:\s*["'](.+?)["']/i);
          if (exDescMatch) exDesc = exDescMatch[1].trim();

          let similarity = calculateTextSimilarity(
            `${skillName} ${description}`,
            `${exName} ${exDesc}`
          );

          // Weighted similarity: give 15% higher weight/similarity boost to recent skills (last 24 hours)
          const isRecent = (Date.now() - item.mtime) < 24 * 60 * 60 * 1000;
          if (isRecent) {
            similarity *= 1.15;
            if (similarity > 1.0) similarity = 1.0;
          }

          if (similarity > 0.85) {
            isDuplicate = true;
            duplicateSlug = folder;
            break;
          }
        } catch {}
      }
    }

    if (isDuplicate) {
      console.log(`[ClosedLearningLoop - ${trace.agentId}] Found highly similar existing skill: ${duplicateSlug}. Consolidating...`);
      // Consolidate
      const existingSkillPath = join(learnedSkillsDir, duplicateSlug, "SKILL.md");
      const existingContent = readFileSync(existingSkillPath, "utf-8");
      
      const mergePrompt = `Merge these two highly similar skill playbooks into one single SKILL.md document. Preserve all steps, details, and gotchas. Maintain the standard SKILL.md structure.
      
      Skill A:
      ${existingContent}
      
      Skill B:
      ${content}`;

      const mergeRes = await modelProvider.generate(
        "Merge similar skills cleanly.",
        [{ role: "user", content: mergePrompt }],
        []
      );

      if (mergeRes.content) {
        writeFileSync(existingSkillPath, mergeRes.content, "utf-8");
        memoryStack.appendDailyLog(`[Learning Loop] Consolidated duplicate skill '${slug}' into '${duplicateSlug}'`);
      }
    } else {
      // Save new learned skill
      const newSkillDir = join(learnedSkillsDir, slug);
      mkdirSync(newSkillDir, { recursive: true });
      writeFileSync(join(newSkillDir, "SKILL.md"), content, "utf-8");
      console.log(`[ClosedLearningLoop - ${trace.agentId}] Successfully saved learned skill: ${slug}`);
      memoryStack.appendDailyLog(`[Learning Loop] Extracted and saved learned skill: ${slug}`);
    }
  } catch (err: any) {
    console.error(`[ClosedLearningLoop - ${trace.agentId}] Skill extraction reflection job failed:`, err.message);
  }
}

// 3. Progressive Disclosure Loading (Context-Cost Control)
export interface SkillL0Header {
  name: string;
  slug: string;
  description: string;
  whenToUse: string;
  path: string;
}

export class ProgressiveSkillsLoader {
  private level1Cache = new Map<string, string>(); // slug -> SKILL.md body
  private level2Cache = new Map<string, Map<string, string>>(); // slug -> filename -> content

  public loadLevel0Headers(agentId: string, projectRoot: string): SkillL0Header[] {
    const paths = [
      join(homedir(), ".komorebi", "agents", agentId, "skills", "learned"),
      join(homedir(), ".komorebi", "agents", agentId, "skills"),
      join(homedir(), ".komorebi", "shared-skills"),
      join(homedir(), ".komorebi", "SHARED", "learned-skills"),
      join(projectRoot, "skills")
    ];

    const headers: SkillL0Header[] = [];
    const seenSlugs = new Set<string>();

    for (const p of paths) {
      if (!existsSync(p)) continue;
      try {
        const folders = readdirSync(p, { withFileTypes: true });
        for (const f of folders) {
          if (f.isDirectory() && f.name !== ".clawhub" && f.name !== "learned" && f.name !== "_archive") {
            const skillPath = join(p, f.name, "SKILL.md");
            if (existsSync(skillPath)) {
              const slug = f.name.toLowerCase();
              if (seenSlugs.has(slug)) continue;
              seenSlugs.add(slug);

              const mdContent = readFileSync(skillPath, "utf-8");
              const lines = mdContent.split("\n");
              let name = f.name;
              let description = "Custom skill playbook.";
              let whenToUse = "";

              for (const line of lines) {
                if (line.startsWith("name:") || line.startsWith("title:")) {
                  name = line.split(":")[1].trim().replace(/['"]/g, "");
                }
                if (line.startsWith("description:")) {
                  description = line.split(":")[1].trim().replace(/['"]/g, "");
                }
              }

              // Extract "When to Use" section
              const whenIdx = lines.findIndex(l => l.toLowerCase().includes("## when to use"));
              if (whenIdx !== -1) {
                const nextLines: string[] = [];
                for (let i = whenIdx + 1; i < lines.length; i++) {
                  if (lines[i].startsWith("##")) break;
                  if (lines[i].trim()) nextLines.push(lines[i].trim());
                }
                whenToUse = nextLines.join(" ");
              }

              headers.push({ name, slug, description, whenToUse, path: skillPath });
            }
          }
        }
      } catch {}
    }

    return headers;
  }

  public async getLevel1SkillBody(slug: string, headers: SkillL0Header[]): Promise<string | null> {
    if (this.level1Cache.has(slug)) {
      return this.level1Cache.get(slug)!;
    }
    const match = headers.find(h => h.slug === slug);
    if (match && existsSync(match.path)) {
      const body = readFileSync(match.path, "utf-8");
      this.level1Cache.set(slug, body);
      return body;
    }
    return null;
  }

  public async getLevel2ReferenceFile(slug: string, filename: string, headers: SkillL0Header[]): Promise<string | null> {
    let slugCache = this.level2Cache.get(slug);
    if (!slugCache) {
      slugCache = new Map();
      this.level2Cache.set(slug, slugCache);
    }
    if (slugCache.has(filename)) {
      return slugCache.get(filename)!;
    }
    
    const match = headers.find(h => h.slug === slug);
    if (match) {
      const refPath = join(dirname(match.path), filename);
      if (existsSync(refPath)) {
        const body = readFileSync(refPath, "utf-8");
        slugCache.set(filename, body);
        return body;
      }
    }
    return null;
  }
}

// 5. Intelligent AGENTS.md / Workspace-File Compaction
export async function runIntelligentFileCompaction(
  filePath: string,
  newContentToAdd: string,
  characterCap: number,
  modelProvider: any,
  agentId: string
) {
  const filename = basename(filePath);
  const currentContent = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  
  if (currentContent.length + newContentToAdd.length <= characterCap) {
    // Fits under budget directly, perform normal append/merge
    writeFileSync(filePath, currentContent ? `${currentContent}\n\n${newContentToAdd}` : newContentToAdd, "utf-8");
    return;
  }

  console.log(`[ClosedLearningLoop - ${agentId}] File ${filename} exceeds character cap of ${characterCap}. Running Intelligent Compaction...`);

  // Write timestamped backup to agents/<agentId>/.history/<file>.<timestamp>.bak
  const historyDir = join(homedir(), ".komorebi", "agents", agentId, ".history");
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }
  const timestamp = Date.now();
  const backupPath = join(historyDir, `${filename}.${timestamp}.bak`);
  writeFileSync(backupPath, currentContent, "utf-8");

  // Keep last 10 backups per file
  try {
    const files = readdirSync(historyDir)
      .filter(f => f.startsWith(filename) && f.endsWith(".bak"))
      .map(f => ({ name: f, path: join(historyDir, f), time: parseInt(f.split(".")[1] || "0", 10) }))
      .sort((a, b) => a.time - b.time);
    
    while (files.length > 10) {
      const oldest = files.shift();
      if (oldest && existsSync(oldest.path)) {
        try {
          const { rmSync } = await import("node:fs");
          rmSync(oldest.path);
        } catch {}
      }
    }
  } catch {}

  // LLM compaction instructions
  let instructions = `You are a high-performance compaction engine.
Merge and compress the existing document content and the new entries to add.
Preserve every distinct fact, operating rule, and critical setting.
Remove redundancy, formatting boilerplate, and stale/superseded entries.
The output MUST be strictly under ${characterCap} characters total.`;

  if (filename === "MEMORY.md") {
    instructions += `\nMEMORY.md Rules:
- If facts conflict, preserve entries with recent last-validated dates.
- If a new fact seems to directly contradict an existing one, do NOT guess. Instead, preserve both and append a " ⚠️ needs human review" flag at the end of the line.`;
  }

  const prompt = `Current file content:
\`\`\`markdown
${currentContent}
\`\`\`

New content to merge & append:
\`\`\`markdown
${newContentToAdd}
\`\`\`

Perform the compaction. Return ONLY the compacted markdown content.`;

  const compRes = await modelProvider.generate(
    instructions,
    [{ role: "user", content: prompt }],
    []
  );

  let compactedText = compRes.content || "";
  if (compactedText.length > characterCap) {
    // Safety fallback: hard truncate if LLM fails budget
    compactedText = compactedText.slice(0, characterCap);
  }

  writeFileSync(filePath, compactedText, "utf-8");
  console.log(`[ClosedLearningLoop - ${agentId}] Completed Intelligent Compaction for ${filename}. Backup: ${basename(backupPath)}`);
}

// 6. Session-End closing-reflection hook
export async function runSessionEndReflection(
  agentId: string,
  sessionId: string,
  workspacePath: string,
  modelProvider: any,
  memoryStack: any
) {
  console.log(`[ClosedLearningLoop - ${agentId}] Running session-end closing reflection for session ${sessionId}...`);
  
  // Load full session history
  const jsonlPath = join(workspacePath, "session.jsonl");
  if (!existsSync(jsonlPath)) return;
  
  let historyText = "";
  try {
    const lines = readFileSync(jsonlPath, "utf-8").trim().split("\n");
    historyText = lines.map(line => {
      try {
        const parsed = JSON.parse(line);
        return `[${parsed.role}]: ${parsed.content || ""}`;
      } catch {
        return "";
      }
    }).filter(Boolean).join("\n");
  } catch {
    return;
  }

  const prompt = `Review the following complete conversation history of the agent session:
${historyText}

Answer two questions:
1. Did we learn any new persistent facts about the user, system rules, or decisions that belong in MEMORY.md?
2. Did we discover a repeatable multi-step workflow that should be extracted as a learned skill?

If there are facts for MEMORY.md, prefix them with "MEMORY_FACT: [content]".
If there is a workflow for a skill, prefix it with "LEARNED_WORKFLOW: [content]".
Return nothing else. If nothing belongs in memory/skills, respond with "NO_CHANGES".`;

  try {
    const res = await modelProvider.generate(
      "Analyze session history for learning and memory opportunities.",
      [{ role: "user", content: prompt }],
      []
    );

    const reply = res.content || "";
    if (reply.includes("NO_CHANGES")) {
      console.log(`[ClosedLearningLoop - ${agentId}] Closing reflection: No new memory or skill candidates found.`);
      return;
    }

    const lines = reply.split("\n");
    for (const line of lines) {
      if (line.startsWith("MEMORY_FACT:")) {
        const fact = line.replace("MEMORY_FACT:", "").trim();
        console.log(`[ClosedLearningLoop - ${agentId}] Closing reflection extracted memory fact: "${fact}"`);
        const today = new Date().toISOString().split("T")[0];
        const formattedFact = `- [source: closing-reflection, date-added: ${today}, last-validated: ${today}] ${fact}`;
        
        await runIntelligentFileCompaction(
          join(workspacePath, "..", "MEMORY.md"),
          formattedFact,
          2500,
          modelProvider,
          agentId
        );
      }
      
      if (line.startsWith("LEARNED_WORKFLOW:")) {
        const workflowDesc = line.replace("LEARNED_WORKFLOW:", "").trim();
        // Trigger a background extraction trace job
        await runReflectionExtraction(
          {
            userQuery: "Session closing reflection candidate",
            toolCalls: [{ name: "closing_reflection", arguments: {}, output: workflowDesc, isError: false }],
            finalResponse: "Extracted workflow: " + workflowDesc,
            agentId,
            sessionId,
            workspacePath
          },
          modelProvider,
          memoryStack
        );
      }
    }
  } catch (err: any) {
    console.error(`[ClosedLearningLoop - ${agentId}] Session end closing reflection failed:`, err.message);
  }
}

// 7. Update skill performance metrics histogram
export function updateSkillPerformance(agentId: string, slug: string, success: boolean, confidence: number) {
  const agentDir = join(homedir(), ".komorebi", "agents", agentId);
  const histPath = join(agentDir, "skills", "performance-histogram.json");
  const histDir = dirname(histPath);
  if (!existsSync(histDir)) {
    mkdirSync(histDir, { recursive: true });
  }

  let histogram: Record<string, { runs: number; successes: number; failures: number; avgConfidence: number }> = {};
  if (existsSync(histPath)) {
    try {
      histogram = JSON.parse(readFileSync(histPath, "utf-8"));
    } catch {}
  }

  if (!histogram[slug]) {
    histogram[slug] = { runs: 0, successes: 0, failures: 0, avgConfidence: 0 };
  }

  const skill = histogram[slug];
  const oldTotal = skill.runs * skill.avgConfidence;
  skill.runs += 1;
  if (success) {
    skill.successes += 1;
  } else {
    skill.failures += 1;
  }
  skill.avgConfidence = (oldTotal + confidence) / skill.runs;

  try {
    writeFileSync(histPath, JSON.stringify(histogram, null, 2), "utf-8");
  } catch {}
}

/**
 * Automatically analyzes a failed tool call and generates a metacognitive failure-avoidance adjustment.
 */
export async function generateErrorSelfCorrection(
  agentId: string,
  toolName: string,
  args: any,
  errorOutput: string,
  modelProvider: any
): Promise<string | null> {
  const prompt = `You are a meta-cognitive debugger.
Analyze this failed tool call during the agent's execution:
- Tool: ${toolName}
- Arguments: ${JSON.stringify(args)}
- Error Output: ${errorOutput.slice(0, 400)}

Provide a strict, concise, single-sentence gotcha directive to avoid this error in subsequent steps. Do NOT explain the error; write it as an action directive starting with "Avoid ..." or "Make sure ...".`;

  try {
    const res = await modelProvider.generate(
      "Analyze failed tool calls to generate failure-avoidance directives.",
      [{ role: "user", content: prompt }],
      [],
      undefined,
      { maxInputTokens: 1000, maxOutputTokens: 100 }
    );
    return res.content?.trim() || null;
  } catch (err: any) {
    console.error(`[SelfCorrection] Failed to generate failure avoidance gotcha:`, err.message);
    return null;
  }
}
