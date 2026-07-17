import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolRegistry } from "./registry.js";
import { ToolDefinition, RegisteredTool } from "./types.js";

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpClientManager {
  private activeClients = new Map<string, Client>();

  constructor(
    private readonly workspacePath: string,
    private readonly mcpServersConfig: Record<string, McpServerConfig>
  ) {}

  /**
   * Spawns all configured MCP servers and registers their tools dynamically.
   */
  public async initializeAll(registry: ToolRegistry): Promise<void> {
    if (!this.mcpServersConfig || Object.keys(this.mcpServersConfig).length === 0) {
      console.log("[MCPClientManager] No MCP servers configured in setup.");
      return;
    }

    for (const [serverName, serverCfg] of Object.entries(this.mcpServersConfig)) {
      try {
        console.log(`[MCPClientManager] Initializing server: ${serverName}...`);
        await this.connectServer(serverName, serverCfg, registry);
      } catch (err: any) {
        console.error(`[MCPClientManager] Failed to load MCP server '${serverName}':`, err.message);
      }
    }
  }

  /**
   * Connects to a specific MCP server and registers its tool schemas in the ToolRegistry.
   */
  private async connectServer(
    serverName: string,
    config: McpServerConfig,
    registry: ToolRegistry
  ): Promise<void> {
    const client = new Client(
      {
        name: `komorebi-${serverName}-client`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: {
        ...process.env,
        ...(config.env || {}),
      } as Record<string, string>,
    });

    await client.connect(transport);
    this.activeClients.set(serverName, client);

    console.log(`[MCPClientManager] Server '${serverName}' connected. Requesting tools...`);

    // List exposed tools
    const toolsResult = await client.listTools();
    if (!toolsResult.tools || toolsResult.tools.length === 0) {
      console.log(`[MCPClientManager] Server '${serverName}' did not expose any tools.`);
      return;
    }

    for (const mcpTool of toolsResult.tools) {
      const namespacedName = `mcp:${serverName}:${mcpTool.name}`;
      
      const definition: ToolDefinition = {
        name: namespacedName,
        description: mcpTool.description || `Exposed tool from ${serverName} MCP server.`,
        parameters: (mcpTool.inputSchema as any) || { type: "object", properties: {} },
      };

      const registered: RegisteredTool = {
        definition,
        execute: async (args) => {
          console.log(`[MCPClientManager] Proxying tool execution to ${serverName}: ${mcpTool.name}`);
          try {
            const callRes = await client.callTool({
              name: mcpTool.name,
              arguments: args,
            });

            // Extract text contents out of MCP content frames
            const content = callRes.content as any[];
            if (content && content.length > 0) {
              const textParts = content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text);
              return textParts.join("\n") || JSON.stringify(callRes);
            }
            return JSON.stringify(callRes);
          } catch (err: any) {
            console.error(`[MCPClientManager] MCP tool execution error on ${namespacedName}:`, err);
            return `Error executing MCP tool: ${err.message}`;
          }
        },
      };

      registry.register(registered);
      console.log(`[MCPClientManager] Registered namespaced tool: ${namespacedName}`);
    }
  }

  /**
   * Safely terminates all spawned stdio subprocesses.
   */
  public async closeAll(): Promise<void> {
    for (const [serverName, client] of this.activeClients.entries()) {
      try {
        console.log(`[MCPClientManager] Closing transport for server: ${serverName}`);
        await client.close();
      } catch (err: any) {
        console.error(`[MCPClientManager] Error closing transport for ${serverName}:`, err.message);
      }
    }
    this.activeClients.clear();
  }
}
