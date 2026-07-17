/**
 * Resolves three independent runtime status labels for a given agent session:
 * - Execution: resolved provider/model ref (e.g. "gemini/gemini-1.5-flash")
 * - Runtime: Resolved harness ID (e.g. "komorebi")
 * - Channel: Transport channel (e.g. "telegram", "web", "cron", "bus")
 */
export function resolveRuntimeStatus(agentId: string, sessionId: string, globalConfig: any) {
  const agent = globalConfig.agents?.find((a: any) => a.id === agentId);
  
  // 1. Resolve Execution (provider/model)
  const provider = agent?.model?.provider || "gemini";
  const model = agent?.model?.name || agent?.model?.modelId || "gemini-3.5-flash";
  const execution = `${provider}/${model}`;
  
  // 2. Resolve Runtime (Harness ID)
  let runtime = "komorebi";
  let reason = "auto-fallback to built-in komorebi harness";
  if (agent?.model?.agentRuntime?.id) {
    runtime = agent.model.agentRuntime.id;
    reason = "model-scoped override";
  } else if (agent?.model?.agentRuntimeId) {
    runtime = agent.model.agentRuntimeId;
    reason = "model-scoped override";
  } else {
    // Check provider scope in globalConfig
    let providerConfig = agent?.providerConfig;
    if (!providerConfig && globalConfig?.providers) {
      providerConfig = globalConfig.providers.find((p: any) => p.id === provider);
    }
    if (!providerConfig && globalConfig?.models?.providers?.[provider]) {
      providerConfig = globalConfig.models.providers[provider];
    }
    if (providerConfig?.agentRuntime?.id) {
      runtime = providerConfig.agentRuntime.id;
      reason = "provider-scoped override";
    } else if (providerConfig?.agentRuntimeId) {
      runtime = providerConfig.agentRuntimeId;
      reason = "provider-scoped override";
    }
  }

  // 3. Resolve Channel
  let channel = "web";
  if (sessionId.includes(":peer:")) {
    channel = "telegram";
  } else if (sessionId.includes("cron")) {
    channel = "cron";
  } else if (sessionId.includes("bus")) {
    channel = "bus";
  }

  return { execution, runtime, channel, reason };
}
