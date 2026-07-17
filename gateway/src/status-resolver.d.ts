/**
 * Resolves three independent runtime status labels for a given agent session:
 * - Execution: resolved provider/model ref (e.g. "gemini/gemini-1.5-flash")
 * - Runtime: Resolved harness ID (e.g. "komorebi")
 * - Channel: Transport channel (e.g. "telegram", "web", "cron", "bus")
 */
export declare function resolveRuntimeStatus(agentId: string, sessionId: string, globalConfig: any): {
    execution: string;
    runtime: string;
    channel: string;
};
//# sourceMappingURL=status-resolver.d.ts.map