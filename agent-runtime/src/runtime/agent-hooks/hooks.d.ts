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
export declare class PluginHooksRegistry {
    private subscribers;
    register(subscriber: PluginHooks): void;
    triggerOnMessageReceived(sessionId: string, message: string, envelope: any): Promise<void>;
    triggerOnSessionCreated(sessionId: string): Promise<void>;
    triggerOnBeforeAgentRun(sessionId: string, message: string, runContext: any): Promise<void>;
    triggerOnToolCall(sessionId: string, toolName: string, args: any, runContext: any): Promise<void>;
    triggerOnAfterToolCall(sessionId: string, toolName: string, args: any, result: any, runContext: any): Promise<void>;
    triggerOnAgentRunComplete(sessionId: string, finishedTurn: FinishedTurn, runContext: any): Promise<void>;
    triggerOnCompactionTriggered(sessionId: string, compactionEvent: any, runContext: any): Promise<void>;
    triggerOnSessionIdle(sessionId: string): Promise<void>;
}
export declare const pluginHooksRegistry: PluginHooksRegistry;
//# sourceMappingURL=hooks.d.ts.map