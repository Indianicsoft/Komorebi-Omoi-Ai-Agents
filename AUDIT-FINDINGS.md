# Komorebi Omoi Integration Audit Findings

This document logs the integration gaps and security flaws identified during the SRE audit of the Komorebi Omoi codebase, along with their respective remediation actions.

---

## 1. Security Resolver Enforcement (Harness Policy Bypass)
*   **Gap identified**: The tool execution flow in the ReAct loop did not consistently enforce the "deny-always-wins" policy across all entry points. In particular, some sub-agent tool invocations could bypass the registry's gating.
*   **Remediation**: 
    - Re-implemented `isToolPermitted` inside `agent-runtime/src/policy.ts` to enforce that any rule matching a deny list overrides all allow list rules.
    - Updated `executeReActLoop` in `agent-runtime/src/runtime.ts` to route all execution requests strictly through `komorebiHarness.runTurn()`.

---

## 2. Resource Starvation on Raspberry Pi 5
*   **Gap identified**: The sub-agent delegation system had extremely high defaults for nesting depth (100) and concurrency (100), which would easily cause Out-Of-Memory (OOM) crashes and CPU core thrashing on a Raspberry Pi 5.
*   **Remediation**:
    - Hardened limits in `agent-runtime/src/subagent.ts` to block delegation chains exceeding a nesting depth of 2 or concurrent sub-agent execution counts exceeding 3.

---

## 3. Plaintext API Secrets Gaps
*   **Gap identified**: Configuration audits detected raw plaintext API keys (e.g. `sk-live-...`) stored in user files.
*   **Remediation**:
    - Wired `komorebi security audit` CLI command to scan user and agent configs.
    - Interpolated all raw keys in `~/.komorebi/komorebi.json` using the environment variables `${AICREDITS_API_KEY}` and `${TOMMY_API_KEY}`.

---

## 4. Lifecycle Hook Wiring Gaps
*   **Gap identified**: Key lifecycle hooks (`onMessageReceived`, `onSessionCreated`, `onSessionIdle`) were declared but never triggered or registered in the main event loops.
*   **Remediation**:
    - Registered SRE hook subscribers (`CuratorSubscriber`, `ProgressDraftSubscriber`, `WatchdogSubscriber`, and `ProactivitySubscriber`) in `agent-runtime/src/main.ts`.
    - Integrated direct hook trigger invocations in `agent-runtime/src/runtime.ts` at the message ingestion, session initialization, and idle state phases.
