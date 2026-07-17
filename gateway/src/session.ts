import { WebSocket } from "ws";
import { AgentConfig, DmScope } from "./types.js";
import { AgentPoolManager } from "./pool.js";

/**
 * SessionManager tracks active WebSocket connection handles per agent session key,
 * and delegates process execution lifecycles to the AgentPoolManager.
 */
export class SessionManager {
  private activeAgentConnections = new Map<string, WebSocket>();
  private poolManager!: AgentPoolManager;

  constructor(
    private readonly agentsConfig: AgentConfig[],
    private readonly projectRoot: string
  ) {}

  /**
   * Links the pool manager instance (called at bootstrap).
   */
  public setPoolManager(poolManager: AgentPoolManager) {
    this.poolManager = poolManager;
  }

  /**
   * Derives a session key based on the agent configuration's DM scope.
   */
  public getSessionKey(
    agentId: string,
    chatId: number,
    userId: number,
    dmScope: DmScope
  ): string {
    switch (dmScope) {
      case "main":
        return `${agentId}:main`;
      case "per-peer":
        return `${agentId}:peer:${userId}`;
      case "per-channel-peer":
        return `${agentId}:chat:${chatId}:peer:${userId}`;
      default:
        return `${agentId}:chat:${chatId}:peer:${userId}`;
    }
  }

  /**
   * Derives a Telegram-specific session key following isolation rules:
   * Group chats sandboxed to agent:<agentId>:telegram:group:<chatId>
   * DM chats mapped to agent:<agentId>:telegram:dm:<userId>
   */
  public getTelegramSessionKey(
    agentId: string,
    chatId: number,
    userId: number,
    isGroup: boolean,
    topicId?: number
  ): string {
    if (isGroup) {
      if (topicId && topicId !== 0) {
        return `agent:${agentId}:telegram:group:${chatId}:topic:${topicId}`;
      }
      return `agent:${agentId}:telegram:group:${chatId}`;
    } else {
      return `agent:${agentId}:telegram:dm:${userId}`;
    }
  }

  public registerAgentConnection(sessionId: string, ws: WebSocket) {
    console.log(`[SessionManager] WebSocket connection registered for session: ${sessionId}`);
    this.activeAgentConnections.set(sessionId, ws);
  }

  public unregisterAgentConnection(sessionId: string) {
    this.activeAgentConnections.delete(sessionId);
  }

  public getAgentConnection(sessionId: string): WebSocket | undefined {
    return this.activeAgentConnections.get(sessionId);
  }

  public getSessionIdForConnection(ws: WebSocket): string | undefined {
    for (const [sessId, conn] of this.activeAgentConnections.entries()) {
      if (conn === ws) return sessId;
    }
    return undefined;
  }

  /**
   * Ensures the agent process is running via the pool manager and returns its active connection.
   */
  public async ensureAgentRunning(
    agentId: string,
    sessionId: string,
    persistent = false
  ): Promise<WebSocket> {
    const existingWs = this.getAgentConnection(sessionId);
    if (existingWs && existingWs.readyState === WebSocket.OPEN) {
      return existingWs;
    }

    if (!this.poolManager) {
      throw new Error("[SessionManager] PoolManager dependency not linked.");
    }

    // Trigger process spawn via pool manager
    await this.poolManager.ensureAgentRunning(agentId, sessionId, persistent);

    // Wait for the spawned process to register its WebSocket connection
    return this.waitForConnection(sessionId);
  }

  /**
   * Helper that polls until the agent's WebSocket registers itself.
   */
  private waitForConnection(
    sessionId: string,
    timeoutMs: number = 10000
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const ws = this.getAgentConnection(sessionId);
        if (ws && ws.readyState === WebSocket.OPEN) {
          clearInterval(interval);
          resolve(ws);
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for agent WebSocket registration on session: ${sessionId}`));
        }
      }, 100);
    });
  }

  /**
   * Safely terminates a session process.
   */
  public terminateSession(sessionId: string) {
    this.poolManager.terminateSession(sessionId);
    this.unregisterAgentConnection(sessionId);
  }

  public getInstance(sessionId: string) {
    return this.poolManager?.getInstance(sessionId);
  }

  public getSessionsForAgent(agentId: string): Array<{ sessionId: string }> {
    const prefix = `${agentId}:`;
    const list: Array<{ sessionId: string }> = [];
    for (const sessionId of this.activeAgentConnections.keys()) {
      if (sessionId.startsWith(prefix)) {
        list.push({ sessionId });
      }
    }
    return list;
  }

  /**
   * Broadcasts a raw JSON frame to every open WebSocket session that belongs
   * to the given agentId (i.e. keys starting with `${agentId}:`).
   */
  public broadcastToAgent(agentId: string, frame: object): number {
    const prefix = `${agentId}:`;
    let sent = 0;
    const payload = JSON.stringify(frame);
    for (const [sessionId, ws] of this.activeAgentConnections.entries()) {
      if (sessionId.startsWith(prefix) && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        sent++;
      }
    }
    return sent;
  }
}

