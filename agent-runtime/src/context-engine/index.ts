import { ChatMessage, ToolDefinition, ToolResult } from "../types.js";

export interface WorkspaceBundle {
  workspacePath: string;
  agentDir: string;
  files: Record<string, string>; // lowercase filename -> content
}

export interface AssembleContext {
  systemPrompt: string;
  history: ChatMessage[];
  tools: ToolDefinition[];
}

export interface FinishedTurn {
  reply: string;
  toolTrace: any[];
  tokensUsed: number;
  compactionEvents: any[];
}

export interface ContextLifecycleSubscriber {
  assemble?: (sessionState: any, workspaceBundle: WorkspaceBundle, context: AssembleContext) => Promise<void> | void;
  ingest?: (toolResult: ToolResult, sessionState: any) => Promise<void> | void;
  afterTurn?: (finishedTurn: FinishedTurn, sessionState: any) => Promise<void> | void;
  compaction?: (sessionState: any) => Promise<void> | void;
}

export class ContextEngine {
  private subscribers: ContextLifecycleSubscriber[] = [];

  public register(subscriber: ContextLifecycleSubscriber) {
    this.subscribers.push(subscriber);
  }

  public async triggerAssemble(
    sessionState: any,
    workspaceBundle: WorkspaceBundle,
    context: AssembleContext
  ): Promise<void> {
    for (const sub of this.subscribers) {
      if (sub.assemble) {
        await sub.assemble(sessionState, workspaceBundle, context);
      }
    }
  }

  public async triggerIngest(toolResult: ToolResult, sessionState: any): Promise<void> {
    for (const sub of this.subscribers) {
      if (sub.ingest) {
        await sub.ingest(toolResult, sessionState);
      }
    }
  }

  public async triggerAfterTurn(finishedTurn: FinishedTurn, sessionState: any): Promise<void> {
    for (const sub of this.subscribers) {
      if (sub.afterTurn) {
        await sub.afterTurn(finishedTurn, sessionState);
      }
    }
  }

  public async triggerCompaction(sessionState: any): Promise<void> {
    for (const sub of this.subscribers) {
      if (sub.compaction) {
        await sub.compaction(sessionState);
      }
    }
  }
}
export const contextEngine = new ContextEngine();
