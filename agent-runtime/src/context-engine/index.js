export class ContextEngine {
    subscribers = [];
    register(subscriber) {
        this.subscribers.push(subscriber);
    }
    async triggerAssemble(sessionState, workspaceBundle, context) {
        for (const sub of this.subscribers) {
            if (sub.assemble) {
                await sub.assemble(sessionState, workspaceBundle, context);
            }
        }
    }
    async triggerIngest(toolResult, sessionState) {
        for (const sub of this.subscribers) {
            if (sub.ingest) {
                await sub.ingest(toolResult, sessionState);
            }
        }
    }
    async triggerAfterTurn(finishedTurn, sessionState) {
        for (const sub of this.subscribers) {
            if (sub.afterTurn) {
                await sub.afterTurn(finishedTurn, sessionState);
            }
        }
    }
    async triggerCompaction(sessionState) {
        for (const sub of this.subscribers) {
            if (sub.compaction) {
                await sub.compaction(sessionState);
            }
        }
    }
}
export const contextEngine = new ContextEngine();
//# sourceMappingURL=index.js.map