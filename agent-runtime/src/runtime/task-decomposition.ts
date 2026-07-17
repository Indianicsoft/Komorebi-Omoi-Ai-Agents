import { ChatMessage, ToolDefinition, ToolCall, ToolResult, ModelResponse, WakeEvent } from "../types.js";
import { ModelProvider } from "../providers/index.js";
import { pluginHooksRegistry } from "./agent-hooks/hooks.js";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { CreativeSolver, CorrectnessBar, GoalAccuracyTracker, recordCreativeWin, GoalHypothesis } from "./goal-inference.js";

export interface SubTask {
  id: string;
  description: string;
  successCondition: string;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
}

export interface TaskTree {
  goal: string;
  subtasks: SubTask[];
}

export class DecompositionPlanner {
  public static async classifyTask(message: string, modelProvider: ModelProvider): Promise<boolean> {
    // Avoid classifying system-triggered wake events or simple tasks
    if (message.includes("Wake Event") || message.includes("[SYSTEM") || message.length < 15) {
      return false;
    }

    const systemPrompt = `You are a request complexity classifier. 
Determine if the user's message is a complex, ambiguous, or multi-step goal (needs multiple sub-actions or planner tasks) or a simple/direct request.
Reply with exactly "COMPLEX" or "SIMPLE".`;

    try {
      const res = await modelProvider.generate(systemPrompt, [{ role: "user", content: message }], []);
      const text = (res.content || "").trim().toUpperCase();
      return text.includes("COMPLEX");
    } catch {
      return false; // Fallback to simple react loop on failure
    }
  }

  public static async decomposeTask(message: string, modelProvider: ModelProvider): Promise<TaskTree> {
    const systemPrompt = `You are the Komorebi Omoi Decomposition Planner.
Decompose the user's goal into a logical sequence of sub-tasks in dependency order.
For each sub-task, provide a clear, independently verifiable success condition.
Return the output as a valid JSON object matching this schema:
{
  "goal": "Original user goal",
  "subtasks": [
    {
      "id": "task_1",
      "description": "Short description of what to do",
      "successCondition": "Verifiable real-world state description (e.g. file index.js exists)",
      "dependencies": []
    }
  ]
}`;

    const res = await modelProvider.generate(systemPrompt, [{ role: "user", content: message }], []);
    try {
      const content = res.content || "";
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      // Fallback simple task tree
      return {
        goal: message,
        subtasks: [
          {
            id: "task_1",
            description: `Execute: ${message}`,
            successCondition: "Observable output conforms to user requirements",
            dependencies: [],
            status: "pending",
            attempts: 0
          }
        ]
      };
    }
  }

  public static async verifySuccess(
    subtask: SubTask,
    agentId: string,
    modelProvider: ModelProvider,
    executeReActLoopFn: (prompt: string) => Promise<string>
  ): Promise<boolean> {
    console.log(`[Decomposition] Verifying success of task '${subtask.id}': ${subtask.successCondition}`);
    
    // 1. Programmatic state checks
    if (subtask.successCondition.toLowerCase().includes("file") && subtask.successCondition.toLowerCase().includes("exists")) {
      const fileMatch = subtask.successCondition.match(/(?:file\s+)?([\w\-./\\]+\.\w+)/i);
      if (fileMatch) {
        // Simple heuristic check if file exists
        const path = fileMatch[1];
        if (existsSync(path)) return true;
      }
    }

    // 2. Ask model validator to evaluate against actual tools or outputs
    const verificationPrompt = `Verify if the success condition is met: "${subtask.successCondition}". 
Please run any checks needed and output exactly "VERIFIED" or "FAILED".`;
    
    try {
      const output = await executeReActLoopFn(verificationPrompt);
      return output.toUpperCase().includes("VERIFIED");
    } catch {
      return false;
    }
  }
}

export class DecompositionExecutor {
  private depth = 0;
  private totalAttempts = 0;

  constructor(depth = 0, totalAttempts = 0) {
    this.depth = depth;
    this.totalAttempts = totalAttempts;
  }

  /**
   * Verify a success condition against real state (used by CreativeSolver).
   */
  public static async verifyCondition(
    condition: string,
    executeReActLoopFn: (prompt: string) => Promise<string>
  ): Promise<boolean> {
    const verificationPrompt = `Verify if the success condition is met: "${condition}". Please check and output exactly "VERIFIED" or "FAILED".`;
    try {
      const output = await executeReActLoopFn(verificationPrompt);
      return output.toUpperCase().includes("VERIFIED");
    } catch {
      return false;
    }
  }

  public async executePlan(
    wakeEvent: WakeEvent,
    sessionState: any,
    reportProgress: (event: any) => Promise<void>,
    executeReActLoopFn: (prompt: string) => Promise<string>,
    taskTree: TaskTree
  ): Promise<string> {
    const subtasks = taskTree.subtasks.map(s => ({
      ...s,
      status: s.status || "pending",
      attempts: s.attempts || 0
    })) as SubTask[];

    console.log(`[Decomposition] Executing plan with ${subtasks.length} subtasks at depth ${this.depth}`);

    // Cache current plan on wsServer if available
    try {
      await sessionState.rpcRequest("cacheAgentPlan", {
        agentId: sessionState.agentId,
        plan: { goal: taskTree.goal, subtasks }
      });
    } catch {}

    // Main sequential execution loop
    while (subtasks.some(s => s.status !== "completed" && s.status !== "failed")) {
      // Find next task where all dependencies are completed
      const nextTask = subtasks.find(s => 
        s.status === "pending" && 
        s.dependencies.every(depId => subtasks.find(t => t.id === depId)?.status === "completed")
      );

      if (!nextTask) {
        // If there's a dependency cycle or dead-end, fail remainder
        subtasks.forEach(s => { if (s.status === "pending") s.status = "failed"; });
        break;
      }

      nextTask.status = "running";
      nextTask.attempts++;
      this.totalAttempts++;

      // Update progress draft
      await this.reportPlanProgress(taskTree.goal, subtasks, reportProgress);

      console.log(`[Decomposition] Starting subtask: ${nextTask.description}`);
      sessionState.memoryStack.appendDailyLog(`[TaskDecomposition] Depth ${this.depth} - Executing subtask: ${nextTask.description}`);

      try {
        const subtaskPrompt = `Task goal: ${nextTask.description}\nSuccess verification criteria: ${nextTask.successCondition}`;
        await executeReActLoopFn(subtaskPrompt);

        // Verification check
        const verified = await DecompositionPlanner.verifySuccess(
          nextTask,
          sessionState.agentId,
          sessionState.modelProvider,
          executeReActLoopFn
        );

        if (verified) {
          nextTask.status = "completed";
          console.log(`[Decomposition] Subtask completed and VERIFIED: ${nextTask.id}`);
          sessionState.memoryStack.appendDailyLog(`[TaskDecomposition] Subtask completed and VERIFIED: ${nextTask.id}`);
        } else {
          throw new Error(`Success condition verification failed: ${nextTask.successCondition}`);
        }
      } catch (err: any) {
        console.error(`[Decomposition] Subtask '${nextTask.id}' failed (Attempt ${nextTask.attempts}):`, err.message);
        sessionState.memoryStack.appendDailyLog(`[TaskDecomposition] Subtask failed: ${err.message}`);

        // Creative Solver: triggered on 2+ failures for same subtask (or immediate block)
        const isImmediateBlock = err.message.toLowerCase().includes("blocked") ||
          err.message.toLowerCase().includes("permission denied") ||
          err.message.toLowerCase().includes("not found") ||
          err.message.toLowerCase().includes("unavailable");
        const shouldTryCreative = nextTask.attempts >= 2 || isImmediateBlock;

        if (shouldTryCreative && this.depth < 4 && this.totalAttempts < 20) {
          console.log(`[Decomposition] [CREATIVE] Activating Creative Problem Solver for subtask: ${nextTask.description}`);
          const creativeSolver = new CreativeSolver(sessionState.agentId, sessionState.workspacePath);
          const availableTools = (sessionState.toolRegistry?.getDefinitions?.() || []).map((t: any) => t.name);

          const strategies = await creativeSolver.generateStrategies(
            nextTask.description,
            err.message,
            nextTask.successCondition,
            availableTools,
            sessionState.modelProvider
          );

          if (strategies.length > 0) {
            await reportProgress({
              type: "thinking",
              detail: `🧩 Creative solver activated — trying ${strategies.length} alternative strategies...`
            });

            const creativeResult = await creativeSolver.tryStrategies(
              strategies,
              nextTask.description,
              nextTask.description,
              executeReActLoopFn,
              async (condition: string) => DecompositionExecutor.verifyCondition(condition, executeReActLoopFn),
              nextTask.successCondition,
              sessionState.modelProvider,
              sessionState.memoryStack
            );

            if (creativeResult.succeeded && creativeResult.successfulStrategy) {
              nextTask.status = "completed";
              // Log creative win
              recordCreativeWin(sessionState.agentId, {
                timestamp: Date.now(),
                goal: taskTree.goal,
                failedApproach: nextTask.description,
                successfulStrategy: creativeResult.successfulStrategy.name,
                strategyDescription: creativeResult.successfulStrategy.description,
                skillExtracted: true
              });
              console.log(`[Decomposition] [CREATIVE] Subtask resolved via creative strategy: ${creativeResult.successfulStrategy.name}`);
            } else {
              // Creative alternatives exhausted → fall through to ADAPT recursive decomp
              if (this.depth < 4 && this.totalAttempts < 20) {
                console.log(`[Decomposition] [ADAPT] Creative failed. Recursively decomposing: ${nextTask.description}`);
                try {
                  const nestedTree = await DecompositionPlanner.decomposeTask(
                    `Resolve this failed subtask: ${nextTask.description}. Reason for failure: ${err.message}`,
                    sessionState.modelProvider
                  );
                  const subExecutor = new DecompositionExecutor(this.depth + 1, this.totalAttempts);
                  await subExecutor.executePlan(wakeEvent, sessionState, reportProgress, executeReActLoopFn, nestedTree);
                  this.totalAttempts = subExecutor.totalAttempts;
                  nextTask.status = "completed";
                } catch {
                  nextTask.status = "failed";
                }
              } else {
                nextTask.status = "failed";
              }
            }
          } else {
            // No creative strategies generated → direct ADAPT
            if (this.depth < 4 && this.totalAttempts < 20) {
              try {
                const nestedTree = await DecompositionPlanner.decomposeTask(
                  `Resolve this failed subtask: ${nextTask.description}. Reason for failure: ${err.message}`,
                  sessionState.modelProvider
                );
                const subExecutor = new DecompositionExecutor(this.depth + 1, this.totalAttempts);
                await subExecutor.executePlan(wakeEvent, sessionState, reportProgress, executeReActLoopFn, nestedTree);
                this.totalAttempts = subExecutor.totalAttempts;
                nextTask.status = "completed";
              } catch {
                nextTask.status = "failed";
              }
            } else {
              nextTask.status = "failed";
            }
          }
        } else if (this.depth < 4 && this.totalAttempts < 20) {
          // Standard ADAPT recursive recovery (first failure, non-blocked)
          console.log(`[Decomposition] [ADAPT] Recursively decomposing failed subtask: ${nextTask.description}`);
          try {
            const nestedTree = await DecompositionPlanner.decomposeTask(
              `Resolve this failed subtask: ${nextTask.description}. Reason for failure: ${err.message}`,
              sessionState.modelProvider
            );
            const subExecutor = new DecompositionExecutor(this.depth + 1, this.totalAttempts);
            await subExecutor.executePlan(wakeEvent, sessionState, reportProgress, executeReActLoopFn, nestedTree);
            this.totalAttempts = subExecutor.totalAttempts;
            nextTask.status = "completed";
            console.log(`[Decomposition] [ADAPT] Subtask recovered and resolved at nested depth.`);
          } catch {
            nextTask.status = "failed";
          }
        } else {
          nextTask.status = "failed";
        }
      }

      // Sync plan cache
      try {
        await sessionState.rpcRequest("cacheAgentPlan", {
          agentId: sessionState.agentId,
          plan: { goal: taskTree.goal, subtasks }
        });
      } catch {}

      await this.reportPlanProgress(taskTree.goal, subtasks, reportProgress);
    }

    const failed = subtasks.some(s => s.status === "failed");
    if (failed) {
      throw new Error(`Failed to complete all planned subtasks. Task execution aborted.`);
    }

    const summary = `All planned subtasks successfully resolved for: ${taskTree.goal}`;

    // Post-Completion Self-Review (Correctness Bar)
    try {
      const correctnessBar = new CorrectnessBar(sessionState.agentId);
      const review = await correctnessBar.postCompletionReview(
        taskTree.goal,
        summary,
        { statement: taskTree.goal, successCondition: "All subtasks complete", confidence: 1.0, supportingEvidence: [] },
        sessionState.modelProvider
      );

      if (review.gapDetected && review.refinedGoal) {
        console.log(`[Decomposition] [CORRECTNESS] Gap detected: ${review.gapDescription}. Looping for gap: ${review.refinedGoal}`);
        sessionState.memoryStack.appendDailyLog(`[CorrectnessBar] Gap detected after completion: ${review.gapDescription}`);

        await reportProgress({
          type: "thinking",
          detail: `🔍 Self-review found a gap: ${review.gapDescription}\nResolving: ${review.refinedGoal}`
        });

        // Execute gap as a new mini-plan (don't redo already-correct work)
        const gapTree = await DecompositionPlanner.decomposeTask(review.refinedGoal, sessionState.modelProvider);
        const gapExecutor = new DecompositionExecutor(this.depth + 1, this.totalAttempts);
        await gapExecutor.executePlan(wakeEvent, sessionState, reportProgress, executeReActLoopFn, gapTree);
        return `${summary}\n\n✅ Gap resolved: ${review.gapDescription}`;
      }
    } catch (reviewErr: any) {
      console.warn(`[CorrectnessBar] Self-review failed:`, reviewErr.message);
    }

    return summary;
  }

  private async reportPlanProgress(
    goal: string,
    subtasks: SubTask[],
    reportProgress: (event: any) => Promise<void>
  ) {
    const completedCount = subtasks.filter(s => s.status === "completed").length;
    const totalCount = subtasks.length;
    
    let draft = `📋 Plan: ${totalCount} steps [${completedCount}/${totalCount}]\n`;
    for (const s of subtasks) {
      const marker = s.status === "completed" ? "✅" : s.status === "running" ? "⏳" : s.status === "failed" ? "❌" : "◽";
      draft += `${marker} ${s.description}\n`;
    }

    await reportProgress({
      type: "plan_progress",
      detail: draft,
      plan: { goal, subtasks }
    });
  }
}
