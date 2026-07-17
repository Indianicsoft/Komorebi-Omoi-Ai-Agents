import { Telegraf } from "telegraf";
import { z } from "zod";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

// Progress Configuration Schema
export const ProgressConfigSchema = z.object({
  mode: z.enum(["off", "partial", "block", "progress"]).default("progress"),
  progress: z.object({
    label: z.union([
      z.literal("auto"),
      z.string(),
      z.array(z.string())
    ]).default("auto"),
    toolProgress: z.boolean().default(true),
    commentary: z.boolean().default(true),
    detailMode: z.enum(["explain", "raw"]).default("explain"),
    commandText: z.enum(["raw", "status"]).default("status"),
    lineLimit: z.number().default(10),
    lineCharBudget: z.number().default(120),
    cleanupOnFallback: z.boolean().default(true),
    showElapsedTime: z.boolean().default(true),
    showAnswerPreview: z.boolean().default(false),
    answerPreviewChars: z.number().default(200)
  }).default({
    label: "auto",
    toolProgress: true,
    commentary: true,
    detailMode: "explain",
    commandText: "status",
    lineLimit: 10,
    lineCharBudget: 120,
    cleanupOnFallback: true,
    showElapsedTime: true,
    showAnswerPreview: false,
    answerPreviewChars: 200
  })
}).default({
  mode: "progress",
  progress: {
    label: "auto",
    toolProgress: true,
    commentary: true,
    detailMode: "explain",
    commandText: "status",
    lineLimit: 10,
    lineCharBudget: 120,
    cleanupOnFallback: true,
    showElapsedTime: true,
    showAnswerPreview: false,
    answerPreviewChars: 200
  }
});

export const TelegramStreamingConfigSchema = z.object({
  streaming: ProgressConfigSchema.default({
    mode: "progress",
    progress: {
      label: "auto",
      toolProgress: true,
      commentary: true,
      detailMode: "explain",
      commandText: "status",
      lineLimit: 10,
      lineCharBudget: 120,
      cleanupOnFallback: true,
      showElapsedTime: true,
      showAnswerPreview: false,
      answerPreviewChars: 200
    }
  })
}).default({
  streaming: {
    mode: "progress",
    progress: {
      label: "auto",
      toolProgress: true,
      commentary: true,
      detailMode: "explain",
      commandText: "status",
      lineLimit: 10,
      lineCharBudget: 120,
      cleanupOnFallback: true,
      showElapsedTime: true,
      showAnswerPreview: false,
      answerPreviewChars: 200
    }
  }
});

export type ProgressConfig = z.infer<typeof ProgressConfigSchema>;

export interface ProgressEvent {
  type: "thinking" | "tool_start" | "tool_end" | "skill_use" | "bus_send" | "bus_recv" | "approval_wait" | "turn_start" | "turn_end" | "meta_updating" | "answer_chunk" | "thinking_stream" | "compaction_start" | "compaction_end";
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: any;
  toolOutput?: string;
  agentId?: string;
  skillName?: string;
  detail?: string;
  chunk?: string;
}

export interface ProgressDraft {
  messageId: number | null;
  label: string;
  lines: string[];
  startedAt: number;
  lastEditAt: number;
  state: "idle" | "pending" | "active" | "finalizing" | "metaUpdating";
  buried: boolean;

  sessionId?: string;
  agentId?: string;

  // Tool call tracking: toolCallId → index in lines[]
  pendingToolTimers: Map<string, NodeJS.Timeout>;
  toolLinesMap: Map<string, number>;
  // Tool start timestamps for elapsed time: toolCallId → startMs
  toolStartTimes: Map<string, number>;

  // Answer preview streaming
  answerPreview: string;

  // Turn start delay timer (kept for API compat but no longer used for initial delay)
  delayTimer: NodeJS.Timeout | null;

  // Debounce/edit queue state
  pendingTextUpdate: string | null;
  editTimeout: NodeJS.Timeout | null;

  execution?: string;
  runtime?: string;
  channel?: string;
  agentName?: string;
}

// Redact secrets from text
export function redactSecrets(text: string): string {
  let redacted = text;
  redacted = redacted.replace(/(?:api_key|apikey|token|password|secret|bearer|auth|key|pass)[="'\s:]+([a-zA-Z0-9_\-\.]{8,})/gi, (match, keyVal) => {
    return match.replace(keyVal, "[REDACTED]");
  });
  redacted = redacted.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");
  redacted = redacted.replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]");
  redacted = redacted.replace(/[a-f0-9]{32,}/gi, "[REDACTED_HASH]");
  return redacted;
}

// Truncate progress lines cleanly
export function truncateLine(line: string, limit: number): string {
  if (line.length <= limit) return line;

  const hasPathOrCommand = line.includes("/") || line.includes("\\") || line.includes(" · ") || line.includes(".");
  if (hasPathOrCommand) {
    const segmentLen = Math.floor((limit - 3) / 2);
    return line.slice(0, segmentLen) + "..." + line.slice(line.length - segmentLen);
  } else {
    const truncated = line.slice(0, limit - 3);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > limit / 2) {
      return truncated.slice(0, lastSpace) + "...";
    }
    return truncated + "...";
  }
}

// Format elapsed time compactly
function fmtElapsed(startMs: number): string {
  const elapsedMs = Date.now() - startMs;
  if (elapsedMs < 1000) return `${elapsedMs}ms`;
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

// Pick emoji for tool/action names
function toolEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n === "exec" || n === "run_command" || n === "bash") return "🖥️";
  if (n.includes("search") || n.includes("google") || n.includes("brave") || n.includes("web")) return "🔎";
  if (n === "write_file" || n === "write_to_file" || n === "replace_file_content" || n.includes("write")) return "✍️";
  if (n === "read_file" || n === "view_file" || n.includes("read")) return "📖";
  if (n.includes("skill") || n === "read_skill" || n === "skills_install") return "🧩";
  if (n.includes("mcp") || n.includes(":")) return "🔌";
  if (n.includes("memory") || n.includes("recall") || n.includes("remem")) return "🧠";
  if (n.includes("image") || n.includes("generate_image")) return "🎨";
  if (n.includes("browse") || n.includes("browser") || n.includes("navigate")) return "🌐";
  if (n.includes("git") || n.includes("github")) return "📦";
  if (n.includes("telegram") || n.includes("send_message")) return "📨";
  if (n.includes("plan") || n.includes("milestone")) return "📋";
  return "⚙️";
}

// Generate formatted progress lines
export function formatProgressLine(
  event: "thinking" | "tool_start" | "tool_end" | "bus_send" | "bus_recv" | "approval_wait" | "skill_use",
  name: string,
  args: any,
  detailMode: "explain" | "raw",
  lineCharBudget: number,
  isPending: boolean = false,
  elapsedStr?: string
): string {
  let line = "";
  const spinner = isPending ? "⏳" : "";

  if (name === "exec" || name === "run_command" || name === "bash") {
    const cmd = args.command || args.CommandLine || args.cmd || "";
    const shortCmd = cmd.trim().split(" ")[0] || "shell";
    line = `${isPending ? "⏳" : "🖥️"} Shell: \`${shortCmd}\``;
    if (detailMode === "raw" && cmd) line += ` · ${cmd.slice(0, 60)}`;
  } else if (name.includes("search") || name === "web_search" || name === "search_web") {
    const query = args.query || args.q || "";
    line = `${isPending ? "⏳" : "🔎"} Search: "${query}"`;
  } else if (name === "write_file" || name === "write_to_file" || name === "replace_file_content" || name === "multi_replace_file_content") {
    const path = args.path || args.filepath || args.filePath || args.TargetFile || "";
    const file = path.split("/").pop() || path;
    line = `${isPending ? "⏳" : "✍️"} Write: ${file}`;
    if (detailMode === "raw" && path) line += ` · ${path.slice(0, 60)}`;
  } else if (name === "read_file" || name === "view_file" || name === "read_url_content") {
    const path = args.path || args.filepath || args.filePath || args.AbsolutePath || args.Url || "";
    const file = path.split("/").pop() || path.slice(0, 40);
    line = `${isPending ? "⏳" : "📖"} Read: ${file}`;
  } else if (name === "skills_install") {
    line = `${isPending ? "⏳" : "🧩"} Installing skill: ${args.slug || ""}`;
  } else if (name === "read_skill") {
    line = `${isPending ? "⏳" : "🧩"} Skill: ${args.skillName || args.name || ""}`;
  } else if (event === "skill_use") {
    line = `🧩 Skill: *${name}*`;
  } else if (name.includes(":")) {
    const parts = name.split(":");
    line = `${isPending ? "⏳" : "🔌"} MCP: ${parts[0]}/${parts[1]}`;
  } else if (event === "bus_send") {
    line = `🤝 → Agent: ${args.targetAgentId || args.agentId || ""}`;
  } else if (event === "bus_recv") {
    line = `🤝 ← Reply: ${args.senderAgentId || args.agentId || ""}`;
  } else if (event === "approval_wait") {
    line = `⏳ Awaiting approval: ${name}`;
  } else if (name === "generate_image") {
    line = `${isPending ? "⏳" : "🎨"} Generating image...`;
  } else if (name === "grep_search") {
    line = `${isPending ? "⏳" : "🔎"} Grep: "${(args.Query || args.query || "").slice(0, 40)}"`;
  } else if (name === "run_command") {
    const cmd = args.CommandLine || args.command || "";
    line = `${isPending ? "⏳" : "🖥️"} Run: \`${cmd.slice(0, 50)}\``;
  } else {
    const emoji = toolEmoji(name);
    line = `${isPending ? "⏳" : emoji} ${name.replace(/_/g, " ")}`;
    if (detailMode === "raw" && args && Object.keys(args).length > 0) {
      line += ` · ${JSON.stringify(args).slice(0, 50)}`;
    }
  }

  if (elapsedStr) {
    line += ` _(${elapsedStr})_`;
  }

  line = redactSecrets(line);
  return truncateLine(line, lineCharBudget);
}

// ─────────────────────────────────────────────────────────────────────────────
// ProgressDraftManager
// ─────────────────────────────────────────────────────────────────────────────

export class ProgressDraftManager {
  private drafts = new Map<string, ProgressDraft>();
  public activeSessionsByTimestamp = new Map<number, { sessionKey: string; sessionId: string }>();
  public completedThoughts = new Map<number, { finalText: string; thoughtsText: string }>();

  public getOrCreateDraft(key: string): ProgressDraft {
    let draft = this.drafts.get(key);
    if (!draft) {
      draft = {
        messageId: null,
        label: "Thinking",
        lines: [],
        startedAt: Date.now(),
        lastEditAt: 0,
        state: "idle",
        buried: false,
        pendingToolTimers: new Map(),
        toolLinesMap: new Map(),
        toolStartTimes: new Map(),
        answerPreview: "",
        delayTimer: null,
        pendingTextUpdate: null,
        editTimeout: null
      };
      this.drafts.set(key, draft);
    }
    return draft;
  }

  public getAgentProgressConfig(agentId: string, globalConfig: any): ProgressConfig {
    const agent = globalConfig.agents?.find((a: any) => a.id === agentId);
    let agentSpecificConfig: any = {};
    if (agent && agent.workspace) {
      const agentConfigPath = join(agent.workspace, "agent.config.json");
      if (existsSync(agentConfigPath)) {
        try {
          const raw = readFileSync(agentConfigPath, "utf-8");
          const parsed = JSON.parse(raw);
          agentSpecificConfig = parsed.channels?.telegram?.streaming || {};
        } catch {}
      }
    }

    const globalTelegramStreaming = globalConfig.channels?.telegram?.streaming || {};
    const merged = {
      mode: agentSpecificConfig.mode || globalTelegramStreaming.mode || "progress",
      progress: {
        ...(globalTelegramStreaming.progress || {}),
        ...(agentSpecificConfig.progress || {})
      }
    };

    const res = ProgressConfigSchema.safeParse(merged);
    if (res.success) {
      return res.data;
    }
    return ProgressConfigSchema.parse({});
  }

  public onMessageLanded(chatId: number) {
    for (const [key, draft] of this.drafts.entries()) {
      if (key.includes(`:${chatId}:`)) {
        draft.buried = true;
      }
    }
  }

  public async handleEvent(
    chatId: number,
    threadId: number | undefined,
    bot: Telegraf,
    event: ProgressEvent,
    config: ProgressConfig,
    sessionId?: string,
    globalConfig?: any
  ) {
    if (config.mode === "off") return;

    const sessionKey = `${event.agentId || "agent"}:${chatId}:${threadId || 0}`;
    const draft = this.getOrCreateDraft(sessionKey);
    if (sessionId) {
      draft.sessionId = sessionId;
      this.activeSessionsByTimestamp.set(draft.startedAt, { sessionKey, sessionId });

      if (globalConfig) {
        try {
          const { resolveRuntimeStatus } = await import("./status-resolver.js");
          const status = resolveRuntimeStatus(event.agentId || "agent", sessionId, globalConfig);
          draft.execution = status.execution;
          draft.runtime = status.runtime;
          draft.channel = status.channel;
        } catch (err) {}

        // Grab agent name for header
        const agentCfg = globalConfig.agents?.find((a: any) => a.id === event.agentId);
        if (agentCfg?.name) draft.agentName = agentCfg.name;
      }
    }

    // ── turn_start: immediately send/reset the placeholder message ──────────
    if (event.type === "turn_start") {
      this.resetDraft(draft);
      draft.state = "active";
      draft.startedAt = Date.now();
      if (sessionId) {
        this.activeSessionsByTimestamp.set(draft.startedAt, { sessionKey, sessionId: sessionId! });
      }

      // Send the initial placeholder immediately — this IS the typing indicator
      const placeholderText = this.buildPlaceholderText(draft, config);
      try {
        await this.sendOrEditTelegram(draft, chatId, threadId, bot, placeholderText, config, /* isProgress */ true);
      } catch (err: any) {
        console.warn("[ProgressDraft] turn_start placeholder send failed:", err.message);
      }
      return;
    }

    if (event.type === "turn_end") {
      // Handled by finalizeDraft method
      return;
    }

    // ── Set label on first work event ────────────────────────────────────────
    if (draft.lines.length === 0 && draft.answerPreview === "" &&
        (event.type === "thinking" || event.type === "tool_start" || event.type === "bus_send" || event.type === "approval_wait" || event.type === "skill_use")) {
      const triggerName = event.toolName || event.skillName || event.type;
      draft.label = this.resolveLabel(triggerName, config);
    }

    // ── thinking ─────────────────────────────────────────────────────────────
    if (event.type === "thinking") {
      if (config.progress.commentary && event.detail) {
        const line = `💭 ${event.detail}`;
        draft.lines.push(redactSecrets(truncateLine(line, config.progress.lineCharBudget)));
        await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      }

    // ── tool_start ───────────────────────────────────────────────────────────
    } else if (event.type === "tool_start" && event.toolCallId && event.toolName) {
      if (config.progress.toolProgress) {
        const toolCallId = event.toolCallId;
        const toolName = event.toolName;
        const toolArgs = event.toolArgs || {};
        const startMs = Date.now();
        draft.toolStartTimes.set(toolCallId, startMs);

        // Show immediately for slow-to-respond tools (no 5s delay — immediate is better for UX)
        const line = formatProgressLine("tool_start", toolName, toolArgs, config.progress.detailMode, config.progress.lineCharBudget, true);
        draft.lines.push(line);
        draft.toolLinesMap.set(toolCallId, draft.lines.length - 1);
        await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      }

    // ── tool_end ─────────────────────────────────────────────────────────────
    } else if (event.type === "tool_end" && event.toolCallId && event.toolName) {
      // Cancel any pending timer
      const timer = draft.pendingToolTimers.get(event.toolCallId);
      if (timer) {
        clearTimeout(timer);
        draft.pendingToolTimers.delete(event.toolCallId);
      }

      const lineIdx = draft.toolLinesMap.get(event.toolCallId);
      const startMs = draft.toolStartTimes.get(event.toolCallId);
      const elapsedStr = startMs && (config.progress as any).showElapsedTime !== false
        ? fmtElapsed(startMs)
        : undefined;

      if (lineIdx !== undefined && lineIdx < draft.lines.length) {
        const completedLine = formatProgressLine(
          "tool_end",
          event.toolName,
          event.toolArgs || {},
          config.progress.detailMode,
          config.progress.lineCharBudget,
          false,
          elapsedStr
        );
        // Replace ⏳ spinner prefix with ✅
        draft.lines[lineIdx] = completedLine.replace(/^⏳/, "✅");
        draft.toolLinesMap.delete(event.toolCallId);
        if (startMs) draft.toolStartTimes.delete(event.toolCallId);
        await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      }

    // ── skill_use ────────────────────────────────────────────────────────────
    } else if (event.type === "skill_use" && event.skillName) {
      const line = `🧩 Skill: *${event.skillName}*`;
      draft.lines.push(redactSecrets(truncateLine(line, config.progress.lineCharBudget)));
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);

    // ── answer_chunk ─────────────────────────────────────────────────────────
    } else if ((event.type === "answer_chunk" || event.type === "thinking_stream") && event.chunk) {
      if ((config.progress as any).showAnswerPreview !== false) {
        draft.answerPreview += event.chunk;
        // Debounce heavily for streaming chunks to avoid hitting Telegram rate limits
        await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      }

    // ── bus_send / bus_recv ──────────────────────────────────────────────────
    } else if (event.type === "bus_send" || event.type === "bus_recv") {
      const line = formatProgressLine(event.type, "", event.toolArgs || { agentId: event.agentId }, config.progress.detailMode, config.progress.lineCharBudget);
      draft.lines.push(line);
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);

    // ── approval_wait ────────────────────────────────────────────────────────
    } else if (event.type === "approval_wait" && event.toolName) {
      const line = formatProgressLine("approval_wait", event.toolName, {}, config.progress.detailMode, config.progress.lineCharBudget);
      draft.lines.push(line);
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);

    // ── meta_updating ────────────────────────────────────────────────────────
    } else if (event.type === "meta_updating") {
      draft.state = "metaUpdating";
      const line = `🧠 Adapting: ${event.detail || ""}`;
      draft.lines.push(redactSecrets(truncateLine(line, config.progress.lineCharBudget)));
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      draft.state = "active";
    } else if (event.type === "compaction_start") {
      draft.state = "metaUpdating";
      const line = `⚡ Compact: ${event.detail || "Running intelligent compaction..."}`;
      draft.lines.push(redactSecrets(truncateLine(line, config.progress.lineCharBudget)));
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      draft.state = "active";
    } else if (event.type === "compaction_end") {
      draft.state = "metaUpdating";
      const line = `✅ Compacted: ${event.detail || "Intelligent compaction complete."}`;
      draft.lines.push(redactSecrets(truncateLine(line, config.progress.lineCharBudget)));
      await this.triggerUpdateFlow(draft, chatId, threadId, bot, config);
      draft.state = "active";
    }
  }

  private async triggerUpdateFlow(
    draft: ProgressDraft,
    chatId: number,
    threadId: number | undefined,
    bot: Telegraf,
    config: ProgressConfig
  ) {
    // Skip intermediate edits to the Telegram message while the agent is working.
    // The user just wants to see the initial working placeholder, and then the final response.
    // However, draft.lines continues to be updated in memory so commands like /plan and /deltas work.
  }

  public async queueUpdate(
    draft: ProgressDraft,
    chatId: number,
    threadId: number | undefined,
    bot: Telegraf,
    config: ProgressConfig
  ) {
    const text = this.formatDraftMessage(draft, config);
    draft.pendingTextUpdate = text;

    if (draft.editTimeout) return;

    const now = Date.now();
    const timeSinceLastEdit = now - draft.lastEditAt;
    const minDelay = 3500; // 3.5s — cuts Telegram edit rate limits in half

    const performEdit = async () => {
      draft.editTimeout = null;
      if (!draft.pendingTextUpdate) return;
      const textToEdit = draft.pendingTextUpdate;
      draft.pendingTextUpdate = null;

      try {
        await this.sendOrEditTelegram(draft, chatId, threadId, bot, textToEdit, config, /* isProgress */ true);
      } catch (err: any) {
        console.error("[ProgressDraft] Debounced edit failed:", err.message);
      }
    };

    if (timeSinceLastEdit >= minDelay) {
      await performEdit();
    } else {
      const delay = minDelay - timeSinceLastEdit;
      draft.editTimeout = setTimeout(performEdit, delay);
    }
  }

  private async sendOrEditTelegram(
    draft: ProgressDraft,
    chatId: number,
    threadId: number | undefined,
    bot: Telegraf,
    text: string,
    config: ProgressConfig,
    isProgress: boolean = false
  ) {
    const cleanText = text && text.trim() ? text : "⏳ Working...";
    const baseOptions: any = {};
    if (threadId) baseOptions.message_thread_id = threadId;

    // Reordering safety check: if another message landed after this draft, restart fresh
    if (draft.buried && draft.messageId !== null) {
      try {
        await bot.telegram.deleteMessage(chatId, draft.messageId);
      } catch {}
      draft.messageId = null;
      draft.buried = false;
    }

    // During progress, show Abort / Plan / Deltas inline buttons
    const progressKeyboard = isProgress ? {
      reply_markup: {
        inline_keyboard: [[
          { text: "⏹ Abort", callback_data: `abort:${draft.startedAt}` },
          { text: "📋 Plan", callback_data: `plan:${draft.startedAt}` },
          { text: "🧠 Deltas", callback_data: `deltas:${draft.startedAt}` }
        ]]
      }
    } : {};

    // Try Markdown first, then HTML, then plain
    const tryFormats = [
      { parse_mode: "Markdown" as const },
      { parse_mode: "HTML" as const },
      {}
    ];

    for (const fmt of tryFormats) {
      const options = { ...baseOptions, ...progressKeyboard, ...fmt };
      try {
        if (draft.messageId === null) {
          const res = await bot.telegram.sendMessage(chatId, cleanText, options);
          draft.messageId = res.message_id;
          draft.lastEditAt = Date.now();
          return;
        } else {
          await bot.telegram.editMessageText(chatId, draft.messageId, undefined, cleanText, options);
          draft.lastEditAt = Date.now();
          return;
        }
      } catch (err: any) {
        const msg: string = err.message || "";
        // Ignore "message is not modified" — not an actual error
        if (msg.includes("message is not modified")) {
          draft.lastEditAt = Date.now();
          return;
        }
        // Handle rate limiting specifically by falling back to sending a new message
        if (msg.includes("Too Many Requests") || msg.includes("429")) {
          console.warn(`[ProgressDraft] Telegram rate limit (429) hit during edit. Falling back to sending a new message...`);
          try {
            if (draft.messageId !== null) {
              await bot.telegram.deleteMessage(chatId, draft.messageId).catch(() => {});
            }
            const res = await bot.telegram.sendMessage(chatId, cleanText, options);
            draft.messageId = res.message_id;
            draft.lastEditAt = Date.now();
            return;
          } catch (fallbackErr: any) {
            console.error("[ProgressDraft] Fallback sendMessage failed after 429:", fallbackErr.message);
          }
        }
        // If bad formatting, try next format
        if (msg.includes("can't parse") || msg.includes("Bad Request") || msg.includes("parse")) {
          continue;
        }
        // Any other error — throw
        throw err;
      }
    }
  }

  public async finalizeDraft(
    draft: ProgressDraft,
    chatId: number,
    threadId: number | undefined,
    bot: Telegraf,
    finalText: string,
    config: ProgressConfig,
    hasMedia: boolean = false,
    extraButtons?: { text: string; callback_data: string }[][]
  ): Promise<boolean> {
    const cleanFinalText = finalText && finalText.trim() ? finalText : "👍 (Turn completed)";
    // Clear active session tracking
    this.activeSessionsByTimestamp.delete(draft.startedAt);

    // Clear all timers
    if (draft.delayTimer) {
      clearTimeout(draft.delayTimer);
      draft.delayTimer = null;
    }
    if (draft.editTimeout) {
      clearTimeout(draft.editTimeout);
      draft.editTimeout = null;
    }
    for (const timer of draft.pendingToolTimers.values()) {
      clearTimeout(timer);
    }
    draft.pendingToolTimers.clear();
    draft.toolStartTimes.clear();

    // Cache for thoughts toggle
    this.completedThoughts.set(draft.startedAt, {
      finalText: cleanFinalText,
      thoughtsText: draft.lines.join("\n")
    });
    if (this.completedThoughts.size > 100) {
      const oldestKey = this.completedThoughts.keys().next().value;
      if (oldestKey !== undefined) {
        this.completedThoughts.delete(oldestKey);
      }
    }

    // Build the final inline keyboard with thoughts toggle + plan + deltas
    const finalKeyboard = [
      [
        { text: "🧠 Show Thoughts", callback_data: `thoughts:show:${draft.startedAt}` },
        { text: "📋 Plan", callback_data: `plan:${draft.startedAt}` },
        { text: "🔁 Retry", callback_data: `retry:${draft.startedAt}` }
      ],
      ...(extraButtons || [])
    ];

    const fitsInTelegram = cleanFinalText.length <= 4000;
    const canEditInPlace = !hasMedia && fitsInTelegram && draft.messageId !== null && !draft.buried;

    if (canEditInPlace) {
      // Try to edit the draft message in-place with the final reply
      const tryFormats = [
        { parse_mode: "Markdown" as const },
        { parse_mode: "HTML" as const },
        {}
      ];

      for (const fmt of tryFormats) {
        const options: any = {
          ...fmt,
          reply_markup: { inline_keyboard: finalKeyboard }
        };
        if (threadId) options.message_thread_id = threadId;

        try {
          await bot.telegram.editMessageText(chatId, draft.messageId!, undefined, cleanFinalText, options);
          draft.state = "idle";
          draft.answerPreview = "";
          return true;
        } catch (err: any) {
          const msg: string = err.message || "";
          if (msg.includes("message is not modified")) {
            draft.state = "idle";
            draft.answerPreview = "";
            return true;
          }
          if (msg.includes("Too Many Requests") || msg.includes("429")) {
            console.warn(`[ProgressDraft] Telegram rate limit (429) hit during finalize. Falling back to sending new message...`);
            break;
          }
          if (msg.includes("can't parse") || msg.includes("Bad Request") || msg.includes("parse")) {
            continue;
          }
          // Other error — fall back to sending new message
          console.warn("[ProgressDraft] In-place finalize failed, falling back:", err.message);
          break;
        }
      }
    }

    // Fallback: delete old draft, send fresh final message
    if (draft.messageId !== null) {
      if (config.progress.cleanupOnFallback) {
        try {
          await bot.telegram.deleteMessage(chatId, draft.messageId);
        } catch {}
      }
      draft.messageId = null;
    }

    draft.state = "idle";
    draft.answerPreview = "";
    return false;
  }

  private resetDraft(draft: ProgressDraft) {
    if (draft.delayTimer) clearTimeout(draft.delayTimer);
    if (draft.editTimeout) clearTimeout(draft.editTimeout);
    for (const timer of draft.pendingToolTimers.values()) {
      clearTimeout(timer);
    }
    draft.pendingToolTimers.clear();
    draft.toolLinesMap.clear();
    draft.toolStartTimes.clear();
    draft.lines = [];
    draft.messageId = null;
    draft.buried = false;
    draft.pendingTextUpdate = null;
    draft.editTimeout = null;
    draft.delayTimer = null;
    draft.answerPreview = "";
    draft.label = "Thinking";
  }

  private resolveLabel(triggerName: string, config: ProgressConfig): string {
    const labelCfg = config.progress.label;
    if (labelCfg !== "auto") {
      if (Array.isArray(labelCfg)) {
        return labelCfg[Math.floor(Math.random() * labelCfg.length)] || "Thinking";
      }
      return labelCfg;
    }

    const name = triggerName.toLowerCase();
    if (name === "exec" || name === "run" || name === "bash" || name === "run_command") return "Executing";
    if (name.includes("search") || name.includes("google") || name.includes("brave")) return "Searching";
    if (name.includes("read_file") || name.includes("view_file")) return "Reading";
    if (name.includes("write") || name.includes("edit")) return "Writing";
    if (name.includes("skill")) return "Activating Skill";
    if (name.includes("image") || name.includes("generate")) return "Generating";
    if (name.includes("browse") || name.includes("navigate")) return "Browsing";
    if (name.includes("memory") || name.includes("recall")) return "Recalling";
    return "Thinking";
  }

  /** Builds the initial placeholder text sent at turn_start */
  private buildPlaceholderText(draft: ProgressDraft, config: ProgressConfig): string {
    const agentLabel = draft.agentName ? `*${draft.agentName}*` : "Agent";
    const execution = draft.execution || "komorebi";
    return `⏳ ${agentLabel} is working...\n\n_${execution}_`;
  }

  private formatDraftMessage(draft: ProgressDraft, config: ProgressConfig): string {
    const label = draft.label || "Thinking";
    const lines = [...draft.lines];
    const maxLines = config.progress.lineLimit || 10;

    // Header
    const agentLabel = draft.agentName ? `*${draft.agentName}*` : "Agent";
    const header = `⏳ *${agentLabel} · ${label}*`;

    // Progress bar (plan-step based)
    const totalSteps = lines.filter(l => l.includes("Plan Step")).length;
    const completedSteps = lines.filter(l => l.startsWith("✅") && l.includes("Plan Step")).length;
    let progressBar = "";
    if (totalSteps > 0) {
      const pct = Math.floor((completedSteps / totalSteps) * 100);
      const filled = Math.round(pct / 10);
      const empty = 10 - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      progressBar = `\n📊 \`[${bar}] ${pct}%\``;
    }

    // Tool / thought lines section
    let linesSection = "";
    if (lines.length > 0) {
      const visibleLines = lines.length > maxLines ? lines.slice(lines.length - maxLines) : lines;
      linesSection = `\n\n${visibleLines.join("\n")}`;
    }

    // Live answer preview (streaming)
    let previewSection = "";
    if (draft.answerPreview && (config.progress as any).showAnswerPreview !== false) {
      const maxChars = (config.progress as any).answerPreviewChars || 200;
      const preview = draft.answerPreview.slice(0, maxChars);
      const ellipsis = draft.answerPreview.length > maxChars ? "..." : "";
      previewSection = `\n\n💬 _${preview}${ellipsis}_`;
    }

    // Footer
    const execution = draft.execution || "komorebi";
    const runtime = draft.runtime || "komorebi";
    const footer = `\n\n_${execution} · ${runtime}_`;

    const full = `${header}${progressBar}${linesSection}${previewSection}${footer}`;

    // Stay under Telegram's 4096 char limit
    if (full.length > 3800) {
      return full.slice(0, 3800) + "...";
    }
    return full;
  }
}
