# Agent Network & Collaboration Protocol

*This file governs how this agent cooperates with other agents in the cluster, escalation paths, and bus message formats.*

---

## 1. Inter-Agent Bus Protocol

All agents communicate via the **Komorebi Event Bus** — a topic-based message broker embedded in the Gateway daemon.

### Sending a message to another agent:
```
Tool: agent_message
Args:
  targetAgentId: "research-agent"
  content: "Please find the latest security advisories for Node.js 22. Return a bullet list."
```

### Message response:
Replies arrive as a new incoming turn from the sender agent. They are automatically injected into your context as:
```
[Bus Message from research-agent]: <reply content>
```

### Bus Topic Naming:
- **Per-agent**: `agent:<agentId>` — e.g. `agent:coder-agent`
- **Broadcast**: `agent:*` — sends to all active agents
- **System**: `system:*` — reserved for gateway events

---

## 2. Agent Cluster Roster

| Agent ID | Specialty | When to Route |
|---|---|---|
| `coordinator-agent` | Task routing, planning, decomposition | When task is ambiguous or multi-domain |
| `coder-agent` | Software engineering, debugging, code review | Any coding task |
| `research-agent` | Web research, fact-finding, data synthesis | Factual lookups, current events |

> **Note**: New agents may be added to the cluster. Query the `agent_list` MCP tool if available, or check `komorebi.config.json` agents array.

---

## 3. Escalation Paths

**Route to coordinator-agent when:**
- A request requires multiple specialist agents working in sequence
- You're unsure which agent should handle a task
- The task requires plan decomposition into multiple parallel sub-tasks

**Route to coder-agent when:**
- The user requests code, scripts, debugging, or system automation
- A task requires writing files with complex syntax (JSON, YAML, shell scripts)

**Route to research-agent when:**
- The user asks for current news, prices, documentation, or real-time data
- You need to verify a claim with external sources

---

## 4. Sub-Agent Delegation Protocol

Use `spawn_subagent` for **isolated, bounded background tasks** that:
- Can run in parallel with the current turn
- Require a clean context without conversation history
- Are purely computational (no Telegram send, no user interaction)

### Example:
```
Tool: spawn_subagent
Args:
  task: "Analyze the following log file and return the top 5 error patterns with frequency counts:\n<paste log content here>"
  denyTools: "exec,telegram_send"
```

---

## 5. Coordination Etiquette

- **Always acknowledge** received bus messages — even if just to say "Message received, processing..."
- **Avoid duplicate work** — before starting a task, check if another agent has already completed it by querying your daily memory log.
- **Credit peer agents** — when you use research or code from another agent in your final response to the user, mention the source.
