/**
 * Resolves three independent runtime status labels for a given agent session:
 * - Execution: resolved provider/model ref (e.g. "gemini/gemini-1.5-flash")
 * - Runtime: Resolved harness ID (e.g. "komorebi")
 * - Channel: Transport channel (e.g. "telegram", "web", "cron", "bus")
 */
export function resolveRuntimeStatus(agentId, sessionId, globalConfig) {
    const agent = globalConfig.agents?.find((a) => a.id === agentId);
    // 1. Resolve Execution (provider/model)
    const provider = agent?.model?.provider || "gemini";
    const model = agent?.model?.name || agent?.model?.modelId || "gemini-3.5-flash";
    const execution = `${provider}/${model}`;
    // 2. Resolve Runtime (Harness ID)
    let runtime = "komorebi";
    if (agent?.model?.agentRuntime?.id) {
        runtime = agent.model.agentRuntime.id;
    }
    else if (agent?.model?.agentRuntimeId) {
        runtime = agent.model.agentRuntimeId;
    }
    else {
        // Check provider scope in globalConfig
        let providerConfig = agent?.providerConfig;
        if (!providerConfig && globalConfig?.providers) {
            providerConfig = globalConfig.providers.find((p) => p.id === provider);
        }
        if (!providerConfig && globalConfig?.models?.providers?.[provider]) {
            providerConfig = globalConfig.models.providers[provider];
        }
        if (providerConfig?.agentRuntime?.id) {
            runtime = providerConfig.agentRuntime.id;
        }
        else if (providerConfig?.agentRuntimeId) {
            runtime = providerConfig.agentRuntimeId;
        }
    }
    // 3. Resolve Channel
    let channel = "web";
    if (sessionId.includes(":peer:")) {
        channel = "telegram";
    }
    else if (sessionId.includes("cron")) {
        channel = "cron";
    }
    else if (sessionId.includes("bus")) {
        channel = "bus";
    }
    return { execution, runtime, channel };
}
//# sourceMappingURL=status-resolver.js.map