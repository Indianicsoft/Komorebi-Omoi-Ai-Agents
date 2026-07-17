import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { ModelProvider, ChatMessage, ToolDefinition, ToolCall, ToolResult, MessageEnvelope, WakeEvent } from "./types.js";
import { ToolRegistry } from "./registry.js";
import { PromptAssembler } from "./prompt.js";
import { MemoryStack } from "./memory-stack.js";
import { createModelProvider } from "./providers/index.js";
import {
  estimateTokens,
  enforceContextGuards,
  repairOrphanedToolCalls,
  trimOnUserBoundaries,
  pruneExpiredCacheToolResults
} from "./compaction.js";
import {
  ProgressiveSkillsLoader,
  checkReflectionTriggers,
  runReflectionExtraction,
  calculateTextSimilarity,
  ExecutedToolCall
} from "./learning.js";
import { komorebiHarness } from "./runtime/harness/komorebi.js";
import { resolveHarness } from "./runtime/harness/registry.js";
import { pluginHooksRegistry } from "./runtime/agent-hooks/hooks.js";

export class AgentRuntime {
  private ws!: WebSocket;
  public currentHops = 0;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private conversationHistory: ChatMessage[] = [];
  public readonly loadedSkills = new Set<string>();
  public readonly loadedReferences = new Map<string, Set<string>>();
  public readonly skillsLoader = new ProgressiveSkillsLoader();
  private lastTurnTrace: { userQuery: string; toolCalls: ExecutedToolCall[]; finalResponse: string } | null = null;
  private memoryStack: MemoryStack;
  private envelope!: MessageEnvelope;

  private configuredContextLimit = 15000;
  private sessionStartTime = Date.now();
  private cacheTTLMs = 300 * 1000;
  private compactionCount = 0;
  private activePlan: string[] = [];
  private completedMilestones = new Set<number>();
  private metaCognitiveAdjustments: string[] = [];
  private agentMood: "focused" | "idle" | "busy" | "alert" = "idle";
  private turnCount = 0;

  constructor(
    private readonly agentId: string,
    private readonly agentName: string,
    private readonly sessionId: string,
    private readonly workspacePath: string,
    private readonly gatewayUrl: string,
    private readonly gatewayToken: string,
    public modelProvider: ModelProvider,
    public readonly toolRegistry: ToolRegistry,
    public readonly promptAssembler: PromptAssembler,
    apiKey: string,
    public readonly providerId: string = "gemini",
    public readonly providerBaseUrl?: string,
    public readonly agentConfig?: any
  ) {
    this.memoryStack = new MemoryStack(workspacePath, providerId, providerBaseUrl, apiKey);
    this.configuredContextLimit = agentConfig?.contextLimit ?? agentConfig?.toolPolicy?.contextLimit ?? 15000;
    
    // 1. Restore conversation state from historical JSONL session log
    this.conversationHistory = repairOrphanedToolCalls(this.memoryStack.getSessionHistory());
    console.log(`[AgentRuntime - ${agentId}] Loaded ${this.conversationHistory.length} turns from historical JSONL session log.`);

    // 2. Initialize Komorebi Omoi core identity, soul, user preference, tools, and memory files
    this.initializeKomorebiFiles();

    // 3. Load compaction metadata
    this.loadCompactionMetadata();
  }

  private async reportProgress(event: any) {
    if (!this.envelope) return;
    try {
      await this.rpcRequest("reportProgress", {
        sessionId: this.sessionId,
        chatId: this.envelope.chatId || 0,
        threadId: this.envelope.threadId || 0,
        event: {
          ...event,
          agentId: this.agentId,
          timestamp: Date.now()
        }
      });
    } catch (err: any) {
      console.error(`[AgentRuntime - ${this.agentId}] reportProgress failed:`, err.message);
    }
  }

  /**
   * Initializes connection to the Gateway and registers this session.
   */
  public async start(): Promise<void> {
    const urlWithToken = `${this.gatewayUrl}?token=${this.gatewayToken}`;
    console.log(`[AgentRuntime - ${this.agentId}] Connecting to Gateway: ${this.gatewayUrl}`);

    this.ws = new WebSocket(urlWithToken);

    return new Promise((resolve, reject) => {
      this.ws.on("open", async () => {
        console.log(`[AgentRuntime - ${this.agentId}] Connected to Gateway. Registering session...`);
        try {
          const res = await this.rpcRequest("registerAgent", {
            agentId: this.agentId,
            sessionId: this.sessionId,
          });
          console.log(`[AgentRuntime - ${this.agentId}] Session registration successful:`, res);
          await pluginHooksRegistry.triggerOnSessionCreated(this.sessionId);

          try {
            const configRes = await this.rpcRequest("getSystemConfig", {}).catch(() => null);
            if (configRes && configRes.config) {
              this.updateAgentsRosterFile(configRes.config);
            }
          } catch (configErr: any) {
            console.warn(`[AgentRuntime - ${this.agentId}] Failed to fetch system config during start:`, configErr.message);
          }
          
          try {
            await this.rpcRequest("busSubscribe", {
              topic: `agent:${this.agentId}`,
            });
            console.log(`[AgentRuntime - ${this.agentId}] Event bus subscription registered.`);
          } catch (subErr: any) {
            console.warn(`[AgentRuntime - ${this.agentId}] Failed to subscribe to event bus:`, subErr.message);
          }
          
          resolve();
        } catch (err) {
          console.error(`[AgentRuntime - ${this.agentId}] Registration failed:`, err);
          reject(err);
        }
      });

      this.ws.on("message", (rawMessage) => {
        this.handleMessage(rawMessage.toString());
      });

      this.ws.on("close", (code, reason) => {
        console.log(`[AgentRuntime - ${this.agentId}] Connection closed: code=${code}, reason=${reason}`);
      });

      this.ws.on("error", (err) => {
        console.error(`[AgentRuntime - ${this.agentId}] Socket error:`, err);
        reject(err);
      });
    });
  }

  /**
   * Receives and handles messages from the Gateway.
   */
  private async handleMessage(messageStr: string) {
    try {
      const frame = JSON.parse(messageStr);

      if (frame.type === "evt") {
        if (frame.event === "busMessage") {
          const { topic, message } = frame.data;
          console.log(`[AgentRuntime - ${this.agentId}] Received event bus message on topic ${topic}:`, message);
          
          const hops = message.hops || 1;
          if (hops > 5) {
            console.warn(`[AgentRuntime - ${this.agentId}] Event bus messaging loop limit reached (hops: ${hops}). Dropping reply to prevent infinite loop.`);
            return;
          }

          // Trigger a ReAct turn to process the incoming agent message
          const envelope = {
            sender: { id: 0, firstName: message.from, username: message.from },
            chatId: 0,
            content: `[Bus Message from ${message.from}]: ${message.content}`,
            attachments: [],
            channel: "bus" as any,
            timestamp: Math.floor(message.timestamp / 1000)
          };
          
          // Run the ReAct loop in the background
          (async () => {
            try {
              this.currentHops = hops;
              const reply = await this.executeReActLoop(envelope);
              
              // Publish the reply back to the sender's topic
              await this.rpcRequest("busPublish", {
                topic: `agent:${message.from}`,
                message: {
                  from: this.agentId,
                  content: reply,
                  timestamp: Date.now(),
                  hops: hops + 1
                }
              });
            } catch (err: any) {
              console.error(`[AgentRuntime - ${this.agentId}] Failed to process bus message:`, err.message);
            } finally {
              this.currentHops = 0;
            }
          })();
        } else if (frame.event === "modelUpdated") {
          // Live model hot-swap: replace the model provider without restarting the process
          try {
            const { model, providerConfig } = frame.data as { model: any; providerConfig: any };
            const newProviderId = model?.provider || "openai-compatible";
            let newApiKey: string = model?.apiKey || "";

            // Resolve API key — strip template wrappers like ${sk-live-...}
            if (newApiKey.startsWith("${") && newApiKey.endsWith("}")) {
              newApiKey = newApiKey.slice(2, -1);
            } else if (newApiKey.startsWith("$")) {
              newApiKey = newApiKey.slice(1);
            }
            // Fall back to provider-level key if agent key is blank
            if (!newApiKey && providerConfig?.apiKey) {
              newApiKey = providerConfig.apiKey;
            }

            const newModelName: string = model?.name || "";
            this.modelProvider = createModelProvider(
              newProviderId,
              newApiKey,
              newModelName,
              providerConfig,
              {
                temperature: model?.temperature,
                maxOutputTokens: model?.maxOutputTokens
              }
            );
            console.log(`[AgentRuntime - ${this.agentId}] ✅ Model hot-swapped to: ${newProviderId}/${newModelName}`);
            await this.reportProgress({
              type: "model_updated",
              detail: `Model updated to ${newModelName} (${newProviderId})`
            });
          } catch (swapErr: any) {
            console.error(`[AgentRuntime - ${this.agentId}] Model hot-swap failed:`, swapErr.message);
          }
        } else if (frame.event === "skillHotReload") {
          try {
            const { skillName, skillPath } = frame.data as { skillName: string; skillPath: string };
            const ok = this.toolRegistry.hotReloadSkill(skillName, skillPath);
            if (ok) {
              console.log(`[AgentRuntime - ${this.agentId}] ✅ Skill '${skillName}' hot-reloaded successfully.`);
              await this.reportProgress({
                type: "skill_hot_reloaded",
                detail: `Skill '${skillName}' hot-reloaded successfully`
              });
            } else {
              console.warn(`[AgentRuntime - ${this.agentId}] ⚠️ Skill '${skillName}' hot-reload failed, kept previous version.`);
            }
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] Skill hot-reload error:`, err.message);
          }
        }
      } else if (frame.type === "req") {
        if (frame.method === "handleMessage") {
          const { envelope } = frame.params;
          console.log(`[AgentRuntime - ${this.agentId}] Ingesting envelope from Telegram bridge...`);
          try {
            this.envelope = envelope;
            const wakeEvent: WakeEvent = {
              type: "message",
              sessionId: this.sessionId,
              agentId: this.agentId,
              payload: {
                message: envelope.content || "",
                envelope
              },
              timestamp: Date.now()
            };
            const finishedTurn = await komorebiHarness.runTurn(
              wakeEvent,
              this,
              async (event) => {
                await this.reportProgress(event);
              }
            );

            // Send outbound message back to user via Telegram RPC tool helper
            await this.rpcRequest("sendTelegramMessage", {
              agentId: this.agentId,
              chatId: envelope.chatId,
              threadId: envelope.threadId,
              text: finishedTurn.reply,
            });
            this.sendResponse(frame.id, true, { success: true });
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] handleMessage turn failed:`, err);
            this.sendResponse(frame.id, false, undefined, err.message);
          }
        } else if (frame.method === "getSkillCircuitData") {
          const { skillName } = frame.params;
          const data = this.toolRegistry.getSkillCircuitData(skillName);
          this.sendResponse(frame.id, true, data);
        } else if (frame.method === "setSkillCircuitState") {
          const { skillName, state } = frame.params;
          this.toolRegistry.setSkillCircuitState(skillName, state);
          this.sendResponse(frame.id, true, { success: true });
        } else if (frame.method === "getSkillsHealth") {
          const list: Record<string, any> = {};
          const seen = new Set<string>();
          for (const [toolName, meta] of (this.toolRegistry as any).toolSkillMetadata.entries()) {
            if (seen.has(meta.skillName)) continue;
            seen.add(meta.skillName);
            list[meta.skillName] = this.toolRegistry.getSkillCircuitData(meta.skillName);
          }
          this.sendResponse(frame.id, true, list);
        } else if (frame.method === "runTurn") {
          const { wakeEvent } = frame.params;
          if (!wakeEvent) {
            throw new Error("Missing parameter 'wakeEvent'");
          }
          console.log(`[AgentRuntime - ${this.agentId}] Harness turn run requested via WakeEvent: ${wakeEvent.type} (${wakeEvent.sessionId})`);
          try {
            this.envelope = wakeEvent.payload.envelope;
            
            const modelName = this.agentConfig?.model?.name || "gemini-1.5-flash";
            const harnessId = resolveHarness(this.providerId, modelName, this.agentConfig || {});
            
            const finishedTurn = await komorebiHarness.runTurn(
              wakeEvent,
              this,
              async (event) => {
                await this.reportProgress(event);
              }
            );
            this.sendResponse(frame.id, true, finishedTurn);
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] runTurn turn failed:`, err);
            this.sendResponse(frame.id, false, undefined, err.message);
          }
        } else if (frame.method === "queryModel") {
          const { systemInstruction, prompt } = frame.params;
          console.log(`[AgentRuntime - ${this.agentId}] Simple model completion query requested`);
          try {
            const result = await this.modelProvider.generate(
              systemInstruction,
              [{ role: "user", content: prompt }],
              []
            );
            this.sendResponse(frame.id, true, { text: result.content || "" });
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] queryModel failed:`, err);
            this.sendResponse(frame.id, false, undefined, err.message);
          }
        } else if (frame.method === "runSessionEndReflection") {
          try {
            const { runSessionEndReflection } = await import("./learning.js");
             await runSessionEndReflection(this.agentId, this.sessionId, this.workspacePath, this.modelProvider, this.memoryStack);
             await pluginHooksRegistry.triggerOnSessionIdle(this.sessionId);
             this.sendResponse(frame.id, true, { success: true });
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] Session-end reflection failed:`, err);
            this.sendResponse(frame.id, false, undefined, err.message);
          }
        } else if (frame.method === "compactSession") {
          const { limit } = frame.params;
          console.log(`[AgentRuntime - ${this.agentId}] Manual compaction requested (limit: ${limit || 1000} tokens)`);
          try {
            const systemPrompt = this.promptAssembler.assembleSystemPrompt(
              this.workspacePath,
              this.toolRegistry.getDefinitions()
            );
            await this.runManualCompaction(systemPrompt, limit || 1000);
            const tokens = this.estimateContextTokens(systemPrompt);
            this.sendResponse(frame.id, true, { success: true, tokens });
          } catch (err: any) {
            console.error(`[AgentRuntime - ${this.agentId}] Manual compaction failed:`, err);
            this.sendResponse(frame.id, false, undefined, err.message);
          }
        } else if (frame.method === "ping") {
          // Respond to heartbeat checks
          this.sendResponse(frame.id, true, { pong: true });
        }
      } else if (frame.type === "res") {
        const handler = this.pendingRequests.get(frame.id);
        if (handler) {
          this.pendingRequests.delete(frame.id);
          if (frame.ok) {
            handler.resolve(frame.payload);
          } else {
            handler.reject(new Error(frame.error || "RPC error"));
          }
        }
      }
    } catch (err) {
      console.error(`[AgentRuntime - ${this.agentId}] Error parsing message frame:`, err);
    }
  }

  public async executeReActLoop(envelope: MessageEnvelope): Promise<string> {
    this.envelope = envelope;
    await pluginHooksRegistry.triggerOnMessageReceived(this.sessionId, envelope.content || "", envelope);

    // Fetch latest system config to update the cluster agents/teams roster dynamically
    try {
      const configRes = await this.rpcRequest("getSystemConfig", {}).catch(() => null);
      if (configRes && configRes.config) {
        this.updateAgentsRosterFile(configRes.config);
      }
    } catch (err: any) {
      console.warn(`[AgentRuntime - ${this.agentId}] Failed to fetch system config for roster update:`, err.message);
    }

    const wakeEvent: WakeEvent = {
      type: "message",
      sessionId: this.sessionId,
      agentId: this.agentId,
      payload: {
        message: envelope.content || "",
        envelope
      },
      timestamp: Date.now()
    };

    const finishedTurn = await komorebiHarness.runTurn(
      wakeEvent,
      this,
      async (event) => {
        await this.reportProgress(event);
      }
    );

    return finishedTurn.reply;
  }

  private async runContextCompaction(systemPrompt: string, steeringInstructions?: string) {
    const preSize = this.estimateContextSize();
    const preTokens = this.estimateContextTokens(systemPrompt);
    console.log(`[AgentRuntime - ${this.agentId}] Starting context compaction (size: ${preSize} chars, ${preTokens} tokens)...`);
    this.compactionCount++;
    this.saveCompactionMetadata();

    await this.reportProgress({
      type: "compaction_start",
      detail: `Context limit reached (${preTokens} tokens). Running intelligent compaction...`
    });

    // 1. Fault-tolerant Pre-Compaction Memory Flush
    try {
      const flushMsg: ChatMessage = {
        role: "user",
        content: `System Notice: The context window limit is approaching. Before we summarize and compact our conversation, inspect our past messages. Write anything important from this conversation to MEMORY.md now, before it is summarized. Use the 'memory_update_curated' or 'memory_write_daily' tools if needed. Respond with 'COMPACTION_PREP_COMPLETE' once done.`
      };

      this.conversationHistory.push(flushMsg);
      const modelRes = await this.modelProvider.generate(
        systemPrompt,
        this.conversationHistory,
        this.toolRegistry.getDefinitions()
      );
      this.conversationHistory.pop(); // remove flushMsg

      if (modelRes.toolCalls && modelRes.toolCalls.length > 0) {
        for (const tc of modelRes.toolCalls) {
          await this.toolRegistry.execute(tc.name, tc.arguments, {
            agentId: this.agentId,
            sessionId: this.sessionId,
            workspacePath: this.workspacePath,
            gatewayUrl: this.gatewayUrl,
            gatewayToken: this.gatewayToken,
            rpcRequest: this.rpcRequest.bind(this),
            memoryStack: this.memoryStack,
            runtime: this
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AgentRuntime - ${this.agentId}] Pre-compaction memory flush failed, skipping to trim: ${err.message}`);
      // Clean up flushMsg in case it was left in history on error
      if (this.conversationHistory[this.conversationHistory.length - 1]?.content?.includes("MEMORY.md")) {
        this.conversationHistory.pop();
      }
    }

    // 2. Programmatic Trimming
    const originalHistory = [...this.conversationHistory];
    this.conversationHistory = trimOnUserBoundaries(this.conversationHistory, 10);
    this.conversationHistory = pruneExpiredCacheToolResults(
      this.conversationHistory,
      this.cacheTTLMs,
      this.sessionStartTime
    );

    // 3. Summarize history using Staged Summarization
    try {
      console.log(`[AgentRuntime - ${this.agentId}] Compacting history into summary...`);
      const historyText = this.conversationHistory
        .map(m => `[${m.role}]: ${m.content || ""}`)
        .join("\n");

      const { runStagedSummarization } = await import("./compaction.js");
      const summaryText = await runStagedSummarization(
        historyText,
        async (prompt, hist) => {
          const res = await this.modelProvider.generate(
            "You are an assistant that summarizes conversation histories.",
            [{ role: "user", content: prompt }],
            []
          );
          return res.content || "";
        }
      );

      const steeringText = steeringInstructions ? `\nNote: ${steeringInstructions}` : "";
      const compactedTurn: ChatMessage = {
        role: "user",
        content: `Summary of previous conversation:\n${summaryText}${steeringText}`
      };

      this.conversationHistory = [compactedTurn];
    } catch (err: any) {
      console.error(`[AgentRuntime - ${this.agentId}] LLM summarization failed, falling back to algorithmic truncation:`, err.message);
      
      // Fallback: keep only the last 6 turns (user/model) and programmatically prune excessively large tool outputs.
      const keptMessages: ChatMessage[] = [];
      const lastMessages = originalHistory.slice(-6);
      for (const msg of lastMessages) {
        const cloned = { ...msg };
        if (cloned.toolResults) {
          cloned.toolResults = cloned.toolResults.map(tr => ({
            ...tr,
            output: tr.output.length > 2000 ? tr.output.slice(0, 2000) + "\n... [Output truncated to save context] ..." : tr.output
          }));
        }
        if (cloned.content && cloned.content.length > 5000) {
          cloned.content = cloned.content.slice(0, 5000) + "\n... [Text truncated to save context] ...";
        }
        keptMessages.push(cloned);
      }

      this.conversationHistory = keptMessages;
    }

    // 4. Write updated state to session.jsonl
    try {
      writeFileSync(
        join(this.workspacePath, "session.jsonl"),
        this.conversationHistory.map(m => JSON.stringify({ timestamp: Date.now(), ...m })).join("\n") + "\n",
        "utf-8"
      );
    } catch (writeErr: any) {
      console.error(`[AgentRuntime - ${this.agentId}] Failed to write session.jsonl:`, writeErr.message);
    }

    console.log(`[AgentRuntime - ${this.agentId}] Context compaction complete. New size: ${this.estimateContextSize()} chars.`);
    const postTokens = this.estimateContextTokens(systemPrompt);
    await this.reportProgress({
      type: "compaction_end",
      detail: `Intelligent compaction complete: context reduced from ${preTokens} to ${postTokens} tokens.`
    });
  }

  private getLastModelResponse(): string | null {
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const msg = this.conversationHistory[i];
      if (msg.role === "model" && msg.content) {
        return msg.content;
      }
    }
    return null;
  }

  public estimateContextTokens(systemPrompt?: string): number {
    let total = 0;
    if (systemPrompt) total += estimateTokens(systemPrompt);
    for (const msg of this.conversationHistory) {
      if (msg.content) total += estimateTokens(msg.content);
      if (msg.toolCalls) total += estimateTokens(JSON.stringify(msg.toolCalls));
      if (msg.toolResults) total += estimateTokens(JSON.stringify(msg.toolResults));
    }
    return total;
  }

  /**
   * Helper estimating length of conversation in characters.
   */
  public estimateContextSize(systemPrompt?: string): number {
    let size = 0;
    if (systemPrompt) size += systemPrompt.length;
    for (const msg of this.conversationHistory) {
      if (msg.content) size += msg.content.length;
      if (msg.toolCalls) size += JSON.stringify(msg.toolCalls).length;
      if (msg.toolResults) size += JSON.stringify(msg.toolResults).length;
    }
    return size;
  }

  public rpcRequest<T = any>(method: string, params: any): Promise<T> {
    const id = randomUUID();
    return new Promise<T>((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("Cannot send RPC request: WebSocket connection is not open"));
      }

      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  private sendResponse(id: string, ok: boolean, payload?: any, error?: string) {
    this.ws.send(JSON.stringify({ type: "res", id, ok, payload, error }));
  }

  private async runMetaCognitiveCheck(toolName: string, toolArgs: any, output: string): Promise<void> {
    console.log(`[MetaCognitiveLoop - ${this.agentId}] Analyzing tool result for meta-cognitive prompt adjustment...`);
    const instructions = `You are a metacognitive engine. Review tool execution output.
Active plan: ${JSON.stringify(this.activePlan)}
If plan step complete, reply "MILESTONE_ACHIEVED: [index]".
If strategy adjust needed, reply "PROMPT_DELTA: [adjustment]".
Otherwise, reply "NO_ADJUSTMENT".`;

    const prompt = `Tool Executed: ${toolName}
Arguments: ${JSON.stringify(toolArgs)}
Output:
"""
${output.slice(0, 500)}
"""

Response:`;

    try {
      const res = await this.modelProvider.generate(
        instructions,
        [{ role: "user", content: prompt }],
        []
      );

      const reply = res.content || "";
      
      // Parse milestone achievement
      if (reply.includes("MILESTONE_ACHIEVED:")) {
        const match = reply.match(/MILESTONE_ACHIEVED:\s*(\d+)/);
        if (match) {
          const idx = parseInt(match[1]);
          if (!isNaN(idx) && idx >= 0 && idx < this.activePlan.length) {
            console.log(`[MilestonePlanner - ${this.agentId}] Milestone checked off: ${idx} (${this.activePlan[idx]})`);
            this.completedMilestones.add(idx);
            await this.updateTelegramPlanProgress();
          }
        }
      }

      if (reply.includes("PROMPT_DELTA:")) {
        const delta = reply.split("PROMPT_DELTA:")[1].trim();
        console.log(`[MetaCognitiveLoop - ${this.agentId}] Extracted prompt delta: "${delta}"`);
        this.metaCognitiveAdjustments.push(delta);
        
        // Report progress about the meta-cognitive update to Telegram
        await this.reportProgress({
          type: "meta_updating",
          detail: delta
        });

        // Store prompt delta in the memory-stack daily log
        this.memoryStack.appendDailyLog(`[Meta-Cognitive prompt delta] ${delta}`);

        // Store prompt delta in prompt-drift.json
        const driftPath = join(homedir(), ".komorebi", "agents", this.agentId, "prompt-drift.json");
        try {
          if (!existsSync(dirname(driftPath))) {
            mkdirSync(dirname(driftPath), { recursive: true });
          }
          let driftHistory: any[] = [];
          if (existsSync(driftPath)) {
            driftHistory = JSON.parse(readFileSync(driftPath, "utf-8"));
          }
          driftHistory.push({
            timestamp: Date.now(),
            delta
          });
          writeFileSync(driftPath, JSON.stringify(driftHistory, null, 2), "utf-8");
        } catch {}
      }
    } catch (err: any) {
      console.error(`[MetaCognitiveLoop - ${this.agentId}] Check failed:`, err.message);
    }
  }

  private async runMilestonePlanning(userQuery: string): Promise<void> {
    console.log(`[MilestonePlanner - ${this.agentId}] Creating execution plan...`);
    const instructions = `Analyze the user request and break it down into a structured, linear sequence of 3 to 5 clear milestones (sub-goals) to achieve.
Return the milestones as a JSON array of strings (e.g. ["Analyze files", "Compute hashes", "Write summary"]). Return ONLY the raw JSON array.`;

    try {
      const res = await this.modelProvider.generate(
        instructions,
        [{ role: "user", content: `Deconstruct task: "${userQuery}"` }],
        []
      );

      const cleaned = res.content?.trim() || "";
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        this.activePlan = JSON.parse(match[0]);
        this.completedMilestones.clear();
        console.log(`[MilestonePlanner - ${this.agentId}] Generated ${this.activePlan.length} milestones:`, this.activePlan);
        await this.updateTelegramPlanProgress();
      }
    } catch (err: any) {
      console.warn(`[MilestonePlanner - ${this.agentId}] Planning failed:`, err.message);
    }
  }

  private async updateTelegramPlanProgress(): Promise<void> {
    if (this.activePlan.length === 0) return;
    const lines = this.activePlan.map((milestone, idx) => {
      const status = this.completedMilestones.has(idx) ? "✅" : "⏳";
      return `${status} Plan Step ${idx + 1}: ${milestone}`;
    });
    
    await this.reportProgress({
      type: "thinking",
      detail: `[Execution Plan]\n` + lines.join("\n")
    });
  }

  private initializeKomorebiFiles() {
    const agentDir = join(homedir(), ".komorebi", "agents", this.agentId);
    const sessionDir = this.workspacePath;

    // Ensure directories exist
    if (!existsSync(agentDir)) {
      mkdirSync(agentDir, { recursive: true });
    }
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    const files = {
      "identity.md": `# Agent Identity\n\n## Overview\n- **Name**: ${this.agentName}\n- **ID**: ${this.agentId}\n- **Runtime**: Komorebi Omoi (Superintelligent Mode)\n- **Architecture**: Autonomous Agentic ReAct Loop with Dynamic Backtracking & Self-Correction\n\n## Role & Mission\nYou are ${this.agentName}, a highly specialized, superintelligent agent running inside the Komorebi Omoi orchestration gateway. Your mission is to assist the user by executing advanced file-system tasks, custom scripts, web searches, and coordinating with other agents in the network. You must solve complex challenges autonomously, backtracking on failures, and optimizing your strategy on the fly.\n\n## Operating Constraints\n- You must operate within the designated session workspace folder.\n- You must respect security policies and request owner approval for host execution when interactive.\n- Maintain high reasoning quality, using meta-cognitive adjustments when needed.\n`,
      "soul.md": `# Agent Soul & Persona\n\n## Core Persona & Values\n- **Integrity**: Always ensure host security and follow authorization directives.\n- **Thoroughness**: Do not settle for minimum viable answers. Explore deep solutions and double check your work.\n- **Adaptability**: Adjust your prompt parameters, search patterns, and meta-cognitive layers dynamically.\n- **Persistence & Self-Correction**: When a tool, script, or command fails or outputs an error, treat it as a puzzle. Backtrack, analyze, search, test hypotheses, and correct your strategy. Never loop on the same error twice.\n\n## Long-Term Objectives\n- Maximize the execution success rate of user tasks.\n- Keep system resources balanced and clean.\n- Accumulate useful skills in the local library.\n- Continuously compile learned facts about the workspace and configuration into MEMORY.md.\n\n## Behavioral Boundaries\n- **NEVER**: Impacts other people without consent, deletes irreversible system data, or uninstalls essential packages.\n- **SUGGEST**: Propose confident improvements, configurations, or non-destructive script suggestions first before executing.\n- **ASK**: For any external messaging, email dispatch, or spending-related transactions, always ask for explicit owner validation.\n`,
      "user.md": `# User Profile & Preferences\n\n## Profile\n- **Active User**: Rohith (Host Owner)\n\n## Preferences & Interaction Guidelines\n- Be concise in finalized Telegram replies.\n- Support collapsible thoughts showing detailed planning steps.\n- Always provide immediate visual progress updates.\n`,
      "memory.md": `# Curated Long-Term Memory\n\n## Key Facts\n- Running inside Komorebi Omoi runtime.\n- Sessions are isolated and session logs are kept in \`session.jsonl\`.\n\n## Compiled Milestones & Learnings\n- None yet recorded.\n`,
      "agents.md": `# Agent Cluster Registry\n\n## Local Agents\n- **tommy**: Chief operator and local task execution specialist.\n- **komorebi-1**: Peer agent.\n\n## Communication Channels\n- Coordinate using the \`agent_message\` tool over the Gateway bus.\n`,
      "tools.md": `# Tool Execution Guide\n\n## Available Tools\n- **read_file** / **write_file** / **edit_file**: Authorized local filesystem access.\n- **exec**: OS shell execution (requires administrator permission gate approval).\n- **web_search** / **web_fetch**: Retrieval of live internet information.\n- **spawn_subagent**: Delegation of scoped background sub-tasks.\n- **skills_load** / **skills_install**: Extension of capabilities via playbook scripts.\n- **telegram_send**: Direct outbound message response.\n\n## Security Policies\n- Any command execution via \`exec\` must pass through the \`requestCommandApproval\` RPC.\n`
    };

    const targetDirs = [agentDir, sessionDir];

    for (const dir of targetDirs) {
      for (const [filename, templateContent] of Object.entries(files)) {
        // Write lowercase version
        const lowercasePath = join(dir, filename.toLowerCase());
        if (!existsSync(lowercasePath)) {
          console.log(`[AgentRuntime - ${this.agentId}] Initializing Komorebi Omoi file: ${lowercasePath}`);
          writeFileSync(lowercasePath, templateContent, "utf-8");
        }

        // Write uppercase version
        const uppercasePath = join(dir, filename.toUpperCase());
        if (!existsSync(uppercasePath)) {
          console.log(`[AgentRuntime - ${this.agentId}] Initializing Komorebi Omoi file: ${uppercasePath}`);
          writeFileSync(uppercasePath, templateContent, "utf-8");
        }
      }
    }

    // Initialize mood.json
    const moodPath = join(agentDir, "mood.json");
    if (!existsSync(moodPath)) {
      writeFileSync(moodPath, JSON.stringify({ mood: "idle", turnCount: 0, uptimeSeconds: 0, lastActive: Date.now() }, null, 2), "utf-8");
    }
  }

  private async writeMoodFile() {
    const agentDir = join(homedir(), ".komorebi", "agents", this.agentId);
    const moodPath = join(agentDir, "mood.json");
    try {
      writeFileSync(moodPath, JSON.stringify({
        mood: this.agentMood,
        turnCount: this.turnCount,
        uptimeSeconds: Math.floor((Date.now() - this.sessionStartTime) / 1000),
        lastActive: Date.now(),
        sessionId: this.sessionId
      }, null, 2), "utf-8");
    } catch {}
  }

  public getMoodData() {
    return {
      mood: this.agentMood,
      turnCount: this.turnCount,
      uptimeSeconds: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      lastActive: Date.now(),
    };
  }

  private updateAgentsRosterFile(config: any) {
    const agentsList = config?.agents || [];
    const teamsList = config?.teams || [];

    const agentsText = agentsList.map((a: any) => `- **${a.id}** (${a.name || a.id}): Using model ${a.model?.name || "unknown"}`).join("\n");
    const teamsText = teamsList.map((t: any) => `- **${t.name}** (ID: ${t.id}): Leader: ${t.leaderAgentId || "None"} | Members: ${(t.memberAgentIds || []).join(", ")}`).join("\n");

    const content = `# Agent Cluster Registry

## Available Agents in the Runtime
${agentsText || "None configured."}

## Available Teams in the Runtime
${teamsText || "None configured."}

## Inter-Agent Communication Channels
- You can send direct messages to any peer agent listed above by calling the \`agent_message\` tool.
- Coordinate on tasks with members of your team via the event bus using the \`agent_message\` tool.
`;

    const agentDir = join(homedir(), ".komorebi", "agents", this.agentId);
    const sessionDir = this.workspacePath;

    for (const dir of [agentDir, sessionDir]) {
      if (existsSync(dir)) {
        try {
          writeFileSync(join(dir, "agents.md"), content, "utf-8");
          writeFileSync(join(dir, "AGENTS.md"), content, "utf-8");
        } catch (err: any) {
          console.error(`[AgentRuntime] Failed to write roster to ${dir}:`, err.message);
        }
      }
    }
  }

  private saveCompactionMetadata() {
    try {
      const metadataPath = join(this.workspacePath, "compaction-metadata.json");
      writeFileSync(metadataPath, JSON.stringify({ compactionCount: this.compactionCount }), "utf-8");
    } catch (err: any) {
      console.error(`[AgentRuntime - ${this.agentId}] Failed to save compaction metadata:`, err.message);
    }
  }

  private loadCompactionMetadata() {
    try {
      const metadataPath = join(this.workspacePath, "compaction-metadata.json");
      if (existsSync(metadataPath)) {
        const data = JSON.parse(readFileSync(metadataPath, "utf-8"));
        if (typeof data.compactionCount === "number") {
          this.compactionCount = data.compactionCount;
        }
      }
    } catch (err: any) {
      console.warn(`[AgentRuntime - ${this.agentId}] Failed to load compaction metadata:`, err.message);
    }
  }

  private async runManualCompaction(systemPrompt: string, targetLimit: number) {
    const preSize = this.estimateContextSize();
    const preTokens = this.estimateContextTokens(systemPrompt);
    console.log(`[AgentRuntime - ${this.agentId}] Starting manual context compaction to ${targetLimit} tokens (current: ${preSize} chars, ${preTokens} tokens)...`);
    this.compactionCount++;
    this.saveCompactionMetadata();

    await this.reportProgress({
      type: "compaction_start",
      detail: `Manual compaction triggered. Target limit: ${targetLimit} tokens.`
    });

    // 1. Fault-tolerant Pre-Compaction Memory Flush
    try {
      const flushMsg: ChatMessage = {
        role: "user",
        content: `System Notice: The context window limit is approaching. Before we summarize and compact our conversation, inspect our past messages. Write anything important from this conversation to MEMORY.md now, before it is summarized. Use the 'memory_update_curated' or 'memory_write_daily' tools if needed. Respond with 'COMPACTION_PREP_COMPLETE' once done.`
      };

      this.conversationHistory.push(flushMsg);
      const modelRes = await this.modelProvider.generate(
        systemPrompt,
        this.conversationHistory,
        this.toolRegistry.getDefinitions()
      );
      this.conversationHistory.pop(); // remove flushMsg

      if (modelRes.toolCalls && modelRes.toolCalls.length > 0) {
        for (const tc of modelRes.toolCalls) {
          await this.toolRegistry.execute(tc.name, tc.arguments, {
            agentId: this.agentId,
            sessionId: this.sessionId,
            workspacePath: this.workspacePath,
            gatewayUrl: this.gatewayUrl,
            gatewayToken: this.gatewayToken,
            rpcRequest: this.rpcRequest.bind(this),
            memoryStack: this.memoryStack,
            runtime: this
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AgentRuntime - ${this.agentId}] Pre-compaction memory flush failed, skipping to trim: ${err.message}`);
      if (this.conversationHistory[this.conversationHistory.length - 1]?.content?.includes("MEMORY.md")) {
        this.conversationHistory.pop();
      }
    }

    // 2. Programmatic Trimming
    const originalHistory = [...this.conversationHistory];
    
    // For manual compaction down to 1k tokens, keep only the last 2 turns
    this.conversationHistory = trimOnUserBoundaries(this.conversationHistory, 2);
    this.conversationHistory = pruneExpiredCacheToolResults(
      this.conversationHistory,
      this.cacheTTLMs,
      this.sessionStartTime
    );

    // 3. Summarize history using Staged Summarization
    try {
      console.log(`[AgentRuntime - ${this.agentId}] Compacting history into summary...`);
      const historyText = originalHistory
        .map(m => `[${m.role}]: ${m.content || ""}`)
        .join("\n");

      const { runStagedSummarization } = await import("./compaction.js");
      const summaryText = await runStagedSummarization(
        historyText,
        async (prompt, hist) => {
          const res = await this.modelProvider.generate(
            prompt,
            hist,
            []
          );
          return res.content || "";
        }
      );

      const compactedTurn: ChatMessage = {
        role: "user",
        content: `Summary of previous conversation (compacted to <1k tokens):\n${summaryText}`
      };

      this.conversationHistory = [compactedTurn];
    } catch (err: any) {
      console.error(`[AgentRuntime - ${this.agentId}] LLM summarization failed, falling back to algorithmic truncation:`, err.message);
      
      const keptMessages: ChatMessage[] = [];
      const lastMessages = originalHistory.slice(-2);
      for (const msg of lastMessages) {
        const cloned = { ...msg };
        if (cloned.toolResults) {
          cloned.toolResults = cloned.toolResults.map(tr => ({
            ...tr,
            output: tr.output.length > 500 ? tr.output.slice(0, 500) + "\n... [Truncated] ..." : tr.output
          }));
        }
        if (cloned.content && cloned.content.length > 1000) {
          cloned.content = cloned.content.slice(0, 1000) + "\n... [Truncated] ...";
        }
        keptMessages.push(cloned);
      }
      this.conversationHistory = keptMessages;
    }

    // 4. Write updated state to session.jsonl
    try {
      writeFileSync(
        join(this.workspacePath, "session.jsonl"),
        this.conversationHistory.map(m => JSON.stringify({ timestamp: Date.now(), ...m })).join("\n") + "\n",
        "utf-8"
      );
    } catch (writeErr: any) {
      console.error(`[AgentRuntime - ${this.agentId}] Failed to write session.jsonl:`, writeErr.message);
    }

    console.log(`[AgentRuntime - ${this.agentId}] Context compaction complete.`);
    const postTokens = this.estimateContextTokens(systemPrompt);
    await this.reportProgress({
      type: "compaction_end",
      detail: `Intelligent compaction complete: context reduced to ${postTokens} tokens.`
    });
  }

  public close() {
    this.agentMood = "idle";
    this.writeMoodFile().catch(() => {});
    this.ws.close();
  }
}
