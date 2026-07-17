import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

export interface StreamState {
  sessionId: string;
  agentId: string;
  chatId: number;
  threadId?: number;
  messageId: number | null;
  textBuffer: string;
  totalText: string;
  activeToolLabel: string | null;
  activeToolName: string | null;
  debounceTimer: NodeJS.Timeout | null;
  coalesceTimer: NodeJS.Timeout | null;
  lastEditTime: number;
  sentMediaKeys: Set<string>;
  rotationCount: number;
  toolCallCount: number;
}

export interface MediaLogEntry {
  timestamp: number;
  sessionId: string;
  agentId: string;
  chatId: number;
  mediaPath: string;
  mediaType: string;
  idempotencyKey: string;
  success: boolean;
}

export interface ReactionLogEntry {
  timestamp: number;
  sessionId: string;
  agentId: string;
  chatId: number;
  messageId: number;
  reactions: string[];
  fromUser: string;
}

export class TelegramStreamer {
  private static instance: TelegramStreamer | null = null;
  private states = new Map<string, StreamState>();
  private globalConfig: any = null;

  public mediaLogs: MediaLogEntry[] = [];
  public reactionLogs: ReactionLogEntry[] = [];

  private constructor() {}

  public static getInstance(): TelegramStreamer {
    if (!TelegramStreamer.instance) {
      TelegramStreamer.instance = new TelegramStreamer();
    }
    return TelegramStreamer.instance;
  }

  public setGlobalConfig(config: any) {
    this.globalConfig = config;
  }

  public getOrCreateState(sessionId: string, agentId: string, chatId: number, threadId?: number): StreamState {
    let state = this.states.get(sessionId);
    if (!state) {
      state = {
        sessionId,
        agentId,
        chatId,
        threadId,
        messageId: null,
        textBuffer: "",
        totalText: "",
        activeToolLabel: null,
        activeToolName: null,
        debounceTimer: null,
        coalesceTimer: null,
        lastEditTime: 0,
        sentMediaKeys: new Set<string>(),
        rotationCount: 0,
        toolCallCount: 0
      };
      this.states.set(sessionId, state);
    }
    return state;
  }

  public getStreamConfig(agentId: string) {
    if (!this.globalConfig) {
      return { enabled: true, maxChars: 800, debounceMs: 500, coalesceMs: 2000 };
    }
    const agent = this.globalConfig.agents?.find((a: any) => a.id === agentId);
    let agentSpecific: any = {};
    if (agent && agent.workspace) {
      const agentConfigPath = join(agent.workspace, "agent.config.json");
      if (existsSync(agentConfigPath)) {
        try {
          const raw = readFileSync(agentConfigPath, "utf-8");
          const parsed = JSON.parse(raw);
          agentSpecific = parsed.channels?.telegram?.streaming || {};
        } catch {}
      }
    }

    const globalTelegram = this.globalConfig.channels?.telegram?.streaming || {};
    return {
      enabled: agentSpecific.preview?.enabled ?? globalTelegram.preview?.enabled ?? true,
      maxChars: agentSpecific.preview?.chunk?.maxChars ?? globalTelegram.preview?.chunk?.maxChars ?? 800,
      debounceMs: agentSpecific.preview?.debounceMs ?? globalTelegram.preview?.debounceMs ?? 500,
      coalesceMs: agentSpecific.preview?.coalesceMs ?? globalTelegram.preview?.coalesceMs ?? 2000,
    };
  }

  public getActivePreviewBlocks(): Array<{ sessionId: string; agentId: string; chatId: number; rotationCount: number; hasActiveMessage: boolean }> {
    const list: any[] = [];
    for (const [sessionId, state] of this.states.entries()) {
      list.push({
        sessionId,
        agentId: state.agentId,
        chatId: state.chatId,
        rotationCount: state.rotationCount,
        hasActiveMessage: state.messageId !== null
      });
    }
    return list;
  }

  public logReaction(sessionId: string, chatId: number, messageId: number, reactions: string[], fromUser: string) {
    const agentId = sessionId.split(":")[1] || "agent";
    this.reactionLogs.unshift({
      timestamp: Date.now(),
      sessionId,
      agentId,
      chatId,
      messageId,
      reactions,
      fromUser
    });
    if (this.reactionLogs.length > 50) {
      this.reactionLogs.pop();
    }
  }

  public async handleProgressEvent(
    sessionId: string,
    chatId: number,
    threadId: number | undefined,
    event: any,
    bot: any
  ) {
    const agentId = event.agentId || sessionId.split(":")[1] || "agent";
    const config = this.getStreamConfig(agentId);

    if (!config.enabled) {
      return;
    }

    const state = this.getOrCreateState(sessionId, agentId, chatId, threadId);

    if (event.type === "turn_start") {
      this.resetState(state);
      return;
    }

    if (event.type === "thinking_stream" && event.chunk) {
      state.textBuffer += event.chunk;
      state.totalText += event.chunk;

      const cleanText = state.textBuffer.trim();
      if (!cleanText) return;

      // Rotation Check
      if (state.textBuffer.length > config.maxChars) {
        await this.freezeCurrentBlock(state, bot);
      }

      if (state.messageId === null && !state.debounceTimer) {
        state.debounceTimer = setTimeout(async () => {
          state.debounceTimer = null;
          await this.sendInitialPreview(state, bot);
        }, config.debounceMs);
      } else if (state.messageId !== null && !state.coalesceTimer) {
        state.coalesceTimer = setTimeout(async () => {
          state.coalesceTimer = null;
          await this.editCurrentPreview(state, bot);
        }, config.coalesceMs);
      }
    }

    if (event.type === "tool_start" && event.toolName) {
      state.toolCallCount++;
      const emoji = this.resolveToolEmoji(event.toolName);
      const toolArgs = event.toolArgs ? this.formatToolArgs(event.toolName, event.toolArgs) : "";
      state.activeToolName = event.toolName;
      state.activeToolLabel = `${emoji} *${event.toolName}*${toolArgs ? `\n\`${toolArgs}\`` : ""}`;

      // Cancel pending debounce — tool_start is more urgent
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = null;
      }

      if (state.messageId === null) {
        // No preview yet — force-send one immediately so tool execution is visible
        await this.sendInitialPreview(state, bot);
      } else {
        await this.editCurrentPreview(state, bot);
      }
    }

    if (event.type === "tool_end" && event.toolName) {
      const emoji = this.resolveToolEmoji(event.toolName);
      const outputPreview = event.toolOutput
        ? this.truncateOutput(String(event.toolOutput))
        : "";
      // Show ✅ done label briefly before clearing
      state.activeToolLabel = `${emoji} *${event.toolName}* ✅${outputPreview ? `\n\`${outputPreview}\`` : ""}`;
      state.activeToolName = null;
      if (state.messageId !== null) {
        await this.editCurrentPreview(state, bot);
      }
      // Clear the done label after 1.5 seconds so it doesn't pollute the final message
      setTimeout(() => { state.activeToolLabel = null; }, 1500);
    }

    if (event.type === "thinking" && event.detail) {
      // Plan preview, goal inference, compaction notes — show as a transient status
      if (state.messageId === null && !state.debounceTimer) {
        const prevBuffer = state.textBuffer;
        state.textBuffer = `💭 ${event.detail.slice(0, 300)}`;
        await this.sendInitialPreview(state, bot);
        state.textBuffer = prevBuffer; // restore after sending
      }
    }
  }

  private async sendInitialPreview(state: StreamState, bot: any) {
    const text = this.formatPreviewText(state);
    if (!text.trim()) return;

    const options: any = { parse_mode: "Markdown" };
    if (state.threadId) options.message_thread_id = state.threadId;

    try {
      const res = await bot.telegram.sendMessage(state.chatId, text, options);
      state.messageId = res.message_id;
      state.lastEditTime = Date.now();
    } catch (err: any) {
      console.error(`[TelegramStreamer] Failed to send initial preview:`, err.message);
    }
  }

  private async editCurrentPreview(state: StreamState, bot: any) {
    if (state.messageId === null) return;
    const text = this.formatPreviewText(state);
    if (!text.trim()) return;

    const options: any = { parse_mode: "Markdown" };
    if (state.threadId) options.message_thread_id = state.threadId;

    try {
      await bot.telegram.editMessageText(state.chatId, state.messageId, undefined, text, options);
      state.lastEditTime = Date.now();
    } catch (err: any) {
      if (err.message?.includes("message is not modified")) return;
      console.error(`[TelegramStreamer] Failed to edit preview:`, err.message);
    }
  }

  private async freezeCurrentBlock(state: StreamState, bot: any) {
    if (state.messageId === null) return;

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    if (state.coalesceTimer) {
      clearTimeout(state.coalesceTimer);
      state.coalesceTimer = null;
    }

    const text = state.textBuffer.trim();
    const options: any = { parse_mode: "Markdown" };
    if (state.threadId) options.message_thread_id = state.threadId;

    try {
      await bot.telegram.editMessageText(state.chatId, state.messageId, undefined, text, options);
    } catch (err: any) {
      if (!err.message?.includes("message is not modified")) {
        console.error(`[TelegramStreamer] Freeze edit failed:`, err.message);
      }
    }

    state.messageId = null;
    state.textBuffer = "";
    state.activeToolLabel = null;
    state.rotationCount++;
  }

  public async finalizeTurn(
    sessionId: string,
    agentId: string,
    chatId: number,
    threadId: number | undefined,
    bot: any,
    finalText: string,
    hasMedia: boolean,
    mediaType: "photo" | "voice" | null,
    mediaPath: string,
    idempotencyKey?: string
  ): Promise<number | null> {
    const state = this.getOrCreateState(sessionId, agentId, chatId, threadId);

    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }
    if (state.coalesceTimer) {
      clearTimeout(state.coalesceTimer);
      state.coalesceTimer = null;
    }

    if (hasMedia && state.messageId !== null) {
      await this.freezeCurrentBlock(state, bot);
    }

    let mediaMsgId: number | null = null;
    if (hasMedia && mediaPath) {
      const mediaKey = idempotencyKey || `${sessionId}:${mediaPath}`;
      const isAlreadySent = state.sentMediaKeys.has(mediaKey);
      if (!isAlreadySent) {
        state.sentMediaKeys.add(mediaKey);
        const options: any = { caption: finalText || "" };
        if (state.threadId) options.message_thread_id = state.threadId;

        try {
          if (mediaType === "photo") {
            const res = await bot.telegram.sendPhoto(chatId, { source: mediaPath }, options);
            mediaMsgId = res.message_id;
          } else {
            const asVoice = mediaPath.includes("voice") || mediaPath.includes("voice_note") || finalText.includes("[[audio_as_voice]]");
            const res = await bot.telegram.sendVoice(chatId, { source: mediaPath }, { ...options, asVoice });
            mediaMsgId = res.message_id;
          }
        } catch (err: any) {
          console.error(`[TelegramStreamer] Media send failed:`, err.message);
        }
      }

      this.mediaLogs.unshift({
        timestamp: Date.now(),
        sessionId,
        agentId,
        chatId,
        mediaPath,
        mediaType: mediaType || "voice",
        idempotencyKey: mediaKey,
        success: mediaMsgId !== null || isAlreadySent
      });
      if (this.mediaLogs.length > 50) {
        this.mediaLogs.pop();
      }
    }

    let textMsgId: number | null = null;
    const remainingText = hasMedia ? "" : (finalText || "");
    
    if (remainingText) {
      const options: any = { parse_mode: "Markdown" };
      if (state.threadId) options.message_thread_id = state.threadId;

      if (state.messageId !== null) {
        try {
          await bot.telegram.editMessageText(chatId, state.messageId, undefined, remainingText, options);
          textMsgId = state.messageId;
        } catch (err: any) {
          if (err.message?.includes("message is not modified")) {
            textMsgId = state.messageId;
          } else {
            console.warn(`[TelegramStreamer] Final edit failed, falling back to sendMessage:`, err.message);
            const res = await bot.telegram.sendMessage(chatId, remainingText, options);
            textMsgId = res.message_id;
          }
        }
      } else {
        try {
          const res = await bot.telegram.sendMessage(chatId, remainingText, options);
          textMsgId = res.message_id;
        } catch (err: any) {
          console.error(`[TelegramStreamer] Final sendMessage failed:`, err.message);
        }
      }
    }

    this.states.delete(sessionId);
    return mediaMsgId || textMsgId;
  }

  private resetState(state: StreamState) {
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    if (state.coalesceTimer) clearTimeout(state.coalesceTimer);
    state.messageId = null;
    state.textBuffer = "";
    state.totalText = "";
    state.activeToolLabel = null;
    state.activeToolName = null;
    state.debounceTimer = null;
    state.coalesceTimer = null;
    state.lastEditTime = 0;
    state.rotationCount = 0;
    state.toolCallCount = 0;
  }

  private formatPreviewText(state: StreamState): string {
    const buf = state.textBuffer.trim();
    const label = state.activeToolLabel || "";
    if (buf && label) return `${buf}\n\n${label}`;
    if (label) return label;
    return buf;
  }

  private formatToolArgs(toolName: string, args: Record<string, any>): string {
    // Show the most meaningful arg as a short preview
    const n = toolName.toLowerCase();
    if (args.query) return String(args.query).slice(0, 60);
    if (args.url) return String(args.url).slice(0, 60);
    if (args.path) return String(args.path).slice(0, 60);
    if (args.command) return String(args.command).slice(0, 60);
    if (args.file_path) return String(args.file_path).slice(0, 60);
    if (args.target) return String(args.target).slice(0, 60);
    const vals = Object.values(args).filter(v => typeof v === "string" || typeof v === "number");
    if (vals.length > 0) return String(vals[0]).slice(0, 60);
    return "";
  }

  private truncateOutput(output: string): string {
    const clean = output.replace(/\n/g, " ").trim();
    return clean.length > 80 ? clean.slice(0, 80) + "…" : clean;
  }

  private resolveToolEmoji(name: string): string {
    const n = name.toLowerCase();
    if (n === "exec" || n === "run_command" || n === "bash" || n === "shell") return "🖥️";
    if (n.includes("search") || n.includes("google") || n.includes("web")) return "🔎";
    if (n.includes("read") || n.includes("view") || n.includes("fetch")) return "📄";
    if (n.includes("write") || n.includes("replace") || n.includes("edit") || n.includes("append")) return "📝";
    if (n.includes("cron") || n.includes("schedule") || n.includes("timer")) return "⏰";
    if (n.includes("list") || n.includes("dir") || n.includes("ls")) return "📂";
    if (n.includes("agent") || n.includes("spawn") || n.includes("bus")) return "🤖";
    if (n.includes("memory") || n.includes("remember")) return "🧠";
    if (n.includes("skill") || n.includes("plugin")) return "🔌";
    if (n.includes("telegram") || n.includes("send") || n.includes("message")) return "📨";
    if (n.includes("image") || n.includes("photo") || n.includes("vision")) return "🖼️";
    if (n.includes("code") || n.includes("run") || n.includes("execute")) return "⚡";
    return "🔧";
  }
}
