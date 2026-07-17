import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { AgentPoolManager } from "./pool.js";
import { SessionManager } from "./session.js";
import type { KomorebiConfig } from "./types.js";
import { SelfHealingSubsystem } from "./self-healing.js";

export type AgentHealthState = "healthy" | "degraded" | "paused" | "offline";

interface WatchdogAgentState {
  healthState: AgentHealthState;
  dailyCostUSD: number;
  toolCallSuccessCount: number;
  toolCallFailureCount: number;
  rollingToolErrors: boolean[]; // array of booleans: true = error, false = success
  botTokenValid: boolean;
  consecutiveLoopCeilings: number;
  lastStateChangeReason: string;
}

export class GatewayWatchdog {
  private static instance: GatewayWatchdog;
  private agentStates = new Map<string, WatchdogAgentState>();
  private gatewayStartTime = Date.now();
  private failedHeartbeats = 0;
  private intervals: NodeJS.Timeout[] = [];
  
  private poolManager!: AgentPoolManager;
  private sessionManager!: SessionManager;
  private getWsServer!: () => any;
  private globalConfig!: KomorebiConfig;

  private constructor() {
    this.loadState();
  }

  public static getInstance(): GatewayWatchdog {
    if (!GatewayWatchdog.instance) {
      GatewayWatchdog.instance = new GatewayWatchdog();
    }
    return GatewayWatchdog.instance;
  }

  public initialize(
    poolManager: AgentPoolManager,
    sessionManager: SessionManager,
    getWsServer: () => any,
    globalConfig: KomorebiConfig
  ) {
    this.poolManager = poolManager;
    this.sessionManager = sessionManager;
    this.getWsServer = getWsServer;
    this.globalConfig = globalConfig;

    // Start timers
    this.intervals.push(setInterval(() => this.checkGatewayHeartbeat(), 15000));
    this.intervals.push(setInterval(() => this.checkTelegramTokens(), 60000)); // check bots every minute
    this.intervals.push(setInterval(() => this.checkSessionHealth(), 30000));
    this.intervals.push(setInterval(() => this.checkDailyCostCaps(), 15000));
    this.intervals.push(setInterval(() => this.resetDailyCostsAtMidnight(), 60000));

    // Initialize states for all configured agents
    for (const agent of this.globalConfig.agents) {
      if (!this.agentStates.has(agent.id)) {
        this.agentStates.set(agent.id, this.createDefaultAgentState());
      }
    }
  }

  private createDefaultAgentState(): WatchdogAgentState {
    return {
      healthState: "healthy",
      dailyCostUSD: 0,
      toolCallSuccessCount: 0,
      toolCallFailureCount: 0,
      rollingToolErrors: [],
      botTokenValid: true,
      consecutiveLoopCeilings: 0,
      lastStateChangeReason: "Initialized",
    };
  }

  private getStateFilePath(): string {
    return join(homedir(), ".komorebi", "watchdog-state.json");
  }

  private loadState() {
    const path = this.getStateFilePath();
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        for (const agentId of Object.keys(parsed)) {
          this.agentStates.set(agentId, parsed[agentId]);
        }
      } catch (err) {
        console.error("[Watchdog] Failed to load state:", err);
      }
    }
  }

  private saveState() {
    const path = this.getStateFilePath();
    try {
      const obj: Record<string, WatchdogAgentState> = {};
      for (const [agentId, state] of this.agentStates.entries()) {
        obj[agentId] = state;
      }
      writeFileSync(path, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.error("[Watchdog] Failed to save state:", err);
    }
  }

  // --- Watchdog Layers ---

  // a. Gateway Heartbeat
  private async checkGatewayHeartbeat() {
    const port = this.globalConfig.gateway.port || 18789;
    const token = this.globalConfig.gateway.authToken;
    try {
      // Check responsiveness of self gateway using native fetch
      const res = await fetch(`http://127.0.0.1:${port}/api/agents/status?token=${token}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        this.failedHeartbeats = 0;
      } else {
        this.failedHeartbeats++;
      }
    } catch (err) {
      this.failedHeartbeats++;
    }

    if (this.failedHeartbeats >= 3) {
      console.error(`[Watchdog] Gateway unresponsive for ${this.failedHeartbeats * 15}s. Triggering self-healing...`);
      SelfHealingSubsystem.getInstance().recordFailure("gateway", "heartbeat_unresponsive").catch(() => {});
    }
  }

  // b. Channel Pairing Bot Token Validity Check
  private async checkTelegramTokens() {
    // 1. Shared Bot Token
    if (this.globalConfig.telegram?.sharedToken) {
      const token = this.globalConfig.telegram.sharedToken;
      if (token && !token.includes("example")) {
        const valid = await this.validateTelegramToken(token);
        if (!valid) {
          console.warn("[Watchdog] Shared Telegram bot token is INVALID/REVOKED!");
          this.handleChannelFailure("shared-telegram-bot", "Shared Telegram bot token revoked/invalid");
        }
      }
    }

    // 2. Individual Agent Bot Tokens
    if (this.globalConfig.telegram?.bots) {
      for (const bot of this.globalConfig.telegram.bots) {
        if (bot.token && !bot.token.includes("example")) {
          const valid = await this.validateTelegramToken(bot.token);
          const state = this.getOrInitAgentState(bot.agentId);
          if (state.botTokenValid !== valid) {
            state.botTokenValid = valid;
            this.saveState();
            if (!valid) {
              this.transitionHealth(bot.agentId, "degraded", `Telegram bot token revoked/invalid`);
              this.handleChannelFailure(bot.agentId, `Bot token for agent ${bot.agentId} is invalid or revoked`);
              SelfHealingSubsystem.getInstance().recordFailure(`agent:${bot.agentId}`, "telegram_bot_token_invalid").catch(() => {});
            } else {
              this.evaluateAgentOverallHealth(bot.agentId);
            }
          }
        }
      }
    }
  }

  private async validateTelegramToken(token: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private handleChannelFailure(agentOrBotId: string, reason: string) {
    const logPath = join(homedir(), ".komorebi", "health-events.jsonl");
    const timestamp = new Date().toISOString();
    const alertEntry = {
      timestamp,
      type: "channel_unpairing_alert",
      target: agentOrBotId,
      reason,
    };
    appendFileSync(logPath, JSON.stringify(alertEntry) + "\n", "utf-8");

    // Attempt to notify user via fallback admin chat ID
    const wsServer = this.getWsServer();
    if (wsServer) {
      const allowed = (this.globalConfig as any).allowedTelegramChatIds;
      const fallbackChatId = allowed && allowed.length > 0 ? Number(allowed[0]) : null;
      if (fallbackChatId) {
        wsServer.sendDirectTelegram(
          this.globalConfig.agents[0]?.id || "coordinator-agent",
          fallbackChatId,
          `⚠️ *Watchdog Alert: Telegram bot pairing broken!*\nTarget: \`${agentOrBotId}\`\nReason: ${reason}`
        ).catch(() => {});
      }
    }
  }

  // c. Cost Tracking
  public recordTurnCost(agentId: string, tokensUsed: number) {
    // Standard cost rate: $0.15 per million tokens (Gemini Flash avg rate)
    const cost = tokensUsed * 0.00000015;
    const state = this.getOrInitAgentState(agentId);
    state.dailyCostUSD += cost;
    this.saveState();

    this.checkDailyCostCaps();
  }

  private checkDailyCostCaps() {
    for (const agent of this.globalConfig.agents) {
      const state = this.getOrInitAgentState(agent.id);
      const costCap = (agent as any).dailyCostCapUSD || 1.0; // default cap $1.00/day
      if (state.dailyCostUSD >= costCap && state.healthState !== "paused") {
        this.transitionHealth(agent.id, "paused", `Daily cost limit reached ($${state.dailyCostUSD.toFixed(4)} >= $${costCap.toFixed(2)})`);
        this.notifyUserOfStateChange(agent.id, `Agent cost limit exceeded. Cost: $${state.dailyCostUSD.toFixed(4)} (Cap: $${costCap.toFixed(2)}). Switching to DO-tier-only.`);
      }
    }
  }

  private resetDailyCostsAtMidnight() {
    const now = new Date();
    // Reset at 00:00:xx
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      console.log("[Watchdog] Midnight reached. Resetting daily cost trackers...");
      for (const [agentId, state] of this.agentStates.entries()) {
        state.dailyCostUSD = 0;
        if (state.lastStateChangeReason.includes("limit reached")) {
          // auto-resume from cost pause
          this.resumeAgent(agentId, "Daily cost tracker reset at midnight");
        }
      }
      this.saveState();
    }
  }

  // d. Tool-Error Rate Monitoring
  public recordToolCall(agentId: string, isError: boolean) {
    const state = this.getOrInitAgentState(agentId);
    if (isError) {
      state.toolCallFailureCount++;
    } else {
      state.toolCallSuccessCount++;
    }

    state.rollingToolErrors.push(isError);
    // keep last 20 calls
    if (state.rollingToolErrors.length > 20) {
      state.rollingToolErrors.shift();
    }

    this.saveState();

    // Check threshold: >40% failures in last 20 calls (meaning >= 8 failures)
    const errorCount = state.rollingToolErrors.filter((e) => e).length;
    const totalCount = state.rollingToolErrors.length;
    const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

    if (totalCount >= 10 && errorRate >= 0.40 && state.healthState !== "degraded" && state.healthState !== "paused") {
      this.transitionHealth(agentId, "degraded", `Tool failure rate exceeded threshold (${(errorRate * 100).toFixed(0)}% errors in last ${totalCount} calls)`);
      this.notifyUserOfStateChange(agentId, `Tool execution failure rate is high at ${(errorRate * 100).toFixed(0)}% (e.g. broken API key or MCP). Agent is degraded.`);
      SelfHealingSubsystem.getInstance().recordFailure(`agent:${agentId}`, "high_tool_failure_rate", { errorRate }).catch(() => {});
    } else if (totalCount >= 10 && errorRate < 0.40 && state.healthState === "degraded") {
      this.evaluateAgentOverallHealth(agentId);
    }
  }

  // e. Session health: stuck in ReAct loop
  private checkSessionHealth() {
    const list = this.poolManager.getStatusList();
    for (const item of list) {
      if (item.status === "running" && item.pid) {
        // We can query its current loop state if the WS server tracks it
        // Or get from harness loop states
        const wsServer = this.getWsServer();
        const loopState = wsServer?.poolManager?.getInstance(item.sessionId)?.lastActivity;
        
        // Let's check loop iterations reported to message pipeline
        const status = wsServer?.messagePipeline?.getSessionPipelineStatus(item.sessionId);
        // If the session has been active for >10 minutes (timeout ceiling near 600s)
        const uptime = item.uptimeMs;
        if (uptime > 480000) { // >8 minutes
          const state = this.getOrInitAgentState(item.agentId);
          state.consecutiveLoopCeilings++;
          this.saveState();

          if (state.consecutiveLoopCeilings >= 2 && state.healthState !== "paused") {
            this.transitionHealth(item.agentId, "paused", `Session stuck in execution loop (run duration limit exceeded)`);
            this.notifyUserOfStateChange(item.agentId, `Session ${item.sessionId} has been running for too long. Stuck in a loop. Pausing agent.`);
            
            // Terminate the stuck session process
            this.poolManager.terminateSession(item.sessionId);
            SelfHealingSubsystem.getInstance().recordFailure(`agent:${item.agentId}`, "react_loop_timeout_ceiling", { sessionId: item.sessionId }).catch(() => {});
          }
        }
      }
    }
  }

  // --- Health State Transitions ---

  private transitionHealth(agentId: string, newState: AgentHealthState, reason: string) {
    const state = this.getOrInitAgentState(agentId);
    const oldState = state.healthState;
    if (oldState === newState) return;

    state.healthState = newState;
    state.lastStateChangeReason = reason;
    this.saveState();

    const timestamp = Date.now();
    console.log(`[Watchdog] [TRANSITION] Agent '${agentId}': ${oldState} -> ${newState} (${reason})`);

    // 1. Write to agent's memory/YYYY-MM-DD.md
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const agentWorkspace = this.globalConfig.agents.find((a) => a.id === agentId)?.workspace;
    if (agentWorkspace) {
      const memoryDir = join(agentWorkspace, "memory");
      if (!existsSync(memoryDir)) {
        mkdirSync(memoryDir, { recursive: true });
      }
      const memoryPath = join(memoryDir, `${dateStr}.md`);
      const logLine = `\n- [${new Date().toISOString()}] [HEALTH TRANSITION] State changed from ${oldState} to ${newState}. Reason: ${reason}\n`;
      try {
        appendFileSync(memoryPath, logLine, "utf-8");
      } catch (err) {
        console.error(`[Watchdog] Failed to write memory log for ${agentId}:`, err);
      }
    }

    // 2. Write to global ~/.komorebi/health-events.jsonl
    const globalLogPath = join(homedir(), ".komorebi", "health-events.jsonl");
    const globalEvent = {
      timestamp,
      agentId,
      oldState,
      newState,
      reason,
    };
    try {
      appendFileSync(globalLogPath, JSON.stringify(globalEvent) + "\n", "utf-8");
    } catch (err) {
      console.error("[Watchdog] Failed to write global health-events:", err);
    }

    // 3. Broadcast to event bus
    const wsServer = this.getWsServer();
    if (wsServer) {
      wsServer.publishToBus("agent_health_changed", {
        agentId,
        oldState,
        newState,
        reason,
        timestamp,
      });
    }
  }

  public getOrInitAgentState(agentId: string): WatchdogAgentState {
    let state = this.agentStates.get(agentId);
    if (!state) {
      state = this.createDefaultAgentState();
      this.agentStates.set(agentId, state);
    }
    return state;
  }

  private evaluateAgentOverallHealth(agentId: string) {
    const state = this.getOrInitAgentState(agentId);
    // If offline (check pool manager)
    const list = this.poolManager.getStatusList();
    const isRunning = list.some((i) => i.agentId === agentId && i.status === "running");

    if (!isRunning && state.healthState !== "paused") {
      this.transitionHealth(agentId, "offline", "Agent process is not running");
      SelfHealingSubsystem.getInstance().recordFailure(`agent:${agentId}`, "process_crashed").catch(() => {});
      return;
    }

    if (state.healthState === "paused" || state.healthState === "offline") {
      return; // remain paused or offline until manual resume or restart
    }

    if (!state.botTokenValid) {
      this.transitionHealth(agentId, "degraded", "Telegram Bot Token is invalid/revoked");
      return;
    }

    const errorCount = state.rollingToolErrors.filter((e) => e).length;
    const totalCount = state.rollingToolErrors.length;
    const errorRate = totalCount > 0 ? errorCount / totalCount : 0;
    if (totalCount >= 10 && errorRate >= 0.40) {
      this.transitionHealth(agentId, "degraded", `Tool failure rate remains high (${(errorRate * 100).toFixed(0)}%)`);
      return;
    }

    this.transitionHealth(agentId, "healthy", "All checks passed successfully");
  }

  public resumeAgent(agentId: string, reason = "Manual recovery request"): boolean {
    const state = this.agentStates.get(agentId);
    if (!state) return false;

    console.log(`[Watchdog] Resuming agent '${agentId}'...`);
    state.consecutiveLoopCeilings = 0;
    state.rollingToolErrors = [];
    state.toolCallFailureCount = 0;
    state.toolCallSuccessCount = 0;
    
    // Reset state to healthy / offline depending on process status
    this.transitionHealth(agentId, "healthy", reason);
    this.evaluateAgentOverallHealth(agentId);
    return true;
  }

  private notifyUserOfStateChange(agentId: string, message: string) {
    const wsServer = this.getWsServer();
    if (wsServer) {
      const allowed = (this.globalConfig as any).allowedTelegramChatIds;
      const fallbackChatId = allowed && allowed.length > 0 ? Number(allowed[0]) : null;
      if (fallbackChatId) {
        wsServer.sendDirectTelegram(
          agentId,
          fallbackChatId,
          `⚠️ *Health Watchdog Notification [${agentId}]*\n\n${message}`
        ).catch(() => {});
      }
    }
  }

  public getHealthState(agentId: string): AgentHealthState {
    const poolState = this.poolManager.getStatusList().find(p => p.agentId === agentId);
    const isOffline = !poolState || poolState.status !== "running";
    
    const state = this.getOrInitAgentState(agentId);
    if (state.healthState === "paused") return "paused";
    if (isOffline) return "offline";
    return state.healthState;
  }

  public getAgentHealthData(agentId: string) {
    const state = this.getOrInitAgentState(agentId);
    return {
      healthState: this.getHealthState(agentId),
      dailyCostUSD: state.dailyCostUSD,
      botTokenValid: state.botTokenValid,
      toolCallSuccessCount: state.toolCallSuccessCount,
      toolCallFailureCount: state.toolCallFailureCount,
      rollingToolErrors: state.rollingToolErrors,
      lastStateChangeReason: state.lastStateChangeReason,
    };
  }
}
