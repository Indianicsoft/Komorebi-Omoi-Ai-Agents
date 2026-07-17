import { Bot, InputFile } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MessageEnvelope, Attachment, DmScope } from "./types.js";
import { SessionManager } from "./session.js";
import { LaneCommandQueue } from "./queue.js";
import { GatewayWsServer } from "./server.js";
import { createPairing } from "./pairing-db.js";

// Text chunking helper following textChunkLimit and chunkMode settings
function chunkText(text: string, limit = 4000, mode: "hard" | "newline" = "newline"): string[] {
  if (limit > 4096) limit = 4096;
  if (text.length <= limit) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + limit;
    if (end >= text.length) {
      chunks.push(text.substring(start));
      break;
    }
    
    if (mode === "newline") {
      const substring = text.substring(start, end);
      const lastNewline = substring.lastIndexOf("\n");
      if (lastNewline > 0) {
        end = start + lastNewline;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
    // Skip leading newlines/whitespace for the next chunk to avoid weird spacing
    while (start < text.length && (text[start] === "\n" || text[start] === "\r" || text[start] === " ")) {
      start++;
    }
  }
  return chunks;
}

export class TelegramBridge {
  private bot: Bot;
  private runnerHandle: any = null;

  constructor(
    private readonly token: string,
    private readonly agentId: string,
    private readonly dmScope: DmScope,
    private readonly allowedUserIds: number[] | undefined,
    private readonly sessionManager: SessionManager,
    private readonly commandQueue: LaneCommandQueue,
    private readonly getWsServer: () => GatewayWsServer | undefined
  ) {
    this.bot = new Bot(this.token);
    this.setupHandlers();
  }

  /**
   * Backward compatible proxy for server.ts and progress-draft.ts to call bot.telegram methods.
   * Intercepts sendMessage, editMessageText, deleteMessage, sendPhoto, sendVoice, sendChatAction,
   * getFileLink, and setMyCommands to execute them via grammY Bot API, applying outbound formatting
   * such as message chunking and voice/audio file routing overrides.
   */
  public getTelegrafInstance(): any {
    const wsServer = this.getWsServer();
    const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
    const telegramConfig = agentConfig?.channels?.telegram;
    
    const limit = telegramConfig?.textChunkLimit ?? 4000;
    const chunkMode = telegramConfig?.chunkMode ?? "newline";

    return {
      telegram: {
        sendMessage: async (chatId: any, text: string, options?: any) => {
          const chunks = chunkText(text, limit, chunkMode);
          let lastMsg: any;
          for (const chunk of chunks) {
            lastMsg = await this.bot.api.sendMessage(chatId, chunk, options);
          }
          return lastMsg;
        },
        editMessageText: async (chatId: any, messageId: any, inlineMessageId: any, text: string, options?: any) => {
          const chunks = chunkText(text, limit, chunkMode);
          return this.bot.api.editMessageText(chatId, messageId, chunks[0], options);
        },
        deleteMessage: (chatId: any, messageId: any) => {
          return this.bot.api.deleteMessage(chatId, messageId);
        },
        sendPhoto: (chatId: any, photo: any, options?: any) => {
          const file = (photo && typeof photo === "object" && photo.source) ? new InputFile(photo.source) : photo;
          return this.bot.api.sendPhoto(chatId, file, options);
        },
        sendVoice: (chatId: any, voice: any, options?: any) => {
          const file = (voice && typeof voice === "object" && voice.source) ? new InputFile(voice.source) : voice;
          
          let asVoice = false;
          if (options && options.caption) {
            if (options.caption.includes("[[audio_as_voice]]")) {
              asVoice = true;
              options.caption = options.caption.replace("[[audio_as_voice]]", "").trim();
            }
          }
          if (options && options.asVoice) {
            asVoice = true;
          }

          if (asVoice) {
            return this.bot.api.sendVoice(chatId, file, options);
          } else {
            return this.bot.api.sendAudio(chatId, file, options);
          }
        },
        sendChatAction: (chatId: any, action: any) => {
          return this.bot.api.sendChatAction(chatId, action);
        },
        getFileLink: async (fileId: string) => {
          const file = await this.bot.api.getFile(fileId);
          return {
            href: `https://api.telegram.org/file/bot${this.token}/${file.file_path}`,
            toString() { return this.href; }
          };
        },
        setMyCommands: (commands: any) => {
          return this.bot.api.setMyCommands(commands);
        }
      }
    };
  }

  private setupHandlers() {
    // 1. Maintain FIFO sequencing per-chat (grammY runner sequentialize middleware)
    this.bot.use(sequentialize((ctx) => String(ctx.chat?.id || ctx.from?.id || "")));

    // 2. Authorization, Pairing Intercepts, and Allowlists Middleware
    this.bot.use(async (ctx, next) => {
      const from = ctx.from;
      if (!from) return next();

      const wsServer = this.getWsServer();
      const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
      const telegramConfig = agentConfig?.channels?.telegram;

      // Allowed users/chats array compile
      const allowFromList: number[] = [
        ...(telegramConfig?.allowFrom || []).map((id: any) => Number(id)),
        ...(telegramConfig?.groups || []).map((id: any) => Number(id)),
        ...(this.allowedUserIds || []).map((id: any) => Number(id))
      ];

      const isAllowed = allowFromList.includes(from.id) || (ctx.chat ? allowFromList.includes(ctx.chat.id) : false);

      if (!isAllowed) {
        const isGroup = ctx.chat && (ctx.chat.type === "group" || ctx.chat.type === "supergroup");
        if (isGroup) {
          const groupPolicy = telegramConfig?.groupPolicy ?? "allowlist";
          if (groupPolicy === "allowlist") {
            console.warn(`[TelegramBridge - ${this.agentId}] Gated unauthorized group interaction from group chat ID: ${ctx.chat.id}`);
            return; // Silent ignore for unauthorized group chats
          }
        } else {
          // Personal DM interaction checks
          const dmPolicy = telegramConfig?.dmPolicy ?? "pairing";
          if (dmPolicy === "pairing") {
            if (ctx.callbackQuery) {
              await ctx.answerCallbackQuery({ text: "Unauthorized: Pairing Required.", show_alert: true });
              return;
            }
            if (ctx.message && ctx.message.text && ctx.message.text.startsWith("/")) {
              // Ignore command shortcuts from unpaired accounts
              return;
            }

            // Trigger registration of a unique 8-character pairing code
            const code = createPairing(from.id, this.agentId);
            const setupMsg = `🔒 *Pairing Required*\n\nYour Telegram account is not paired with agent *${agentConfig?.name || this.agentId}*.\n\nPlease approve this pairing request using the following code:\n\n🔑 \`${code}\`\n\nCommand:\n\`komorebi pairing approve telegram ${this.agentId} ${code}\`\n\nThis verification code expires in 1 hour.`;
            await ctx.reply(setupMsg, { parse_mode: "Markdown" });
            return;
          } else {
            if (ctx.callbackQuery) {
              await ctx.answerCallbackQuery({ text: "Unauthorized: Access Denied.", show_alert: true });
            } else {
              await ctx.reply("❌ Unauthorized: You are not authorized to interact with this agent.");
            }
            return;
          }
        }
      }
      return next();
    });

    // 3. Command Routers
    this.bot.command("start", (ctx) => this.sendMainMenu(ctx));
    this.bot.command("menu", (ctx) => this.sendMainMenu(ctx));
    this.bot.command("help", (ctx) => this.sendHelpMessage(ctx));
    this.bot.command("new", (ctx) => this.handleNewSession(ctx));
    this.bot.command("status", (ctx) => this.handleStatus(ctx));
    this.bot.command("compact", (ctx) => this.handleCompact(ctx));
    this.bot.command("abort", (ctx) => this.handleAbort(ctx));
    this.bot.command("plan", (ctx) => this.handlePlan(ctx));
    this.bot.command("deltas", (ctx) => this.handleDeltas(ctx));
    this.bot.command("think", (ctx) => this.handleThinkToggle(ctx));
    this.bot.command("retry", (ctx) => this.handleRetry(ctx));

    // 4. Message Reaction Updates
    this.bot.on("message_reaction", async (ctx) => {
      const wsServer = this.getWsServer();
      const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
      const telegramConfig = agentConfig?.channels?.telegram;
      if (telegramConfig?.reactionNotifications) {
        const rx = ctx.messageReaction;
        const reactions = rx.new_reaction.map((r: any) => r.type === "emoji" ? r.emoji : "").filter(Boolean);
        const fromUser = ctx.from?.first_name || "Someone";
        const signalText = `Reaction: [${reactions.join(", ")}] by ${fromUser} on message ID ${rx.message_id}`;
        console.log(`[TelegramBridge - ${this.agentId}] Logged reaction notification signal: "${signalText}"`);

        const { TelegramStreamer } = await import("./telegram-streamer.js");
        const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
        const sessionId = this.sessionManager.getTelegramSessionKey(this.agentId, rx.chat.id, ctx.from?.id || 0, isGroup);
        TelegramStreamer.getInstance().logReaction(sessionId, rx.chat.id, rx.message_id, reactions, fromUser);
        const escapedSession = sessionId.replace(/:/g, "_");
        const workspaceRoot = agentConfig?.workspace || join(homedir(), ".komorebi", "agents", this.agentId);
        const sessionDir = isGroup ? join(workspaceRoot, escapedSession) : workspaceRoot;
        
        try {
          const { mkdirSync, appendFileSync } = await import("node:fs");
          mkdirSync(sessionDir, { recursive: true });
          const sessionJsonlPath = join(sessionDir, "session.jsonl");
          const logTurn = {
            role: "system",
            content: `[SIGNAL] ${signalText}`,
            timestamp: Math.floor(Date.now() / 1000)
          };
          appendFileSync(sessionJsonlPath, JSON.stringify(logTurn) + "\n", "utf-8");
        } catch (err: any) {
          console.error(`[TelegramBridge - ${this.agentId}] Failed to append reaction signal to memory:`, err.message);
        }
      }
    });

    // 5. Message Normalization and Processing pipeline dispatch
    this.bot.on("message", async (ctx) => {
      const wsServer = this.getWsServer();
      if (wsServer) {
        wsServer.progressDraftManager.onMessageLanded(ctx.chat.id);
      }
      
      const from = ctx.from;
      if (!from) return;

      const msg = ctx.message as any;

      // Ignore command text messages
      if (msg.text && msg.text.startsWith("/")) {
        return;
      }

      let content = msg.text || msg.caption || "";
      const attachments: Attachment[] = [];

      const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
      const telegramConfig = agentConfig?.channels?.telegram;
      const limitBytes = (telegramConfig?.mediaMaxMb ?? 5) * 1024 * 1024;

      const addAttachment = (type: string, file: any, fileName?: string) => {
        if (file.file_size && file.file_size > limitBytes) {
          console.warn(`[TelegramBridge - ${this.agentId}] Attachment skipped: exceeds size limit (${file.file_size} > ${limitBytes})`);
          ctx.reply(`⚠️ Attachment skipped: exceeds size limit of ${telegramConfig?.mediaMaxMb ?? 5} MB.`).catch(() => {});
          return false;
        }
        attachments.push({
          type: type as any,
          fileId: file.file_id,
          fileName,
          mimeType: file.mime_type,
          fileSize: file.file_size
        });
        return true;
      };

      if (msg.voice) {
        if (addAttachment("voice", msg.voice)) {
          if (!content) content = "[Voice Message]";
        }
      }
      if (msg.photo && msg.photo.length > 0) {
        const photo = msg.photo[msg.photo.length - 1];
        if (addAttachment("photo", photo)) {
          if (!content) content = "[Photo]";
        }
      }
      if (msg.document) {
        if (addAttachment("document", msg.document, msg.document.file_name)) {
          if (!content) content = `[Document: ${msg.document.file_name || "unnamed"}]`;
        }
      }
      if (msg.audio) {
        if (addAttachment("audio", msg.audio, msg.audio.file_name)) {
          if (!content) content = `[Audio: ${msg.audio.title || "unnamed"}]`;
        }
      }
      if (msg.video) {
        if (addAttachment("video", msg.video)) {
          if (!content) content = "[Video]";
        }
      }

      // Download attachments to perception directory
      for (const att of attachments) {
        try {
          const path = await this.downloadFile(att.fileId, this.agentId, att.fileName);
          if (path) {
            att.localPath = path;
          }
        } catch (err: any) {
          console.error(`[TelegramBridge - ${this.agentId}] Attachment download failed:`, err.message);
        }
      }

      const envelope: MessageEnvelope = {
        sender: {
          id: from.id,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name
        },
        chatId: ctx.chat.id,
        threadId: msg.message_thread_id,
        content,
        attachments,
        channel: "telegram",
        timestamp: msg.date
      };

      const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";
      const sessionKey = this.sessionManager.getTelegramSessionKey(this.agentId, ctx.chat.id, from.id, isGroup, msg.message_thread_id);

      console.log(`[TelegramBridge - ${this.agentId}] Forwarding normalized message to pipeline (session: ${sessionKey})`);

      if (!wsServer) {
        throw new Error("WS Server not initialized yet");
      }

      // Progress draft turn_start progress event
      const progressConfig = wsServer.progressDraftManager.getAgentProgressConfig(this.agentId, wsServer.globalConfig);
      if (progressConfig.mode !== "off") {
        const turnStartEvent = {
          type: "turn_start" as const,
          timestamp: Date.now(),
          agentId: this.agentId
        };
        try {
          await wsServer.progressDraftManager.handleEvent(
            ctx.chat.id,
            msg.message_thread_id ?? undefined,
            this.getTelegrafInstance(),
            turnStartEvent,
            progressConfig,
            sessionKey,
            wsServer.globalConfig
          );
        } catch (err: any) {
          console.warn("[TelegramBridge] turn_start progress event failed:", err.message);
        }
      }

      // Chat Action typing canceler loop
      const sendTyping = () => {
        this.bot.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});
      };
      sendTyping();
      const typingInterval = setInterval(sendTyping, 4000);
      wsServer.messagePipeline.registerTypingCanceler(sessionKey, () => {
        clearInterval(typingInterval);
      });

      wsServer.messagePipeline.handleInbound(
        "telegram",
        "default",
        sessionKey,
        content,
        envelope
      ).catch(err => {
        console.error(`[TelegramBridge] Pipeline processing failed:`, err);
        clearInterval(typingInterval);
        wsServer.messagePipeline.clearTypingCanceler(sessionKey);
        ctx.reply(`❌ *Failed to process message:* ${err.message}`).catch(() => {});
      });
    });

    // 6. Callback Query Router
    this.bot.on("callback_query", async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (!data) return;

      const wsServer = this.getWsServer();

      // Case A: Elevated Command Security Approvals
      if (data.startsWith("exec:")) {
        const parts = data.split(":");
        const decision = parts[1]; // "approve" or "deny"
        const frameId = parts[2];
        
        const approved = decision === "approve";
        if (wsServer) {
          wsServer.resolveCommandApproval(frameId, approved);
        }

        const oldText = (ctx.callbackQuery.message as any)?.text || "";
        const updatedText = `⚔️ *Security Action Taken*\n${oldText.replace("⚠️ *Security Alert* ⚠️\n", "")}\n\nDecision: **${approved ? "✅ APPROVED" : "❌ DENIED"}** by owner.`;
        
        try {
          await ctx.editMessageText(updatedText, { parse_mode: "Markdown" });
        } catch (err) {}
        await ctx.answerCallbackQuery({ text: `Command execution ${approved ? "approved" : "denied"}.` });
      }
      // Case B: Boundary Approvals
      else if (data.startsWith("boundary:")) {
        const parts = data.split(":");
        const choice = parts[1];
        const id = parts[4];

        if (wsServer) {
          wsServer.resolveBoundaryApproval(id, choice);
        }

        const oldText = (ctx.callbackQuery.message as any)?.text || "";
        const updatedText = `🧠 *Boundary Learned*\n${oldText}\n\nDecision: User confirmed **${choice.toUpperCase()}** for this action pattern.`;
        
        try {
          await ctx.editMessageText(updatedText, { parse_mode: "Markdown" });
        } catch (err) {}
        await ctx.answerCallbackQuery({ text: `Boundary rule saved: ${choice.toUpperCase()}` });
      }
      // Case C: Thoughts Show/Hide
      else if (data.startsWith("thoughts:")) {
        const parts = data.split(":");
        const action = parts[1];
        const timestamp = Number(parts[2]);

        if (!wsServer) {
          await ctx.answerCallbackQuery({ text: "Error: Gateway server not initialized." });
          return;
        }

        const completed = wsServer.progressDraftManager.completedThoughts.get(timestamp);
        if (!completed) {
          await ctx.answerCallbackQuery({ text: "Thinking details not found or expired." });
          return;
        }

        const { finalText, thoughtsText } = completed;
        let newText = finalText;
        let buttonText = "🧠 Show Thoughts";
        let newCallbackData = `thoughts:show:${timestamp}`;

        if (action === "show") {
          const quotedThoughts = thoughtsText.split("\n").map(line => line.trim() ? `> ${line}` : ">").join("\n");
          newText = `${finalText}\n\n🧠 *Thinking Process:*\n${quotedThoughts}`;
          buttonText = "🧠 Hide Thoughts";
          newCallbackData = `thoughts:hide:${timestamp}`;
        }

        const inlineKeyboard = [
          [
            { text: buttonText, callback_data: newCallbackData },
            { text: "📋 Plan", callback_data: `plan:${timestamp}` },
            { text: "🧠 Deltas", callback_data: `deltas:${timestamp}` }
          ]
        ];

        try {
          await ctx.editMessageText(newText, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: inlineKeyboard }
          });
        } catch (err) {}
        await ctx.answerCallbackQuery();
      }
      // Case D: Menu Commands
      else if (data.startsWith("menu:")) {
        const action = data.split(":")[1];
        if (action === "new") {
          await this.handleNewSession(ctx);
        } else if (action === "status") {
          await this.handleStatus(ctx);
        } else if (action === "abort") {
          await this.handleAbort(ctx);
        } else if (action === "plan") {
          await this.handlePlan(ctx);
        } else if (action === "deltas") {
          await this.handleDeltas(ctx);
        } else if (action === "help") {
          await this.handleHelpCallback(ctx);
        } else if (action === "back") {
          const agentName = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId)?.name || this.agentId;
          const modelObj = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId)?.model;
          const modelName = typeof modelObj === "object" ? modelObj.name : (modelObj || "Default Model");
          
          const menuText = `🌌 *Komorebi Omoi Agent Control Center*\n\n` +
                       `🤖 *Agent*: **${agentName}** (\`${this.agentId}\`)\n` +
                       `🧠 *Model*: \`${modelName}\`\n` +
                       `📡 *Channel Policy*: \`${this.dmScope}\`\n\n` +
                       `Welcome to your autonomous agent assistant! Use the buttons below to interact with and inspect the agent.`;
                       
          const inlineKeyboard = [
            [
              { text: "✨ New Session", callback_data: "menu:new" },
              { text: "📊 Status", callback_data: "menu:status" }
            ],
            [
              { text: "📋 View Plan", callback_data: "menu:plan" },
              { text: "🧠 Deltas", callback_data: "menu:deltas" }
            ],
            [
              { text: "⏹️ Abort Turn", callback_data: "menu:abort" },
              { text: "❓ Help Menu", callback_data: "menu:help" }
            ]
          ];
          
          try {
            await ctx.editMessageText(menuText, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: inlineKeyboard }
            });
          } catch (err) {}
        }
        await ctx.answerCallbackQuery();
      }
      // Case E: Historical Turn Controls
      else if (data.startsWith("abort:") || data.startsWith("plan:") || data.startsWith("deltas:")) {
        const parts = data.split(":");
        const action = parts[0];
        const timestamp = Number(parts[1]);

        if (!wsServer) {
          await ctx.answerCallbackQuery({ text: "Error: Gateway server not initialized." });
          return;
        }

        const sessionInfo = wsServer.progressDraftManager.activeSessionsByTimestamp.get(timestamp);
        if (!sessionInfo) {
          if (action === "plan" || action === "deltas") {
            const completed = wsServer.progressDraftManager.completedThoughts.get(timestamp);
            if (completed) {
              const text = action === "plan" ? "Milestone execution completed." : "No active prompt adjustments.";
              await ctx.answerCallbackQuery({ text, show_alert: true });
              return;
            }
          }
          await ctx.answerCallbackQuery({ text: "Session not found or already completed." });
          return;
        }

        const { sessionKey, sessionId } = sessionInfo;

        if (action === "abort") {
          try {
            this.sessionManager.terminateSession(sessionId);
            const oldText = (ctx.callbackQuery.message as any)?.text || "";
            await ctx.editMessageText(`${oldText}\n\n❌ *Turn Aborted by User*`, { reply_markup: { inline_keyboard: [] } });
            await ctx.answerCallbackQuery({ text: "Turn successfully aborted." });
          } catch (err: any) {
            await ctx.answerCallbackQuery({ text: `Failed to abort turn: ${err.message}` });
          }
        } else if (action === "plan") {
          const draft = wsServer.progressDraftManager.getOrCreateDraft(sessionKey);
          const planLines = draft.lines.filter(l => l.includes("Plan Step") || l.includes("Milestone"));
          const alertText = planLines.length > 0 ? planLines.join("\n") : "No execution plan generated yet.";
          await ctx.answerCallbackQuery({ text: alertText, show_alert: true });
        } else if (action === "deltas") {
          const draft = wsServer.progressDraftManager.getOrCreateDraft(sessionKey);
          const deltaLines = draft.lines.filter(l => l.includes("Adapting") || l.includes("Meta-Cognitive") || l.includes("Prompt Delta") || l.includes("Update"));
          const alertText = deltaLines.length > 0 
            ? deltaLines.map(l => l.replace("🧠 Adapting:", "•").replace("🧠 Meta-Cognitive Update:", "•").replace("🧠 Thought:", "•")).join("\n") 
            : "No active meta-cognitive prompt adjustments yet.";
          await ctx.answerCallbackQuery({ text: alertText, show_alert: true });
        }
      }
      // Case F: Retry query
      else if (data.startsWith("retry:")) {
        if (!wsServer) return;
        const from = ctx.from;
        if (!from) return;
        const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
        if (!chatId) return;
        const sessionId = this.getSessionId(ctx);
        const lastQuery = this.getLastUserQuery(sessionId);
        if (!lastQuery) {
          await ctx.answerCallbackQuery({ text: "No previous query found to retry.", show_alert: true });
          return;
        }

        await ctx.answerCallbackQuery({ text: `Retrying: "${lastQuery.slice(0, 25)}..."` });

        // Convert inline button retry into a synthetic message context
        const envelope = {
          sender: { id: from.id, firstName: from.first_name, username: from.username },
          chatId,
          content: lastQuery,
          attachments: [],
          channel: "telegram" as const,
          isSynthetic: true,
          timestamp: Math.floor(Date.now() / 1000)
        };

        const progressConfig = wsServer.progressDraftManager.getAgentProgressConfig(this.agentId, wsServer.globalConfig);
        if (progressConfig.mode !== "off") {
          try {
            await wsServer.progressDraftManager.handleEvent(
              chatId, undefined, this.getTelegrafInstance(),
              { type: "turn_start", timestamp: Date.now(), agentId: this.agentId },
              progressConfig, sessionId, wsServer.globalConfig
            );
          } catch {}
        }

        const sendTyping = () => {
          this.bot.api.sendChatAction(chatId, "typing").catch(() => {});
        };
        sendTyping();
        const typingInterval = setInterval(sendTyping, 4000);

        wsServer.messagePipeline.registerTypingCanceler(sessionId, () => {
          clearInterval(typingInterval);
        });

        wsServer.messagePipeline.handleInbound("telegram", "default", sessionId, lastQuery, envelope)
          .catch(err => {
            console.error("[TelegramBridge] Retry dispatch failed:", err);
            clearInterval(typingInterval);
            wsServer.messagePipeline.clearTypingCanceler(sessionId);
          });
      }
    });
  }

  private async sendMainMenu(ctx: any) {
    const wsServer = this.getWsServer();
    const agentName = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId)?.name || this.agentId;
    const modelObj = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId)?.model;
    const modelName = typeof modelObj === "object" ? modelObj.name : (modelObj || "Default Model");
    
    const text = `🌌 *Komorebi Omoi Agent Control Center*\n\n` +
                 `🤖 *Agent*: **${agentName}** (\`${this.agentId}\`)\n` +
                 `🧠 *Model*: \`${modelName}\`\n` +
                 `📡 *Channel Policy*: \`${this.dmScope}\`\n\n` +
                 `Welcome to your autonomous agent assistant! Use the buttons below to interact with and inspect the agent.`;
                 
    const inlineKeyboard = [
      [
        { text: "✨ New Session", callback_data: "menu:new" },
        { text: "📊 Status", callback_data: "menu:status" }
      ],
      [
        { text: "📋 View Plan", callback_data: "menu:plan" },
        { text: "🧠 Deltas", callback_data: "menu:deltas" }
      ],
      [
        { text: "⏹️ Abort Turn", callback_data: "menu:abort" },
        { text: "❓ Help Menu", callback_data: "menu:help" }
      ]
    ];
    
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  private async sendHelpMessage(ctx: any) {
    const text = `❓ *Komorebi Agent Help Guide*\n\n` +
                 `Here are the commands you can use in this chat:\n\n` +
                 `📱 /menu - Open interactive control dashboard\n` +
                 `✨ /new - Clear conversation history & restart session\n` +
                 `📊 /status - View agent status, model, and history size\n` +
                 `⚡ /compact - Compact conversation history to 1k tokens\n` +
                 `⏹️ /abort - Instantly abort the current running task\n` +
                 `📋 /plan - View milestones of the current task plan\n` +
                 `🧠 /deltas - Check active prompt adjustments (deltas)\n` +
                 `❓ /help - Show this guide\n\n` +
                 `Simply type any command, or ask the agent a question directly to begin!`;
    await ctx.reply(text, { parse_mode: "Markdown" });
  }

  private async handleNewSession(ctx: any) {
    const from = ctx.from;
    if (!from) return;

    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const sessionId = this.getSessionId(ctx);
    const isGroup = sessionId.includes(":group:");
    const escapedSession = sessionId.replace(/:/g, "_");
    
    const wsServer = this.getWsServer();
    const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
    const workspaceRoot = agentConfig?.workspace || join(homedir(), ".komorebi", "agents", this.agentId);
    const sessionDir = isGroup ? join(workspaceRoot, escapedSession) : workspaceRoot;
    const sessionJsonlPath = join(sessionDir, "session.jsonl");

    // 1. Terminate running session
    try {
      this.sessionManager.terminateSession(sessionId);
    } catch {}

    // 2. Wipe history file
    try {
      const fs = await import("node:fs");
      if (fs.existsSync(sessionJsonlPath)) {
        fs.writeFileSync(sessionJsonlPath, "", "utf-8");
      }
    } catch (err: any) {
      console.error(`[TelegramBridge] Failed to wipe session file: ${err.message}`);
    }

    // 3. Clear the draft state
    if (wsServer) {
      const threadId = ctx.message?.message_thread_id || 0;
      const sessionKey = `${this.agentId}:${chatId}:${threadId}`;
      const draft = wsServer.progressDraftManager.getOrCreateDraft(sessionKey);
      wsServer.progressDraftManager.completedThoughts.delete(draft.startedAt);
    }

    await ctx.reply("✨ *Conversation history wiped. Session restarted fresh!*", { parse_mode: "Markdown" });
  }

  private async handleStatus(ctx: any) {
    const from = ctx.from;
    if (!from) return;

    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const sessionId = this.getSessionId(ctx);
    const isGroup = sessionId.includes(":group:");
    
    const isRunning = this.sessionManager.getAgentConnection(sessionId) !== undefined;
    const wsServer = this.getWsServer();
    const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
    
    const escapedSession = sessionId.replace(/:/g, "_");
    const workspaceRoot = agentConfig?.workspace || join(homedir(), ".komorebi", "agents", this.agentId);
    const sessionDir = isGroup ? join(workspaceRoot, escapedSession) : workspaceRoot;
    const sessionJsonlPath = join(sessionDir, "session.jsonl");
    const metadataPath = join(sessionDir, "compaction-metadata.json");

    let historyCount = 0;
    let sizeChars = 0;
    let compactionCount = 0;
    try {
      const fs = await import("node:fs");
      if (fs.existsSync(sessionJsonlPath)) {
        const content = fs.readFileSync(sessionJsonlPath, "utf-8").trim();
        if (content) {
          const lines = content.split("\n");
          historyCount = lines.length;
          sizeChars = content.length;
        }
      }
      if (fs.existsSync(metadataPath)) {
        const meta = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        if (typeof meta.compactionCount === "number") {
          compactionCount = meta.compactionCount;
        }
      }
    } catch {}

    const modelObj = agentConfig?.model;
    const modelName = typeof modelObj === "object" ? modelObj.name : (modelObj || "Default Model");
    const modelProvider = typeof modelObj === "object" ? (modelObj.provider || "unknown") : "unknown";
    const statusEmoji = isRunning ? "🟢" : "⚪";
    const statusLabel = isRunning ? "Running" : "Idle";
    const reasoning = wsServer?.messagePipeline.getReasoningSetting(sessionId) || "off";

    const text = `📊 *Agent Status*\n\n` +
                 `${statusEmoji} **${statusLabel}** \u2014 ${agentConfig?.name || this.agentId}\n\n` +
                 `🤖 *Agent ID*: \`${this.agentId}\`\n` +
                 `🧠 *Model*: \`${modelName}\` (${modelProvider})\n` +
                 `📡 *DM Scope*: \`${this.dmScope}\`\n` +
                 `🔍 *Reasoning*: \`${reasoning}\` (/think to toggle)\n` +
                 `⚡ *Compactions*: \`${compactionCount}\`\n` +
                 `💬 *History Turns*: \`${historyCount}\`\n` +
                 `📏 *History Size*: \`${(sizeChars / 1024).toFixed(2)} KB\`\n\n` +
                 `_Session: \`${sessionId}\`_`;
                 
    await ctx.reply(text, { parse_mode: "Markdown" });
  }

  private async handleCompact(ctx: any) {
    const from = ctx.from;
    if (!from) return;

    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const sessionId = this.getSessionId(ctx);

    await ctx.reply("⚡ *Initiating conversation compaction to 1k tokens...*", { parse_mode: "Markdown" });

    try {
      await this.sessionManager.ensureAgentRunning(this.agentId, sessionId);
      const wsServer = this.getWsServer();
      if (!wsServer) throw new Error("WS Server not initialized yet");
      const ws = this.sessionManager.getAgentConnection(sessionId);
      if (!ws) throw new Error("Could not establish agent connection");

      const result = await wsServer.sendRequest(ws, "compactSession", { limit: 1000 });
      if (result && result.success) {
        await ctx.reply(`✅ *Conversation successfully compacted!*\n- New tokens: \`${result.tokens}\``, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(`❌ *Compaction failed:* ${result?.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error(`[TelegramBridge] /compact failed:`, err);
      await ctx.reply(`❌ *Error running compaction:* ${err.message}`);
    }
  }

  private async handleAbort(ctx: any) {
    const from = ctx.from;
    if (!from) return;

    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const sessionId = this.getSessionId(ctx);

    const isRunning = this.sessionManager.getAgentConnection(sessionId) !== undefined;
    if (!isRunning) {
      await ctx.reply("⏹️ *No active task is running for this session.*", { parse_mode: "Markdown" });
      return;
    }

    try {
      this.sessionManager.terminateSession(sessionId);
      await ctx.reply("⏹️ *Task execution aborted successfully.*", { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.reply(`❌ *Failed to abort execution: ${err.message}*`, { parse_mode: "Markdown" });
    }
  }

  private async handlePlan(ctx: any) {
    const wsServer = this.getWsServer();
    if (!wsServer) {
      await ctx.reply("❌ *Server state unavailable.*", { parse_mode: "Markdown" });
      return;
    }
    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;
    const threadId = ctx.message?.message_thread_id || 0;
    
    const sessionKey = `${this.agentId}:${chatId}:${threadId}`;
    const draft = wsServer.progressDraftManager.getOrCreateDraft(sessionKey);
    const planLines = draft.lines.filter(l => l.includes("Plan Step") || l.includes("Milestone"));
    
    if (planLines.length > 0) {
      await ctx.reply(`📋 *Current Milestone Execution Plan:*\n\n${planLines.join("\n")}`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply("📋 *No active execution plan generated yet.*", { parse_mode: "Markdown" });
    }
  }

  private async handleDeltas(ctx: any) {
    const wsServer = this.getWsServer();
    if (!wsServer) {
      await ctx.reply("❌ *Server state unavailable.*", { parse_mode: "Markdown" });
      return;
    }
    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;
    const threadId = ctx.message?.message_thread_id || 0;
    
    const sessionKey = `${this.agentId}:${chatId}:${threadId}`;
    const draft = wsServer.progressDraftManager.getOrCreateDraft(sessionKey);
    const deltaLines = draft.lines.filter(l => l.includes("Meta-Cognitive") || l.includes("Prompt Delta") || l.includes("Update"));
    
    if (deltaLines.length > 0) {
      const text = deltaLines.map(l => l.replace("🧠 Meta-Cognitive Update:", "•").replace("🧠 Thought:", "•")).join("\n");
      await ctx.reply(`🧠 *Active Prompt Adjustments (Deltas):*\n\n${text}`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply("🧠 *No active meta-cognitive prompt adjustments yet.*", { parse_mode: "Markdown" });
    }
  }

  private getSessionId(ctx: any): string {
    const from = ctx.from;
    const chatId = ctx.chat?.id || ctx.message?.chat.id || ctx.callbackQuery?.message?.chat.id;
    const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup" || ctx.message?.chat?.type === "group" || ctx.message?.chat?.type === "supergroup" || ctx.callbackQuery?.message?.chat?.type === "group" || ctx.callbackQuery?.message?.chat?.type === "supergroup";
    const threadId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id || ctx.message?.threadId;
    return this.sessionManager.getTelegramSessionKey(this.agentId, chatId || 0, from?.id || 0, !!isGroup, threadId);
  }

  private async handleHelpCallback(ctx: any) {
    const text = `❓ *Komorebi Agent Help Guide*\n\n` +
                 `📱 /menu ─ Interactive dashboard\n` +
                 `✨ /new ─ Reset session\n` +
                 `📊 /status ─ View status & model info\n` +
                 `⚡ /compact ─ Compact history to 1k tokens\n` +
                 `⏹️ /abort ─ Abort active task\n` +
                 `🔁 /retry ─ Retry the last turn\n` +
                 `🔍 /think ─ Toggle reasoning display (on/off/stream)\n` +
                 `📋 /plan ─ View execution milestones\n` +
                 `🧠 /deltas ─ Active prompt deltas\n` +
                 `❓ /help ─ View this help guide`;
    
    const inlineKeyboard = [
      [
        { text: "⬅️ Back to Menu", callback_data: "menu:back" }
      ]
    ];
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  }

  private async handleThinkToggle(ctx: any) {
    const from = ctx.from;
    if (!from) return;
    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const wsServer = this.getWsServer();
    if (!wsServer) {
      await ctx.reply("❌ *Server not available.*", { parse_mode: "Markdown" });
      return;
    }

    const sessionId = this.getSessionId(ctx);
    const current = wsServer.messagePipeline.getReasoningSetting(sessionId);
    const next: "on" | "off" | "stream" = current === "off" ? "on" : current === "on" ? "stream" : "off";
    wsServer.messagePipeline.setReasoningSetting(sessionId, next);

    const labels: Record<string, string> = {
      off: "⚫ Off (hidden)",
      on: "🟡 On (appended to reply)",
      stream: "🟢 Stream (live in progress)"
    };
    await ctx.reply(
      `🔍 *Reasoning visibility updated*\n\nNew setting: ${labels[next]}`,
      { parse_mode: "Markdown" }
    );
  }

  private async handleRetry(ctx: any) {
    const from = ctx.from;
    if (!from) return;
    const chatId = ctx.chat?.id || ctx.message?.chat.id;
    if (!chatId) return;

    const wsServer = this.getWsServer();
    if (!wsServer) {
      await ctx.reply("❌ *Server not available.*", { parse_mode: "Markdown" });
      return;
    }

    const sessionId = this.getSessionId(ctx);
    const lastQuery = this.getLastUserQuery(sessionId);
    if (!lastQuery) {
      await ctx.reply("⚠️ *No previous query found to retry.*", { parse_mode: "Markdown" });
      return;
    }

    const envelope = {
      sender: { id: from.id, firstName: from.first_name, username: from.username },
      chatId,
      content: lastQuery,
      attachments: [],
      channel: "telegram" as const,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const progressConfig = wsServer.progressDraftManager.getAgentProgressConfig(this.agentId, wsServer.globalConfig);
    if (progressConfig.mode !== "off") {
      try {
        await wsServer.progressDraftManager.handleEvent(
          chatId, undefined, this.getTelegrafInstance(),
          { type: "turn_start", timestamp: Date.now(), agentId: this.agentId },
          progressConfig, sessionId, wsServer.globalConfig
        );
      } catch {}
    }

    const sendTyping = () => {
      this.bot.api.sendChatAction(chatId, "typing").catch(() => {});
    };
    sendTyping();
    const typingInterval = setInterval(sendTyping, 4000);

    wsServer.messagePipeline.registerTypingCanceler(sessionId, () => {
      clearInterval(typingInterval);
    });

    wsServer.messagePipeline.handleInbound("telegram", "default", sessionId, lastQuery, envelope)
      .catch(err => {
        console.error("[TelegramBridge] Retry dispatch failed:", err);
        clearInterval(typingInterval);
        wsServer.messagePipeline.clearTypingCanceler(sessionId);
      });
  }

  private getLastUserQuery(sessionId: string): string | null {
    const escapedSession = sessionId.replace(/:/g, "_");
    const wsServer = this.getWsServer();
    const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
    const workspaceRoot = agentConfig?.workspace || join(homedir(), ".komorebi", "agents", this.agentId);
    const isGroup = sessionId.includes(":telegram:group:");
    const sessionDir = isGroup ? join(workspaceRoot, escapedSession) : workspaceRoot;
    const sessionJsonlPath = join(sessionDir, "session.jsonl");
    try {
      if (existsSync(sessionJsonlPath)) {
        const content = readFileSync(sessionJsonlPath, "utf-8").trim();
        if (content) {
          const lines = content.split("\n");
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line) {
              const parsed = JSON.parse(line);
              if (parsed.role === "user" && parsed.content && !parsed.content.startsWith("/") && parsed.content !== "[Retry last turn]") {
                return parsed.content;
              }
            }
          }
        }
      }
    } catch {}
    return null;
  }

  private async downloadFile(fileId: string, agentId: string, fileName?: string): Promise<string | undefined> {
    const wsServer = this.getWsServer();
    if (!wsServer) return undefined;
    const agentConfig = wsServer.globalConfig.agents.find((a: any) => a.id === agentId);
    const workspacePath = agentConfig?.workspace || join(homedir(), ".komorebi", "agents", agentId);
    if (!workspacePath) return undefined;

    const { mkdirSync, createWriteStream } = await import("node:fs");
    const { pipeline } = await import("node:stream/promises");
    const { Readable } = await import("node:stream");
    
    const attachmentsDir = join(workspacePath, "perception", "attachments");
    try {
      mkdirSync(attachmentsDir, { recursive: true });
    } catch {}

    try {
      const file = await this.bot.api.getFile(fileId);
      const url = `https://api.telegram.org/file/bot${this.token}/${file.file_path}`;
      const localName = `${fileId}_${fileName || 'media'}`;
      const localPath = join(attachmentsDir, localName);

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("Response body is null");

      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(localPath));
      console.log(`[TelegramBridge - ${this.agentId}] Downloaded attachment ${fileId} to ${localPath}`);
      return localPath;
    } catch (err: any) {
      console.error(`[TelegramBridge - ${this.agentId}] Failed to download attachment ${fileId}:`, err.message);
      return undefined;
    }
  }

  public async start() {
    console.log(`[TelegramBridge - ${this.agentId}] Starting bot connection...`);

    const wsServer = this.getWsServer();
    const agentConfig = wsServer?.globalConfig.agents?.find((a: any) => a.id === this.agentId);
    const telegramConfig = agentConfig?.channels?.telegram;
    
    try {
      await this.bot.api.setMyCommands([
        { command: "menu", description: "📱 Open the main interactive menu" },
        { command: "new", description: "✨ Start a new clean session (clears history)" },
        { command: "status", description: "📊 Check agent status, model, and session info" },
        { command: "compact", description: "⚡ Compact conversation history to 1k tokens" },
        { command: "abort", description: "⏹️ Abort the current running execution" },
        { command: "retry", description: "🔁 Retry the last turn" },
        { command: "think", description: "🔍 Toggle reasoning visibility (off/on/stream)" },
        { command: "plan", description: "📋 View the current milestone execution plan" },
        { command: "deltas", description: "🧠 View active prompt adjustments (deltas)" },
        { command: "help", description: "❓ Show help about commands" }
      ]);
      console.log(`[TelegramBridge - ${this.agentId}] Registered bot commands successfully.`);
    } catch (err: any) {
      console.error(`[TelegramBridge - ${this.agentId}] Failed to register bot commands:`, err.message);
    }

    const mode = telegramConfig?.mode ?? "polling";
    if (mode === "webhook") {
      if (wsServer?.app) {
        const webhookPath = `/api/webhook/telegram/${this.agentId}`;
        const { webhookCallback } = await import("grammy");
        wsServer.app.use(webhookPath, webhookCallback(this.bot, "express"));
        
        const externalDomain = telegramConfig.webhookDomain || `http://${wsServer.globalConfig.gateway.host}:${wsServer.globalConfig.gateway.port}`;
        await this.bot.api.setWebhook(`${externalDomain}${webhookPath}`);
        console.log(`[TelegramBridge - ${this.agentId}] Webhook mode started at ${externalDomain}${webhookPath}`);
      } else {
        console.error(`[TelegramBridge - ${this.agentId}] Cannot start webhook mode: Express app is unavailable.`);
      }
    } else {
      const maxConcurrent = (wsServer?.globalConfig.agents as any)?.defaults?.maxConcurrent ?? 5;
      const allowedUpdates = telegramConfig?.allowed_updates || ["message", "callback_query", "message_reaction"];
      
      this.runnerHandle = run(this.bot, {
        runner: {
          maxConcurrent
        },
        allowedUpdates
      } as any);
      console.log(`[TelegramBridge - ${this.agentId}] Polling mode started with concurrency cap ${maxConcurrent}.`);
    }
  }

  public async stop() {
    console.log(`[TelegramBridge - ${this.agentId}] Stopping bot...`);
    try {
      if (this.runnerHandle && this.runnerHandle.isRunning()) {
        await this.runnerHandle.stop();
      }
    } catch (err: any) {
      console.warn(`[TelegramBridge - ${this.agentId}] Error stopping runner:`, err.message);
    }
  }
}
