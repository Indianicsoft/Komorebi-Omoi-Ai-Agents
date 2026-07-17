import { ChatMessage, ToolDefinition, ToolResult } from "../types.js";
export interface WorkspaceBundle {
    workspacePath: string;
    agentDir: string;
    files: Record<string, string>;
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
export declare class ContextEngine {
    private subscribers;
    register(subscriber: ContextLifecycleSubscriber): void;
    triggerAssemble(sessionState: any, workspaceBundle: WorkspaceBundle, context: AssembleContext): Promise<void>;
    triggerIngest(toolResult: ToolResult, sessionState: any): Promise<void>;
    triggerAfterTurn(finishedTurn: FinishedTurn, sessionState: any): Promise<void>;
    triggerCompaction(sessionState: any): Promise<void>;
}
export declare const contextEngine: ContextEngine;
//# sourceMappingURL=index.d.ts.map