import { AgentConfig } from "../../types.js";

// Supported harness list
const SUPPORTED_HARNESSES = new Set(["komorebi"]);

/**
 * Resolves the agent runtime harness ID according to OpenClaw resolution rules:
 * model-scope > provider-scope > "auto" (always resolves to "komorebi" for now).
 * Fails closed if the explicit harness is not supported/registered.
 */
export function resolveHarness(
  providerId: string,
  modelName: string,
  agentConfig: any,
  globalConfig?: any
): string {
  let resolvedHarnessId = "auto";

  // 1. Model Scope Precedence
  if (agentConfig?.model?.agentRuntime?.id) {
    resolvedHarnessId = agentConfig.model.agentRuntime.id;
  } else if (agentConfig?.model?.agentRuntimeId) {
    resolvedHarnessId = agentConfig.model.agentRuntimeId;
  }

  if (!resolvedHarnessId || resolvedHarnessId === "default") {
    resolvedHarnessId = "auto";
  }

  // 2. Provider Scope Precedence
  if (resolvedHarnessId === "auto") {
    // Find provider config in agentConfig or globalConfig
    let providerConfig = agentConfig?.providerConfig;
    if (!providerConfig && globalConfig?.providers) {
      providerConfig = globalConfig.providers.find((p: any) => p.id === providerId);
    }
    if (!providerConfig && globalConfig?.models?.providers?.[providerId]) {
      providerConfig = globalConfig.models.providers[providerId];
    }

    if (providerConfig?.agentRuntime?.id) {
      resolvedHarnessId = providerConfig.agentRuntime.id;
    } else if (providerConfig?.agentRuntimeId) {
      resolvedHarnessId = providerConfig.agentRuntimeId;
    }
  }

  if (!resolvedHarnessId || resolvedHarnessId === "default") {
    resolvedHarnessId = "auto";
  }

  // 3. Fallback / Default Resolution
  if (resolvedHarnessId === "auto") {
    resolvedHarnessId = "komorebi";
  }

  // 4. Fail Closed Check
  if (!SUPPORTED_HARNESSES.has(resolvedHarnessId)) {
    throw new Error(`CRITICAL: Explicit agent runtime harness '${resolvedHarnessId}' is not registered or supported.`);
  }

  return resolvedHarnessId;
}
