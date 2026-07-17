import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";

function getAgentIdFromSession(sessionId: string): string {
  if (sessionId.startsWith("agent:")) {
    return sessionId.split(":")[1];
  }
  return sessionId.split(":")[0];
}

export interface PipelineConfig {
  messages?: {
    inbound?: {
      debounceMs?: number;
      byChannel?: Record<string, number>;
    };
    queue?: {
      default?: "interrupt" | "steer" | "followup" | "collect";
      byChannel?: Record<string, "interrupt" | "steer" | "followup" | "collect">;
    };
    groupChat?: {
      historyLimit?: number;
    };
    responsePrefix?: string;
  };
  channels?: Record<string, {
    responsePrefix?: string;
    accounts?: Record<string, {
      responsePrefix?: string;
    }>;
  }>;
  agents?: Array<{
    id: string;
    defaults?: {
      blockStreamingDefault?: boolean;
    };
  }>;
}

export interface WakeEvent {
  type: "message" | "heartbeat" | "cron" | "hook" | "webhook";
  sessionId: string;
  agentId: string;
  payload: {
    message?: string;
    envelope?: any;
    cadence?: string;      // heartbeat
    cronExpression?: string; // cron
    hookName?: string;     // hook
    hookData?: any;
    body?: any;            // webhook
    headers?: Record<string, string>;
  };
  timestamp: number;
}

export class MessagePipeline {
  // Dedup Cache: keyed by message-id
  private dedupCache = new Map<string, number>();

  // Inbound Debouncing
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceBatches = new Map<string, WakeEvent[]>();

  // Backlog buffer for group chats (messages not yet triggering run)
  private groupChatBacklog = new Map<string, { sender: string; content: string }[]>();

  // Active runs tracker
  private activeRuns = new Set<string>();

  // Session-specific settings (like reasoning visibility)
  private sessionSettings = new Map<string, { reasoning: "on" | "off" | "stream" }>();

  // Collected messages for "collect" queue mode
  private collectedMessages = new Map<string, string[]>();

  // Session command queues for "followup" mode
  private sessionQueues = new Map<string, WakeEvent[]>();

  // Typing indicator cancelers - keyed by sessionId
  // Registered by TelegramBridge when a Telegram message arrives
  private typingCancelers = new Map<string, () => void>();

  // Stores the last reply text produced by cron-triggered turns.
  // Keyed by sessionId; consumed and cleared by the cron scheduler
  // after each job run to guarantee Telegram delivery.
  public readonly lastCronReplies = new Map<string, string>();

  constructor(
    private readonly sessionManager: any,
    private readonly globalConfig: any,
    private readonly sendWsRequest: (ws: WebSocket, method: string, params: any) => Promise<any>,
    private readonly broadcastToClients: (event: any) => void,
    private readonly editTelegramMessage: (chatId: number, msgId: number, text: string, bot: any) => Promise<void>,
    private readonly replyTelegramMessage: (chatId: number, text: string, bot: any) => Promise<number>,
    private readonly getTelegramBot: (agentId: string) => any
  ) {
    // Periodically clean dedup cache
    setInterval(() => {
      const now = Date.now();
      for (const [key, time] of this.dedupCache.entries()) {
        if (now - time > 300000) { // 5 minutes lifetime
          this.dedupCache.delete(key);
        }
      }
    }, 60000);
  }



  /**
   * Main pipeline entry point.
   */
  public async handleInbound(
    channel: "telegram" | "web",
    accountId: string,
    sessionId: string,
    rawText: string,
    envelope: any
  ): Promise<void> {
    const agentId = getAgentIdFromSession(sessionId);
    const wakeEvent: WakeEvent = {
      type: "message",
      sessionId,
      agentId,
      payload: {
        message: rawText,
        envelope
      },
      timestamp: Date.now()
    };
    return this.handleWakeEvent(wakeEvent);
  }

  public async handleWakeEvent(wakeEvent: WakeEvent): Promise<void> {
    const { type, sessionId, agentId, payload } = wakeEvent;

    // 1. Duplicate Suppression Check (only for message types)
    if (type === "message") {
      const channel = wakeEvent.payload.envelope?.channel || "web";
      const accountId = wakeEvent.payload.envelope?.sender?.username || "anon";
      const dedupKey = `${channel}:${accountId}:${wakeEvent.payload.envelope?.sender?.id || "anon"}:${sessionId}:${wakeEvent.payload.envelope?.messageId || wakeEvent.payload.envelope?.timestamp}`;
      if (this.dedupCache.has(dedupKey)) {
        console.log(`[Pipeline] Suppressing duplicate message: ${dedupKey}`);
        return;
      }
      this.dedupCache.set(dedupKey, Date.now());

      // Separate Directive parsing (CommandBody vs Body)
      const rawText = payload.message || "";
      const isCommand = rawText.startsWith("/");
      if (isCommand) {
        const parts = rawText.split(" ");
        const cmd = parts[0].toLowerCase();
        const arg = parts[1]?.toLowerCase();

        if (cmd === "/reasoning" && (arg === "on" || arg === "off" || arg === "stream")) {
          this.setReasoningSetting(sessionId, arg as any);
          const reply = `Reasoning visibility updated to: **${arg}** for session ${sessionId}`;
          await this.sendOutbound(channel, sessionId, reply, wakeEvent.payload.envelope);
          return; // Handled command, stop pipeline
        }
      }

      // Group Chat Check & Backlog buffering
      const isMentioned = this.isBotMentioned(rawText, agentId);
      const isGroup = wakeEvent.payload.envelope?.chatId && wakeEvent.payload.envelope?.chatId !== wakeEvent.payload.envelope?.sender?.id;

      if (isGroup && channel === "telegram") {
        if (!isMentioned) {
          let backlog = this.groupChatBacklog.get(sessionId) || [];
          backlog.push({ sender: wakeEvent.payload.envelope?.sender?.firstName || "User", content: rawText });
          this.groupChatBacklog.set(sessionId, backlog.slice(-20)); // Limit to last 20 messages
          console.log(`[Pipeline] Buffered group message to backlog for session ${sessionId}`);
          return;
        }
      }
    }

    // 2. Debouncing Inbound messages (only messages get debounced)
    if (type !== "message") {
      await this.processWakeTurn(wakeEvent);
      return;
    }

    const channel = wakeEvent.payload.envelope?.channel || "web";
    const config = this.globalConfig as PipelineConfig;
    const debounceMs = config.messages?.inbound?.byChannel?.[channel] ?? config.messages?.inbound?.debounceMs ?? 2000;

    let batch = this.debounceBatches.get(sessionId) || [];
    batch.push(wakeEvent);
    this.debounceBatches.set(sessionId, batch);

    if (this.debounceTimers.has(sessionId)) {
      clearTimeout(this.debounceTimers.get(sessionId)!);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(sessionId);
      const currentBatch = this.debounceBatches.get(sessionId) || [];
      this.debounceBatches.delete(sessionId);

      if (currentBatch.length === 0) return;

      const combinedText = currentBatch.map(b => b.payload.message).join(" ");
      const latestEvent = currentBatch[currentBatch.length - 1];

      const batchedEvent: WakeEvent = {
        ...latestEvent,
        payload: {
          ...latestEvent.payload,
          message: combinedText
        }
      };

      await this.processWakeTurn(batchedEvent);
    }, debounceMs);

    this.debounceTimers.set(sessionId, timer);
  }

  /**
   * Registers a callback to stop the Telegram typing indicator for a session.
   * Called by TelegramBridge after starting the typing loop.
   */
  public registerTypingCanceler(sessionId: string, cancel: () => void) {
    // Cancel any existing canceler first (e.g. rapid messages)
    const existing = this.typingCancelers.get(sessionId);
    if (existing) existing();
    this.typingCancelers.set(sessionId, cancel);
  }

  /**
   * Clears and fires the typing canceler for the given session.
   */
  public clearTypingCanceler(sessionId: string) {
    const cancel = this.typingCancelers.get(sessionId);
    if (cancel) {
      cancel();
      this.typingCancelers.delete(sessionId);
    }
  }

  /**
   * Sets session-specific settings.
   */
  public setReasoningSetting(sessionId: string, val: "on" | "off" | "stream") {
    this.sessionSettings.set(sessionId, { reasoning: val });
    this.broadcastToClients({
      type: "session_setting_updated",
      sessionId,
      settings: { reasoning: val }
    });
  }

  public getReasoningSetting(sessionId: string): "on" | "off" | "stream" {
    return this.sessionSettings.get(sessionId)?.reasoning || "off";
  }

  /**
   * Returns current pipeline parameters for Dashboard status mapping.
   */
  public getSessionPipelineStatus(sessionId: string) {
    const config = this.globalConfig as PipelineConfig;
    const queueMode = config.messages?.queue?.byChannel?.telegram ?? config.messages?.queue?.default ?? "steer";
    const agent = config.agents?.find(a => a.id === getAgentIdFromSession(sessionId));
    const blockStreaming = agent?.defaults?.blockStreamingDefault ?? false;
    const debounceMs = config.messages?.inbound?.debounceMs ?? 2000;

    return {
      queueMode,
      blockStreaming,
      reasoning: this.getReasoningSetting(sessionId),
      debounceMs,
      active: this.activeRuns.has(sessionId)
    };
  }

  public hasActiveRunsForAgent(agentId: string): boolean {
    const prefix = `${agentId}:`;
    for (const sessId of this.activeRuns) {
      if (sessId.startsWith(prefix)) return true;
    }
    return false;
  }

  private isBotMentioned(text: string, agentId: string): boolean {
    const cleanId = agentId.toLowerCase();
    const cleanText = text.toLowerCase();
    return cleanText.includes(`@${cleanId}`) || cleanText.includes(cleanId) || cleanText.includes("bot");
  }

  /**
   * Processes the normalized WakeEvent.
   */
  private async processWakeTurn(wakeEvent: WakeEvent): Promise<void> {
    const { type, sessionId, agentId, payload } = wakeEvent;
    const channel = payload.envelope?.channel || "web";
    const config = this.globalConfig as PipelineConfig;
    let queueMode = config.messages?.queue?.byChannel?.[channel] ?? config.messages?.queue?.default ?? "followup";

    // If an agent run is already active for this session
    if (this.activeRuns.has(sessionId)) {
      console.log(`[Pipeline] Active run in progress for session ${sessionId}. Applying queue mode: ${queueMode}`);

      if (queueMode === "interrupt") {
        try {
          this.sessionManager.terminateSession(sessionId);
        } catch {}
        this.activeRuns.delete(sessionId);
        setTimeout(() => this.processWakeTurn(wakeEvent), 500);
        return;
      } else if (queueMode === "steer" && type === "message") {
        const ws = this.sessionManager.getAgentConnection(sessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            await this.sendWsRequest(ws, "steerTurn", { sessionId, message: payload.message });
            console.log(`[Pipeline] Steered active run with message: "${payload.message}"`);
            return;
          } catch (err: any) {
            console.error(`[Pipeline] Failed to steer active run:`, err.message);
          }
        }
        queueMode = "followup";
      }

      if (queueMode === "collect" && type === "message") {
        let col = this.collectedMessages.get(sessionId) || [];
        col.push(payload.message || "");
        this.collectedMessages.set(sessionId, col);
        return;
      }

      // Default: followup (sequential queueing)
      let q = this.sessionQueues.get(sessionId) || [];
      q.push(wakeEvent as any);
      this.sessionQueues.set(sessionId, q);
      return;
    }

    this.activeRuns.add(sessionId);

    // Build full body (Backlog wrapper for group chat)
    let body = payload.message || "";
    const backlog = this.groupChatBacklog.get(sessionId) || [];
    this.groupChatBacklog.delete(sessionId);

    if (backlog.length > 0 && type === "message") {
      const historyLimit = config.messages?.groupChat?.historyLimit || 10;
      const formattedBacklog = backlog
        .slice(-historyLimit)
        .map(m => `${m.sender}: ${m.content}`)
        .join("\n");
      body = `[Chat messages since your last reply - for context]\n${formattedBacklog}\n\n[Current message - respond to this]\n${body}`;
    }

    const reasoningSetting = this.getReasoningSetting(sessionId);

    // Progress draft variables
    let progressMsgId: number | undefined;
    const bot = channel === "telegram" ? this.getTelegramBot(agentId) : null;

    try {
      const ws = await this.sessionManager.ensureAgentRunning(agentId, sessionId);

      const executionEvent: WakeEvent = {
        ...wakeEvent,
        payload: {
          ...payload,
          message: body
        }
      };

      const result = await this.sendWsRequest(ws, "runTurn", {
        sessionId,
        wakeEvent: executionEvent
      });

      try {
        const { GatewayWatchdog } = await import("./watchdog.js");
        if (result) {
          if (result.tokensUsed) {
            GatewayWatchdog.getInstance().recordTurnCost(agentId, result.tokensUsed);
          }
          if (result.toolTrace && Array.isArray(result.toolTrace)) {
            for (const tool of result.toolTrace) {
              GatewayWatchdog.getInstance().recordToolCall(agentId, !!tool.isError);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Pipeline] Watchdog recording failed:`, err.message);
      }

      let finalReply = result.reply || "No reply generated.";
      if (reasoningSetting === "off") {
        finalReply = finalReply.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
      }

      // Store cron reply so the scheduler can guarantee Telegram delivery
      if (wakeEvent.type === "cron") {
        this.lastCronReplies.set(sessionId, finalReply);
      }

      await this.sendOutbound(channel, sessionId, finalReply, payload.envelope, progressMsgId);
    } catch (err: any) {
      const errMsg = `⚠️ Execution error: ${err.message}`;
      console.error(`[Pipeline] Dispatch turn execution failed:`, err.message);
      // Store error as cron reply too so scheduler knows what happened
      if (wakeEvent.type === "cron") {
        this.lastCronReplies.set(sessionId, errMsg);
      }
      // Stop typing indicator on error before sending the error message
      this.clearTypingCanceler(sessionId);
      await this.sendOutbound(channel, sessionId, errMsg, payload.envelope, progressMsgId);
    } finally {
      this.activeRuns.delete(sessionId);

      // Trigger followup queues or collections
      const followupMsgs = this.collectedMessages.get(sessionId) || [];
      this.collectedMessages.delete(sessionId);

      if (followupMsgs.length > 0) {
        const combinedFollowup = followupMsgs.join("\n");
        const nextEvent: WakeEvent = {
          type: "message",
          sessionId,
          agentId,
          payload: {
            message: combinedFollowup,
            envelope: payload.envelope
          },
          timestamp: Date.now()
        };
        await this.processWakeTurn(nextEvent);
      } else {
        const nextInQueue = this.sessionQueues.get(sessionId)?.shift();
        if (nextInQueue) {
          await this.processWakeTurn(nextInQueue as any);
        }
      }
    }
  }

  private formatCompositeProgress(thinking: string, answer: string, reasoning: string): string {
    let result = "";
    if (reasoning === "stream" && thinking) {
      result += `💭 *Thinking:*\n_${thinking}_\n\n`;
    }
    if (answer) {
      result += `💬 *Answer so far:*\n${answer}`;
    } else {
      result += `⏳ *Generating reply...*`;
    }
    return result;
  }

  /**
   * Central outbound formatting and dispatch.
   */
  private async sendOutbound(
    channel: "telegram" | "web",
    sessionId: string,
    rawReply: string,
    envelope: any,
    progressMsgId?: number
  ): Promise<void> {
    const config = this.globalConfig as PipelineConfig;
    const agentId = getAgentIdFromSession(sessionId);

    // Outbound Prefix Cascade Lookup
    let prefix = config.messages?.responsePrefix || "";
    if (config.channels?.[channel]?.responsePrefix) {
      prefix = config.channels[channel].responsePrefix!;
    }
    const channelAccount = envelope?.accountId || "default";
    if (config.channels?.[channel]?.accounts?.[channelAccount]?.responsePrefix) {
      prefix = config.channels[channel].accounts![channelAccount].responsePrefix!;
    }

    // If this is a cron-triggered Telegram reply, prepend a header so the user
    // knows which job/agent is reporting and at what time.
    let cronHeader = "";
    if (envelope?.isCron) {
      const jobName = envelope.cronJobName || agentId;
      const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      cronHeader = `🤖 *${agentId}* — _scheduled run at ${now}_\n━━━━━━━━━━━━━━━\n`;
    }

    const formattedReply = `${cronHeader}${prefix ? `${prefix} ` : ""}${rawReply}`;

    if (channel === "telegram" && envelope?.chatId) {
      const bot = this.getTelegramBot(agentId);
      if (bot) {
        // Stop the typing indicator right before the reply lands
        this.clearTypingCanceler(sessionId);
        try {
          if (progressMsgId) {
            // Edit/Finalize the active draft message directly
            await this.editTelegramMessage(envelope.chatId, progressMsgId, formattedReply, bot);
          } else {
            await this.replyTelegramMessage(envelope.chatId, formattedReply, bot);
          }
          console.log(`[Pipeline] ✅ Telegram reply delivered for session ${sessionId} → chatId ${envelope.chatId}`);
        } catch (tgErr: any) {
          console.error(`[Pipeline] ❌ Telegram delivery failed for session ${sessionId}:`, tgErr.message);
        }
      } else {
        console.warn(`[Pipeline] ⚠️ No Telegram bot found for agentId='${agentId}' (session ${sessionId}). Reply NOT delivered to Telegram.`);
        // Still broadcast to web bus as fallback
        this.broadcastToClients({
          type: "agent_message",
          sessionId,
          content: formattedReply,
          timestamp: Date.now()
        });
      }
    } else {
      // Dispatch Web outbound response to Dashboard websocket clients
      this.broadcastToClients({
        type: "agent_message",
        sessionId,
        content: formattedReply,
        timestamp: Date.now()
      });
    }
  }

  // Maps to keep track of stream accumulators per session key
  private sessionThinkingTexts = new Map<string, string>();
  private sessionAnswerTexts = new Map<string, string>();

  public async handleProgressEvent(sessionId: string, chatId: any, threadId: any, event: any) {
    const agentId = getAgentIdFromSession(sessionId);
    const reasoningSetting = this.getReasoningSetting(sessionId);

    const { resolveRuntimeStatus } = await import("./status-resolver.js");
    const status = resolveRuntimeStatus(agentId, sessionId, this.globalConfig);
    
    // Propagate events to Dashboard in real-time
    this.broadcastToClients({
      type: "loop_progress",
      sessionId,
      event: {
        ...event,
        runtime: status.runtime,
        reason: status.reason
      }
    });

    if (event.type === "thinking_stream" && event.chunk) {
      if (reasoningSetting === "stream") {
        let text = this.sessionThinkingTexts.get(sessionId) || "";
        text += event.chunk;
        this.sessionThinkingTexts.set(sessionId, text);
      } else {
        let text = this.sessionAnswerTexts.get(sessionId) || "";
        text += event.chunk;
        this.sessionAnswerTexts.set(sessionId, text);
      }
    }

    if (event.type === "turn_end") {
      this.sessionThinkingTexts.delete(sessionId);
      this.sessionAnswerTexts.delete(sessionId);
    }
  }
}
