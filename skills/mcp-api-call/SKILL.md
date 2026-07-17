---
name: mcp-api-call
description: Instructions for invoking external actions and retrieving resources via Model Context Protocol (MCP) servers.
tags:
  - integration
  - protocol
---

# MCP API Calling Skill

This skill guides the agent on how to communicate with external APIs, databases, or file systems that have been wrapped as MCP servers.

## Operating Manual

### 1. Locate Namespaced Tool
Review the list of active tools in your system prompt. All MCP tools are auto-injected using the prefix `mcp:<serverName>:<toolName>` (e.g. `mcp:filesystem:read_file`).

### 2. Invoke Directly
If a matching namespaced tool is active:
*   Reason about the required parameters schema.
*   Execute the tool directly. Do not use generic proxies if a direct namespaced tool is available.

### 3. Fallback: Generic call
If the tool is not directly registered in the namespace, but the server is running:
*   Invoke the `mcp_call` helper tool.
*   Arguments: `serverName`, `toolName`, and the raw `arguments` JSON object payload.

### 4. Direct HTTP Fallback
If no MCP wrapper exists for a REST endpoint, use the `generic_api_call` tool to call the API directly using standard HTTP request parameters.
