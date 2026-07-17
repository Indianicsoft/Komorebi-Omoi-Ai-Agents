export interface Attachment {
  type: "voice" | "photo" | "document" | "audio" | "video";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  localPath?: string;
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
  attachments: Attachment[];
  channel: "telegram";
  timestamp: number;
}

export type DmScope = "main" | "per-peer" | "per-channel-peer";

// WebSocket RPC Protocol types
export interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params: any;
}

export interface RpcResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: any;
  error?: string;
}

export interface RpcEvent {
  type: "evt";
  event: string;
  data: any;
}

export type RpcFrame = RpcRequest | RpcResponse | RpcEvent;

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
    allowUnrestrictedCommands?: boolean;
  };
  channels?: any;
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
  channels?: any;
  agents: AgentConfig[];
  providers?: any[];
  models?: any;
}
