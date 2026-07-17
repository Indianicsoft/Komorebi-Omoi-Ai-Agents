# Context Engine Lifecycle Specifications

The Context Engine governs the active conversation window, prompt construction, lazy skill disclosures, and context compaction cycles through a unified hook subscription architecture.

## Lifecycle Hooks

The runtime harness triggers the Context Engine at four static lifecycle execution points per turn:

1. **`assemble(sessionState, workspaceBundle, context)`**
   - **Trigger Point**: Prior to querying the model.
   - **Role**: Combines identity, user settings, memory stack entries, level-0 skill tables, and conversation transcripts into the final query prompt payload.

2. **`ingest(toolResult, sessionState)`**
   - **Trigger Point**: Immediately after a tool completes execution.
   - **Role**: Applies the Tool Result Guard (synthesizes error placeholders if calls are orphaned) and checks tool output logs to lazy-load Level-1 or Level-2 playbooks/references.

3. **`afterTurn(finishedTurn, sessionState)`**
   - **Trigger Point**: Once a complete message turn (including plain-text reply and tool trace outcomes) is produced.
   - **Role**: Triggers reflection extraction classifiers, finalizes progress drafts, and parses inter-agent event bus messages.

4. **`compaction(sessionState)`**
   - **Trigger Point**: When estimated history character or token size crosses the recommended floor boundaries.
   - **Role**: Invokes the 8-technique compaction routines (turn trimming, cache expiration, head/tail preservation, staged summaries) and updates memory logs.

## Subscriber Registrations

All background services (compaction, skills progressive loader, reflection, bus trackers) register callback handlers rather than injecting operations inside loop templates directly.
