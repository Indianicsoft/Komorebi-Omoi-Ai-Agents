# Curated Long-Term Memory (Example)

This curated context sheet stores verified facts, user details, and operational states compiled during agent execution.

## User Profiles & Details
*   **Name**: Rohith
*   **Role**: Host Owner & Principal Architect
*   **Preferences**:
    *   Prefers Node.js and TypeScript for microservice backend components.
    *   Prefers process namespaces (Bubblewrap) over Docker containers for Pi 5 isolation to conserve memory.

## Persistent Context & System Rules
*   **Core System Name**: Komorebi Omoi
*   **Gateway Binding**: `ws://127.0.0.1:18789`
*   **Hardware Profile**: Raspberry Pi 5 (8GB, 4-core A76)
*   **Memory Ceiling**: Hard limit of 500MB V8 heap size per agent process.
*   **Security Gating**: Default-deny on shell commands (`exec`) and writes outside agent-designated workspaces.
