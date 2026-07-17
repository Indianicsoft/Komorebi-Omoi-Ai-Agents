export class PluginHooksRegistry {
    subscribers = [];
    register(subscriber) {
        this.subscribers.push(subscriber);
    }
    async triggerOnMessageReceived(sessionId, message, envelope) {
        for (const sub of this.subscribers) {
            if (sub.onMessageReceived)
                await sub.onMessageReceived(sessionId, message, envelope);
        }
    }
    async triggerOnSessionCreated(sessionId) {
        for (const sub of this.subscribers) {
            if (sub.onSessionCreated)
                await sub.onSessionCreated(sessionId);
        }
    }
    async triggerOnBeforeAgentRun(sessionId, message, runContext) {
        for (const sub of this.subscribers) {
            if (sub.onBeforeAgentRun)
                await sub.onBeforeAgentRun(sessionId, message, runContext);
        }
    }
    async triggerOnToolCall(sessionId, toolName, args, runContext) {
        for (const sub of this.subscribers) {
            if (sub.onToolCall)
                await sub.onToolCall(sessionId, toolName, args, runContext);
        }
    }
    async triggerOnAfterToolCall(sessionId, toolName, args, result, runContext) {
        for (const sub of this.subscribers) {
            if (sub.onAfterToolCall)
                await sub.onAfterToolCall(sessionId, toolName, args, result, runContext);
        }
    }
    async triggerOnAgentRunComplete(sessionId, finishedTurn, runContext) {
        for (const sub of this.subscribers) {
            if (sub.onAgentRunComplete)
                await sub.onAgentRunComplete(sessionId, finishedTurn, runContext);
        }
    }
    async triggerOnCompactionTriggered(sessionId, compactionEvent, runContext) {
        for (const sub of this.subscribers) {
            if (sub.onCompactionTriggered)
                await sub.onCompactionTriggered(sessionId, compactionEvent, runContext);
        }
    }
    async triggerOnSessionIdle(sessionId) {
        for (const sub of this.subscribers) {
            if (sub.onSessionIdle)
                await sub.onSessionIdle(sessionId);
        }
    }
}
export const pluginHooksRegistry = new PluginHooksRegistry();
//# sourceMappingURL=hooks.js.map