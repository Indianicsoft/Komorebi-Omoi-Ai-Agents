export interface ChatMessage {
  role: "user" | "model" | "system";
  content?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  mediaParts?: Array<{
    mimeType: string;
    data: string;
  }>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError?: boolean;
}

export interface ModelResponse {
  content?: string;
  toolCalls?: ToolCall[];
}

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ModelProvider {
  id: string;
  generate(
    systemPrompt: string,
    history: ChatMessage[],
    tools: ToolDefinition[],
    onChunk?: (chunk: { text?: string; toolCalls?: any[] }) => Promise<void> | void,
    options?: { maxInputTokens?: number; maxOutputTokens?: number }
  ): Promise<ModelResponse>;
}

export interface ToolExecutionContext {
  agentId: string;
  sessionId: string;
  workspacePath: string;
  gatewayUrl: string;
  gatewayToken: string;
  rpcRequest: (method: string, params: any) => Promise<any>;
  memoryStack?: any;
  runtime?: any;
}

export type ToolExecuteFn = (
  args: Record<string, any>,
  context: ToolExecutionContext
) => Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecuteFn;
}

export interface ToolPolicy {
  sandboxType: "none" | "bubblewrap" | "docker";
  allowedTools: string[]; // e.g. ["*"] or list of tool names
  networkAccess: boolean;
  readWritePaths?: string[];
  allowUnrestrictedCommands?: boolean;
}
export interface MessageEnvelope {
  sender: {
    id: number;
    username?: string;
    firstName: string;
    lastName?: string;
  };
  chatId: number;
  threadId?: number;
  content: string;
  attachments: Array<{
    type: string;
    fileId: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    localPath?: string;
  }>;
  channel: "telegram";
  timestamp: number;
}
export interface SoulConfig {
  soul?: string;
  agents?: string;
  user?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  workspace: string;
  model: {
    provider: string;
    name: string;
    apiKey: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
  toolPolicy: {
    sandboxType: "none" | "bubblewrap" | "docker";
    allowedTools: string[];
    networkAccess: boolean;
    readWritePaths?: string[];
  };
}

export interface KomorebiConfig {
  gateway: {
    authToken: string;
    host: string;
    port: number;
  };
  bus: {
    type: "redis" | "embedded" | "nats";
    port?: number;
    url?: string;
    maxMessageSizeKb?: number;
  };
  telegram?: {
    sharedToken?: string;
    bots?: Array<{
      token: string;
      agentId: string;
      allowedUserIds?: number[];
    }>;
  };
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
  agents: AgentConfig[];
  providers?: any[];
  models?: any;
  teams?: any[];
}

export interface WakeEvent {
  type: "message" | "heartbeat" | "cron" | "hook" | "webhook";
  sessionId: string;
  agentId: string;
  payload: {
    message?: string;
    envelope?: any;
    cadence?: string;      // heartbeat
    cronExpression?: string; // cron
    hookName?: string;     // hook
    hookData?: any;
    body?: any;            // webhook
    headers?: Record<string, string>;
  };
  timestamp: number;
}
