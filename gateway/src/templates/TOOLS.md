# Agent Tools Capability Register

*This file catalogues your available tool surface and usage discipline rules. Update it when new tools are registered.*

---

## Core Tool Discipline Rules

1. **Read before write** — never overwrite without reading the current file state first.
2. **Batch tool calls** — when multiple independent lookups are needed, make them in the same model turn.
3. **Sandbox awareness** — `exec` requires administrator approval outside of sandbox mode. Always warn the user before attempting shell execution.
4. **Error transparency** — if a tool returns an error, report the exact error message, don't silently ignore it.
5. **No hallucinated outputs** — never fabricate what a tool "would" return. If you can't run it, say so.

---

## File System Tools

| Tool | Purpose | Notes |
|---|---|---|
| `read_file` | Read file contents from workspace | Relative to workspace root |
| `write_file` | Create or overwrite file | Triggers intelligent compaction for MEMORY.md, USER.md |
| `edit_file` | In-place find-and-replace in a file | Fails if targetText not found exactly |
| `append_file` | Append text to end of existing file | Creates file if doesn't exist |
| `list_dir` | List directory contents recursively | Shows files/folders tree-style |

---

## Web & Network Tools

| Tool | Purpose | Notes |
|---|---|---|
| `web_search` | DuckDuckGo search query | Returns top 5 snippets |
| `web_fetch` | Fetch raw text from URL | Returns first 4000 chars |
| `http_stream` | Chunked streaming HTTP fetch | Use for large payloads or APIs |
| `generic_api_call` | Raw REST API call (GET/POST/PUT/DELETE) | Supply headers as JSON object |

---

## Memory Tools

| Tool | Purpose | Notes |
|---|---|---|
| `memory_write_daily` | Append to today's dated log (YYYY-MM-DD.md) | Good for session journals |
| `memory_update_curated` | Overwrite MEMORY.md with compiled summary | Use after significant learning |
| `memory_search` | Semantic vector search of long-term memory | Returns relevant past context |

---

## Agent Collaboration Tools

| Tool | Purpose | Notes |
|---|---|---|
| `agent_message` | Send message to another cluster agent | Async — reply comes as new turn |
| `spawn_subagent` | Spawn isolated helper sub-agent | Use for parallelizable background tasks |

---

## Skills & Capability Expansion

| Tool | Purpose | Notes |
|---|---|---|
| `skills_search` | Search ClawHub registry for installable skills | Returns slug, description, ratings |
| `skills_load` | Load a skill's SKILL.md instructions into context | Run before using a skill |
| `skills_load_reference` | Load a reference file from a skill folder | For schemas, playbooks, etc. |
| `read_skill` | Read SKILL.md content directly from disk | Alias for skills_load |

---

## Utility Tools

| Tool | Purpose | Notes |
|---|---|---|
| `exec` | Execute shell command on host OS | Requires admin approval unless sandbox-unrestricted |
| `cron_schedule` | Schedule a recurring cron job | Uses gateway daemon queue |
| `telegram_send` | Push a Telegram message proactively | Useful for async progress notifications |
| `mcp_call` | Invoke a Model Context Protocol (MCP) server tool | Proxies to registered MCP servers |
| `think` | Internal reasoning scratchpad | Output is logged but not shown to user |
| `synthesize_tool` | Dynamically generate and register a new custom tool | For one-off integrations |

---

## MCP Servers Available

*This section is populated automatically at runtime based on the komorebi.config.json mcpServers.*

Check `komorebi.config.json` for the current list of registered MCP server names and their exposed tools.
