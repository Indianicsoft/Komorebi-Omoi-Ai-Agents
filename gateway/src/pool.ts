import { spawn, execSync, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import * as os from "node:os";
import { AgentConfig } from "./types.js";

export interface AgentInstance {
  agentId: string;
  sessionId: string;
  pid?: number;
  child?: ChildProcess;
  startTime?: number;
  lastActivity: number;
  restarts: number;
  status: "idle" | "running" | "unresponsive" | "crashed" | "failed";
  workspace: string;
  lastHeartbeatResponse: number;
  /** Timestamp when the process last became stable (running for >60s without crashing) */
  lastStableAt?: number;
  /** Whether this is a persistent "always-on" session that should auto-revive */
  persistent?: boolean;
}

export class AgentPoolManager {
  private instances = new Map<string, AgentInstance>();
  private restartTimers = new Map<string, NodeJS.Timeout>();
  private watchdogInterval: NodeJS.Timeout;
  private keepAliveInterval: NodeJS.Timeout;

  // Callback invoked when a persistent session needs to be revived
  private onReviveSession?: (agentId: string, sessionId: string) => void;

  constructor(
    private readonly agentsConfig: AgentConfig[],
    private readonly projectRoot: string,
    private readonly gatewayPort: number = 18789
  ) {
    this.watchdogInterval = setInterval(this.runRamWatchdog.bind(this), 15000);
    // Keep-alive: every 30s, ensure all persistent sessions are running
    this.keepAliveInterval = setInterval(this.revivePersistentSessions.bind(this), 30000);
  }

  /**
   * Register a callback to revive a persistent agent session.
   * Called by the server layer which has full pipeline access.
   */
  public setReviveCallback(fn: (agentId: string, sessionId: string) => void) {
    this.onReviveSession = fn;
  }

  /**
   * Spawns an agent session if not already running.
   */
  public async ensureAgentRunning(agentId: string, sessionId: string, persistent = false): Promise<void> {
    let instance = this.instances.get(sessionId);

    // If already running and active, do nothing
    if (instance && instance.status === "running" && instance.child && instance.pid) {
      return;
    }

    if (!instance) {
      const agent = this.agentsConfig.find(a => a.id === agentId);
      let sessionWorkspace: string;

      const isTelegramDm = sessionId.startsWith("agent:") && sessionId.includes(":telegram:dm:");
      if (isTelegramDm) {
        sessionWorkspace = agent?.workspace || join(homedir(), ".komorebi", "agents", agentId);
      } else {
        const agentWorkspaceBase = join(homedir(), ".komorebi", "agents", agentId);
        sessionWorkspace = join(agentWorkspaceBase, sessionId.replace(/:/g, "_"));
      }
      
      if (!existsSync(sessionWorkspace)) {
        mkdirSync(sessionWorkspace, { recursive: true });
      }

      instance = {
        agentId,
        sessionId,
        status: "idle",
        workspace: sessionWorkspace,
        restarts: 0,
        lastActivity: Date.now(),
        lastHeartbeatResponse: Date.now(),
        persistent,
      };
      this.instances.set(sessionId, instance);
    }

    // Mark as persistent if requested
    if (persistent) instance.persistent = true;

    // If failed, reset so it can try again — persistent agents always retry
    if (instance.status === "failed") {
      console.log(`[AgentPoolManager] Resetting failed state for session ${sessionId} to resume execution`);
      instance.status = "idle";
      instance.restarts = 0;
    }

    await this.spawnProcess(instance);
  }

  /**
   * Performs the child process spawn with nice constraints and memory limits.
   */
  private async spawnProcess(instance: AgentInstance): Promise<void> {
    const agent = this.agentsConfig.find(a => a.id === instance.agentId);
    if (!agent) {
      throw new Error(`Configuration not found for agent ID: ${instance.agentId}`);
    }

    instance.status = "idle";
    const scriptPath = join(this.projectRoot, "agent-runtime", "dist", "main.js");

    console.log(`[AgentPoolManager] Spawning: agent=${instance.agentId}, session=${instance.sessionId}, nice=10, limit=500MB`);

    // Spawning with nice -n 10 on Linux to yield CPU priority, and setting old space size limit
    const child = spawn(
      "nice",
      [
        "-n", "10",
        "node",
        "--max-old-space-size=500",
        scriptPath,
        "--agent-id", instance.agentId,
        "--session-id", instance.sessionId,
        "--workspace", instance.workspace,
        "--gateway-url", `ws://127.0.0.1:${this.gatewayPort}`
      ],
      {
        env: {
          ...process.env,
          // Block nested spawning: child runtimes cannot spawn other processes
          KOMOREBI_BLOCK_NESTED: "true",
        },
        stdio: "pipe"
      }
    );

    instance.child = child;
    instance.pid = child.pid;
    instance.startTime = Date.now();
    instance.lastActivity = Date.now();
    instance.lastHeartbeatResponse = Date.now();
    instance.status = "running";

    // After 60s of stable uptime, reset restart counter
    const stabilityTimer = setTimeout(() => {
      if (instance.status === "running" && instance.pid) {
        instance.restarts = 0;
        instance.lastStableAt = Date.now();
        console.log(`[AgentPoolManager] Session ${instance.sessionId} is stable — restart counter reset.`);
      }
    }, 60000);

    child.stdout?.on("data", (data) => {
      instance.lastActivity = Date.now();
      console.log(`[AgentStdout - ${instance.sessionId}] ${data.toString().trim()}`);
    });

    child.stderr?.on("data", (data) => {
      instance.lastActivity = Date.now();
      console.error(`[AgentStderr - ${instance.sessionId}] ${data.toString().trim()}`);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(stabilityTimer);
      console.warn(`[AgentPoolManager] Session ${instance.sessionId} exited (code=${code}, signal=${signal})`);
      instance.pid = undefined;
      instance.child = undefined;

      if (instance.status !== "failed") {
        instance.status = "crashed";
        this.handleCrash(instance);
      }
    });
  }

  /**
   * Restart supervisor — unlimited retries with exponential backoff.
   * Resets the backoff after each stable period (60s+ uptime).
   */
  private handleCrash(instance: AgentInstance) {
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(instance.restarts, 6)), 64000);
    instance.restarts++;

    console.log(`[AgentPoolManager] Session ${instance.sessionId} crashed (attempt ${instance.restarts}). Restarting in ${backoffMs}ms...`);

    const timer = setTimeout(async () => {
      this.restartTimers.delete(instance.sessionId);
      try {
        await this.spawnProcess(instance);
      } catch (err) {
        console.error(`[AgentPoolManager] Restart spawn failed for session ${instance.sessionId}:`, err);
        // If spawn itself fails, re-schedule with longer delay
        instance.status = "crashed";
        this.handleCrash(instance);
      }
    }, backoffMs);

    this.restartTimers.set(instance.sessionId, timer);
  }

  /**
   * Periodic keep-alive: finds all persistent sessions that are no longer running
   * (crashed/failed/terminated) and revives them.
   */
  private revivePersistentSessions() {
    let revived = 0;
    for (const [sessionId, instance] of this.instances.entries()) {
      if (!instance.persistent) continue;

      const isDown = instance.status !== "running" || !instance.pid;
      const hasNoChild = !instance.child;
      const noRestartPending = !this.restartTimers.has(sessionId);

      if (isDown && hasNoChild && noRestartPending) {
        console.log(`[AgentPoolManager] Keep-alive: reviving persistent session ${sessionId}`);
        instance.status = "idle";
        instance.restarts = 0;
        this.spawnProcess(instance).catch(err => {
          console.error(`[AgentPoolManager] Keep-alive spawn failed for ${sessionId}:`, err);
        });
        revived++;
      }
    }

    if (revived > 0) {
      console.log(`[AgentPoolManager] Keep-alive cycle: revived ${revived} persistent session(s).`);
    }
  }

  /**
   * Retrieves process statistics (uptime, PID, RAM usage, activity).
   */
  public getStatusList() {
    return Array.from(this.instances.values()).map(inst => {
      let ramUsageMb = 0;
      let cpuPercent = 0;
      if (inst.pid) {
        ramUsageMb = this.getRamUsage(inst.pid);
        cpuPercent = this.getCpuUsage(inst.pid);
      }

      return {
        agentId: inst.agentId,
        sessionId: inst.sessionId,
        pid: inst.pid || null,
        ramUsageMb,
        cpuPercent,
        uptimeMs: inst.startTime ? Date.now() - inst.startTime : 0,
        lastActivityMsAgo: Date.now() - inst.lastActivity,
        restarts: inst.restarts,
        status: inst.status,
        workspace: inst.workspace,
        persistent: inst.persistent ?? false,
      };
    });
  }

  private getCpuUsage(pid: number): number {
    try {
      const output = execSync(`ps -o %cpu= -p ${pid}`, { stdio: ["ignore", "pipe", "ignore"] });
      const cpu = parseFloat(output.toString().trim());
      return isNaN(cpu) ? 0 : cpu;
    } catch {
      return 0;
    }
  }

  /**
   * Measures RAM Resident Set Size (RSS) directly using Linux ps command.
   */
  private getRamUsage(pid: number): number {
    try {
      const output = execSync(`ps -o rss= -p ${pid}`, { stdio: ["ignore", "pipe", "ignore"] });
      const rssKb = parseInt(output.toString().trim(), 10);
      return isNaN(rssKb) ? 0 : Math.round(rssKb / 1024);
    } catch {
      return 0; // fallback if process is dead or non-linux
    }
  }

  public terminateSession(sessionId: string) {
    const instance = this.instances.get(sessionId);
    if (instance) {
      console.log(`[AgentPoolManager] Explicitly terminating session: ${sessionId}`);
      // Cancel pending restart timer
      const timer = this.restartTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.restartTimers.delete(sessionId);
      }

      const wasPersistent = instance.persistent;
      instance.status = "failed"; // block auto-restart via crash handler
      if (instance.child) {
        instance.child.kill("SIGTERM");
      }

      // Only remove non-persistent sessions from the pool.
      // Persistent sessions stay in the registry so the keep-alive loop can revive them.
      if (!wasPersistent) {
        this.instances.delete(sessionId);
      } else {
        // Clear child reference so keep-alive detects it as down
        instance.child = undefined;
        instance.pid = undefined;
        console.log(`[AgentPoolManager] Persistent session ${sessionId} terminated — will auto-revive within 30s.`);
      }
    }
  }

  public getInstance(sessionId: string): AgentInstance | undefined {
    return this.instances.get(sessionId);
  }

  /**
   * Returns all instances grouped by agentId.
   */
  public getInstancesByAgent(): Map<string, AgentInstance[]> {
    const byAgent = new Map<string, AgentInstance[]>();
    for (const inst of this.instances.values()) {
      if (!byAgent.has(inst.agentId)) {
        byAgent.set(inst.agentId, []);
      }
      byAgent.get(inst.agentId)!.push(inst);
    }
    return byAgent;
  }

  /**
   * Kills duplicate instances: for each agentId that has more than one running
   * process lane, terminates all but the most recently started one.
   * Returns the count of sessions killed.
   */
  public killDuplicates(): number {
    const byAgent = this.getInstancesByAgent();
    let killed = 0;
    for (const [, instances] of byAgent) {
      if (instances.length <= 1) continue;
      // Sort by startTime descending — keep the newest
      const sorted = [...instances].sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));
      // Kill all except the first (newest)
      for (const inst of sorted.slice(1)) {
        console.log(`[AgentPoolManager] killDuplicates: terminating stale session ${inst.sessionId} for agent ${inst.agentId}`);
        this.terminateSession(inst.sessionId);
        killed++;
      }
    }
    return killed;
  }

  /**
   * Terminates all instances whose status matches one of the given statuses.
   * Returns the count of sessions killed.
   */
  public killAllByStatus(statuses: AgentInstance["status"][]): number {
    const targets = Array.from(this.instances.values()).filter(i => statuses.includes(i.status));
    for (const inst of targets) {
      console.log(`[AgentPoolManager] killAllByStatus(${statuses.join("|")}) – terminating ${inst.sessionId}`);
      this.terminateSession(inst.sessionId);
    }
    return targets.length;
  }

  /**
   * Terminates all instances for a given agentId.
   */
  public killAllForAgent(agentId: string): number {
    const targets = Array.from(this.instances.values()).filter(i => i.agentId === agentId);
    for (const inst of targets) {
      this.terminateSession(inst.sessionId);
    }
    return targets.length;
  }

  private runRamWatchdog() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usedPercent = (usedMemory / totalMemory) * 100;

    if (usedPercent > 85) {
      console.warn(`[Watchdog] CRITICAL: System RAM usage is at ${usedPercent.toFixed(2)}% (> 85%). Pausing non-essential agents...`);
      
      const runningInstances = Array.from(this.instances.values())
        .filter(inst => inst.status === "running" && inst.pid && !(inst as any).pausedByWatchdog);

      if (runningInstances.length > 0) {
        // Pause the first running agent found (excluding coordinator if possible), prefer non-persistent
        const target = 
          runningInstances.find(i => !i.persistent) || 
          runningInstances.find(i => i.agentId !== "coordinator-agent") || 
          runningInstances[0];
        if (target.pid) {
          try {
            process.kill(target.pid, "SIGSTOP");
            (target as any).pausedByWatchdog = true;
            console.warn(`[Watchdog] Sent SIGSTOP to pause agent process '${target.agentId}' (PID: ${target.pid})`);
          } catch (err: any) {
            console.error(`[Watchdog] Failed to pause agent ${target.agentId}:`, err.message);
          }
        }
      }
    } else if (usedPercent < 80) {
      const pausedInstances = Array.from(this.instances.values())
        .filter(inst => (inst as any).pausedByWatchdog && inst.pid);

      for (const inst of pausedInstances) {
        try {
          process.kill(inst.pid!, "SIGCONT");
          (inst as any).pausedByWatchdog = false;
          console.log(`[Watchdog] Sent SIGCONT to resume agent process '${inst.agentId}' (PID: ${inst.pid})`);
        } catch (err: any) {
          console.error(`[Watchdog] Failed to resume agent ${inst.agentId}:`, err.message);
        }
      }
    }
  }

  public close() {
    clearInterval(this.watchdogInterval);
    clearInterval(this.keepAliveInterval);
    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    for (const inst of this.instances.values()) {
      if (inst.child) {
        inst.child.kill("SIGKILL");
      }
    }
    this.instances.clear();
  }
}
