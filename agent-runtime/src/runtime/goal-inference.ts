/**
 * goal-inference.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Goal Inference & Creative Execution Layer for Komorebi Omoi
 *
 * Integrates with: DecompositionPlanner, Reflection Module, ContextEngine
 *
 * Provides:
 *   1. GoalInferenceEngine   – ranked hypothesis generation with confidence gating
 *   2. ImplicitReqInferrer   – unstated-but-reasonable requirement extraction
 *   3. CreativeSolver        – alternative strategy generation on repeated failure
 *   4. CorrectnessBar        – post-completion self-review gap detection
 *   5. GoalAccuracyTracker   – per-agent rolling goal-match accuracy metric
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { appendFileSync } from "node:fs";
import { runReflectionExtraction } from "../learning.js";
import { runIntelligentFileCompaction } from "../learning.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalHypothesis {
  statement: string;
  successCondition: string;
  confidence: number;
  supportingEvidence: string[];
}

export interface GoalInferenceResult {
  hypotheses: GoalHypothesis[];
  chosen: GoalHypothesis | null;
  clarificationNeeded: boolean;
  clarifyingQuestion: string | null;
  implicitRequirements: ImplicitRequirement[];
  planPreview: string;
}

export interface ImplicitRequirement {
  category: "quality" | "safety" | "style" | "default-param";
  description: string;
  source: "user.md" | "memory.md" | "heuristic";
}

export interface CreativeStrategy {
  id: string;
  name: string;
  description: string;
  toolsApproach: string;
  estimatedSuccessLikelihood: number;  // 0-1
  resourceCost: "low" | "medium" | "high";
  reversible: boolean;
}

export interface CreativeSolverResult {
  failureReason: string;
  strategiesGenerated: CreativeStrategy[];
  selectedStrategy: CreativeStrategy;
  successfulStrategy: CreativeStrategy | null;
}

export interface PostCompletionReview {
  gapDetected: boolean;
  gapDescription: string | null;
  refinedGoal: string | null;
}

export interface GoalAccuracyRecord {
  agentId: string;
  taskId: string;
  timestamp: number;
  originalRequest: string;
  chosenHypothesis: string;
  hadFollowUpCorrection: boolean;
  correctiveMessage?: string;
}

export interface GoalAccuracyStats {
  totalTasks: number;
  correctedTasks: number;
  accuracyRate: number;
  recentTrend: number[];  // last 20 data points (0=miss, 1=hit)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.75;       // Tunable per agent via agentConfig
const CONFIDENCE_GAP_THRESHOLD = 0.20;   // Min gap between top-1 and top-2 to proceed
const MAX_CREATIVE_ALTERNATIVES = 3;
const AMBIGUITY_FAILURE_THRESHOLD = 2;   // Attempts before creative solver triggers

// ─── Goal Inference Engine ────────────────────────────────────────────────────

export class GoalInferenceEngine {
  private readonly agentDir: string;
  private readonly confidenceThreshold: number;

  constructor(
    private readonly agentId: string,
    private readonly workspacePath: string,
    agentConfig?: any
  ) {
    this.agentDir = join(homedir(), ".komorebi", "agents", agentId);
    this.confidenceThreshold = agentConfig?.goalInference?.confidenceThreshold ?? CONFIDENCE_THRESHOLD;
  }

  /**
   * Main entry point. Given raw user message + session context, returns
   * ranked hypotheses and whether clarification is needed.
   */
  public async infer(
    message: string,
    recentHistory: Array<{ role: string; content: string }>,
    modelProvider: any
  ): Promise<GoalInferenceResult> {
    // Skip trivial / system messages
    if (this.isTrivialMessage(message)) {
      return {
        hypotheses: [],
        chosen: null,
        clarificationNeeded: false,
        clarifyingQuestion: null,
        implicitRequirements: [],
        planPreview: ""
      };
    }

    // Load persona context files
    const userMdContent   = this.loadAgentFile("user.md");
    const memoryMdContent = this.loadAgentFile("memory.md");

    // 1. Generate ranked hypothesis set
    const hypotheses = await this.generateHypotheses(
      message, recentHistory, userMdContent, memoryMdContent, modelProvider
    );

    if (hypotheses.length === 0) {
      return {
        hypotheses: [],
        chosen: null,
        clarificationNeeded: false,
        clarifyingQuestion: null,
        implicitRequirements: [],
        planPreview: ""
      };
    }

    // Sort descending by confidence
    hypotheses.sort((a, b) => b.confidence - a.confidence);
    const top1 = hypotheses[0];
    const top2 = hypotheses[1] ?? null;

    // 2. Confidence-gated routing
    const gap = top2 ? top1.confidence - top2.confidence : 1.0;
    const shouldProceedAutonomously =
      top1.confidence >= this.confidenceThreshold &&
      gap > CONFIDENCE_GAP_THRESHOLD;

    // 3. Infer implicit requirements
    const implicitRequirements = await this.inferImplicitRequirements(
      top1,
      message,
      userMdContent,
      memoryMdContent,
      modelProvider
    );

    // 4. Build plan preview string
    const planPreview = this.buildPlanPreview(top1, implicitRequirements);

    // 5. Decide: ask or proceed
    if (!shouldProceedAutonomously && top2) {
      // Check if ambiguity actually matters (would different hypotheses produce different outcomes?)
      const ambiguityMatters = await this.ambiguityMatters(top1, top2, modelProvider);

      if (ambiguityMatters) {
        const question = await this.generateClarifyingQuestion(top1, top2, modelProvider);
        return {
          hypotheses,
          chosen: null,
          clarificationNeeded: true,
          clarifyingQuestion: question,
          implicitRequirements,
          planPreview
        };
      }
    }

    // Proceed with top hypothesis
    return {
      hypotheses,
      chosen: top1,
      clarificationNeeded: false,
      clarifyingQuestion: null,
      implicitRequirements,
      planPreview
    };
  }

  /**
   * After a clarification is answered, record to MEMORY.md so this ambiguity
   * resolves automatically next time. Extends Boundary Learning.
   */
  public async recordClarificationResolution(
    originalMessage: string,
    hypothesis: GoalHypothesis,
    modelProvider: any
  ): Promise<void> {
    console.log(`[GoalInference - ${this.agentId}] Recording clarification resolution to MEMORY.md`);
    const dateStr = new Date().toISOString().split("T")[0];
    const fact = `- [source: goal-clarification, date-added: ${dateStr}] When user says "${originalMessage.slice(0, 100)}", they typically mean: "${hypothesis.statement}" (success: "${hypothesis.successCondition}")`;
    
    const memoryPath = join(this.agentDir, "MEMORY.md");
    await runIntelligentFileCompaction(memoryPath, fact, 2500, modelProvider, this.agentId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async generateHypotheses(
    message: string,
    history: Array<{ role: string; content: string }>,
    userMd: string,
    memoryMd: string,
    modelProvider: any
  ): Promise<GoalHypothesis[]> {
    const recentContext = history.slice(-6).map(h => `[${h.role}]: ${h.content || ""}`).join("\n");

    const systemPrompt = `You are the Komorebi Omoi Goal Inference Engine.
Given a user message and context, generate 2-4 distinct goal interpretations.
Each interpretation must be genuinely different — not just paraphrase variants.

Context files available:
USER.md: ${userMd.slice(0, 800)}

MEMORY.md (recent precedents): ${memoryMd.slice(0, 600)}

Recent conversation:
${recentContext}

Return a JSON array of GoalHypothesis objects. Each must have:
- statement: clear natural-language goal statement
- successCondition: independently verifiable state that confirms completion
- confidence: 0.0-1.0 float — derived from message clarity, context fit, memory precedents
- supportingEvidence: string array of reasons this interpretation is valid

Score confidence based on:
- Literal message specificity (+0.4 if explicit)
- Context/history alignment (+0.2 if aligns with recent turns)
- USER.md stated preferences (+0.15 if matches known user pattern)
- MEMORY.md similar past resolution (+0.25 if precedent exists)
- Plausibility given agent tools available (+0.1 if clearly achievable)

Return ONLY valid JSON array. No markdown.`;

    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: `User message: "${message}"` }],
        [],
        undefined,
        { maxInputTokens: 3000, maxOutputTokens: 1200 }
      );

      const content = res.content || "";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter(h => h.statement && h.successCondition && typeof h.confidence === "number")
                       .slice(0, 4);
        }
      }
    } catch (err: any) {
      console.warn(`[GoalInference - ${this.agentId}] Hypothesis generation failed:`, err.message);
    }

    // Fallback: single literal hypothesis
    return [{
      statement: message,
      successCondition: "User's request has been completed as stated",
      confidence: 0.6,
      supportingEvidence: ["Literal message content"]
    }];
  }

  private async inferImplicitRequirements(
    hypothesis: GoalHypothesis,
    message: string,
    userMd: string,
    memoryMd: string,
    modelProvider: any
  ): Promise<ImplicitRequirement[]> {
    const systemPrompt = `You are the Komorebi Omoi Implicit Requirements Inferrer.
A competent human assistant would assume certain unstated requirements are implied.
Identify 1-4 REASONABLE implicit requirements for this goal — things a thoughtful person would assume without being told.

NEVER infer security/safety boundary exceptions. Only infer positive quality/style/defaults.
Categories: quality (format, detail level), safety (reversibility preference), style (tone, coding style from past), default-param (unstated parameters that have obvious defaults).

Return JSON array of objects with: category, description, source (one of: "user.md", "memory.md", "heuristic")
Return ONLY valid JSON array. No markdown.`;

    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: `Goal: "${hypothesis.statement}"\n\nUSER.md snippet: ${userMd.slice(0, 500)}\n\nMEMORY.md snippet: ${memoryMd.slice(0, 400)}` }],
        [],
        undefined,
        { maxInputTokens: 2000, maxOutputTokens: 500 }
      );

      const content = res.content || "";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, 4);
      }
    } catch {}
    return [];
  }

  private async ambiguityMatters(
    top1: GoalHypothesis,
    top2: GoalHypothesis,
    modelProvider: any
  ): Promise<boolean> {
    const systemPrompt = `Would these two goal interpretations lead to meaningfully different actions or outputs?
Reply with ONLY "YES" or "NO".`;
    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: `Interpretation A: ${top1.statement}\nInterpretation B: ${top2.statement}` }],
        [],
        undefined,
        { maxInputTokens: 500, maxOutputTokens: 10 }
      );
      return (res.content || "").trim().toUpperCase().includes("YES");
    } catch {
      return true; // Err on side of asking
    }
  }

  private async generateClarifyingQuestion(
    top1: GoalHypothesis,
    top2: GoalHypothesis,
    modelProvider: any
  ): Promise<string> {
    const systemPrompt = `You are a precise clarification question generator.
Generate ONE targeted question that differentiates between the two goal interpretations below.
The question must be:
- Specific to the actual difference (never generic like "what do you mean?")
- Phrased naturally for a chat message
- Answerable with a short response

Return ONLY the question string, no explanation.`;

    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: `Interpretation A: ${top1.statement}\nInterpretation B: ${top2.statement}` }],
        [],
        undefined,
        { maxInputTokens: 500, maxOutputTokens: 150 }
      );
      return (res.content || "").trim() || `Do you mean "${top1.statement}" or "${top2.statement}"?`;
    } catch {
      return `Do you mean "${top1.statement}" or "${top2.statement}"?`;
    }
  }

  private buildPlanPreview(
    hypothesis: GoalHypothesis,
    requirements: ImplicitRequirement[]
  ): string {
    let preview = `🎯 Goal inferred: ${hypothesis.statement} (confidence: ${(hypothesis.confidence * 100).toFixed(0)}%)\n`;
    preview += `✅ Done when: ${hypothesis.successCondition}\n`;
    if (requirements.length > 0) {
      preview += "📋 Assuming:\n";
      for (const req of requirements) {
        preview += `  • ${req.description} [from ${req.source}]\n`;
      }
    }
    return preview;
  }

  private isTrivialMessage(message: string): boolean {
    if (!message || message.length < 5) return true;
    if (message.includes("[SYSTEM") || message.includes("Wake Event")) return true;
    const trivialPatterns = [/^(yes|no|ok|okay|sure|thanks|thank you|got it|done)\.?$/i];
    return trivialPatterns.some(p => p.test(message.trim()));
  }

  private loadAgentFile(filename: string): string {
    const paths = [
      join(this.agentDir, filename.toUpperCase()),
      join(this.agentDir, filename.toLowerCase()),
      join(this.workspacePath, filename.toUpperCase()),
      join(this.workspacePath, filename.toLowerCase()),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        try { return readFileSync(p, "utf-8"); } catch {}
      }
    }
    return "";
  }
}

// ─── Creative Problem-Solving Framework ──────────────────────────────────────

export class CreativeSolver {
  constructor(
    private readonly agentId: string,
    private readonly workspacePath: string
  ) {}

  /**
   * Triggered when a subtask has failed AMBIGUITY_FAILURE_THRESHOLD times
   * or when the initial approach is immediately blocked.
   * Generates, ranks, and returns up to MAX_CREATIVE_ALTERNATIVES strategies.
   */
  public async generateStrategies(
    failedApproach: string,
    failureReason: string,
    successCondition: string,
    availableTools: string[],
    modelProvider: any
  ): Promise<CreativeStrategy[]> {
    console.log(`[CreativeSolver - ${this.agentId}] Generating creative alternatives for failed approach: ${failedApproach}`);

    const systemPrompt = `You are the Komorebi Omoi Creative Problem Solver.
The direct approach to achieve a goal has failed. Generate ${MAX_CREATIVE_ALTERNATIVES} genuinely DIFFERENT strategies.

"Different" means: different tools, different data sources, different approaches (not parameter variations of the same approach).
Think laterally: can the goal be achieved via a completely different path?

Examples of genuinely different strategies:
- Direct API → Web scraping fallback → Ask another agent via bus → Synthesize from memory
- Write file → Pipe to stdout → Use a different format entirely
- CLI tool → Python script → Node.js code → REST API

The failed approach: "${failedApproach}"
Reason it failed: "${failureReason}"
Goal success condition: "${successCondition}"
Available tools: ${availableTools.slice(0, 20).join(", ")}

Return JSON array of strategy objects with:
- id: "strategy_1" | "strategy_2" | "strategy_3"
- name: short identifier
- description: what this strategy does differently
- toolsApproach: which tools/approaches this uses
- estimatedSuccessLikelihood: 0.0-1.0 based on tool availability and feasibility
- resourceCost: "low" | "medium" | "high"
- reversible: boolean

Rank by: reversible=true > estimatedSuccessLikelihood > low resourceCost
Return ONLY valid JSON array.`;

    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: "Generate creative alternative strategies." }],
        [],
        undefined,
        { maxInputTokens: 2000, maxOutputTokens: 1000 }
      );

      const content = res.content || "";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) {
          // Sort: reversible first, then by likelihood
          return parsed
            .filter(s => s.id && s.description)
            .sort((a, b) => {
              if (a.reversible && !b.reversible) return -1;
              if (!a.reversible && b.reversible) return 1;
              return (b.estimatedSuccessLikelihood ?? 0) - (a.estimatedSuccessLikelihood ?? 0);
            })
            .slice(0, MAX_CREATIVE_ALTERNATIVES);
        }
      }
    } catch (err: any) {
      console.error(`[CreativeSolver - ${this.agentId}] Strategy generation failed:`, err.message);
    }

    return [];
  }

  /**
   * Execute strategies in ranked order, calling the ReAct loop for each.
   * Returns as soon as one succeeds. Updates Reflection Module on success.
   */
  public async tryStrategies(
    strategies: CreativeStrategy[],
    originalGoal: string,
    failedApproach: string,
    executeReActLoopFn: (prompt: string) => Promise<string>,
    verifySuccessFn: (condition: string) => Promise<boolean>,
    successCondition: string,
    modelProvider: any,
    memoryStack: any
  ): Promise<{ succeeded: boolean; successfulStrategy: CreativeStrategy | null; reply: string }> {
    for (const strategy of strategies) {
      console.log(`[CreativeSolver - ${this.agentId}] Trying creative strategy: "${strategy.name}" — ${strategy.description}`);

      try {
        const strategyPrompt = `Creative strategy attempt: ${strategy.name}
Approach: ${strategy.description}
Tools/approach to use: ${strategy.toolsApproach}
Goal: ${originalGoal}
Success condition: ${successCondition}

The previous approach "${failedApproach}" failed. Use this DIFFERENT approach now.`;

        const reply = await executeReActLoopFn(strategyPrompt);
        const verified = await verifySuccessFn(successCondition);

        if (verified) {
          console.log(`[CreativeSolver - ${this.agentId}] ✅ Creative strategy SUCCEEDED: "${strategy.name}"`);

          // HIGH-VALUE Reflection trigger: extract as learned skill immediately
          await this.extractCreativeInsightAsSkill(
            failedApproach,
            strategy,
            originalGoal,
            modelProvider,
            memoryStack
          );

          return { succeeded: true, successfulStrategy: strategy, reply };
        }
      } catch (err: any) {
        console.warn(`[CreativeSolver - ${this.agentId}] Strategy "${strategy.name}" failed:`, err.message);
      }
    }

    return { succeeded: false, successfulStrategy: null, reply: "" };
  }

  /**
   * When a creative alternative succeeds where the obvious approach failed,
   * extract it as a learned skill with explicit "when X fails, try Y" framing.
   */
  private async extractCreativeInsightAsSkill(
    failedApproach: string,
    successfulStrategy: CreativeStrategy,
    goal: string,
    modelProvider: any,
    memoryStack: any
  ): Promise<void> {
    console.log(`[CreativeSolver - ${this.agentId}] Extracting creative insight as learned skill...`);

    const trace = {
      userQuery: `Achieve: ${goal}`,
      toolCalls: [{
        name: "creative_solver",
        arguments: { approach: successfulStrategy.toolsApproach },
        output: `Successfully achieved goal via creative strategy: ${successfulStrategy.description}`,
        isError: false
      }],
      finalResponse: `When the obvious approach "${failedApproach}" is blocked, use "${successfulStrategy.name}": ${successfulStrategy.description}`,
      correction: `Direct approach failed: ${failedApproach}. Creative solution: ${successfulStrategy.name}`,
      agentId: this.agentId,
      sessionId: "creative-solver",
      workspacePath: this.workspacePath
    };

    try {
      await runReflectionExtraction(trace, modelProvider, memoryStack);
    } catch (err: any) {
      console.warn(`[CreativeSolver - ${this.agentId}] Skill extraction failed:`, err.message);
    }
  }
}

// ─── Correctness Bar (Post-Completion Self-Review) ────────────────────────────

export class CorrectnessBar {
  constructor(private readonly agentId: string) {}

  /**
   * After all subtasks are VERIFIED individually, run one cheap-model pass
   * to check if the aggregate result matches original intent.
   */
  public async postCompletionReview(
    originalRequest: string,
    deliveredSummary: string,
    inferredGoal: GoalHypothesis,
    modelProvider: any
  ): Promise<PostCompletionReview> {
    console.log(`[CorrectnessBar - ${this.agentId}] Running post-completion self-review...`);

    const systemPrompt = `You are the Komorebi Omoi Correctness Auditor.
Review the original user request versus what was actually delivered.
Each individual piece may have been verified, but does the WHOLE thing match original intent?

Answer:
1. Is there a gap between what was likely intended and what was delivered? 
2. If yes, describe the gap in ONE sentence.
3. Provide a more specific goal statement for just the gap (if any).

Return JSON: { "gapDetected": boolean, "gapDescription": string|null, "refinedGoal": string|null }
Return ONLY valid JSON. No markdown.`;

    try {
      const res = await modelProvider.generate(
        systemPrompt,
        [{ role: "user", content: `Original request: "${originalRequest}"\n\nInferred goal: "${inferredGoal.statement}"\n\nWhat was delivered: "${deliveredSummary.slice(0, 800)}"` }],
        [],
        undefined,
        { maxInputTokens: 1500, maxOutputTokens: 300 }
      );

      const content = res.content || "";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          gapDetected: !!parsed.gapDetected,
          gapDescription: parsed.gapDescription || null,
          refinedGoal: parsed.refinedGoal || null
        };
      }
    } catch (err: any) {
      console.warn(`[CorrectnessBar - ${this.agentId}] Self-review failed:`, err.message);
    }

    return { gapDetected: false, gapDescription: null, refinedGoal: null };
  }
}

// ─── Goal Accuracy Tracker ────────────────────────────────────────────────────

export class GoalAccuracyTracker {
  private readonly logPath: string;
  private readonly statsPath: string;

  constructor(private readonly agentId: string) {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    const metricsDir = join(agentDir, "metrics");
    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }
    this.logPath   = join(metricsDir, "goal-accuracy.jsonl");
    this.statsPath = join(metricsDir, "goal-accuracy-stats.json");
  }

  /** Called when a task is marked done. */
  public recordTaskCompletion(
    taskId: string,
    originalRequest: string,
    chosenHypothesis: string
  ): void {
    const record: GoalAccuracyRecord = {
      agentId: this.agentId,
      taskId,
      timestamp: Date.now(),
      originalRequest,
      chosenHypothesis,
      hadFollowUpCorrection: false
    };
    this.appendRecord(record);
  }

  /** Called if the user's next message is a correction of the previous response. */
  public recordCorrection(taskId: string, correctiveMessage: string): void {
    // Update the last record for this taskId
    const records = this.loadAllRecords();
    // findLastIndex is ES2023; use a manual reverse loop for compatibility
    let idx = -1;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].taskId === taskId) { idx = i; break; }
    }
    if (idx !== -1) {
      records[idx].hadFollowUpCorrection = true;
      records[idx].correctiveMessage = correctiveMessage;
      this.writeAllRecords(records);
    }
    this.recomputeStats(records);
  }

  /** Get current rolling accuracy stats. */
  public getStats(): GoalAccuracyStats {
    if (existsSync(this.statsPath)) {
      try {
        return JSON.parse(readFileSync(this.statsPath, "utf-8"));
      } catch {}
    }
    return { totalTasks: 0, correctedTasks: 0, accuracyRate: 1.0, recentTrend: [] };
  }

  private appendRecord(record: GoalAccuracyRecord): void {
    try {
      appendFileSync(this.logPath, JSON.stringify(record) + "\n", "utf-8");
    } catch {}
    const all = this.loadAllRecords();
    this.recomputeStats(all);
  }

  private loadAllRecords(): GoalAccuracyRecord[] {
    if (!existsSync(this.logPath)) return [];
    try {
      return readFileSync(this.logPath, "utf-8")
        .trim().split("\n")
        .filter(Boolean)
        .map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  private writeAllRecords(records: GoalAccuracyRecord[]): void {
    try {
      writeFileSync(this.logPath, records.map(r => JSON.stringify(r)).join("\n") + "\n", "utf-8");
    } catch {}
  }

  private recomputeStats(records: GoalAccuracyRecord[]): void {
    const total = records.length;
    const corrected = records.filter(r => r.hadFollowUpCorrection).length;
    const accuracyRate = total === 0 ? 1.0 : (total - corrected) / total;
    const recentTrend = records.slice(-20).map(r => r.hadFollowUpCorrection ? 0 : 1);
    const stats: GoalAccuracyStats = { totalTasks: total, correctedTasks: corrected, accuracyRate, recentTrend };
    try {
      writeFileSync(this.statsPath, JSON.stringify(stats, null, 2), "utf-8");
    } catch {}
  }
}

// ─── Creative Log (per-agent history of creative wins) ───────────────────────

export interface CreativeWin {
  timestamp: number;
  goal: string;
  failedApproach: string;
  successfulStrategy: string;
  strategyDescription: string;
  skillExtracted: boolean;
}

export function recordCreativeWin(agentId: string, win: CreativeWin): void {
  const agentDir = join(homedir(), ".komorebi", "agents", agentId);
  const metricsDir = join(agentDir, "metrics");
  if (!existsSync(metricsDir)) {
    mkdirSync(metricsDir, { recursive: true });
  }
  const logPath = join(metricsDir, "creative-wins.jsonl");
  try {
    appendFileSync(logPath, JSON.stringify(win) + "\n", "utf-8");
  } catch {}
}

export function loadCreativeLog(agentId: string): CreativeWin[] {
  const logPath = join(homedir(), ".komorebi", "agents", agentId, "metrics", "creative-wins.jsonl");
  if (!existsSync(logPath)) return [];
  try {
    return readFileSync(logPath, "utf-8")
      .trim().split("\n")
      .filter(Boolean)
      .map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

// ─── Turn-Level State for the Goal Layer ─────────────────────────────────────

export interface GoalLayerTurnState {
  taskId: string;
  originalMessage: string;
  inferenceResult: GoalInferenceResult | null;
  creativeAttempts: number;
  completedAt: number | null;
}

/** Singleton per-session store for current turn's goal state */
const turnStateMap = new Map<string, GoalLayerTurnState>();

export function initGoalTurnState(sessionId: string, message: string): GoalLayerTurnState {
  const state: GoalLayerTurnState = {
    taskId: `${sessionId}-${Date.now()}`,
    originalMessage: message,
    inferenceResult: null,
    creativeAttempts: 0,
    completedAt: null
  };
  turnStateMap.set(sessionId, state);
  return state;
}

export function getGoalTurnState(sessionId: string): GoalLayerTurnState | undefined {
  return turnStateMap.get(sessionId);
}

export function clearGoalTurnState(sessionId: string): void {
  turnStateMap.delete(sessionId);
}
