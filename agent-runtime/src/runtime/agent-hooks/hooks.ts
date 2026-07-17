import { FinishedTurn } from "../../context-engine/index.js";

export interface PluginHooks {
  onMessageReceived?: (sessionId: string, message: string, envelope: any) => Promise<void> | void;
  onSessionCreated?: (sessionId: string) => Promise<void> | void;
  onBeforeAgentRun?: (sessionId: string, message: string, runContext: any) => Promise<void> | void;
  onToolCall?: (sessionId: string, toolName: string, args: any, runContext: any) => Promise<void> | void;
  onAfterToolCall?: (sessionId: string, toolName: string, args: any, result: any, runContext: any) => Promise<void> | void;
  onAgentRunComplete?: (sessionId: string, finishedTurn: FinishedTurn, runContext: any) => Promise<void> | void;
  onCompactionTriggered?: (sessionId: string, compactionEvent: any, runContext: any) => Promise<void> | void;
  onSessionIdle?: (sessionId: string) => Promise<void> | void;
}

export class PluginHooksRegistry {
  private subscribers: PluginHooks[] = [];

  public register(subscriber: PluginHooks) {
    this.subscribers.push(subscriber);
  }

  public async triggerOnMessageReceived(sessionId: string, message: string, envelope: any) {
    for (const sub of this.subscribers) {
      if (sub.onMessageReceived) await sub.onMessageReceived(sessionId, message, envelope);
    }
  }

  public async triggerOnSessionCreated(sessionId: string) {
    for (const sub of this.subscribers) {
      if (sub.onSessionCreated) await sub.onSessionCreated(sessionId);
    }
  }

  public async triggerOnBeforeAgentRun(sessionId: string, message: string, runContext: any) {
    for (const sub of this.subscribers) {
      if (sub.onBeforeAgentRun) await sub.onBeforeAgentRun(sessionId, message, runContext);
    }
  }

  public async triggerOnToolCall(sessionId: string, toolName: string, args: any, runContext: any) {
    for (const sub of this.subscribers) {
      if (sub.onToolCall) await sub.onToolCall(sessionId, toolName, args, runContext);
    }
  }

  public async triggerOnAfterToolCall(sessionId: string, toolName: string, args: any, result: any, runContext: any) {
    for (const sub of this.subscribers) {
      if (sub.onAfterToolCall) await sub.onAfterToolCall(sessionId, toolName, args, result, runContext);
    }
  }

  public async triggerOnAgentRunComplete(sessionId: string, finishedTurn: FinishedTurn, runContext: any) {
    for (const sub of this.subscribers) {
      if (sub.onAgentRunComplete) await sub.onAgentRunComplete(sessionId, finishedTurn, runContext);
    }
  }

  public async triggerOnCompactionTriggered(sessionId: string, compactionEvent: any, runContext: any) {
    for (const sub of this.subscribers) {
      if (sub.onCompactionTriggered) await sub.onCompactionTriggered(sessionId, compactionEvent, runContext);
    }
  }

  public async triggerOnSessionIdle(sessionId: string) {
    for (const sub of this.subscribers) {
      if (sub.onSessionIdle) await sub.onSessionIdle(sessionId);
    }
  }
}

export const pluginHooksRegistry = new PluginHooksRegistry();
