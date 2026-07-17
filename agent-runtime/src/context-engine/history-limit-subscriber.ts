import { ContextLifecycleSubscriber, AssembleContext, WorkspaceBundle } from "./index.js";

export class HistoryLimitSubscriber implements ContextLifecycleSubscriber {
  public async assemble(
    sessionState: any,
    workspaceBundle: WorkspaceBundle,
    context: AssembleContext
  ): Promise<void> {
    const sessionId = sessionState.sessionId;
    const agentConfig = sessionState.agentConfig;
    if (!sessionId || !agentConfig) return;

    const telegramConfig = agentConfig.channels?.telegram;
    if (!telegramConfig) return;

    if (sessionId.includes(":telegram:group:")) {
      const limit = telegramConfig.historyLimit ?? 50;
      if (context.history.length > limit) {
        context.history = context.history.slice(-limit);
      }
    } else if (sessionId.includes(":telegram:dm:")) {
      const parts = sessionId.split(":");
      const userId = parts[4]; // agent:<agentId>:telegram:dm:<userId>
      
      let turnsLimit = telegramConfig.dmHistoryLimit ?? 10;
      if (userId && telegramConfig.dms?.[userId]?.historyLimit !== undefined) {
        turnsLimit = telegramConfig.dms[userId].historyLimit;
      }

      // Trim based on user turns (each turn starts with a user role message)
      let userCount = 0;
      let startIndex = 0;
      for (let i = context.history.length - 1; i >= 0; i--) {
        if (context.history[i].role === "user") {
          userCount++;
          if (userCount === turnsLimit) {
            startIndex = i;
            break;
          }
        }
      }

      if (startIndex > 0) {
        context.history = context.history.slice(startIndex);
      }
    }
  }
}
