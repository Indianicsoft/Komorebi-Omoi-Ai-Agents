# Harness Selection Resolution Policy

This document describes the precedence and evaluation rules used to resolve which agent execution harness to spawn for a given session in the Komorebi Omoi runtime.

## Resolution Algorithm Precedence

Harness resolution occurs at session initialization using the following order of precedence:

1. **Model-Scoped Override**  
   If configured on the agent configuration (`agentConfig.model.agentRuntime.id` or `agentConfig.model.agentRuntimeId`), this setting takes highest priority.

2. **Provider-Scoped Override**  
   If step 1 is unset or set to `"auto"`/`"default"`, the resolver checks the provider configuration (`providersConfig[providerId].agentRuntime.id` or `providersConfig[providerId].agentRuntimeId`).

3. **Auto Fallback**  
   If both model and provider scopes are unset, `"auto"`, or `"default"`, the system falls back to the built-in `"komorebi"` harness.

## Resolution Configuration Rules

- **`"auto"` / `"default"` / Unset**: Automatically maps to the fallback `"komorebi"` runtime.
- **Fail Closed Constraint**: If an explicit harness ID is provided (e.g. `"openclaw-v2"`) but is not supported/registered, the resolver **fails closed immediately and throws a loud fatal compilation/runtime error**, halting execution to prevent silent degradations.

## Reference Code Implementation
See [registry.ts](file:///media/rohith/DataVolume1/komorebi%20omoi%20/agent-runtime/src/runtime/harness/registry.ts) for the exact TypeScript implementation.
