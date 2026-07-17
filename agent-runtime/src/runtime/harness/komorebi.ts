import { ChatMessage, ToolDefinition, ToolCall, ToolResult, ModelResponse, WakeEvent } from "../../types.js";
import { ModelProvider } from "../../providers/index.js";
import { ToolRegistry } from "../../registry.js";
import { PromptAssembler } from "../../prompt.js";
import { MemoryStack } from "../../memory-stack.js";
import { FinishedTurn } from "../../context-engine/index.js";
import { pluginHooksRegistry } from "../agent-hooks/hooks.js";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { ProactivityManager } from "../proactivity.js";
import { DecompositionPlanner, DecompositionExecutor } from "../task-decomposition.js";
import {
  GoalInferenceEngine,
  GoalAccuracyTracker,
  initGoalTurnState,
  getGoalTurnState,
  clearGoalTurnState
} from "../goal-inference.js";

export interface LoopState {
  iterationCount: number;
  startTime: number;
  elapsedTime: number;
  pendingToolCalls: ToolCall[];
}

export class KomorebiHarness {
  private activeLoops = new Map<string, LoopState>();

  public getLoopState(sessionId: string): LoopState {
    const loop = this.activeLoops.get(sessionId);
    if (loop) {
      return {
        ...loop,
        elapsedTime: Math.floor((Date.now() - loop.startTime) / 1000),
      };
    }
    return { iterationCount: 0, startTime: 0, elapsedTime: 0, pendingToolCalls: [] };
  }

  public async runTurn(
    wakeEvent: WakeEvent,
    sessionState: any,
    reportProgress: (event: any) => Promise<void>
  ): Promise<FinishedTurn> {
    const { sessionId, type, payload } = wakeEvent;
    const startTime = Date.now();
    const loopState: LoopState = {
      iterationCount: 0,
      startTime,
      elapsedTime: 0,
      pendingToolCalls: [],
    };
    this.activeLoops.set(sessionId, loopState);

    const toolTrace: any[] = [];
    const compactionEvents: any[] = [];

    let messageText = payload.message || "";
    let resolvedMode = "unknown";
    try {
      const baseUrl = sessionState.gatewayUrl.replace(/^ws/, "http").replace(/\/ws(\?.*)?$/, "");
      const res = await fetch(`${baseUrl}/api/agents/${sessionState.agentId}/context?token=${sessionState.gatewayToken}`);
      if (res.ok) {
        const contextData = await res.json() as any;
        resolvedMode = contextData.resolvedMode || "unknown";
        console.log(`[Harness] Resolved situational context for agent ${sessionState.agentId}: ${resolvedMode}`);
      }
    } catch (err: any) {
      console.warn("[Harness] Failed to fetch situational context:", err.message);
    }

    if (resolvedMode === "mobile-brief") {
      messageText = `[SYSTEM NOTE: User is currently mobile/walking/driving. Keep all outputs/responses extremely concise, brief, and bulleted if possible. Focus on essential details only.]\n` + messageText;
    } else if (resolvedMode === "do-not-disturb") {
      messageText = `[SYSTEM NOTE: User is in Do Not Disturb mode. Only alert if critically urgent.]\n` + messageText;
    }

    if (type === "heartbeat") {
      messageText = `[SYSTEM: Wake Event - Heartbeat tick]\nYou have been activated by your heartbeat tick (cadence: ${payload.cadence || "default"}). Check your HEARTBEAT.md and proactivity logs. Identify if there are any proactive tasks due or opportunities to suggest. Output actions/suggestions if appropriate, or respond with quiet status details if nothing is due.`;
    } else if (type === "cron") {
      messageText = `[SYSTEM: Wake Event - Scheduled Cron Job fired]\nCron expression: ${payload.cronExpression || "unknown"}. Execute your scheduled cron task and report results. Trigger prompt detail: ${payload.message || "none"}`;
    } else if (type === "hook") {
      messageText = `[SYSTEM: Wake Event - Plugin Hook Event fired]\nHook name: ${payload.hookName || "unknown"}. Data: ${JSON.stringify(payload.hookData || {})}. Assess the event and perform any required actions.`;
    } else if (type === "webhook") {
      messageText = `[SYSTEM: Wake Event - External Webhook received]\nPayload: ${JSON.stringify(payload.body || {})}. Process this request and generate appropriate responses.`;
    }

    const agentDir = join(homedir(), ".komorebi", "agents", sessionState.agentId);
    const proactivity = new ProactivityManager(sessionState.agentId, agentDir);
    const isProactive = type !== "message" && type !== "cron";
    const approachesTried: string[] = [];

    let mediaParts: any[] | undefined = undefined;
    try {
      if (wakeEvent.payload.envelope && wakeEvent.payload.envelope.attachments && wakeEvent.payload.envelope.attachments.length > 0) {
        const { understandMedia } = await import("../../perception.js");
        mediaParts = [];
        for (const attachment of wakeEvent.payload.envelope.attachments) {
          const result = await understandMedia(
            attachment,
            sessionState.agentConfig,
            undefined,
            sessionState.toolRegistry,
            sessionState.modelProvider
          );
          if (result.provider === "native" && result.nativePart) {
            mediaParts.push(result.nativePart);
            messageText += `\n[Natively attached media: ${attachment.type} - ${attachment.fileName || "media"}]`;
          } else {
            if (result.extractedText) {
              messageText += `\n[Media Content Extracted (${attachment.type}): ${result.extractedText}]`;
            }
            if (result.description) {
              messageText += `\n[Media Description (${attachment.type}): ${result.description}]`;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`[Harness] Error processing attachments:`, err.message);
    }

    // ── Goal Inference Layer (runs on user messages only) ────────────────────
    if (type === "message" && messageText && !messageText.startsWith("[SYSTEM")) {
      const inferenceEngine = new GoalInferenceEngine(
        sessionState.agentId,
        sessionState.workspacePath,
        sessionState.agentConfig
      );
      const accuracyTracker = new GoalAccuracyTracker(sessionState.agentId);

      // Build a lightweight history for context
      const recentHistory = (sessionState.conversationHistory || []).slice(-8).map((m: any) => ({
        role: m.role,
        content: m.content || ""
      }));

      try {
        const inferResult = await inferenceEngine.infer(
          messageText,
          recentHistory,
          sessionState.modelProvider
        );

        // Store in turn state for later accuracy tracking
        const turnState = initGoalTurnState(sessionId, messageText);
        turnState.inferenceResult = inferResult;

        // Surface plan preview to Telegram/Dashboard
        if (inferResult.planPreview) {
          await reportProgress({
            type: "thinking",
            detail: inferResult.planPreview,
            goalHypotheses: inferResult.hypotheses,
            loopState: this.getLoopState(sessionId)
          });
        }

        // Clarification gating: if ambiguity matters, return clarifying question
        if (inferResult.clarificationNeeded && inferResult.clarifyingQuestion) {
          console.log(`[Harness] Goal ambiguity detected. Asking targeted clarification.`);
          const finishedTurn: FinishedTurn = {
            reply: inferResult.clarifyingQuestion,
            toolTrace: [],
            tokensUsed: 0,
            compactionEvents: []
          };
          this.activeLoops.delete(sessionId);
          return finishedTurn;
        }

        // Override messageText with clarified goal statement for execution
        if (inferResult.chosen) {
          const implicitReqText = inferResult.implicitRequirements.length > 0
            ? `\n[Implicit requirements inferred: ${inferResult.implicitRequirements.map(r => r.description).join("; ")}]`
            : "";
          messageText = `${messageText}\n\n[Inferred goal: ${inferResult.chosen.statement}]\n[Success condition: ${inferResult.chosen.successCondition}]${implicitReqText}`;
        }

        // Record task start for accuracy tracking
        const taskId = turnState.taskId;
        accuracyTracker.recordTaskCompletion(
          taskId,
          messageText,
          inferResult.chosen?.statement || messageText
        );
      } catch (inferErr: any) {
        console.warn(`[Harness] Goal inference failed, continuing without it:`, inferErr.message);
      }
    }

    // ── INTERCEPT Complex Tasks for Task Decomposition ───────────────────────
    const isComplex = await DecompositionPlanner.classifyTask(messageText, sessionState.modelProvider);
    if (isComplex) {
      console.log(`[Harness] Complex request detected. Routing through Decomposition Planner...`);
      const taskTree = await DecompositionPlanner.decomposeTask(messageText, sessionState.modelProvider);
      const executor = new DecompositionExecutor();
      
      const executeReActLoopFn = async (subtaskPrompt: string) => {
        const subTurnResult = await this.executeReActLoop(
          subtaskPrompt,
          wakeEvent,
          sessionState,
          reportProgress,
          startTime,
          compactionEvents,
          toolTrace,
          loopState,
          proactivity,
          isProactive,
          approachesTried
        );
        return subTurnResult.reply;
      };

      try {
        const finalReply = await executor.executePlan(
          wakeEvent,
          sessionState,
          reportProgress,
          executeReActLoopFn,
          taskTree
        );

        const finishedTurn: FinishedTurn = {
          reply: finalReply,
          toolTrace,
          tokensUsed: Math.ceil(sessionState.estimateContextSize(messageText) / 4),
          compactionEvents
        };

        await reportProgress({
          type: "turn_end",
          tokensUsed: finishedTurn.tokensUsed
        });
        await pluginHooksRegistry.triggerOnAgentRunComplete(sessionId, finishedTurn, sessionState);
        this.activeLoops.delete(sessionId);
        return finishedTurn;
      } catch (err: any) {
        console.error(`[Decomposition] Task execution failed:`, err.message);
        this.activeLoops.delete(sessionId);
        return {
          reply: `⚠️ *Task Failed* ⚠️\n\nReason: ${err.message}`,
          toolTrace,
          tokensUsed: Math.ceil(sessionState.estimateContextSize(messageText) / 4),
          compactionEvents
        };
      }
    }

    // Default Single ReAct Loop for simple messages
    return this.executeReActLoop(
      messageText,
      wakeEvent,
      sessionState,
      reportProgress,
      startTime,
      compactionEvents,
      toolTrace,
      loopState,
      proactivity,
      isProactive,
      approachesTried,
      mediaParts
    );
  }

  public async executeReActLoop(
    messageText: string,
    wakeEvent: WakeEvent,
    sessionState: any,
    reportProgress: (event: any) => Promise<void>,
    startTime: number,
    compactionEvents: any[],
    toolTrace: any[],
    loopState: LoopState,
    proactivity: ProactivityManager,
    isProactive: boolean,
    approachesTried: string[],
    mediaParts?: any[]
  ): Promise<FinishedTurn> {
    const { sessionId } = wakeEvent;
    let lastSystemPrompt = "";

    try {
      const userMsg: ChatMessage = {
        role: "user",
        content: messageText,
        mediaParts: mediaParts && mediaParts.length > 0 ? mediaParts : undefined,
      };
      sessionState.conversationHistory.push(userMsg);
      sessionState.memoryStack.logSessionTurn(userMsg);

      const configuredLimit = sessionState.agentConfig?.toolPolicy?.loopLimit ?? sessionState.agentConfig?.loopLimit;
      const maxIterations = (configuredLimit === 0 || configuredLimit === -1) ? Infinity : (configuredLimit ?? 100);
      const timeoutLimitMs = sessionState.agentConfig?.toolPolicy?.timeoutLimitMs ?? sessionState.agentConfig?.timeoutLimitMs ?? 600000;

      while (loopState.iterationCount < maxIterations && (Date.now() - startTime) < timeoutLimitMs) {
        loopState.elapsedTime = Math.floor((Date.now() - startTime) / 1000);

        const agentDir = join(homedir(), ".komorebi", "agents", sessionState.agentId);
        const mdFiles = ["soul.md", "identity.md", "user.md", "memory.md", "agents.md", "tools.md"];
        const files: Record<string, string> = {};
        for (const file of mdFiles) {
          const filePath = join(agentDir, file);
          if (existsSync(filePath)) {
            files[file] = readFileSync(filePath, "utf-8");
          }
        }
        const workspaceBundle = {
          workspacePath: sessionState.workspacePath,
          agentDir,
          files,
        };

        const basePrompt = sessionState.promptAssembler.assembleSystemPrompt(
          sessionState.workspacePath,
          sessionState.toolRegistry.getDefinitions()
        );
        lastSystemPrompt = basePrompt;
        const assembleContext = {
          systemPrompt: basePrompt,
          history: sessionState.conversationHistory,
          tools: sessionState.toolRegistry.getDefinitions(),
        };

        // Trigger onBeforeAgentRun
        await pluginHooksRegistry.triggerOnBeforeAgentRun(sessionId, messageText, {
          sessionState,
          workspaceBundle,
          context: assembleContext
        });

        // Trigger Context Engine assemble hook to crop/trim history
        const { contextEngine } = await import("../../context-engine/index.js");
        await contextEngine.triggerAssemble(sessionState, workspaceBundle, assembleContext);

        // Compaction checks
        const preGenSize = sessionState.estimateContextSize(assembleContext.systemPrompt);
        const preGenLimit = sessionState.configuredContextLimit;
        if (preGenSize > preGenLimit * 4) {
          console.log(`[KomorebiHarness - ${sessionState.agentId}] ⚡ Pre-generate context: ${preGenSize} chars (>${preGenLimit * 4}). Triggering compaction...`);
          await reportProgress({
            type: "compaction_start",
            detail: `Context size: ${preGenSize} chars, pre-generate compaction...`,
            loopState: this.getLoopState(sessionId)
          });
          await pluginHooksRegistry.triggerOnCompactionTriggered(sessionId, { originalSize: preGenSize }, sessionState);
          const postCompactSize = sessionState.estimateContextSize(assembleContext.systemPrompt);
          compactionEvents.push({
            timestamp: Date.now(),
            originalSize: preGenSize,
            newSize: postCompactSize,
          });
          assembleContext.history = sessionState.conversationHistory;
        }

        const modelRes = await sessionState.modelProvider.generate(
          assembleContext.systemPrompt,
          assembleContext.history,
          assembleContext.tools,
          async (chunk: { text?: string; toolCalls?: any[] }) => {
            if (chunk.text) {
              await reportProgress({
                type: "thinking_stream",
                chunk: chunk.text,
                loopState: this.getLoopState(sessionId)
              });
            }
          },
          {
            maxInputTokens: 15000,
            maxOutputTokens: 4000,
          }
        );

        if (modelRes.content && !modelRes.toolCalls) {
          await reportProgress({
            type: "thinking",
            detail: modelRes.content,
            loopState: this.getLoopState(sessionId)
          });
        }

        if (modelRes.toolCalls && modelRes.toolCalls.length > 0) {
          loopState.pendingToolCalls = modelRes.toolCalls;
          
          const modelMsg: ChatMessage = {
            role: "model",
            content: modelRes.content,
            toolCalls: modelRes.toolCalls,
          };
          sessionState.conversationHistory.push(modelMsg);
          sessionState.memoryStack.logSessionTurn(modelMsg);

          const toolResults: ToolResult[] = [];
          for (const tc of modelRes.toolCalls) {
            await pluginHooksRegistry.triggerOnToolCall(sessionId, tc.name, tc.arguments, sessionState);
            approachesTried.push(`Executing tool: ${tc.name} with arguments ${JSON.stringify(tc.arguments)}`);

            if (isProactive) {
              let domain = "tools";
              if (tc.name === "write_file" || tc.name === "append_file") domain = "files";
              else if (tc.name === "sendTelegramMessage" || tc.name === "agent_message") domain = "telegram-sends";
              
              const actionStr = `${tc.name}(${JSON.stringify(tc.arguments)})`;
              let tier = await proactivity.classifyAction(domain, actionStr, sessionId);

              if (tier === "NEVER") {
                proactivity.logAction(sessionId, domain, actionStr, "NEVER", "BLOCKED");
                throw new Error(`[PROACTIVITY: NEVER] Security boundary violation: Proactive tool execution of '${tc.name}' is prohibited.`);
              }

              if (tier === "UNCLASSIFIED") {
                try {
                  const reply = await sessionState.rpcRequest("requestBoundaryApproval", {
                    agentId: sessionState.agentId,
                    sessionId,
                    chatId: sessionState.envelope?.chatId,
                    threadId: sessionState.envelope?.threadId,
                    action: actionStr,
                    domain,
                    pattern: tc.name + ".*"
                  });
                  const choice = (reply?.choice || "suggest").toUpperCase();
                  proactivity.recordRule(domain, tc.name + ".*", choice);
                  tier = choice as any;
                } catch {
                  tier = "SUGGEST";
                }
              }

              if (tier === "ASK") {
                try {
                  const reply = await sessionState.rpcRequest("requestCommandApproval", {
                    agentId: sessionState.agentId,
                    chatId: sessionState.envelope?.chatId,
                    threadId: sessionState.envelope?.threadId,
                    command: actionStr
                  });
                  if (!reply?.approved) {
                    throw new Error(`[PROACTIVITY: ASK] blocked: rejected by owner.`);
                  }
                } catch (err: any) {
                  throw err;
                }
              }
            }

            await reportProgress({
              type: "tool_start",
              toolCallId: tc.id,
              toolName: tc.name,
              toolArgs: tc.arguments,
              loopState: this.getLoopState(sessionId)
            });

            let output = await sessionState.toolRegistry.execute(tc.name, tc.arguments, {
              agentId: sessionState.agentId,
              sessionId,
              workspacePath: sessionState.workspacePath,
              gatewayUrl: sessionState.gatewayUrl,
              gatewayToken: sessionState.gatewayToken,
              rpcRequest: sessionState.rpcRequest.bind(sessionState),
              memoryStack: sessionState.memoryStack,
              runtime: sessionState.runtime || sessionState,
            });

            const maxChars = 3000;
            if (output.length > maxChars) {
              output = output.slice(0, maxChars) + "\n... [Output truncated] ...";
            }

            const isError = output.toLowerCase().includes("error") || output.includes("[tool execution interrupted]");
            const toolResult: ToolResult = {
              toolCallId: tc.id,
              name: tc.name,
              output,
              isError
            };
            toolResults.push(toolResult);

            toolTrace.push({
              name: tc.name,
              arguments: tc.arguments,
              output,
              isError
            });

            await pluginHooksRegistry.triggerOnAfterToolCall(sessionId, tc.name, tc.arguments, output, {
              sessionState,
              toolResult
            });

            await reportProgress({
              type: "tool_end",
              toolCallId: tc.id,
              toolName: tc.name,
              toolArgs: tc.arguments,
              toolOutput: output,
              loopState: this.getLoopState(sessionId)
            });
          }

          loopState.pendingToolCalls = [];
          const obsMsg: ChatMessage = { role: "user", toolResults };
          sessionState.conversationHistory.push(obsMsg);
          sessionState.memoryStack.logSessionTurn(obsMsg);
          loopState.iterationCount++;
        } else {
          let finalReply = modelRes.content || "Processing completed successfully.";
          const modelMsg: ChatMessage = { role: "model", content: finalReply };
          sessionState.conversationHistory.push(modelMsg);
          sessionState.memoryStack.logSessionTurn(modelMsg);

          const finishedTurn: FinishedTurn = {
            reply: finalReply,
            toolTrace,
            tokensUsed: Math.ceil(sessionState.estimateContextSize(assembleContext.systemPrompt) / 4),
            compactionEvents,
          };

          await reportProgress({
            type: "turn_end",
            tokensUsed: finishedTurn.tokensUsed
          });
          await pluginHooksRegistry.triggerOnAgentRunComplete(sessionId, finishedTurn, sessionState);
          this.activeLoops.delete(sessionId);
          return finishedTurn;
        }
      }

      const finalReply = sessionState.getLastModelResponse() || "Agent execution halted: loop limits reached.";
      const finishedTurn: FinishedTurn = {
        reply: finalReply,
        toolTrace,
        tokensUsed: Math.ceil(sessionState.estimateContextSize(lastSystemPrompt) / 4),
        compactionEvents,
      };

      await reportProgress({
        type: "turn_end",
        tokensUsed: finishedTurn.tokensUsed
      });
      await pluginHooksRegistry.triggerOnAgentRunComplete(sessionId, finishedTurn, sessionState);
      this.activeLoops.delete(sessionId);
      return finishedTurn;
    } catch (err: any) {
      this.activeLoops.delete(sessionId);
      console.error(`[AgentRuntime] ReAct loop crashed:`, err);
      return {
        reply: `⚠️ *Error:* ${err.message}`,
        toolTrace,
        tokensUsed: Math.ceil(sessionState.estimateContextSize(lastSystemPrompt) / 4),
        compactionEvents
      };
    }
  }
}

export const komorebiHarness = new KomorebiHarness();
