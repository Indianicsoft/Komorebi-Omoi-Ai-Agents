import { describe, it, expect } from "vitest";
import { ProgressDraftManager, ProgressEvent } from "./progress-draft.js";

describe("Telegram Progress Draft Simulator", () => {
  it("should simulate Telegram progress draft workflow successfully", async () => {
    console.log("==================================================");
    console.log("SIMULATING TELEGRAM PROGRESS DRAFT WORKFLOW");
    console.log("==================================================");

    const manager = new ProgressDraftManager();
    
    // Mock bot message recorder
    const sentMessages: Array<{ id: number; text: string; markup?: any; type: "send" | "edit" | "delete" }> = [];
    let nextMessageId = 1000;

    const mockBot: any = {
      telegram: {
        sendMessage: async (chatId: number, text: string, options?: any) => {
          const id = nextMessageId++;
          console.log(`\n[MockTelegram] [SEND] Message ID: ${id}`);
          console.log(text);
          if (options?.reply_markup) {
            console.log(`[MockTelegram] Buttons:`, JSON.stringify(options.reply_markup));
          }
          sentMessages.push({ id, text, markup: options?.reply_markup, type: "send" });
          return { message_id: id };
        },
        editMessageText: async (chatId: number, messageId: number, inlineMessageId: string | undefined, text: string, options?: any) => {
          console.log(`\n[MockTelegram] [EDIT] Message ID: ${messageId}`);
          console.log(text);
          sentMessages.push({ id: messageId, text, type: "edit" });
          return { message_id: messageId };
        },
        deleteMessage: async (chatId: number, messageId: number) => {
          console.log(`\n[MockTelegram] [DELETE] Message ID: ${messageId}`);
          sentMessages.push({ id: messageId, text: "", type: "delete" });
          return true;
        }
      }
    };

    const config = {
      mode: "progress" as const,
      progress: {
        label: "auto" as const,
        toolProgress: true,
        commentary: true,
        detailMode: "explain" as const,
        commandText: "status" as const,
        lineLimit: 8,
        lineCharBudget: 120,
        cleanupOnFallback: false,
        showElapsedTime: true,
        showAnswerPreview: true,
        answerPreviewChars: 200
      }
    };

    const chatId = 12345;
    const threadId = undefined;
    const agentId = "coder-agent";
    const sessionKey = `${agentId}:${chatId}:0`;

    // 1. Turn start event
    console.log("\n--- Turn Start ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "turn_start", timestamp: Date.now(), agentId }, config);

    // 2. Fast tool call starts at t=0, ends at t=15ms (simulated fast)
    console.log("\n--- Fast Tool Executing ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "tool_start", timestamp: Date.now(), toolCallId: "tc-1", toolName: "read_file", toolArgs: { path: "utils.ts" }, agentId }, config);
    await manager.handleEvent(chatId, threadId, mockBot, { type: "tool_end", timestamp: Date.now(), toolCallId: "tc-1", toolName: "read_file", toolArgs: { path: "utils.ts" }, toolOutput: "function helper() {}", agentId }, config);

    // Assert that draft message was sent to Telegram immediately
    console.log(`Sent count: ${(sentMessages.length as number)} (Expected >= 1)`);
    expect(sentMessages.length).toBeGreaterThanOrEqual(1);

    // 3. Slow tool call starts.
    console.log("\n--- Slow Tool Executing ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "tool_start", timestamp: Date.now(), toolCallId: "tc-2", toolName: "exec", toolArgs: { command: "npm run build" }, agentId }, config);

    // 4. Send bus message to another agent
    console.log("\n--- Messaging Another Agent (Bus) ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "bus_send", timestamp: Date.now(), toolArgs: { targetAgentId: "research-agent" }, agentId }, config);

    // 5. Tool tc-2 ends
    console.log("\n--- Slow Tool Completed ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "tool_end", timestamp: Date.now(), toolCallId: "tc-2", toolName: "exec", toolArgs: { command: "npm run build" }, agentId }, config);

    // 6. Approval wait blocks
    console.log("\n--- Approval Gating Block ---");
    await manager.handleEvent(chatId, threadId, mockBot, { type: "approval_wait", timestamp: Date.now(), toolName: "exec: sudo rm -rf /", agentId }, config);

    // 7. Finalize draft with final answer
    console.log("\n--- Finalizing Turn ---");
    const draft = manager.getOrCreateDraft(sessionKey);
    const finalized = await manager.finalizeDraft(draft, chatId, threadId, mockBot, "Final response: The build completed successfully.", config);

    expect(finalized).toBe(true);
    console.log("ALL SIMULATION ASSERTIONS PASSED!");
  });
});
