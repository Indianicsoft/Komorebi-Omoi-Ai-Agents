import { WebSocketServer, WebSocket } from "ws";
import { createServer, Server } from "node:http";
import express from "express";
import { RpcFrame, RpcResponse, RpcRequest, KomorebiConfig } from "./types.js";
import { MessagePipeline } from "./pipeline.js";
import { SessionManager } from "./session.js";
import { AgentPoolManager } from "./pool.js";
import { Telegraf } from "telegraf";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync, rmSync, mkdirSync, promises as fsPromises } from "node:fs";
import { homedir } from "node:os";
import crypto from "node:crypto";
import { GatewayCronScheduler } from "./cron.js";
import type { CronJobV2, TaskRecord } from "./cron-store.js";
import { validateSchedule, cronToHuman } from "./cron-scheduler.js";
import { execSync } from "node:child_process";
import { withFileLock } from "./lock.js";
import { ClawHubClient, SkillInstaller, parseSkillManifest } from "./clawhub.js";
import { ProgressDraftManager } from "./progress-draft.js";
import { GatewayWatchdog } from "./watchdog.js";
import { ContextSignalBus } from "./context-bus.js";
import { SelfHealingSubsystem } from "./self-healing.js";

function getAgentIdFromSession(sessionId: string): string {
  if (sessionId.startsWith("agent:")) {
    return sessionId.split(":")[1];
  }
  return sessionId.split(":")[0];
}

export class GatewayWsServer {
  private server: Server;
  private wss: WebSocketServer;
  private token: string;
  private busSubscriptions = new Map<string, Set<WebSocket>>();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private heartbeatInterval: NodeJS.Timeout;
  private heartbeatTasksInterval: NodeJS.Timeout;
  private pendingCommandApprovals = new Map<string, { resolve: (val: boolean) => void }>();
  private gatewayStartTime = Date.now();
  private pendingBoundaryApprovals = new Map<string, { resolve: (val: string) => void }>();
  public readonly progressDraftManager = new ProgressDraftManager();
  private readonly serverStartTime = Date.now();
  private lastActivityTimes = new Map<string, number>();
  private lastAgentPlans = new Map<string, any>();
  private runClosingReflections = new Set<string>();

  public readonly harness: {
    runTurn: (sessionId: string, message: string, envelope?: any) => Promise<any>;
  };
  public readonly messagePipeline: MessagePipeline;
  public app!: express.Application;

  constructor(
    private readonly host: string = "127.0.0.1",
    private readonly port: number = 18789,
    private readonly poolManager: AgentPoolManager,
    public readonly sessionManager: SessionManager,
    private readonly getTelegramBot: (agentId: string) => Telegraf | undefined,
    public readonly globalConfig: KomorebiConfig = { gateway: { host: "127.0.0.1", port: 18789, authToken: "" }, bus: { type: "embedded" }, agents: [] },
    private readonly cronScheduler?: GatewayCronScheduler
  ) {
    const envToken = process.env.OPENKOMOREBI_GATEWAY_TOKEN;
    if (!envToken) {
      throw new Error("CRITICAL: OPENKOMOREBI_GATEWAY_TOKEN environment variable is not defined!");
    }
    this.token = envToken;

    // Initialize TelegramStreamer global configuration
    import("./telegram-streamer.js").then(({ TelegramStreamer }) => {
      TelegramStreamer.getInstance().setGlobalConfig(this.globalConfig);
    });

    this.messagePipeline = new MessagePipeline(
      this.sessionManager,
      this.globalConfig,
      this.sendRequest.bind(this),
      (evt) => {
        if (evt.type === "agent_message") {
          this.publishToBus("agent_message", evt);
        } else {
          this.publishToBus("loop_progress", evt);
        }
      },
      async (chatId, msgId, text, bot) => {
        const cleanText = text && text.trim() ? text : "👍 (Turn completed)";
        try {
          await bot.telegram.editMessageText(chatId, msgId, undefined, cleanText, { parse_mode: "Markdown" });
        } catch (err: any) {
          console.error("[Telegram Edit] Markdown parsing failed, retrying plain text:", err.message);
          try {
            await bot.telegram.editMessageText(chatId, msgId, undefined, cleanText);
          } catch (retryErr: any) {
            console.error("[Telegram Edit] Plain retry failed:", retryErr.message);
          }
        }
      },
      async (chatId, text, bot) => {
        const cleanText = text && text.trim() ? text : "👍 (Turn completed)";
        try {
          const res = await bot.telegram.sendMessage(chatId, cleanText, { parse_mode: "Markdown" });
          return res.message_id;
        } catch (err: any) {
          console.error("[Telegram Send] Markdown parsing failed, retrying plain text:", err.message);
          const res = await bot.telegram.sendMessage(chatId, cleanText);
          return res.message_id;
        }
      },
      (agentId) => this.getTelegramBot(agentId)
    );

    this.harness = {
      runTurn: async (sessionId: string, message: string, envelope?: any) => {
        const agentId = getAgentIdFromSession(sessionId);
        const ws = await this.sessionManager.ensureAgentRunning(agentId, sessionId);
        
        const finalEnvelope = envelope || {
          sender: { id: 1, firstName: "System", username: "gateway" },
          chatId: 1,
          content: message,
          attachments: [],
          channel: "web",
          timestamp: Math.floor(Date.now() / 1000)
        };

        return await this.sendRequest(ws, "runTurn", {
          sessionId,
          message,
          envelope: finalEnvelope
        });
      }
    };

    // 1. Setup Express Status Server & Static Dashboard Frontend
    const app = express();
    this.app = app;
    app.use(express.json());

    // CORS middleware
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }
      next();
    });

    // Serve control panel UI dashboard statically
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const publicDir = join(__dirname, "..", "public");
    if (existsSync(publicDir)) {
      console.log(`[GatewayWsServer] Hosting control panel static files from: ${publicDir}`);
      app.use(express.static(publicDir));
    } else {
      console.warn(`[GatewayWsServer] Warning: Control panel directory not found at: ${publicDir}`);
    }

    // Health-check / status endpoint for the CLI monitor
    app.get("/api/system/health", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }
      if (clientToken !== this.token) {
        return res.status(401).json({ error: "Unauthorized: Invalid Gateway Token" });
      }

      const watchdog = GatewayWatchdog.getInstance();
      const healthData: Record<string, any> = {};
      for (const agent of this.globalConfig.agents) {
        healthData[agent.id] = watchdog.getAgentHealthData(agent.id);
      }

      return res.json({
        uptimeMs: Date.now() - this.gatewayStartTime,
        agents: healthData
      });
    });

    app.post("/api/agents/:agentId/resume", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }
      if (clientToken !== this.token) {
        return res.status(401).json({ error: "Unauthorized: Invalid Gateway Token" });
      }

      const agentId = req.params.agentId;
      const success = GatewayWatchdog.getInstance().resumeAgent(agentId, "Resumed manually via Dashboard/API");
      return res.json({ success });
    });

    app.post("/api/context/signal", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }
      if (clientToken !== this.token) {
        return res.status(401).json({ error: "Unauthorized: Invalid Gateway Token" });
      }

      const { agentId, signalType, value, source, ttl } = req.body;
      if (!agentId || !signalType || value === undefined) {
        return res.status(400).json({ error: "Missing required parameters: agentId, signalType, value" });
      }

      ContextSignalBus.getInstance().publish(agentId, {
        signalType,
        value,
        source: source || "api",
        ttl: ttl || 7200, // default 2 hours (7200 seconds)
      });

      return res.json({ success: true });
    });

    app.get("/api/agents/:agentId/context", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }
      if (clientToken !== this.token) {
        return res.status(401).json({ error: "Unauthorized: Invalid Gateway Token" });
      }

      const agentId = req.params.agentId;
      const bus = ContextSignalBus.getInstance();
      const resolvedMode = bus.resolveSituationalContext(agentId);
      const history = bus.getHistory(agentId);
      const activeSignals = bus.getActiveSignals(agentId);

      return res.json({
        resolvedMode,
        activeSignals,
        history
      });
    });

    // Health-check / status endpoint for the CLI monitor
    app.get("/api/agents/status", (req: express.Request, res: express.Response) => {
      // Validate Authorization header
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }

      if (clientToken !== this.token) {
        return res.status(401).json({ error: "Unauthorized: Invalid Gateway Token" });
      }

      res.setHeader("X-Gateway-Start-Time", String(this.serverStartTime));
      const statusList = this.poolManager.getStatusList();
      res.json(statusList);
    });

    const getConfigData = () => {
      const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
      if (existsSync(userConfigPath)) {
        return readFileSync(userConfigPath, "utf-8");
      }
      const projectRoot = join(__dirname, "..", "..");
      const configPath = join(projectRoot, "komorebi.config.json");
      if (existsSync(configPath)) {
        return readFileSync(configPath, "utf-8");
      }
      return "{}";
    };

    const getConfigHash = () => {
      const data = getConfigData();
      return crypto.createHash("md5").update(data).digest("hex");
    };

    // ── Cron REST endpoints ────────────────────────────────────────────────

    // Webhook trigger (existing, kept for backward compat)
    app.post("/api/cron/trigger/:id", async (req: express.Request, res: express.Response) => {
      const { id } = req.params;
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
      }
      const token = authHeader.split(" ")[1];
      if (!this.cronScheduler) return res.status(503).json({ error: "Cron scheduler not initialized" });

      const jobs = this.cronScheduler.getJobs();
      const job = jobs.find((j: any) => j.id === id);
      if (!job) return res.status(404).json({ error: "Cron job not found" });
      if (token !== job.webhookToken) return res.status(403).json({ error: "Invalid webhook token" });

      try {
        await this.cronScheduler.runJob(id);
        res.json({ success: true, message: `Cron job ${id} triggered` });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to run job" });
      }
    });

    // GET all jobs (REST alternative to WS listCronJobs)
    app.get("/api/cron/jobs", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });
      if (!this.cronScheduler) return res.status(503).json({ error: "Cron scheduler not initialized" });
      res.json({ jobs: this.cronScheduler.getJobs(), warnings: this.cronScheduler.getBoundaryWarnings() });
    });

    // GET task records for a specific job
    app.get("/api/cron/jobs/:id/tasks", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });
      if (!this.cronScheduler) return res.status(503).json({ error: "Cron scheduler not initialized" });
      const tasks = this.cronScheduler.getTasks(req.params.id);
      res.json({ tasks: tasks.slice(-100) });  // last 100 task records
    });

    // GET scheduler drift report
    app.get("/api/cron/drift-report", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });
      if (!this.cronScheduler) return res.status(503).json({ error: "Cron scheduler not initialized" });
      res.json(this.cronScheduler.getDriftReport());
    });

    // GET queue snapshot (debug)
    app.get("/api/cron/queue", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });
      if (!this.cronScheduler) return res.status(503).json({ error: "Cron scheduler not initialized" });
      res.json({ queue: this.cronScheduler.getQueueSnapshot() });
    });

    // ── Fleet-wide Intelligence Dashboard endpoint ──────────────────────────────
    // Returns per-agent learning stats used to render the IQ score panel.
    app.get("/api/system/intelligence", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });

      const agentList: any[] = this.globalConfig.agents || [];
      const result: Record<string, any> = {};

      for (const agent of agentList) {
        const agentDir = join(homedir(), ".komorebi", "agents", agent.id);

        // Compute success rate across both tool-usages and turn learning.log completions
        let totalCount = 0;
        let successCount = 0;
        let skillSuccessRate = 0.85; // default/fallback baseline success rate (85%)

        const usageLogPath = join(agentDir, "skills", "usage-log.jsonl");
        if (existsSync(usageLogPath)) {
          try {
            const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n").filter(Boolean);
            const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            const used = entries.filter((e: any) => e.action === "use" || e.action === "load");
            for (const entry of used) {
              totalCount++;
              if (entry.success) successCount++;
            }
          } catch {}
        }

        const learningLogPath = join(agentDir, "learning.log");
        if (existsSync(learningLogPath)) {
          try {
            const lines = readFileSync(learningLogPath, "utf-8").trim().split("\n").filter(Boolean);
            const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            for (const entry of entries) {
              totalCount++;
              if (entry.success) successCount++;
            }
          } catch {}
        }

        if (totalCount > 0) {
          skillSuccessRate = successCount / totalCount;
        }

        // Count learned skills in the subfolder structure
        let learnedSkillCount = 0;
        const learnedDir = join(agentDir, "skills", "learned");
        if (existsSync(learnedDir)) {
          try {
            learnedSkillCount = readdirSync(learnedDir, { withFileTypes: true })
              .filter(entry => entry.isDirectory() && entry.name !== "_archive" && !entry.name.startsWith("."))
              .length;
          } catch {}
        }

        // Memory file size in KB
        let memorySizeKb = 0;
        const memoryPath = join(agentDir, "MEMORY.md");
        if (existsSync(memoryPath)) {
          try { memorySizeKb = Math.round(statSync(memoryPath).size / 1024); } catch {}
        }

        // Turn count from mood.json
        let totalTurns = 0;
        const moodPath = join(agentDir, "mood.json");
        if (existsSync(moodPath)) {
          try { totalTurns = JSON.parse(readFileSync(moodPath, "utf-8")).turnCount || 0; } catch {}
        }

        // Last curation timestamp
        let lastCuration: number | null = null;
        const curationStatePath = join(agentDir, "skills", "curation-state.json");
        if (existsSync(curationStatePath)) {
          try { lastCuration = JSON.parse(readFileSync(curationStatePath, "utf-8")).lastCuration || null; } catch {}
        }

        // Goal-match accuracy stats
        let goalAccuracyRate: number | null = null;
        let goalAccuracyTotalTasks = 0;
        let goalAccuracyCorrectedTasks = 0;
        const goalStatsPath = join(agentDir, "metrics", "goal-accuracy-stats.json");
        if (existsSync(goalStatsPath)) {
          try {
            const stats = JSON.parse(readFileSync(goalStatsPath, "utf-8"));
            goalAccuracyRate = stats.accuracyRate ?? null;
            goalAccuracyTotalTasks = stats.totalTasks ?? 0;
            goalAccuracyCorrectedTasks = stats.correctedTasks ?? 0;
          } catch {}
        }

        // Creative wins count
        let creativeWinsCount = 0;
        const creativeLogPath = join(agentDir, "metrics", "creative-wins.jsonl");
        if (existsSync(creativeLogPath)) {
          try {
            creativeWinsCount = readFileSync(creativeLogPath, "utf-8")
              .trim().split("\n").filter(Boolean).length;
          } catch {}
        }

        result[agent.id] = {
          skillSuccessRate,
          learnedSkillCount,
          memorySizeKb,
          totalTurns,
          lastCuration,
          goalAccuracyRate,
          goalAccuracyTotalTasks,
          goalAccuracyCorrectedTasks,
          creativeWinsCount
        };
      }

      res.json({ agents: result });
    });

    // ── Goal Accuracy endpoint for Dashboard Autonomy page ──────────────────────
    app.get("/api/agents/:agentId/goal-accuracy", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });

      const { agentId } = req.params;
      const metricsDir = join(homedir(), ".komorebi", "agents", agentId, "metrics");
      const statsPath = join(metricsDir, "goal-accuracy-stats.json");
      const logPath   = join(metricsDir, "goal-accuracy.jsonl");

      if (!existsSync(statsPath)) {
        return res.json({ stats: null, recentRecords: [] });
      }

      let stats: any = null;
      try { stats = JSON.parse(readFileSync(statsPath, "utf-8")); } catch {}

      let recentRecords: any[] = [];
      if (existsSync(logPath)) {
        try {
          recentRecords = readFileSync(logPath, "utf-8")
            .trim().split("\n").filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean)
            .slice(-50);
        } catch {}
      }

      return res.json({ stats, recentRecords });
    });

    // ── Creative wins log endpoint for Dashboard Chat page ─────────────────────
    app.get("/api/agents/:agentId/creative-log", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });

      const { agentId } = req.params;
      const logPath = join(homedir(), ".komorebi", "agents", agentId, "metrics", "creative-wins.jsonl");

      if (!existsSync(logPath)) {
        return res.json({ wins: [] });
      }

      let wins: any[] = [];
      try {
        wins = readFileSync(logPath, "utf-8")
          .trim().split("\n").filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
      } catch {}

      return res.json({ wins });
    });

    // ── On-demand agent skill curation trigger ──────────────────────────────────
    app.post("/api/agents/:agentId/curate", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) return res.status(401).json({ error: "Unauthorized" });

      const { agentId } = req.params;
      const agentList: any[] = this.globalConfig.agents || [];
      const agent = agentList.find(a => a.id === agentId);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      try {
        const { LearningCurator } = await import("./learning-curator.js");
        const curator = new LearningCurator(this.globalConfig);
        await curator.curateAgent(agent);
        res.json({ success: true, message: `Skill curation completed for agent '${agentId}'.` });
      } catch (err: any) {
        console.error(`[Curate API] Failed to curate agent ${agentId}:`, err.message);
        res.status(500).json({ error: err.message || "Curation failed" });
      }
    });

    // Direct Agent Model Query Endpoint
    app.post("/api/agents/:agentId/query-model", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const { systemInstruction, prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Missing required parameter: prompt" });
      }

      try {
        const sessionId = `${agentId}:chat:dashboard_${Date.now()}`;
        await this.sessionManager.ensureAgentRunning(agentId, sessionId);
        const ws = this.sessionManager.getAgentConnection(sessionId);
        if (!ws) {
          throw new Error(`Agent connection not active for ${agentId}`);
        }
        const result = await this.sendRequest(ws, "queryModel", {
          systemInstruction: systemInstruction || "You are a helpful assistant.",
          prompt
        });
        
        // Terminate the temporary session process after use to clean up resources
        try {
          this.sessionManager.terminateSession(sessionId);
        } catch {}

        res.json({ success: true, text: result.text });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to query agent model" });
      }
    });

    // Generic Agent Webhook Receiver Endpoint
    app.post("/api/webhook/:agentId/:sessionId", async (req: express.Request, res: express.Response) => {
      const { agentId, sessionId } = req.params;
      console.log(`[WebhookReceiver] Received external trigger for agent ${agentId} (session: ${sessionId})`);

      try {
        const wakeEvent = {
          type: "webhook" as const,
          sessionId,
          agentId,
          payload: {
            body: req.body,
            headers: req.headers as any
          },
          timestamp: Date.now()
        };

        await this.messagePipeline.handleWakeEvent(wakeEvent);
        res.json({ success: true, message: "Webhook wake event successfully routed to pipeline" });
      } catch (err: any) {
        console.error(`[WebhookReceiver] Routing failed:`, err);
        res.status(500).json({ error: err.message || "Internal server error" });
      }
    });

    // Sanitized public config endpoint for dashboard client initialization
    app.get("/komorebi.config.json", (req: express.Request, res: express.Response) => {
      try {
        const configText = getConfigData();
        const parsed = JSON.parse(configText);
        if (parsed.gateway) {
          // Redact the gateway token to prevent leakage
          parsed.gateway.authToken = "";
        }
        res.json(parsed);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Config editor API with Concurrency Guard
    app.get("/api/config", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const configText = getConfigData();
      const hash = getConfigHash();
      res.json({ config: JSON.parse(configText), hash });
    });

    app.post("/api/config", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { config: newConfig, baseHash } = req.body;
      if (!newConfig || !baseHash) {
        return res.status(400).json({ error: "Missing config or baseHash" });
      }

      const currentHash = getConfigHash();
      if (baseHash !== currentHash) {
        // Concurrency Conflict!
        const configText = getConfigData();
        return res.status(409).json({
          error: "Conflict: The configuration file has been modified by another process.",
          currentConfig: JSON.parse(configText),
          currentHash
        });
      }

      try {
        // Read old config before overwriting to detect model changes
        const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
        let oldConfig: any = {};
        try {
          oldConfig = JSON.parse(getConfigData());
        } catch { /* ignore parse errors on old config */ }

        const formatted = JSON.stringify(newConfig, null, 2);
        writeFileSync(userConfigPath, formatted, "utf-8");
        
        console.log(`[GatewayWsServer] Configuration updated successfully. New Hash: ${getConfigHash()}`);

        // Detect agent model changes and broadcast hot-swap events to running sessions
        const oldAgents: any[] = oldConfig.agents || [];
        const newAgents: any[] = newConfig.agents || [];
        for (const newAgent of newAgents) {
          const oldAgent = oldAgents.find((a: any) => a.id === newAgent.id);
          const modelChanged = !oldAgent ||
            oldAgent.model?.provider !== newAgent.model?.provider ||
            oldAgent.model?.name !== newAgent.model?.name ||
            oldAgent.model?.apiKey !== newAgent.model?.apiKey ||
            oldAgent.model?.temperature !== newAgent.model?.temperature ||
            oldAgent.model?.maxOutputTokens !== newAgent.model?.maxOutputTokens;

          if (modelChanged) {
            // Resolve provider config so agent can reconstruct the provider
            const providerId = newAgent.model?.provider || "openai-compatible";
            let providerConfig: any = undefined;
            if (newConfig.models?.providers?.[providerId]) {
              providerConfig = { id: providerId, ...newConfig.models.providers[providerId] };
            }

            const frame = {
              type: "evt",
              event: "modelUpdated",
              data: {
                agentId: newAgent.id,
                model: newAgent.model,
                providerConfig
              }
            };
            const sessionsSent = this.sessionManager.broadcastToAgent(newAgent.id, frame);
            console.log(`[GatewayWsServer] Broadcasted modelUpdated to ${sessionsSent} session(s) for agent: ${newAgent.id}`);
          }
        }

        // Refresh in-memory globalConfig so Telegram /start, /status, and
        // menu callbacks immediately reflect new agent/model settings without
        // requiring a gateway restart. (readonly is TypeScript-only enforcement)
        const gc = this.globalConfig as any;
        if (Array.isArray(newConfig.agents)) {
          gc.agents = newConfig.agents;
        }
        if (newConfig.models) {
          gc.models = newConfig.models;
        }
        if (newConfig.providers) {
          gc.providers = newConfig.providers;
        }
        if (newConfig.telegram) {
          gc.telegram = newConfig.telegram;
        }
        console.log(`[GatewayWsServer] In-memory globalConfig refreshed with ${(newConfig.agents || []).length} agents.`);

        res.json({ success: true, hash: getConfigHash() });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to write config: ${err.message}` });
      }
    });

    app.post("/api/gateway/restart", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      res.json({ success: true, message: "Restarting Gateway daemon..." });
      
      setTimeout(() => {
        try {
          execSync("sudo systemctl restart komorebi-gateway");
        } catch {
          process.exit(0);
        }
      }, 500);
    });

    // Get general documentation files from project root
    app.get("/api/docs/:filename", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { filename } = req.params;
      if (!/^[a-zA-Z0-9_\-]+\.md$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }

      // __dirname is gateway/src, so root is two dirs up
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const projectRoot = join(__dirname, "..", "..");
      const filePath = join(projectRoot, filename);

      if (!existsSync(filePath)) {
        return res.status(404).json({ error: `Documentation file not found: ${filename}` });
      }

      try {
        const content = readFileSync(filePath, "utf-8");
        res.json({ content });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to read documentation file: ${err.message}` });
      }
    });

    // List MD files inside an agent's workspace
    app.get("/api/agents/:agentId/files", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      
      let configText;
      try {
        configText = getConfigData();
      } catch (e) {
        return res.status(500).json({ error: "Failed to read configuration" });
      }
      const config = JSON.parse(configText);
      const agent = config.agents?.find((a: any) => a.id === agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      let workspace = agent.workspace;
      if (!workspace) {
        workspace = join(homedir(), ".komorebi", "agents", agentId);
      }

      if (!existsSync(workspace)) {
        return res.status(404).json({ error: `Agent workspace directory does not exist: ${workspace}` });
      }

      try {
        const getMdFilesRecursive = (dir: string, baseDir: string = dir): string[] => {
          let results: string[] = [];
          if (!existsSync(dir)) return results;
          const list = readdirSync(dir);
          for (const file of list) {
            const filePath = join(dir, file);
            const stat = statSync(filePath);
            if (stat.isDirectory()) {
              results = results.concat(getMdFilesRecursive(filePath, baseDir));
            } else if (file.toLowerCase().endsWith(".md")) {
              const relativePath = filePath.substring(baseDir.length).replace(/^[\\\/]/, "");
              results.push(relativePath);
            }
          }
          return results;
        };

        const files = getMdFilesRecursive(workspace);
        res.json({ files });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to list files: ${err.message}` });
      }
    });

    // Read MD file content (supports subdirectory wildcard matching)
    app.get("/api/agents/:agentId/files/:filename(*)", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId, filename } = req.params;
      if (!/^[a-zA-Z0-9_\-\.\/]+\.md$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }

      let configText;
      try {
        configText = getConfigData();
      } catch (e) {
        return res.status(500).json({ error: "Failed to read configuration" });
      }
      const config = JSON.parse(configText);
      const agent = config.agents?.find((a: any) => a.id === agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      let workspace = agent.workspace;
      if (!workspace) {
        workspace = join(homedir(), ".komorebi", "agents", agentId);
      }

      const absoluteWorkspace = resolve(workspace);
      const filePath = resolve(absoluteWorkspace, filename);
      if (!filePath.startsWith(absoluteWorkspace)) {
        return res.status(400).json({ error: "Path traversal attempt detected" });
      }

      if (!existsSync(filePath)) {
        return res.status(404).json({ error: `File not found: ${filename}` });
      }

      try {
        const content = readFileSync(filePath, "utf-8");
        res.json({ content });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to read file: ${err.message}` });
      }
    });

    // Get agent advanced stats (learning logs, prompt drift, skill performance histogram)
    app.get("/api/agents/:agentId/advanced-stats", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const agentDir = join(homedir(), ".komorebi", "agents", agentId);
      if (!existsSync(agentDir)) {
        return res.status(404).json({ error: "Agent directory not found" });
      }

      const logPath = join(agentDir, "learning.log");
      const driftPath = join(agentDir, "prompt-drift.json");
      const histPath = join(agentDir, "skills", "performance-histogram.json");

      let learningLog: any[] = [];
      if (existsSync(logPath)) {
        try {
          const content = readFileSync(logPath, "utf-8");
          learningLog = content.trim().split("\n").map(line => JSON.parse(line));
        } catch {}
      }

      let promptDrift: any[] = [];
      if (existsSync(driftPath)) {
        try {
          promptDrift = JSON.parse(readFileSync(driftPath, "utf-8"));
        } catch {}
      }

      let histogram: any = {};
      if (existsSync(histPath)) {
        try {
          histogram = JSON.parse(readFileSync(histPath, "utf-8"));
        } catch {}
      }

      res.json({ learningLog, promptDrift, histogram });
    });

    // Get agent current mood endpoint
    app.get("/api/agents/:agentId/mood", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const agentDir = join(homedir(), ".komorebi", "agents", agentId);
      const moodPath = join(agentDir, "mood.json");

      const isActive = this.messagePipeline.hasActiveRunsForAgent(agentId);
      let moodData: any = { mood: "idle", turnCount: 0, uptimeSeconds: 0, lastActive: Date.now() };

      if (existsSync(moodPath)) {
        try {
          moodData = JSON.parse(readFileSync(moodPath, "utf-8"));
        } catch {}
      }
      res.json({
        ...moodData,
        mood: isActive ? (moodData.mood || "focused") : "idle"
      });
    });

    // Get agent stats endpoint
    app.get("/api/agents/:agentId/stats", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const statusList = this.poolManager.getStatusList();
      const inst = statusList.find(x => x.agentId === agentId);
      
      const agentDir = join(homedir(), ".komorebi", "agents", agentId);
      const moodPath = join(agentDir, "mood.json");
      let moodData: any = { mood: "idle", turnCount: 0, uptimeSeconds: 0, lastActive: Date.now() };
      
      if (existsSync(moodPath)) {
        try {
          moodData = JSON.parse(readFileSync(moodPath, "utf-8"));
        } catch {}
      }

      const isActive = this.messagePipeline.hasActiveRunsForAgent(agentId);

      // Get latest reasoning thoughts from think.md
      let latestThoughts = "";
      try {
        const today = new Date().toISOString().split("T")[0];
        const thinkPath = join(agentDir, "memory", `${today}-think.md`);
        if (existsSync(thinkPath)) {
          const content = readFileSync(thinkPath, "utf-8").trim();
          if (content) {
            const sections = content.split("## ").filter(s => s.trim());
            if (sections.length > 0) {
              const lastSection = sections[sections.length - 1];
              latestThoughts = lastSection.replace(/^\[[^\]]+\]\n/, "").trim().slice(0, 180);
              if (lastSection.length > 180) latestThoughts += "...";
            }
          }
        }
      } catch {}

      res.json({
        status: inst ? inst.status : "idle",
        pid: inst ? inst.pid : null,
        ramUsageMb: inst ? inst.ramUsageMb : 0,
        cpuPercent: inst ? inst.cpuPercent : 0,
        uptimeMs: inst ? inst.uptimeMs : 0,
        restarts: inst ? inst.restarts : 0,
        mood: isActive ? (moodData.mood || "focused") : "idle",
        turnCount: moodData.turnCount,
        lastActive: moodData.lastActive,
        latestThoughts: latestThoughts || undefined
      });
    });

    // Restart agent endpoint
    app.post("/api/agents/:agentId/restart", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const statusList = this.poolManager.getStatusList();
      const inst = statusList.find(x => x.agentId === agentId);

      if (inst) {
        this.poolManager.terminateSession(inst.sessionId);
        await this.poolManager.ensureAgentRunning(agentId, inst.sessionId);
        return res.json({ success: true, message: `Agent session ${inst.sessionId} restarted.` });
      }

      // If no active running session, spawn a new one with a default session ID
      const sessionId = `web_console:${Date.now()}`;
      await this.poolManager.ensureAgentRunning(agentId, sessionId);
      res.json({ success: true, message: `Started new agent session ${sessionId}.` });
    });

    // Configure agent endpoint
    app.post("/api/agents/:agentId/configure", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const { name, model, toolPolicy, telegram } = req.body;

      try {
        const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
        let currentConfig: any = {};
        if (existsSync(userConfigPath)) {
          currentConfig = JSON.parse(readFileSync(userConfigPath, "utf-8"));
        } else {
          const projectRoot = join(__dirname, "..", "..");
          const configPath = join(projectRoot, "komorebi.config.json");
          currentConfig = JSON.parse(readFileSync(configPath, "utf-8"));
        }

        if (!currentConfig.agents) {
          currentConfig.agents = [];
        }

        let agentIdx = currentConfig.agents.findIndex((a: any) => a.id === agentId);
        if (agentIdx === -1) {
          const newAgent = {
            id: agentId,
            name: name || agentId,
            workspace: join(homedir(), ".komorebi", "agents", agentId),
            model: model || { provider: "gemini", name: "gemini-1.5-flash", apiKey: "$GEMINI_API_KEY" },
            toolPolicy: toolPolicy || { sandboxType: "none", allowedTools: ["*"], networkAccess: true },
            telegram: telegram || { botToken: "", allowedUsers: [] }
          };
          currentConfig.agents.push(newAgent);
        } else {
          const agent = currentConfig.agents[agentIdx];
          if (name) agent.name = name;
          if (model) agent.model = model;
          if (toolPolicy) agent.toolPolicy = toolPolicy;
          if (telegram) agent.telegram = telegram;
        }

        writeFileSync(userConfigPath, JSON.stringify(currentConfig, null, 2), "utf-8");
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to update agent config: ${err.message}` });
      }
    });

    // Write MD file content (supports subdirectory creation and wildcard matching)
    app.post("/api/agents/:agentId/files/:filename(*)", (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId, filename } = req.params;
      const { content } = req.body;

      if (!/^[a-zA-Z0-9_\-\.\/]+\.md$/.test(filename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }

      if (typeof content !== "string") {
        return res.status(400).json({ error: "Missing or invalid content" });
      }

      let configText;
      try {
        configText = getConfigData();
      } catch (e) {
        return res.status(500).json({ error: "Failed to read configuration" });
      }
      const config = JSON.parse(configText);
      const agent = config.agents?.find((a: any) => a.id === agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      let workspace = agent.workspace;
      if (!workspace) {
        workspace = join(homedir(), ".komorebi", "agents", agentId);
      }

      const absoluteWorkspace = resolve(workspace);
      const filePath = resolve(absoluteWorkspace, filename);
      if (!filePath.startsWith(absoluteWorkspace)) {
        return res.status(400).json({ error: "Path traversal attempt detected" });
      }

      try {
        const dirPath = dirname(filePath);
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }
        writeFileSync(filePath, content, "utf-8");
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to write file: ${err.message}` });
      }
    });

    // ClawHub Registry search API
    app.get("/api/clawhub/search", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { q, category, verifiedOnly } = req.query;
      const client = new ClawHubClient();
      try {
        const results = await client.search(
          (q as string) || "", 
          { 
            category: category as string, 
            verifiedOnly: verifiedOnly === "true" 
          }
        );
        res.json({ results });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ClawHub Registry info API
    app.get("/api/clawhub/info/:slug(*)", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { slug } = req.params;
      const client = new ClawHubClient();
      try {
        const info = await client.info(slug);
        if (!info) {
          return res.status(404).json({ error: "Skill not found in registry" });
        }
        res.json({ info });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Install ClawHub Skill endpoint
    app.post("/api/agents/:agentId/skills/install", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const { source, global, version, force } = req.body;

      if (!source) {
        return res.status(400).json({ error: "Missing required parameter: source" });
      }

      const projectRoot = join(__dirname, "..", "..");
      const installer = new SkillInstaller(projectRoot);
      
      try {
        const result = await installer.install(source, {
          agentId: agentId === "global" ? undefined : agentId,
          global: global === true || agentId === "global",
          version,
          force
        });
        
        if (!result.success) {
          return res.status(400).json({ error: result.message });
        }

        if (result.success && agentId && agentId !== "global") {
          const isPlugin = result.manifest?.category?.toLowerCase() === "plugin";
          const skillName = result.manifest?.name || source.split("/").pop() || source;
          const skillPath = isPlugin
            ? join(homedir(), ".komorebi", "agents", agentId, "plugins", skillName)
            : join(homedir(), ".komorebi", "agents", agentId, "skills", skillName);
          
          this.sessionManager.broadcastToAgent(agentId, {
            type: "evt",
            event: "skillHotReload",
            data: { skillName, skillPath }
          });
        }

        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Update Skills endpoint
    app.post("/api/agents/skills/update", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId, allAgents } = req.body;
      const projectRoot = join(__dirname, "..", "..");
      const installer = new SkillInstaller(projectRoot);

      try {
        const result = await installer.update({
          agentId,
          allAgents
        });
        if (result.success && result.updatedSkills) {
          for (const item of result.updatedSkills) {
            this.sessionManager.broadcastToAgent(item.agentId, {
              type: "evt",
              event: "skillHotReload",
              data: { skillName: item.skillName, skillPath: item.skillPath }
            });
          }
        }
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // List installed agent skills and plugins endpoint
    app.get("/api/agents/:agentId/skills", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;

      const projectRoot = join(__dirname, "..", "..");
      const agentSkillsDir = join(homedir(), ".komorebi", "agents", agentId, "skills");
      const globalSkillsDir = join(homedir(), ".komorebi", "shared-skills");
      const agentPluginsDir = join(homedir(), ".komorebi", "agents", agentId, "plugins");
      const globalPluginsDir = join(homedir(), ".komorebi", "shared-plugins");

      const listSkills = (dir: string, scope: "local" | "global") => {
        if (!existsSync(dir)) return [];
        try {
          return readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name !== ".clawhub")
            .map(entry => {
              const skillMdPath = join(dir, entry.name, "SKILL.md");
              let description = "";
              let version = "";
              let publisher = "";
              let verified = false;
              if (existsSync(skillMdPath)) {
                try {
                  const content = readFileSync(skillMdPath, "utf-8");
                  const manifest = parseSkillManifest(content);
                  description = manifest.description;
                  version = manifest.version;
                  publisher = manifest.publisher;
                  verified = manifest.verified;
                } catch {}
              }
              const trustJsonPath = join(dir, entry.name, ".trust", "trust.json");
              let trustScore = "UNKNOWN";
              let trustFindings: string[] = [];
              if (existsSync(trustJsonPath)) {
                try {
                  const trustObj = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
                  trustScore = trustObj.score || "UNKNOWN";
                  trustFindings = trustObj.findings || [];
                } catch {}
              }

              return {
                name: entry.name,
                description,
                version,
                publisher,
                verified,
                scope,
                trustScore,
                trustFindings
              };
            });
        } catch {
          return [];
        }
      };

      const listPlugins = (dir: string, scope: "local" | "global") => {
        if (!existsSync(dir)) return [];
        try {
          return readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name !== ".clawhub")
            .map(entry => {
              const pluginJsonPath = existsSync(join(dir, entry.name, "plugin.json"))
                ? join(dir, entry.name, "plugin.json")
                : join(dir, entry.name, "manifest.json");
              let description = "";
              let version = "";
              let publisher = "";
              let verified = false;
              if (existsSync(pluginJsonPath)) {
                try {
                  const jsonContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
                  description = jsonContent.description || "";
                  version = jsonContent.version || "";
                  publisher = jsonContent.publisher || "";
                  verified = jsonContent.verified || false;
                } catch {}
              }
              const trustJsonPath = join(dir, entry.name, ".trust", "trust.json");
              let trustScore = "UNKNOWN";
              let trustFindings: string[] = [];
              if (existsSync(trustJsonPath)) {
                try {
                  const trustObj = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
                  trustScore = trustObj.score || "UNKNOWN";
                  trustFindings = trustObj.findings || [];
                } catch {}
              }

              return {
                name: entry.name,
                description,
                version,
                publisher,
                verified,
                scope,
                trustScore,
                trustFindings
              };
            });
        } catch {
          return [];
        }
      };

      const localSkills = listSkills(agentSkillsDir, "local");
      const globalSkills = listSkills(globalSkillsDir, "global");
      const localPlugins = listPlugins(agentPluginsDir, "local");
      const globalPlugins = listPlugins(globalPluginsDir, "global");

      // Load usage statistics from usage-log.jsonl
      const usageMap = new Map<string, { count: number; successCount: number; lastUsed: number }>();
      const usageLogPath = join(agentSkillsDir, "usage-log.jsonl");
      if (existsSync(usageLogPath)) {
        try {
          const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n");
          for (const line of lines) {
            if (!line) continue;
            const entry = JSON.parse(line);
            const stats = usageMap.get(entry.slug) || { count: 0, successCount: 0, lastUsed: 0 };
            stats.count++;
            if (entry.success) stats.successCount++;
            if (entry.timestamp > stats.lastUsed) stats.lastUsed = entry.timestamp;
            usageMap.set(entry.slug, stats);
          }
        } catch {}
      }

      const listLearnedSkills = (isArchive: boolean) => {
        const dir = isArchive 
          ? join(agentSkillsDir, "learned", "_archive")
          : join(agentSkillsDir, "learned");
        
        if (!existsSync(dir)) return [];
        try {
          return readdirSync(dir, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && entry.name !== "_archive")
            .map(entry => {
              const skillMdPath = join(dir, entry.name, "SKILL.md");
              let name = entry.name;
              let description = "Extracted learned workflow.";
              let status = isArchive ? "archived" : "active";
              let triggerType = "complexity"; // default
              let createdDate = new Date().toISOString().split("T")[0];

              if (existsSync(skillMdPath)) {
                try {
                  const content = readFileSync(skillMdPath, "utf-8");
                  const nameMatch = content.match(/^#\s+(.+)$/m);
                  if (nameMatch) name = nameMatch[1].trim();

                  const descMatch = content.match(/description:\s*["'](.+?)["']/i);
                  if (descMatch) description = descMatch[1].trim();

                  if (content.includes("status: battle-tested")) {
                    status = "promoted";
                  }

                  // Use filesystem birthtime/mtime for actual created date
                  const stat = statSync(skillMdPath);
                  const time = (stat.birthtimeMs && stat.birthtimeMs > 0) ? stat.birthtime : stat.mtime;
                  createdDate = time.toISOString().split("T")[0];
                  
                  // Check if name has 'recovery' or 'correction' in slug or if usage shows failures
                  if (entry.name.includes("recovery")) {
                    triggerType = "recovery";
                  } else if (entry.name.includes("correction")) {
                    triggerType = "correction";
                  }
                } catch {}
              }

              const stats = usageMap.get(entry.name.toLowerCase()) || { count: 0, successCount: 0 };
              const successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 100;

              return {
                name,
                slug: entry.name.toLowerCase(),
                description,
                status,
                triggerType,
                createdDate,
                usageCount: stats.count,
                successRate,
                isArchive
              };
            });
        } catch {
          return [];
        }
      };

      const learnedSkills = [
        ...listLearnedSkills(false),
        ...listLearnedSkills(true)
      ];

      res.json({
        skills: [...localSkills, ...globalSkills],
        plugins: [...localPlugins, ...globalPlugins],
        learnedSkills
      });
    });

    // Skill health details
    app.get("/api/agents/:agentId/skills/health", async (req: express.Request, res: express.Response) => {
      const { agentId } = req.params;
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token && req.query.token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sessions = this.sessionManager.getSessionsForAgent(agentId);
      if (sessions.length === 0) {
        return res.json({}); // Not running, return empty circuit stats
      }

      try {
        const ws = await this.sessionManager.ensureAgentRunning(agentId, sessions[0].sessionId);
        const data = await this.sendRequest(ws, "getSkillsHealth", {});
        res.json(data);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Toggle skill circuit breaker state
    app.post("/api/agents/:agentId/skills/:skillName/circuit", async (req: express.Request, res: express.Response) => {
      const { agentId, skillName } = req.params;
      const { state } = req.body; // "CLOSED" or "OPEN"
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token && req.query.token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const sessions = this.sessionManager.getSessionsForAgent(agentId);
      if (sessions.length === 0) {
        return res.status(400).json({ error: "Agent process is not running." });
      }

      try {
        const ws = await this.sessionManager.ensureAgentRunning(agentId, sessions[0].sessionId);
        const result = await this.sendRequest(ws, "setSkillCircuitState", { skillName, state });
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Uninstall ClawHub package (skill or plugin) endpoint
    app.post("/api/agents/:agentId/skills/uninstall", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { agentId } = req.params;
      const { name, type, global } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "Missing required parameters: name and type" });
      }

      const isPlugin = type === "plugin";
      let destDir: string;

      if (global === true || agentId === "global") {
        const globalSkillsDir = join(homedir(), ".komorebi", "shared-skills");
        const globalPluginsDir = join(homedir(), ".komorebi", "shared-plugins");
        destDir = isPlugin ? join(globalPluginsDir, name) : join(globalSkillsDir, name);
      } else {
        const agentSkillsDir = join(homedir(), ".komorebi", "agents", agentId, "skills");
        const agentPluginsDir = join(homedir(), ".komorebi", "agents", agentId, "plugins");
        destDir = isPlugin ? join(agentPluginsDir, name) : join(agentSkillsDir, name);
      }

      if (!existsSync(destDir)) {
        return res.status(404).json({ error: `Package directory not found: ${destDir}` });
      }

      try {
        rmSync(destDir, { recursive: true, force: true });
        
        // Remove from lock file if exists
        const lockFilePath = (global === true || agentId === "global")
          ? join(homedir(), ".komorebi", "shared-skills", ".clawhub", "lock.json")
          : join(homedir(), ".komorebi", "agents", agentId, ".clawhub", "lock.json");
          
        if (existsSync(lockFilePath)) {
          try {
            const lockData = JSON.parse(readFileSync(lockFilePath, "utf-8"));
            if (lockData.installs && lockData.installs[name]) {
              delete lockData.installs[name];
              writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2), "utf-8");
            }
          } catch {}
        }

        res.json({ success: true, message: `Successfully uninstalled ${type} '${name}'` });
      } catch (err: any) {
        res.status(500).json({ error: `Failed to delete package: ${err.message}` });
      }
    });

    // List active licenses tied to this Komorebi install
    app.get("/api/clawhub/licenses", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
      if (token !== this.token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const configPath = join(homedir(), ".komorebi", "komorebi.json");
      let licenses: string[] = [];
      if (existsSync(configPath)) {
        try {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          licenses = config.licenses || [];
        } catch {}
      }
      res.json({ licenses });
    });

    // Standard JSON-RPC 2.0 HTTP API Route for CLI commands
    app.post("/api/rpc", async (req: express.Request, res: express.Response) => {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }
      if (clientToken !== this.token) {
        return res.status(401).json({ error: { message: "Unauthorized: Invalid Gateway Token" } });
      }

      const { method, params, id } = req.body;
      if (!method) {
        return res.status(400).json({ error: { message: "Missing required parameter: method" } });
      }

      // Mock WebSocket connection to run the RPC request in handleClientRequest
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: (data: string) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              res.json({ result: parsed.payload, id });
            } else {
              res.json({ error: { message: parsed.error || "Unknown RPC error" }, id });
            }
          } catch (err: any) {
            res.status(500).json({ error: { message: `Failed to serialize response: ${err.message}` }, id });
          }
        }
      } as any;

      try {
        await this.handleClientRequest(mockWs, { type: "req", id: id || `http_rpc_${Date.now()}`, method, params }, () => {});
      } catch (err: any) {
        res.status(500).json({ error: { message: err.message }, id });
      }
    });

    // 2. Setup Shared HTTP and WS Server
    this.server = createServer(app);
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP Upgrade manually for security validation
    this.server.on("upgrade", (request, socket, head) => {
      const reqUrl = request.url || "";
      const queryToken = new URL(reqUrl, `http://${request.headers.host}`).searchParams.get("token");
      const authHeader = request.headers.authorization;

      let clientToken = queryToken;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        clientToken = authHeader.split(" ")[1];
      }

      if (clientToken !== this.token) {
        console.warn(`[GatewayWsServer] Upgrade connection rejected (invalid token)`);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request);
      });
    });
    this.wss.on("connection", this.handleConnection.bind(this));

    this.server.listen(this.port, this.host, () => {
      console.log(`[GatewayWsServer] Server listening on http://${this.host}:${this.port}`);
    });

    // 3. Start 15s Heartbeat Supervisor Loop
    this.heartbeatInterval = setInterval(this.runSupervisorChecks.bind(this), 15000);

    // 4. Start 30-minute Heartbeat Task Scheduler Loop
    this.heartbeatTasksInterval = setInterval(this.checkHeartbeatTasks.bind(this), 30 * 60 * 1000);
    // Trigger initial check on startup
    setTimeout(() => this.checkHeartbeatTasks(), 5000);

    // Pre-spawn persistent heartbeat sessions for all configured agents to ensure they are never offline
    setTimeout(() => {
      console.log("[GatewayWsServer] Pre-spawning persistent heartbeat sessions for all configured agents...");
      for (const agent of this.globalConfig.agents) {
        const sessionId = `${agent.id}:chat:heartbeat_persistent`;
        this.sessionManager.ensureAgentRunning(agent.id, sessionId, true).catch(err => {
          console.error(`[GatewayWsServer] Failed to pre-spawn agent ${agent.id} persistent session:`, err.message);
        });
      }
    }, 1000);
  }
  /**
   * Supervisor loop: pings all running agent instances to confirm main loop responsiveness.
   */
  private async runSupervisorChecks() {
    console.log(`[Supervisor] Performing 15s health-checks on active pool...`);
    const statusList = this.poolManager.getStatusList();

    for (const inst of statusList) {
      if (inst.status !== "running" || !inst.pid) {
        continue;
      }

      const ws = this.sessionManager.getAgentConnection(inst.sessionId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const instanceObj = this.poolManager.getInstance(inst.sessionId);
        const uptime = Date.now() - (instanceObj?.startTime || 0);
        if (uptime < 20000) {
          // Grace period of 20 seconds for new processes to connect and register
          continue;
        }
        console.warn(`[Supervisor] Session ${inst.sessionId} has no active WebSocket after ${uptime}ms. Triggering process restart.`);
        this.poolManager.terminateSession(inst.sessionId);
        continue;
      }

      // Check heartbeat responses
      const instanceObj = this.poolManager.getInstance(inst.sessionId);
      if (instanceObj) {
        const timeSinceHeartbeat = Date.now() - instanceObj.lastHeartbeatResponse;
        if (timeSinceHeartbeat > 20000) {
          console.error(`[Supervisor] Session ${inst.sessionId} failed heartbeat checks (no response in ${timeSinceHeartbeat}ms). Terminating process.`);
          this.poolManager.terminateSession(inst.sessionId);
          continue;
        }

        // Send a ping RPC request. If it fails, the agent's event loop is locked.
        (async () => {
          try {
            await this.sendRequest(ws, "ping", {});
            instanceObj.lastHeartbeatResponse = Date.now();
            instanceObj.lastActivity = Date.now();
          } catch (pingErr) {
            console.error(`[Supervisor] Ping RPC failed for session ${inst.sessionId}:`, pingErr);
          }
        })();

        // Check idle time for session-end reflection (e.g. 30+ minutes)
        const lastAct = this.lastActivityTimes.get(inst.sessionId);
        if (lastAct && !this.runClosingReflections.has(inst.sessionId)) {
          const idleThreshold = (process.env.SESSION_IDLE_TIMEOUT_MINS ? parseInt(process.env.SESSION_IDLE_TIMEOUT_MINS, 10) : 30) * 60 * 1000;
          if (Date.now() - lastAct >= idleThreshold) {
            this.runClosingReflections.add(inst.sessionId);
            console.log(`[Supervisor] Session ${inst.sessionId} has been idle for ${Math.round((Date.now() - lastAct)/60000)} minutes. Triggering final closing reflection...`);
            (async () => {
              try {
                await this.sendRequest(ws, "runSessionEndReflection", {
                  agentId: inst.agentId,
                  sessionId: inst.sessionId
                });
                console.log(`[Supervisor] Session-end closing reflection successful for session ${inst.sessionId}`);
              } catch (err: any) {
                console.error(`[Supervisor] Session-end closing reflection failed for ${inst.sessionId}:`, err.message);
              }
            })();
          }
        }
      }
    }
  }

  private handleConnection(ws: WebSocket) {
    let registeredSessionId: string | null = null;

    ws.on("message", async (rawMessage) => {
      try {
        const frame = JSON.parse(rawMessage.toString()) as RpcFrame;

        if (frame.type === "req") {
          await this.handleClientRequest(ws, frame, (sessionId) => {
            registeredSessionId = sessionId;
          });
        } else if (frame.type === "res") {
          this.handleClientResponse(frame);
        } else if (frame.type === "evt") {
          this.handleClientEvent(frame);
        }

        if (registeredSessionId) {
          this.lastActivityTimes.set(registeredSessionId, Date.now());
        }
      } catch (err: any) {
        console.error("[GatewayWsServer] Error processing message frame:", err);
        ws.send(
          JSON.stringify({
            type: "res",
            id: "unknown",
            ok: false,
            error: `Malformed JSON or Frame error: ${err.message}`,
          })
        );
      }
    });

    ws.on("close", () => {
      if (registeredSessionId) {
        console.log(`[GatewayWsServer] Session ${registeredSessionId} disconnected.`);
        this.sessionManager.unregisterAgentConnection(registeredSessionId);
      }
      this.removeConnectionFromBus(ws);
    });

    ws.on("error", (err) => {
      console.error(`[GatewayWsServer] Connection error:`, err);
    });
  }

  private async handleClientRequest(
    ws: WebSocket,
    req: RpcRequest,
    setSessionId: (sessionId: string) => void
  ) {
    const { id, method, params } = req;

    try {
      switch (method) {
        case "registerAgent": {
          const { agentId, sessionId } = params;
          if (!agentId || !sessionId) {
            throw new Error("Missing parameters 'agentId' or 'sessionId'");
          }
          setSessionId(sessionId);
          this.sessionManager.registerAgentConnection(sessionId, ws);
          const instanceObj = this.poolManager.getInstance(sessionId);
          if (instanceObj) {
            instanceObj.lastHeartbeatResponse = Date.now();
            instanceObj.lastActivity = Date.now();
          }
          this.sendResponse(ws, id, true, { registered: true });
          break;
        }

        case "getSystemConfig": {
          const configText = JSON.stringify(this.globalConfig);
          const hash = crypto.createHash("md5").update(configText).digest("hex");
          this.sendResponse(ws, id, true, { config: this.globalConfig, hash });
          break;
        }

        case "saveSystemConfig": {
          const { config: newConfig, baseHash } = params;
          if (!newConfig || !baseHash) {
            throw new Error("Missing parameters for saveSystemConfig");
          }

          const currentConfigText = JSON.stringify(this.globalConfig);
          const currentHash = crypto.createHash("md5").update(currentConfigText).digest("hex");
          if (currentHash !== baseHash) {
            this.sendResponse(ws, id, true, { success: false, conflict: true, hash: currentHash, config: this.globalConfig });
            break;
          }

          try {
            const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
            let oldConfig: any = {};
            try {
              if (existsSync(userConfigPath)) {
                oldConfig = JSON.parse(readFileSync(userConfigPath, "utf-8"));
              }
            } catch {}

            const formatted = JSON.stringify(newConfig, null, 2);
            writeFileSync(userConfigPath, formatted, "utf-8");

            const oldAgents: any[] = oldConfig.agents || [];
            const newAgents: any[] = newConfig.agents || [];

            // Spawn or stop processes depending on new config
            for (const newAgent of newAgents) {
              const oldAgent = oldAgents.find(a => a.id === newAgent.id);
              if (!oldAgent) {
                console.log(`[GatewayWsServer] Spawning newly configured agent: ${newAgent.id}`);
                const sessions = this.sessionManager.getSessionsForAgent(newAgent.id);
                const sessionId = sessions.length > 0 ? sessions[0].sessionId : `${newAgent.id}:chat:web_test`;
                this.sessionManager.ensureAgentRunning(newAgent.id, sessionId).catch(() => {});
              }
            }

            for (const oldAgent of oldAgents) {
              const newAgent = newAgents.find(a => a.id === oldAgent.id);
              if (!newAgent) {
                console.log(`[GatewayWsServer] Terminating deleted agent: ${oldAgent.id}`);
                const sessions = this.sessionManager.getSessionsForAgent(oldAgent.id);
                for (const s of sessions) {
                  this.poolManager.terminateSession(s.sessionId);
                }
              }
            }

            const gc = this.globalConfig as any;
            if (Array.isArray(newConfig.agents)) {
              gc.agents = newConfig.agents;
            }
            if (newConfig.models) {
              gc.models = newConfig.models;
            }
            if (newConfig.providers) {
              gc.providers = newConfig.providers;
            }
            if (newConfig.telegram) {
              gc.telegram = newConfig.telegram;
            }

            const nextConfigText = JSON.stringify(this.globalConfig);
            const nextHash = crypto.createHash("md5").update(nextConfigText).digest("hex");
            this.sendResponse(ws, id, true, { success: true, hash: nextHash });
          } catch (err: any) {
            throw new Error(`Failed to save config: ${err.message}`);
          }
          break;
        }

        case "getSelfHealingStatus": {
          const sh = SelfHealingSubsystem.getInstance();
          this.sendResponse(ws, id, true, {
            knownFixes: sh.getKnownFixes(),
            incidents: sh.getIncidents(),
            pendingFixes: sh.getPendingFixes()
          });
          break;
        }

        case "applySelfHealingFix": {
          const { fingerprint, fix } = params;
          if (!fingerprint) throw new Error("Missing fingerprint");
          const sh = SelfHealingSubsystem.getInstance();
          const success = await sh.applyFix(fingerprint, fix || {}, true);
          this.sendResponse(ws, id, true, { success });
          break;
        }

        case "rollbackSelfHealingFix": {
          const { fingerprint } = params;
          if (!fingerprint) throw new Error("Missing fingerprint");
          const sh = SelfHealingSubsystem.getInstance();
          const success = sh.rollbackFix(fingerprint);
          this.sendResponse(ws, id, true, { success });
          break;
        }

        case "cacheAgentPlan": {
          const { agentId, plan } = params;
          if (!agentId || !plan) throw new Error("Missing parameters");
          this.lastAgentPlans.set(agentId, plan);
          // Broadcast update to dashboard clients
          this.publishToBus("agent_plan_updated", { agentId, plan });
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "getAgentLastPlan": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing agentId");
          const plan = this.lastAgentPlans.get(agentId) || null;
          this.sendResponse(ws, id, true, { plan });
          break;
        }

        case "listSessions": {
          const sessions: any[] = [];
          const sessionMap = new Map<string, any>(); // key = agentId + ":" + sessionId
          const agentsDir = join(homedir(), ".komorebi", "agents");
          if (existsSync(agentsDir)) {
            try {
              const { resolveRuntimeStatus } = await import("./status-resolver.js");
              const agentDirs = await fsPromises.readdir(agentsDir);
              for (const agentId of agentDirs) {
                const agentPath = join(agentsDir, agentId);
                const agentStat = await fsPromises.stat(agentPath);
                if (agentStat.isDirectory()) {
                  const sessionDirs = await fsPromises.readdir(agentPath);
                  for (const sessionDir of sessionDirs) {
                    const sessionPath = join(agentPath, sessionDir);
                    const sessionStat = await fsPromises.stat(sessionPath);
                    if (sessionStat.isDirectory()) {
                      const jsonlPath = join(sessionPath, "session.jsonl");
                      if (existsSync(jsonlPath)) {
                        try {
                          const fileContent = await fsPromises.readFile(jsonlPath, "utf-8");
                          const transcript = fileContent.trim().split("\n");
                          const lastLine = transcript[transcript.length - 1];
                          const jsonlStat = await fsPromises.stat(jsonlPath);
                          let lastMessageTime = jsonlStat.mtimeMs;
                          let lastText = "";
                          if (lastLine) {
                            const parsed = JSON.parse(lastLine);
                            lastMessageTime = parsed.timestamp || lastMessageTime;
                            lastText = parsed.content || "";
                          }
                          
                          const resolvedSessionId = sessionDir.replace(/_/g, ":");
                          const dedupeKey = `${agentId}::${resolvedSessionId}`;

                          // Deduplication: if the same agentId+sessionId already exists,
                          // keep whichever entry has the more recent last message time.
                          const existing = sessionMap.get(dedupeKey);
                          if (existing && existing.lastMessageTime >= lastMessageTime) {
                            continue; // skip older duplicate
                          }

                          const status = resolveRuntimeStatus(agentId, resolvedSessionId, this.globalConfig);
                          const pipelineStatus = this.messagePipeline.getSessionPipelineStatus(resolvedSessionId);

                          sessionMap.set(dedupeKey, {
                            agentId,
                            sessionId: resolvedSessionId,
                            lastMessageTime,
                            lastText,
                            turns: transcript.filter(Boolean).length,
                            execution: status.execution,
                            runtime: status.runtime,
                            channel: status.channel,
                            queueMode: pipelineStatus.queueMode,
                            blockStreaming: pipelineStatus.blockStreaming,
                            reasoning: pipelineStatus.reasoning,
                            debounceMs: pipelineStatus.debounceMs,
                            active: pipelineStatus.active
                          });
                        } catch {}
                      }
                    }
                  }
                }
              }
            } catch {}
          }
          sessions.push(...sessionMap.values());
          // Sort by lastMessageTime descending (newest first)
          sessions.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
          this.sendResponse(ws, id, true, sessions);
          break;
        }

        case "getSessionTranscript": {
          const { agentId, sessionId } = params;
          if (!agentId || !sessionId) {
            throw new Error("Missing parameters 'agentId' or 'sessionId'");
          }
          const escapedSession = sessionId.replace(/:/g, "_");
          const jsonlPath = join(homedir(), ".komorebi", "agents", agentId, escapedSession, "session.jsonl");
          const transcript: any[] = [];
          if (existsSync(jsonlPath)) {
            try {
              const fileContent = await fsPromises.readFile(jsonlPath, "utf-8");
              const lines = fileContent.trim().split("\n");
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    transcript.push(JSON.parse(line));
                  } catch {}
                }
              }
            } catch {}
          }
          this.sendResponse(ws, id, true, transcript);
          break;
        }

        case "deleteSession": {
          const { agentId, sessionId } = params;
          if (!agentId || !sessionId) {
            throw new Error("Missing parameters 'agentId' or 'sessionId'");
          }
          
          try {
            this.sessionManager.terminateSession(sessionId);
          } catch (err: any) {
            console.warn(`[Gateway - deleteSession] Failed to terminate session process for ${sessionId}:`, err.message);
          }

          const escapedSession = sessionId.replace(/:/g, "_");
          const sessionPath = join(homedir(), ".komorebi", "agents", agentId, escapedSession);
          
          try {
            if (existsSync(sessionPath)) {
              rmSync(sessionPath, { recursive: true, force: true });
              console.log(`[Gateway - deleteSession] Session directory deleted for session: ${sessionId}`);
            }
          } catch (err: any) {
            console.error(`[Gateway - deleteSession] Failed to delete session directory:`, err.message);
            throw new Error(`Failed to delete session directory: ${err.message}`);
          }

          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "sendMessageToAgent": {
          const { agentId, sessionId, text } = params;
          if (!agentId || !sessionId || !text) {
            throw new Error("Missing parameters 'agentId', 'sessionId', or 'text'");
          }
          const envelope = {
            sender: { id: 1, firstName: "Dashboard", username: "web_console" },
            chatId: 1,
            content: text,
            attachments: [],
            channel: "web" as any,
            timestamp: Math.floor(Date.now() / 1000)
          };
          this.messagePipeline.handleInbound("web", "web_console", sessionId, text, envelope).catch(err => {
            console.error(`[sendMessageToAgent] Dispatch failed:`, err);
          });
          this.sendResponse(ws, id, true, { dispatched: true });
          break;
        }

        case "setReasoningSetting": {
          const { sessionId, value } = params;
          if (!sessionId || !value) {
            throw new Error("Missing parameters 'sessionId' or 'value'");
          }
          this.messagePipeline.setReasoningSetting(sessionId, value);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "reportProgress": {
          const { sessionId, chatId, threadId, event } = params;
          if (sessionId === undefined || chatId === undefined || event === undefined) {
            throw new Error("Missing parameters 'sessionId', 'chatId', or 'event'");
          }
          await this.messagePipeline.handleProgressEvent(sessionId, chatId, threadId, event);
          const agentId = event.agentId || sessionId.split(":")[1] || "agent";
          const bot = this.getTelegramBot(agentId);
          if (bot) {
            const config = this.progressDraftManager.getAgentProgressConfig(agentId, this.globalConfig);
            await this.progressDraftManager.handleEvent(
              Number(chatId),
              threadId ? Number(threadId) : undefined,
              bot,
              event,
              config,
              sessionId,
              this.globalConfig
            );

            const { TelegramStreamer } = await import("./telegram-streamer.js");
            const proxyBot = this.getTelegramBot(agentId);
            if (proxyBot) {
              await TelegramStreamer.getInstance().handleProgressEvent(
                sessionId,
                Number(chatId),
                threadId ? Number(threadId) : undefined,
                event,
                proxyBot
              );
            }
          }
          this.publishToBus("loop_progress", { sessionId, chatId, threadId, event });
          this.sendResponse(ws, id, true, { reported: true });
          break;
        }

        case "getActivePreviewBlocks": {
          const { TelegramStreamer } = await import("./telegram-streamer.js");
          const list = TelegramStreamer.getInstance().getActivePreviewBlocks();
          this.sendResponse(ws, id, true, { list });
          break;
        }

        case "getTelegramLogs": {
          const { TelegramStreamer } = await import("./telegram-streamer.js");
          const streamer = TelegramStreamer.getInstance();
          this.sendResponse(ws, id, true, {
            mediaLogs: streamer.mediaLogs,
            reactionLogs: streamer.reactionLogs
          });
          break;
        }

        case "listCronJobs": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          this.sendResponse(ws, id, true, this.cronScheduler.getJobs());
          break;
        }

        case "saveCronJob": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { job } = params;
          if (!job || !job.id) throw new Error("Invalid job payload");
          this.cronScheduler.addOrUpdateJob(job);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "deleteCronJob": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { jobId } = params;
          if (!jobId) throw new Error("Missing jobId");
          this.cronScheduler.deleteJob(jobId);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "runCronJob": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { jobId } = params;
          if (!jobId) throw new Error("Missing jobId");
          await this.cronScheduler.runJob(jobId);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "enableCronJob": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { jobId } = params;
          if (!jobId) throw new Error("Missing jobId");
          this.cronScheduler.enableJob(jobId);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "disableCronJob": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { jobId } = params;
          if (!jobId) throw new Error("Missing jobId");
          this.cronScheduler.disableJob(jobId);
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "getCronTasks": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          const { jobId } = params;
          const tasks = this.cronScheduler.getTasks(jobId);
          this.sendResponse(ws, id, true, { tasks: tasks.slice(-100) });
          break;
        }

        case "getCronDriftReport": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          this.sendResponse(ws, id, true, this.cronScheduler.getDriftReport());
          break;
        }

        case "getCronBoundaryWarnings": {
          if (!this.cronScheduler) throw new Error("Cron scheduler not active");
          this.sendResponse(ws, id, true, { warnings: this.cronScheduler.getBoundaryWarnings() });
          break;
        }

        case "validateCronSchedule": {
          const { schedule, timezone } = params;
          const valid = validateSchedule(schedule ?? "");
          const human = valid ? cronToHuman(schedule, timezone ?? "UTC") : null;
          this.sendResponse(ws, id, true, { valid, human });
          break;
        }

        case "stopAgent": {
          const { sessionId } = params;
          if (!sessionId) {
            throw new Error("Missing parameter 'sessionId'");
          }
          this.poolManager.terminateSession(sessionId);
          this.sendResponse(ws, id, true, { terminated: true });
          break;
        }

        case "restartAgent": {
          const { sessionId, agentId } = params;
          if (!sessionId || !agentId) {
            throw new Error("Missing parameters 'sessionId' or 'agentId'");
          }
          this.poolManager.terminateSession(sessionId);
          await this.poolManager.ensureAgentRunning(agentId, sessionId);
          this.sendResponse(ws, id, true, { restarted: true });
          break;
        }

        case "killDuplicateInstances": {
          // Kill all duplicate pool entries per agentId, keeping the most recently started one
          const killed = this.poolManager.killDuplicates();
          console.log(`[Gateway - killDuplicateInstances] Killed ${killed} duplicate instance(s).`);
          this.sendResponse(ws, id, true, { killed });
          break;
        }

        case "killAllIdleInstances": {
          // Kill all instances that are idle, crashed, or failed
          const killed = this.poolManager.killAllByStatus(["idle", "crashed", "failed", "unresponsive"]);
          console.log(`[Gateway - killAllIdleInstances] Killed ${killed} idle/crashed/failed instance(s).`);
          this.sendResponse(ws, id, true, { killed });
          break;
        }

        case "killAgentInstances": {
          // Kill all pool instances for a specific agentId
          const { agentId: targetAgentId } = params;
          if (!targetAgentId) throw new Error("Missing parameter 'agentId'");
          const killed = this.poolManager.killAllForAgent(targetAgentId);
          console.log(`[Gateway - killAgentInstances] Killed ${killed} instance(s) for agent '${targetAgentId}'.`);
          this.sendResponse(ws, id, true, { killed });
          break;
        }

        case "sendTelegramMessage": {
          const { agentId, chatId, threadId, text, parseMode, messageId } = params;
          if (!agentId) {
            throw new Error("Missing parameter 'agentId'");
          }
          const cleanText = text && text.trim() ? text : "👍 (Turn completed)";
          
          let hasMedia = false;
          let mediaType: "photo" | "voice" | null = null;
          let mediaPath = "";
          let cleanMsgText = cleanText;

          const imageMatch = cleanText.match(/\[IMAGE:\s*(.*?)\]/);
          const voiceMatch = cleanText.match(/\[VOICE:\s*(.*?)\]/);

          if (imageMatch) {
            hasMedia = true;
            mediaType = "photo";
            mediaPath = imageMatch[1].trim();
            cleanMsgText = cleanText.replace(/\[IMAGE:\s*(.*?)\]/g, "").trim();
          } else if (voiceMatch) {
            hasMedia = true;
            mediaType = "voice";
            mediaPath = voiceMatch[1].trim();
            cleanMsgText = cleanText.replace(/\[VOICE:\s*(.*?)\]/g, "").trim();
          }

          // Enforce outbound Telegram send gating: restrict to active session chatId
          const sessionId = this.sessionManager.getSessionIdForConnection(ws) || "";
          const isTelegram = sessionId.startsWith("telegram:") || (sessionId.startsWith("agent:") && sessionId.includes(":telegram:"));
          let resolvedThreadId = threadId ? Number(threadId) : undefined;
          if (isTelegram) {
            const parts = sessionId.split(":");
            const expectedChatId = sessionId.startsWith("agent:") ? parts[4] : parts[1];
            if (String(chatId) !== expectedChatId) {
              console.warn(`[Gating] Outbound Telegram send rejected. Agent '${agentId}' tried to message chat '${chatId}' but is gated to '${expectedChatId}'`);
              throw new Error(`Access Denied: Outbound send policy restricted to active session chat ID (${expectedChatId}).`);
            }
            if (parts[5] === "topic") {
              resolvedThreadId = Number(parts[6]);
            }
          }

          const bot = this.getTelegramBot(agentId);
          
          // Resolve targetChatId with fallback to allowed chat IDs if it is 0 or falsy
          let targetChatId = chatId;
          if (!targetChatId || Number(targetChatId) === 0) {
            const allowed = (this.globalConfig as any).allowedTelegramChatIds;
            if (allowed && allowed.length > 0) {
              targetChatId = allowed[0];
            } else {
              const botConfig = this.globalConfig.telegram?.bots?.find((b: any) => b.agentId === agentId);
              if (botConfig && botConfig.allowedUserIds && botConfig.allowedUserIds.length > 0) {
                targetChatId = botConfig.allowedUserIds[0];
              }
            }
          }

          const hasValidTargetChat = !!(bot && targetChatId && Number(targetChatId) !== 0 && !isNaN(Number(targetChatId)));

          if (!hasValidTargetChat) {
            console.log(`[GatewayWsServer] Intercepted sendTelegramMessage for non-Telegram session '${sessionId}' and no fallback chat ID found. Publishing to event bus.`);
            this.publishToBus(`chat:${sessionId}`, {
              agentId,
              text: cleanMsgText,
              messageId,
              timestamp: Date.now()
            });
            this.sendResponse(ws, id, true, { sent: true });
            break;
          }

          // If we have a valid targetChatId, check if it's a native Telegram session
          const isNativeTelegramSession = !!(
            !sessionId.includes(":web_") &&
            !sessionId.includes(":cron_") &&
            !sessionId.includes(":cron:") &&
            !sessionId.includes(":heartbeat_") &&
            !sessionId.includes("curator_")
          );

          if (!isNativeTelegramSession) {
            console.log(`[GatewayWsServer] Intercepted sendTelegramMessage for non-Telegram session '${sessionId}'. Routing to Telegram chat ID ${targetChatId} and publishing to event bus.`);
            this.publishToBus(`chat:${sessionId}`, {
              agentId,
              text: cleanMsgText,
              messageId,
              timestamp: Date.now()
            });
            
            // Send message directly to Telegram without session progress/draft handling
            try {
              if (hasMedia) {
                if (mediaType === "photo") {
                  await bot.telegram.sendPhoto(Number(targetChatId), { source: mediaPath }, {
                    caption: cleanMsgText,
                    message_thread_id: threadId ? Number(threadId) : undefined
                  });
                } else {
                  await bot.telegram.sendVoice(Number(targetChatId), { source: mediaPath }, {
                    caption: cleanMsgText,
                    message_thread_id: threadId ? Number(threadId) : undefined
                  });
                }
              } else {
                await bot.telegram.sendMessage(Number(targetChatId), cleanMsgText, {
                  parse_mode: parseMode || "Markdown"
                });
              }
            } catch (err: any) {
              console.error(`[sendTelegramMessage] Failed to send Telegram message to targetChatId ${targetChatId} for non-native session:`, err.message);
            }
            
            this.sendResponse(ws, id, true, { sent: true });
            break;
          }

          if (!chatId) {
            throw new Error("Missing parameter 'chatId' for Telegram session");
          }

          const { TelegramStreamer } = await import("./telegram-streamer.js");
          const streamConfig = TelegramStreamer.getInstance().getStreamConfig(agentId);

          if (streamConfig.enabled) {
            const proxyBot = this.getTelegramBot(agentId);
            if (proxyBot) {
              try {
                this.messagePipeline.clearTypingCanceler(sessionId);
                const sentMsgId = await TelegramStreamer.getInstance().finalizeTurn(
                  sessionId,
                  agentId,
                  Number(chatId),
                  resolvedThreadId,
                  proxyBot,
                  cleanMsgText,
                  hasMedia,
                  mediaType,
                  mediaPath,
                  messageId
                );
                this.sendResponse(ws, id, true, { sent: true, messageId: sentMsgId });
              } catch (err: any) {
                console.error(`[sendTelegramMessage] Stream finalization failed:`, err.message);
                this.sendResponse(ws, id, false, undefined, err.message);
              }
              break;
            }
          }

          const config = this.progressDraftManager.getAgentProgressConfig(agentId, this.globalConfig);
          const sessionKey = `${agentId}:${chatId}:${threadId || 0}`;
          const draft = this.progressDraftManager.getOrCreateDraft(sessionKey);

          // Stop typing indicator before final message lands
          this.messagePipeline.clearTypingCanceler(sessionKey);

          // Extra buttons: Retry
          const extraButtons = [
            [{ text: "🔁 Retry", callback_data: `retry:${draft.startedAt}` }]
          ];

          if (hasMedia) {
            if (draft.messageId) {
              try {
                await bot.telegram.deleteMessage(chatId, draft.messageId);
              } catch {}
            }
            try {
              let resMsg;
              if (mediaType === "photo") {
                resMsg = await bot.telegram.sendPhoto(chatId, { source: mediaPath }, {
                  caption: cleanMsgText,
                  message_thread_id: threadId ? Number(threadId) : undefined
                });
              } else {
                resMsg = await bot.telegram.sendVoice(chatId, { source: mediaPath }, {
                  caption: cleanMsgText,
                  message_thread_id: threadId ? Number(threadId) : undefined
                });
              }
              this.sendResponse(ws, id, true, { sent: true, messageId: resMsg.message_id });
            } catch (err: any) {
              console.error(`[sendTelegramMessage] Media send failed:`, err.message);
              this.sendResponse(ws, id, false, undefined, err.message);
            }
            break;
          }

          // PRIMARY PATH: If a progress draft is active, finalize it in-place
          // (edit the draft message to become the final reply — the single-message pattern)
          if (config.mode !== "off" && draft.state !== "idle" && draft.state !== "finalizing") {
            draft.state = "finalizing";
            const finalized = await this.progressDraftManager.finalizeDraft(
              draft,
              Number(chatId),
              threadId ? Number(threadId) : undefined,
              bot,
              cleanMsgText,
              config,
              false,
              extraButtons
            );
            if (finalized) {
              this.sendResponse(ws, id, true, { sent: true, messageId: draft.messageId });
              break;
            }
            // finalizeDraft returned false — fell back, draft cleared. Fall through to fresh send.
          }

          // FALLBACK: Send as a new message (either no active draft, or finalize fell back)
          const inlineKeyboard = [
            [
              { text: "🧠 Show Thoughts", callback_data: `thoughts:show:${draft.startedAt}` },
              { text: "📋 Plan", callback_data: `plan:${draft.startedAt}` },
              { text: "🔁 Retry", callback_data: `retry:${draft.startedAt}` }
            ]
          ];

          const baseOptions: any = {};
          if (threadId) baseOptions.message_thread_id = threadId;
          baseOptions.reply_markup = { inline_keyboard: inlineKeyboard };

          // Tri-format fallback: Markdown → HTML → plain text
          const tryFormats = [
            { parse_mode: "Markdown" as const },
            { parse_mode: "HTML" as const },
            {}
          ];

          let sentMessageId: number | undefined;
          for (const fmt of tryFormats) {
            const options = { ...baseOptions, ...fmt };
            try {
              let resMsg;
              if (messageId) {
                resMsg = await bot.telegram.editMessageText(chatId, messageId, undefined, cleanText, options);
              } else {
                resMsg = await bot.telegram.sendMessage(chatId, cleanText, options);
              }
              sentMessageId = resMsg && typeof resMsg === "object" ? (resMsg as any).message_id : messageId;
              break; // Success — stop trying formats
            } catch (err: any) {
              const msg: string = err.message || "";
              if (msg.includes("message is not modified")) {
                sentMessageId = messageId;
                break;
              }
              if (msg.includes("can't parse") || msg.includes("Bad Request") || msg.includes("parse")) {
                continue; // Try next format
              }
              // Last resort: if we've tried all formats and still failing
              if (fmt === tryFormats[tryFormats.length - 1]) {
                console.error("[sendTelegramMessage] All format fallbacks exhausted:", err.message);
                throw new Error(`Telegram Send Failed: ${err.message}`);
              }
            }
          }

          this.sendResponse(ws, id, true, { sent: true, messageId: sentMessageId });
          break;
        }

        case "busPublish": {
          const { topic, message } = params;
          if (!topic || !message) {
            throw new Error("Missing parameters 'topic' or 'message'");
          }

          // Intercept broadcast signals to write to SHARED/SIGNALS.md
          if (topic === "agent:broadcast-signal" || topic === "agent:broadcast") {
            const sharedDir = join(homedir(), ".komorebi", "SHARED");
            const signalsPath = join(sharedDir, "SIGNALS.md");
            const timestamp = new Date().toISOString();
            const logEntry = `\n- [${timestamp}] Agent [${message.from || "unknown"}]: ${message.content || message.text || ""}\n`;
            
            withFileLock(signalsPath, async () => {
              const currentContent = existsSync(signalsPath) ? readFileSync(signalsPath, "utf-8") : "";
              writeFileSync(signalsPath, currentContent + logEntry, "utf-8");
            }).catch(err => {
              console.error("[GatewayWsServer] Broadcast lock write failed:", err);
            });
          }

          this.publishToBus(topic, message);
          this.sendResponse(ws, id, true, { published: true });
          break;
        }

        case "logFeedback": {
          const { agentId, text } = params;
          if (!agentId || !text) {
            throw new Error("Missing parameters 'agentId' or 'text'");
          }
          const sharedDir = join(homedir(), ".komorebi", "SHARED");
          const feedbackPath = join(sharedDir, "FEEDBACK-LOG.md");
          const timestamp = new Date().toISOString();
          const logEntry = `\n- [${timestamp}] Agent [${agentId}]: ${text}\n`;
          
          withFileLock(feedbackPath, async () => {
            const currentContent = existsSync(feedbackPath) ? readFileSync(feedbackPath, "utf-8") : "";
            writeFileSync(feedbackPath, currentContent + logEntry, "utf-8");
          }).then(() => {
            this.sendResponse(ws, id, true, { success: true });
          }).catch(err => {
            this.sendResponse(ws, id, false, { error: err.message });
          });
          break;
        }

        case "busSubscribe": {
          const { topic } = params;
          if (!topic) {
            throw new Error("Missing parameter 'topic'");
          }
          this.subscribeToBus(ws, topic);
          this.sendResponse(ws, id, true, { subscribed: true });
          break;
        }

        case "getAgentProactivityStatus": {
          const { agentId } = params;
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          const memoryPath = join(agentDir, "proactivity", "memory.md");
          const domainsDir = join(agentDir, "proactivity", "domains");
          const logPath = join(agentDir, "proactivity", "log.md");

          let quieter = false;
          if (existsSync(memoryPath)) {
            const content = readFileSync(memoryPath, "utf-8");
            quieter = content.toLowerCase().includes("quieter: true");
          }

          const rules: any[] = [];
          if (existsSync(domainsDir)) {
            const files = readdirSync(domainsDir).filter(f => f.endsWith(".md"));
            for (const file of files) {
              const domain = file.replace(".md", "");
              const content = readFileSync(join(domainsDir, file), "utf-8");
              const lines = content.split("\n");
              for (const line of lines) {
                const match = line.match(/-\s*Pattern:\s*(.*?)\s*\|\s*Tier:\s*(\w+)/i);
                if (match) {
                  rules.push({ domain, pattern: match[1].trim(), tier: match[2].trim() });
                }
              }
            }
          }

          let logEntries: string[] = [];
          if (existsSync(logPath)) {
            const content = readFileSync(logPath, "utf-8");
            logEntries = content.split("\n").filter(l => l.startsWith("|") && !l.includes("Timestamp"));
          }

          this.sendResponse(ws, id, true, { quieter, rules, logEntries });
          break;
        }

        case "toggleQuieterMode": {
          const { agentId, value } = params;
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          const memoryPath = join(agentDir, "proactivity", "memory.md");
          if (existsSync(memoryPath)) {
            let content = readFileSync(memoryPath, "utf-8");
            if (content.includes("quieter:")) {
              content = content.replace(/quieter:\s*\w+/gi, `quieter: ${value}`);
            } else {
              content += `\nquieter: ${value}\n`;
            }
            writeFileSync(memoryPath, content, "utf-8");
          }
          this.sendResponse(ws, id, true, { success: true, quieter: value });
          break;
        }

        case "resetAgentBoundaries": {
          const { agentId } = params;
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          const domainsDir = join(agentDir, "proactivity", "domains");
          if (existsSync(domainsDir)) {
            const files = readdirSync(domainsDir);
            for (const file of files) {
              const filePath = join(domainsDir, file);
              const stat = statSync(filePath);
              if (stat.isFile()) {
                rmSync(filePath);
              }
            }
          }
          const memoryPath = join(agentDir, "proactivity", "memory.md");
          if (existsSync(memoryPath)) {
            writeFileSync(
              memoryPath,
              `# Global Proactivity Settings\n\n## Global Default Tier\n- Default Tier: SUGGEST\n\n## Learned Rules\n- Pattern: .* | Tier: SUGGEST\n\nquieter: false\n`,
              "utf-8"
            );
          }
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "listActiveAgents": {
          // Discovery Mechanism returning active agents list
          const activeList = this.poolManager.getStatusList()
            .filter(a => a.status === "running")
            .map(a => ({
              agentId: a.agentId,
              sessionId: a.sessionId,
              status: a.status,
            }));
          this.sendResponse(ws, id, true, activeList);
          break;
        }

        case "requestCommandApproval": {
          const { agentId, command } = params;
          if (!agentId || !command) {
            throw new Error("Missing parameters 'agentId' or 'command'");
          }

          const sessionId = this.sessionManager.getSessionIdForConnection(ws) || "";
          const isTelegram = sessionId.startsWith("telegram:") || (sessionId.startsWith("agent:") && sessionId.includes(":telegram:"));
          if (!isTelegram) {
            // Auto-approve if not running inside an active Telegram chat session
            this.sendResponse(ws, id, true, { approved: true });
            break;
          }

          const parts = sessionId.split(":");
          const chatId = sessionId.startsWith("agent:") ? parts[4] : parts[1];
          const threadId = sessionId.startsWith("agent:") ? undefined : parts[2];

          const bot = this.getTelegramBot(agentId);
          if (!bot) {
            this.sendResponse(ws, id, true, { approved: true });
            break;
          }

          console.log(`[Approval Gating] Requesting command approval for agent '${agentId}' in chat '${chatId}': "${command}"`);

          const config = this.progressDraftManager.getAgentProgressConfig(agentId, this.globalConfig);
          if (config.mode !== "off") {
            await this.progressDraftManager.handleEvent(
              Number(chatId),
              threadId ? Number(threadId) : undefined,
              bot,
              {
                type: "approval_wait",
                timestamp: Date.now(),
                toolName: command,
                agentId
              },
              config
            );
          }

          const msgText = `⚠️ *Security Alert* ⚠️\nAgent *${agentId}* is requesting to execute the following shell command:\n\n\`\`\`bash\n${command}\n\`\`\`\n\nApprove execution?`;
          
          const extra: any = {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Approve", callback_data: `exec:approve:${id}` },
                  { text: "❌ Deny", callback_data: `exec:deny:${id}` }
                ]
              ]
            }
          };

          if (threadId) {
            extra.message_thread_id = Number(threadId);
          }

          await bot.telegram.sendMessage(chatId, msgText, extra);

          // Suspend agent ReAct execution loop by adding resolve handler
          this.pendingCommandApprovals.set(id, {
            resolve: (approved: boolean) => {
              this.sendResponse(ws, id, true, { approved });
            }
          });
          break;
        }

        case "requestBoundaryApproval": {
          const { agentId, sessionId, chatId, threadId, action, domain, pattern } = params;
          const bot = this.getTelegramBot(agentId);
          if (!bot || !chatId || chatId === "0" || chatId === 0) {
            this.sendResponse(ws, id, true, { choice: "suggest" });
            break;
          }

          const msgText = `🧠 *Boundary Decision Required* 🧠\nAgent *${agentId}* wants to proactively perform:\n\`${action}\`\n\nShould the agent do this automatically, suggest it first, or block it?`;

          const extra: any = {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ DO (Auto)", callback_data: `boundary:do:${domain}:${pattern}:${id}` },
                  { text: "💬 SUGGEST", callback_data: `boundary:suggest:${domain}:${pattern}:${id}` },
                  { text: "❌ NEVER", callback_data: `boundary:never:${domain}:${pattern}:${id}` }
                ]
              ]
            }
          };

          if (threadId) {
            extra.message_thread_id = Number(threadId);
          }

          await bot.telegram.sendMessage(chatId, msgText, extra);

          this.pendingBoundaryApprovals.set(id, {
            resolve: (choice: string) => {
              this.sendResponse(ws, id, true, { choice });
            }
          });
          break;
        }

        case "getAgentsTelemetry": {
          this.sendResponse(ws, id, true, this.poolManager.getStatusList());
          break;
        }

        case "getAgentStats": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const statusList = this.poolManager.getStatusList();
          const inst = statusList.find(x => x.agentId === agentId);
          
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          const moodPath = join(agentDir, "mood.json");
          let moodData: any = { mood: "idle", turnCount: 0, uptimeSeconds: 0, lastActive: Date.now() };
          
          if (existsSync(moodPath)) {
            try {
              moodData = JSON.parse(readFileSync(moodPath, "utf-8"));
            } catch {}
          }

          const isActive = this.messagePipeline.hasActiveRunsForAgent(agentId);

          let latestThoughts = "";
          try {
            const today = new Date().toISOString().split("T")[0];
            const thinkPath = join(agentDir, "memory", `${today}-think.md`);
            if (existsSync(thinkPath)) {
              const content = readFileSync(thinkPath, "utf-8").trim();
              if (content) {
                const sections = content.split("## ").filter(s => s.trim());
                if (sections.length > 0) {
                  const lastSection = sections[sections.length - 1];
                  latestThoughts = lastSection.replace(/^\[[^\]]+\]\n/, "").trim().slice(0, 180);
                  if (lastSection.length > 180) latestThoughts += "...";
                }
              }
            }
          } catch {}

          this.sendResponse(ws, id, true, {
            status: inst ? inst.status : "idle",
            pid: inst ? inst.pid : null,
            ramUsageMb: inst ? inst.ramUsageMb : 0,
            cpuPercent: inst ? inst.cpuPercent : 0,
            uptimeMs: inst ? inst.uptimeMs : 0,
            restarts: inst ? inst.restarts : 0,
            mood: isActive ? (moodData.mood || "focused") : "idle",
            turnCount: moodData.turnCount,
            lastActive: moodData.lastActive,
            latestThoughts: latestThoughts || undefined
          });
          break;
        }

        case "getFleetIntelligence": {
          const agentList: any[] = this.globalConfig.agents || [];
          const result: Record<string, any> = {};

          for (const agent of agentList) {
            const agentDir = join(homedir(), ".komorebi", "agents", agent.id);

            let totalCount = 0;
            let successCount = 0;
            let skillSuccessRate = 0.85;

            const usageLogPath = join(agentDir, "skills", "usage-log.jsonl");
            if (existsSync(usageLogPath)) {
              try {
                const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n").filter(Boolean);
                const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                const used = entries.filter((e: any) => e.action === "use" || e.action === "load");
                for (const entry of used) {
                  totalCount++;
                  if (entry.success) successCount++;
                }
              } catch {}
            }

            const learningLogPath = join(agentDir, "learning.log");
            if (existsSync(learningLogPath)) {
              try {
                const lines = readFileSync(learningLogPath, "utf-8").trim().split("\n").filter(Boolean);
                const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                for (const entry of entries) {
                  totalCount++;
                  if (entry.success) successCount++;
                }
              } catch {}
            }

            if (totalCount > 0) {
              skillSuccessRate = successCount / totalCount;
            }

            let learnedSkillCount = 0;
            const learnedDir = join(agentDir, "skills", "learned");
            if (existsSync(learnedDir)) {
              try {
                learnedSkillCount = readdirSync(learnedDir, { withFileTypes: true })
                  .filter(entry => entry.isDirectory() && entry.name !== "_archive" && !entry.name.startsWith("."))
                  .length;
              } catch {}
            }

            let memorySizeKb = 0;
            const memoryPath = join(agentDir, "MEMORY.md");
            if (existsSync(memoryPath)) {
              try { memorySizeKb = Math.round(statSync(memoryPath).size / 1024); } catch {}
            }

            let totalTurns = 0;
            const moodPath = join(agentDir, "mood.json");
            if (existsSync(moodPath)) {
              try { totalTurns = JSON.parse(readFileSync(moodPath, "utf-8")).turnCount || 0; } catch {}
            }

            let lastCuration: number | null = null;
            const curationStatePath = join(agentDir, "skills", "curation-state.json");
            if (existsSync(curationStatePath)) {
              try { lastCuration = JSON.parse(readFileSync(curationStatePath, "utf-8")).lastCuration || null; } catch {}
            }

            result[agent.id] = { skillSuccessRate, learnedSkillCount, memorySizeKb, totalTurns, lastCuration };
          }

          this.sendResponse(ws, id, true, { agents: result });
          break;
        }

        case "getAgentAdvancedStats": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          if (!existsSync(agentDir)) {
            throw new Error("Agent directory not found");
          }

          const logPath = join(agentDir, "learning.log");
          const driftPath = join(agentDir, "prompt-drift.json");
          const histPath = join(agentDir, "skills", "performance-histogram.json");

          let learningLog: any[] = [];
          if (existsSync(logPath)) {
            try {
              const content = readFileSync(logPath, "utf-8");
              learningLog = content.trim().split("\n").map(line => JSON.parse(line));
            } catch {}
          }

          let promptDrift: any[] = [];
          if (existsSync(driftPath)) {
            try {
              promptDrift = JSON.parse(readFileSync(driftPath, "utf-8"));
            } catch {}
          }

          let histogram: any = {};
          if (existsSync(histPath)) {
            try {
              histogram = JSON.parse(readFileSync(histPath, "utf-8"));
            } catch {}
          }

          this.sendResponse(ws, id, true, { learningLog, promptDrift, histogram });
          break;
        }

        case "getSystemHealth": {
          const watchdog = GatewayWatchdog.getInstance();
          const agents: Record<string, any> = {};
          for (const agent of this.globalConfig.agents) {
            agents[agent.id] = watchdog.getAgentHealthData(agent.id);
          }
          const healthData = {
            gatewayStartTime: this.gatewayStartTime,
            systemUptimeMs: Date.now() - this.gatewayStartTime,
            failedHeartbeats: (watchdog as any).failedHeartbeats,
            agents
          };
          this.sendResponse(ws, id, true, healthData);
          break;
        }

        case "resumeAgent": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const ok = GatewayWatchdog.getInstance().resumeAgent(agentId, "Resumed via SRE WebSocket RPC override");
          this.sendResponse(ws, id, true, { success: ok });
          break;
        }

        case "curateAgentSkills": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const agentList: any[] = this.globalConfig.agents || [];
          const agent = agentList.find(a => a.id === agentId);
          if (!agent) {
            throw new Error(`Agent '${agentId}' not found in configuration`);
          }

          const { LearningCurator } = await import("./learning-curator.js");
          const curator = new LearningCurator(this.globalConfig);
          await curator.curateAgent(agent);
          this.sendResponse(ws, id, true, { success: true, message: `Skill curation completed for agent '${agentId}'.` });
          break;
        }

        case "listAgentSkills": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");

          const agentSkillsDir = join(homedir(), ".komorebi", "agents", agentId, "skills");
          const globalSkillsDir = join(homedir(), ".komorebi", "shared-skills");
          const agentPluginsDir = join(homedir(), ".komorebi", "agents", agentId, "plugins");
          const globalPluginsDir = join(homedir(), ".komorebi", "shared-plugins");

          const listSkills = (dir: string, scope: "local" | "global") => {
            if (!existsSync(dir)) return [];
            try {
              return readdirSync(dir, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && entry.name !== ".clawhub")
                .map(entry => {
                  const skillMdPath = join(dir, entry.name, "SKILL.md");
                  let description = "";
                  let version = "";
                  let publisher = "";
                  let verified = false;
                  if (existsSync(skillMdPath)) {
                    try {
                      const content = readFileSync(skillMdPath, "utf-8");
                      const manifest = parseSkillManifest(content);
                      description = manifest.description;
                      version = manifest.version;
                      publisher = manifest.publisher;
                      verified = manifest.verified;
                    } catch {}
                  }
                  const trustJsonPath = join(dir, entry.name, ".trust", "trust.json");
                  let trustScore = "UNKNOWN";
                  let trustFindings: string[] = [];
                  if (existsSync(trustJsonPath)) {
                    try {
                      const trustObj = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
                      trustScore = trustObj.score || "UNKNOWN";
                      trustFindings = trustObj.findings || [];
                    } catch {}
                  }

                  return {
                    name: entry.name,
                    description,
                    version,
                    publisher,
                    verified,
                    scope,
                    trustScore,
                    trustFindings
                  };
                });
            } catch {
              return [];
            }
          };

          const listPlugins = (dir: string, scope: "local" | "global") => {
            if (!existsSync(dir)) return [];
            try {
              return readdirSync(dir, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && entry.name !== ".clawhub")
                .map(entry => {
                  const pluginJsonPath = existsSync(join(dir, entry.name, "plugin.json"))
                    ? join(dir, entry.name, "plugin.json")
                    : join(dir, entry.name, "manifest.json");
                  let description = "";
                  let version = "";
                  let publisher = "";
                  let verified = false;
                  if (existsSync(pluginJsonPath)) {
                    try {
                      const jsonContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
                      description = jsonContent.description || "";
                      version = jsonContent.version || "";
                      publisher = jsonContent.publisher || "";
                      verified = jsonContent.verified || false;
                    } catch {}
                  }
                  const trustJsonPath = join(dir, entry.name, ".trust", "trust.json");
                  let trustScore = "UNKNOWN";
                  let trustFindings: string[] = [];
                  if (existsSync(trustJsonPath)) {
                    try {
                      const trustObj = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
                      trustScore = trustObj.score || "UNKNOWN";
                      trustFindings = trustObj.findings || [];
                    } catch {}
                  }

                  return {
                    name: entry.name,
                    description,
                    version,
                    publisher,
                    verified,
                    scope,
                    trustScore,
                    trustFindings
                  };
                });
            } catch {
              return [];
            }
          };

          const localSkills = listSkills(agentSkillsDir, "local");
          const globalSkills = listSkills(globalSkillsDir, "global");
          const localPlugins = listPlugins(agentPluginsDir, "local");
          const globalPlugins = listPlugins(globalPluginsDir, "global");

          const usageMap = new Map<string, { count: number; successCount: number; lastUsed: number }>();
          const usageLogPath = join(agentSkillsDir, "usage-log.jsonl");
          if (existsSync(usageLogPath)) {
            try {
              const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n");
              for (const line of lines) {
                if (!line) continue;
                const entry = JSON.parse(line);
                const stats = usageMap.get(entry.slug) || { count: 0, successCount: 0, lastUsed: 0 };
                stats.count++;
                if (entry.success) stats.successCount++;
                if (entry.timestamp > stats.lastUsed) stats.lastUsed = entry.timestamp;
                usageMap.set(entry.slug, stats);
              }
            } catch {}
          }

          const listLearnedSkills = (isArchive: boolean) => {
            const dir = isArchive 
              ? join(agentSkillsDir, "learned", "_archive")
              : join(agentSkillsDir, "learned");
            
            if (!existsSync(dir)) return [];
            try {
              return readdirSync(dir, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && entry.name !== "_archive")
                .map(entry => {
                  const skillMdPath = join(dir, entry.name, "SKILL.md");
                  let name = entry.name;
                  let description = "Extracted learned workflow.";
                  let status = isArchive ? "archived" : "active";
                  let triggerType = "complexity";
                  let createdDate = new Date().toISOString().split("T")[0];

                  if (existsSync(skillMdPath)) {
                    try {
                      const content = readFileSync(skillMdPath, "utf-8");
                      const nameMatch = content.match(/^#\s+(.+)$/m);
                      if (nameMatch) name = nameMatch[1].trim();

                      const descMatch = content.match(/description:\s*["'](.+?)["']/i);
                      if (descMatch) description = descMatch[1].trim();

                      if (content.includes("status: battle-tested")) {
                        status = "promoted";
                      }

                      const stat = statSync(skillMdPath);
                      const time = (stat.birthtimeMs && stat.birthtimeMs > 0) ? stat.birthtime : stat.mtime;
                      createdDate = time.toISOString().split("T")[0];
                      
                      if (entry.name.includes("recovery")) {
                        triggerType = "recovery";
                      } else if (entry.name.includes("correction")) {
                        triggerType = "correction";
                      }
                    } catch {}
                  }

                  const stats = usageMap.get(entry.name.toLowerCase()) || { count: 0, successCount: 0 };
                  const successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 100;

                  return {
                    name,
                    slug: entry.name.toLowerCase(),
                    description,
                    status,
                    triggerType,
                    createdDate,
                    usageCount: stats.count,
                    successRate,
                    isArchive
                  };
                });
            } catch {
              return [];
            }
          };

          const learnedSkills = [
            ...listLearnedSkills(false),
            ...listLearnedSkills(true)
          ];

          this.sendResponse(ws, id, true, {
            skills: [...localSkills, ...globalSkills],
            plugins: [...localPlugins, ...globalPlugins],
            learnedSkills
          });
          break;
        }

        case "getAgentSkillsHealth": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const list: Record<string, any> = {};
          const wsAgent = this.sessionManager.getAgentConnection(`${agentId}:chat:web_test`);
          if (wsAgent && wsAgent.readyState === WebSocket.OPEN) {
            const result = await this.sendRequest(wsAgent, "getSkillsHealth", {});
            this.sendResponse(ws, id, true, result);
          } else {
            this.sendResponse(ws, id, true, {});
          }
          break;
        }

        case "listClawhubLicenses": {
          const configPath = join(homedir(), ".komorebi", "komorebi.json");
          let licenses: string[] = [];
          if (existsSync(configPath)) {
            try {
              const config = JSON.parse(readFileSync(configPath, "utf-8"));
              licenses = config.licenses || [];
            } catch {}
          }
          this.sendResponse(ws, id, true, { licenses });
          break;
        }

        case "searchClawhubSkills": {
          const { query } = params;
          const client = new ClawHubClient();
          const results = await client.search(query || "");
          this.sendResponse(ws, id, true, { results });
          break;
        }

        case "installSkill": {
          const { agentId, packageUrl, type, name } = params;
          if (!agentId || !packageUrl) {
            throw new Error("Missing parameter: packageUrl");
          }
          const projectRoot = join(__dirname, "..", "..");
          const installer = new SkillInstaller(projectRoot);
          const result = await installer.install(packageUrl, {
            agentId: agentId === "global" ? undefined : agentId,
            global: agentId === "global",
            force: true
          });
          if (result.success && agentId && agentId !== "global") {
            const isPlugin = result.manifest?.category?.toLowerCase() === "plugin";
            const skillName = result.manifest?.name || packageUrl.split("/").pop() || packageUrl;
            const skillPath = isPlugin
              ? join(homedir(), ".komorebi", "agents", agentId, "plugins", skillName)
              : join(homedir(), ".komorebi", "agents", agentId, "skills", skillName);
            
            this.sessionManager.broadcastToAgent(agentId, {
              type: "evt",
              event: "skillHotReload",
              data: { skillName, skillPath }
            });
          }
          this.sendResponse(ws, id, true, result);
          break;
        }

        case "uninstallSkill": {
          const { agentId, type, name } = params;
          if (!agentId || !type || !name) {
            throw new Error("Missing parameters for uninstallSkill");
          }
          const destination = join(homedir(), ".komorebi", "agents", agentId, "skills");
          const skillDir = join(destination, name);
          if (existsSync(skillDir)) {
            rmSync(skillDir, { recursive: true, force: true });
          }
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "listAgentFiles": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          
          const agent = this.globalConfig.agents?.find((a: any) => a.id === agentId);
          let workspace = agent?.workspace;
          if (!workspace) {
            workspace = join(homedir(), ".komorebi", "agents", agentId);
          }

          if (!existsSync(workspace)) {
            this.sendResponse(ws, id, true, { files: [] });
            break;
          }

          const getMdFilesRecursive = (dir: string, baseDir: string = dir): string[] => {
            let results: string[] = [];
            if (!existsSync(dir)) return results;
            const list = readdirSync(dir);
            for (const file of list) {
              const filePath = join(dir, file);
              const stat = statSync(filePath);
              if (stat.isDirectory()) {
                results = results.concat(getMdFilesRecursive(filePath, baseDir));
              } else if (file.toLowerCase().endsWith(".md")) {
                const relativePath = filePath.substring(baseDir.length).replace(/^[\\\/]/, "");
                results.push(relativePath);
              }
            }
            return results;
          };

          const files = getMdFilesRecursive(workspace);
          this.sendResponse(ws, id, true, { files });
          break;
        }

        case "readAgentFile": {
          const { agentId, filename } = params;
          if (!agentId || !filename) throw new Error("Missing parameters for readAgentFile");
          const agent = this.globalConfig.agents?.find((a: any) => a.id === agentId);
          let workspace = agent?.workspace;
          if (!workspace) {
            workspace = join(homedir(), ".komorebi", "agents", agentId);
          }
          const filePath = join(workspace, filename);
          if (!existsSync(filePath)) {
            throw new Error(`File '${filename}' not found for agent '${agentId}'`);
          }
          const content = readFileSync(filePath, "utf-8");
          this.sendResponse(ws, id, true, { content });
          break;
        }

        case "writeAgentFile": {
          const { agentId, filename, content } = params;
          if (!agentId || !filename || content === undefined) {
            throw new Error("Missing parameters for writeAgentFile");
          }
          const agent = this.globalConfig.agents?.find((a: any) => a.id === agentId);
          let workspace = agent?.workspace;
          if (!workspace) {
            workspace = join(homedir(), ".komorebi", "agents", agentId);
          }
          const filePath = join(workspace, filename);
          const dirPath = dirname(filePath);
          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }
          writeFileSync(filePath, content, "utf-8");
          this.sendResponse(ws, id, true, { success: true });
          break;
        }

        case "getAgentContext": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          
          let resolvedMode = "unknown";
          let activeSignals: any[] = [];
          try {
            const baseUrl = `http://127.0.0.1:${this.port}`;
            const res = await fetch(`${baseUrl}/api/agents/${agentId}/context?token=${this.token}`);
            if (res.ok) {
              const contextData = await res.json() as any;
              resolvedMode = contextData.resolvedMode || "unknown";
              activeSignals = contextData.activeSignals || [];
            }
          } catch {}
          
          this.sendResponse(ws, id, true, { resolvedMode, activeSignals });
          break;
        }

        case "queryAgentModel": {
          const { agentId, systemInstruction, prompt } = params;
          if (!agentId || !prompt) {
            throw new Error("Missing parameters for queryAgentModel");
          }

          const sessionId = `${agentId}:chat:dashboard_${Date.now()}`;
          await this.sessionManager.ensureAgentRunning(agentId, sessionId);
          const wsAgent = this.sessionManager.getAgentConnection(sessionId);
          if (!wsAgent) {
            throw new Error(`Agent connection not active for ${agentId}`);
          }
          const result = await this.sendRequest(wsAgent, "queryModel", {
            systemInstruction: systemInstruction || "You are a helpful assistant.",
            prompt
          });
          
          try {
            this.sessionManager.terminateSession(sessionId);
          } catch {}

          this.sendResponse(ws, id, true, { success: true, text: result.text });
          break;
        }

        case "getAgentStats": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");

          const statusList = this.poolManager.getStatusList();
          const inst = statusList.find(x => x.agentId === agentId);
          
          const agentDir = join(homedir(), ".komorebi", "agents", agentId);
          const moodPath = join(agentDir, "mood.json");
          let moodData: any = { mood: "idle", turnCount: 0, uptimeSeconds: 0, lastActive: Date.now() };
          
          if (existsSync(moodPath)) {
            try {
              moodData = JSON.parse(readFileSync(moodPath, "utf-8"));
            } catch {}
          }

          const isActive = this.messagePipeline.hasActiveRunsForAgent(agentId);

          // Get latest reasoning thoughts from think.md
          let latestThoughts = "";
          try {
            const today = new Date().toISOString().split("T")[0];
            const thinkPath = join(agentDir, "memory", `${today}-think.md`);
            if (existsSync(thinkPath)) {
              const content = readFileSync(thinkPath, "utf-8").trim();
              if (content) {
                const sections = content.split("## ").filter(s => s.trim());
                if (sections.length > 0) {
                  const lastSection = sections[sections.length - 1];
                  latestThoughts = lastSection.replace(/^\[[^\]]+\]\n/, "").trim().slice(0, 180);
                  if (lastSection.length > 180) latestThoughts += "...";
                }
              }
            }
          } catch {}

          this.sendResponse(ws, id, true, {
            status: inst ? inst.status : "idle",
            pid: inst ? inst.pid : null,
            ramUsageMb: inst ? inst.ramUsageMb : 0,
            cpuPercent: inst ? inst.cpuPercent : 0,
            uptimeMs: inst ? inst.uptimeMs : 0,
            restarts: inst ? inst.restarts : 0,
            mood: isActive ? (moodData.mood || "focused") : "idle",
            turnCount: moodData.turnCount,
            lastActive: moodData.lastActive,
            latestThoughts: latestThoughts || undefined
          });
          break;
        }

        case "getSystemIntelligence": {
          const agentList: any[] = this.globalConfig.agents || [];
          const result: Record<string, any> = {};

          for (const agent of agentList) {
            const agentDir = join(homedir(), ".komorebi", "agents", agent.id);

            let totalCount = 0;
            let successCount = 0;
            let skillSuccessRate = 0.85;

            const usageLogPath = join(agentDir, "skills", "usage-log.jsonl");
            if (existsSync(usageLogPath)) {
              try {
                const lines = readFileSync(usageLogPath, "utf-8").trim().split("\n").filter(Boolean);
                const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                const used = entries.filter((e: any) => e.action === "use" || e.action === "load");
                for (const entry of used) {
                  totalCount++;
                  if (entry.success) successCount++;
                }
              } catch {}
            }

            const learningLogPath = join(agentDir, "learning.log");
            if (existsSync(learningLogPath)) {
              try {
                const lines = readFileSync(learningLogPath, "utf-8").trim().split("\n").filter(Boolean);
                const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                for (const entry of entries) {
                  totalCount++;
                  if (entry.success) successCount++;
                }
              } catch {}
            }

            if (totalCount > 0) {
              skillSuccessRate = successCount / totalCount;
            }

            let learnedSkillCount = 0;
            const learnedDir = join(agentDir, "skills", "learned");
            if (existsSync(learnedDir)) {
              try {
                learnedSkillCount = readdirSync(learnedDir, { withFileTypes: true })
                  .filter(entry => entry.isDirectory() && entry.name !== "_archive" && !entry.name.startsWith("."))
                  .length;
              } catch {}
            }

            let memorySizeKb = 0;
            const memoryPath = join(agentDir, "MEMORY.md");
            if (existsSync(memoryPath)) {
              try { memorySizeKb = Math.round(statSync(memoryPath).size / 1024); } catch {}
            }

            let totalTurns = 0;
            const moodPath = join(agentDir, "mood.json");
            if (existsSync(moodPath)) {
              try { totalTurns = JSON.parse(readFileSync(moodPath, "utf-8")).turnCount || 0; } catch {}
            }

            let lastCuration: number | null = null;
            const curationStatePath = join(agentDir, "skills", "curation-state.json");
            if (existsSync(curationStatePath)) {
              try { lastCuration = JSON.parse(readFileSync(curationStatePath, "utf-8")).lastCuration || null; } catch {}
            }

            result[agent.id] = { skillSuccessRate, learnedSkillCount, memorySizeKb, totalTurns, lastCuration };
          }

          this.sendResponse(ws, id, true, { agents: result });
          break;
        }

        case "restartAgent": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");

          const statusList = this.poolManager.getStatusList();
          const inst = statusList.find(x => x.agentId === agentId);

          if (inst) {
            this.poolManager.terminateSession(inst.sessionId);
            await this.poolManager.ensureAgentRunning(agentId, inst.sessionId);
            this.sendResponse(ws, id, true, { success: true, message: `Agent session ${inst.sessionId} restarted.` });
          } else {
            const sessionId = `web_console:${Date.now()}`;
            await this.poolManager.ensureAgentRunning(agentId, sessionId);
            this.sendResponse(ws, id, true, { success: true, message: `Started new agent session ${sessionId}.` });
          }
          break;
        }

        case "restartGateway": {
          this.sendResponse(ws, id, true, { success: true, message: "Restarting Gateway daemon..." });
          setTimeout(() => {
            try {
              execSync("sudo systemctl restart komorebi-gateway");
            } catch {
              process.exit(0);
            }
          }, 500);
          break;
        }

        case "getAgentAdvancedStats": {
          const { agentId } = params;
          if (!agentId) throw new Error("Missing parameter 'agentId'");
          const agent = this.globalConfig.agents?.find((a: any) => a.id === agentId);
          let workspace = agent?.workspace;
          if (!workspace) {
            workspace = join(homedir(), ".komorebi", "agents", agentId);
          }

          if (!existsSync(workspace)) {
            this.sendResponse(ws, id, true, { learningLog: [], promptDrift: [], histogram: {} });
            break;
          }

          const logPath = join(workspace, "learning.log");
          const driftPath = join(workspace, "prompt-drift.json");
          const histPath = join(workspace, "skills", "performance-histogram.json");

          let learningLog: any[] = [];
          if (existsSync(logPath)) {
            try {
              const content = readFileSync(logPath, "utf-8");
              learningLog = content.trim().split("\n").map(line => JSON.parse(line));
            } catch {}
          }

          let promptDrift: any[] = [];
          if (existsSync(driftPath)) {
            try {
              promptDrift = JSON.parse(readFileSync(driftPath, "utf-8"));
            } catch {}
          }

          let histogram: any = {};
          if (existsSync(histPath)) {
            try {
              histogram = JSON.parse(readFileSync(histPath, "utf-8"));
            } catch {}
          }

          this.sendResponse(ws, id, true, { learningLog, promptDrift, histogram });
          break;
        }

        case "listPairings": {
          const { agentId, pendingOnly } = params;
          const { listPairings } = await import("./pairing-db.js");
          const pairings = listPairings(agentId, pendingOnly);
          this.sendResponse(ws, id, true, pairings);
          break;
        }

        case "approvePairing": {
          const { code, agentId } = params;
          if (!code || !agentId) {
            throw new Error("Missing required parameters: code, agentId");
          }
          const { approvePairing } = await import("./pairing-db.js");
          const pairing = approvePairing(code, agentId);
          this.sendResponse(ws, id, true, pairing);
          break;
        }

        default:
          throw new Error(`Unknown RPC method: ${method}`);
      }
    } catch (error: any) {
      console.error(`[GatewayWsServer] Error in RPC method ${method}:`, error);
      this.sendResponse(ws, id, false, undefined, error.message);
    }
  }

  private handleClientResponse(res: RpcResponse) {
    const handler = this.pendingRequests.get(res.id);
    if (handler) {
      this.pendingRequests.delete(res.id);
      if (res.ok) {
        handler.resolve(res.payload);
      } else {
        handler.reject(new Error(res.error || "Unknown RPC error"));
      }
    }
  }

  private handleClientEvent(evt: any) {
    const { event, data } = evt;
    console.log(`[GatewayWsServer] Event received [${event}]:`, JSON.stringify(data));
  }

  public sendRequest<T = any>(ws: WebSocket, method: string, params: any): Promise<T> {
    const id = crypto.randomUUID();
    if (method === "handleMessage" && params.sessionKey) {
      this.lastActivityTimes.set(params.sessionKey, Date.now());
      this.runClosingReflections.delete(params.sessionKey);
    }
    return new Promise<T>((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("Cannot send RPC request: WebSocket is not open"));
      }

      this.pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  private sendResponse(ws: WebSocket, id: string, ok: boolean, payload?: any, error?: string) {
    ws.send(JSON.stringify({ type: "res", id, ok, payload, error }));
  }

  private subscribeToBus(ws: WebSocket, topic: string) {
    let subs = this.busSubscriptions.get(topic);
    if (!subs) {
      subs = new Set<WebSocket>();
      this.busSubscriptions.set(topic, subs);
    }
    subs.add(ws);
  }
  /**
   * Directly delivers a Telegram message for a given agent bypassing the pipeline.
   * Used by the cron scheduler to guarantee Telegram delivery of cron run summaries.
   * Tries Markdown first, then falls back to plain text if parsing fails.
   */
  public async sendDirectTelegram(agentId: string, chatId: number, text: string): Promise<void> {
    const bot = this.getTelegramBot(agentId);
    if (!bot) {
      console.warn(`[GatewayWsServer] sendDirectTelegram: no bot registered for agent '${agentId}'. Message not sent.`);
      return;
    }
    const cleanText = text?.trim() || "(no content)";
    try {
      await bot.telegram.sendMessage(chatId, cleanText, { parse_mode: "Markdown" });
      console.log(`[GatewayWsServer] ✅ sendDirectTelegram delivered to chatId=${chatId} for agent '${agentId}'`);
    } catch (mdErr: any) {
      console.warn(`[GatewayWsServer] sendDirectTelegram Markdown failed, retrying plain text:`, mdErr.message);
      try {
        await bot.telegram.sendMessage(chatId, cleanText);
        console.log(`[GatewayWsServer] ✅ sendDirectTelegram (plain) delivered to chatId=${chatId} for agent '${agentId}'`);
      } catch (plainErr: any) {
        console.error(`[GatewayWsServer] ❌ sendDirectTelegram failed completely for agent '${agentId}':`, plainErr.message);
      }
    }
  }

  public publishToBus(topic: string, message: any) {
    const payloadStr = JSON.stringify({ type: "evt", event: "busMessage", data: { topic, message } });

    // Send to exact topic subscribers
    const exactSubs = this.busSubscriptions.get(topic);
    if (exactSubs) {
      for (const client of exactSubs) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payloadStr);
        }
      }
    }

    // Send to wildcard '*' subscribers
    const wildcardSubs = this.busSubscriptions.get("*");
    if (wildcardSubs) {
      for (const client of wildcardSubs) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payloadStr);
        }
      }
    }
  }

  private removeConnectionFromBus(ws: WebSocket) {
    for (const [topic, subs] of this.busSubscriptions.entries()) {
      if (subs.has(ws)) {
        subs.delete(ws);
        if (subs.size === 0) {
          this.busSubscriptions.delete(topic);
        }
      }
    }
  }

  public resolveCommandApproval(frameId: string, approved: boolean) {
    const pending = this.pendingCommandApprovals.get(frameId);
    if (pending) {
      this.pendingCommandApprovals.delete(frameId);
      pending.resolve(approved);
    }
  }

  public resolveBoundaryApproval(id: string, choice: string) {
    const pending = this.pendingBoundaryApprovals.get(id);
    if (pending) {
      this.pendingBoundaryApprovals.delete(id);
      pending.resolve(choice);
    }
  }

  private checkHeartbeatTasks() {
    console.log("[GatewayWsServer] Running periodic heartbeat task checks...");
    const agentsDir = join(homedir(), ".komorebi", "agents");
    const agentIds = this.globalConfig.agents.map(a => a.id);
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const matchCron = (expr: string): boolean => {
      const parts = expr.split(/\s+/);
      if (parts.length < 2) return false;
      const minField = parts[0];
      const hourField = parts[1];

      const matchField = (field: string, val: number) => {
        if (field === "*") return true;
        if (field.startsWith("*/")) {
          const step = parseInt(field.split("/")[1], 10);
          return val % step === 0;
        }
        return parseInt(field, 10) === val;
      };

      return matchField(minField, currentMinute) && matchField(hourField, currentHour);
    };

    for (const agentId of agentIds) {
      // Trigger general agent heartbeat WakeEvent
      const heartbeatSessionId = `${agentId}:chat:heartbeat_persistent`;
      const wakeEvent = {
        type: "heartbeat" as const,
        sessionId: heartbeatSessionId,
        agentId,
        payload: {
          cadence: "30m",
          message: "Periodic heartbeat tick"
        },
        timestamp: Date.now()
      };
      this.messagePipeline.handleWakeEvent(wakeEvent).catch(err => {
        console.error(`[Heartbeat - ${agentId}] Heartbeat wake event trigger failed:`, err);
      });

      const heartbeatPath = join(agentsDir, agentId, "HEARTBEAT.md");
      if (existsSync(heartbeatPath)) {
        try {
          const content = readFileSync(heartbeatPath, "utf-8");
          const lines = content.split("\n");
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith("#")) continue;
            
            const parts = cleanLine.split("|");
            if (parts.length >= 2) {
              const cronExpr = parts[0].trim();
              const promptText = parts[1].trim();
              
              if (matchCron(cronExpr)) {
                console.log(`[Heartbeat Tasks - ${agentId}] Triggering scheduled task: "${promptText}"`);
                this.triggerAgentScheduledTask(agentId, promptText);
              }
            }
          }
        } catch (err) {
          console.error(`[Heartbeat Tasks - ${agentId}] Error parsing HEARTBEAT.md:`, err);
        }
      }
    }
  }

  private async triggerAgentScheduledTask(agentId: string, promptText: string) {
    const sessionId = `${agentId}:chat:cron_${Date.now()}`;
    try {
      const envelope = {
        sender: { id: 0, firstName: "System", username: "heartbeat_daemon" },
        chatId: 0,
        content: promptText,
        attachments: [],
        channel: "web" as any,
        timestamp: Math.floor(Date.now() / 1000)
      };
      const wakeEvent = {
        type: "cron" as const,
        sessionId,
        agentId,
        payload: {
          message: promptText,
          cronExpression: "* * * * *",
          envelope
        },
        timestamp: Date.now()
      };
      await this.messagePipeline.handleWakeEvent(wakeEvent);
    } catch (err: any) {
      console.error(`[Heartbeat Trigger - ${agentId}] Failed to run scheduled task:`, err);
    }
  }

  public close() {
    clearInterval(this.heartbeatInterval);
    clearInterval(this.heartbeatTasksInterval);
    this.wss.close();
    this.server.close();
  }
}
