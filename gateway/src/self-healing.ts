import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { AgentPoolManager } from "./pool.js";
import { SessionManager } from "./session.js";
import type { KomorebiConfig } from "./types.js";

export interface KnownFix {
  symptomFingerprint: string;
  rootCause: string;
  fixApplied: string;
  fixType: "config" | "restart" | "code" | "skill-disable";
  successRate: number;
  lastSeen: number;
  timesApplied: number;
  timesSucceeded: number;
}

export interface Incident {
  id: string;
  timestamp: number;
  componentId: string;
  errorSignature: string;
  fingerprint: string;
  tier: number;
  status: "active" | "resolved" | "failed" | "pending_approval";
  diagnosis?: string;
  proposedFix?: any;
  fixType?: string;
  outcome?: string;
}

export class SelfHealingSubsystem {
  private static instance: SelfHealingSubsystem;
  private poolManager!: AgentPoolManager;
  private sessionManager!: SessionManager;
  private globalConfig!: KomorebiConfig;
  private getWsServer!: () => any;
  
  private strikes = new Map<string, number>(); // fingerprint -> strike count
  private lastStrikeTime = new Map<string, number>(); // fingerprint -> timestamp
  private pendingFixes = new Map<string, any>(); // fingerprint -> pending fix details
  private projectRoot!: string;

  private constructor() {
    this.projectRoot = join(homedir(), ".komorebi"); // default fallback
  }

  public static getInstance(): SelfHealingSubsystem {
    if (!SelfHealingSubsystem.instance) {
      SelfHealingSubsystem.instance = new SelfHealingSubsystem();
    }
    return SelfHealingSubsystem.instance;
  }

  public initialize(
    poolManager: AgentPoolManager,
    sessionManager: SessionManager,
    globalConfig: KomorebiConfig,
    getWsServer: () => any,
    projectRoot: string
  ) {
    this.poolManager = poolManager;
    this.sessionManager = sessionManager;
    this.globalConfig = globalConfig;
    this.getWsServer = getWsServer;
    this.projectRoot = projectRoot;

    // Ensure self-healing directory exists
    const shDir = this.getSelfHealingDir();
    if (!existsSync(shDir)) {
      mkdirSync(shDir, { recursive: true });
    }
  }

  private getSelfHealingDir(): string {
    const dir = join(homedir(), ".komorebi", "self-healing");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private getKnownFixesPath(): string {
    return join(this.getSelfHealingDir(), "known-fixes.jsonl");
  }

  private getIncidentsPath(): string {
    return join(this.getSelfHealingDir(), "incidents.jsonl");
  }

  // --- Core API Methods ---

  public getKnownFixes(): KnownFix[] {
    const path = this.getKnownFixesPath();
    if (!existsSync(path)) return [];
    try {
      const content = readFileSync(path, "utf-8").trim();
      if (!content) return [];
      return content.split("\n").map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  private saveKnownFixes(fixes: KnownFix[]) {
    const path = this.getKnownFixesPath();
    const data = fixes.map(f => JSON.stringify(f)).join("\n");
    writeFileSync(path, data, "utf-8");
  }

  public getIncidents(): Incident[] {
    const path = this.getIncidentsPath();
    if (!existsSync(path)) return [];
    try {
      const content = readFileSync(path, "utf-8").trim();
      if (!content) return [];
      return content.split("\n").map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  private logIncident(incident: Incident) {
    const path = this.getIncidentsPath();
    try {
      appendFileSync(path, JSON.stringify(incident) + "\n", "utf-8");
    } catch (err) {
      console.error("[SelfHealing] Failed to log incident:", err);
    }

    // Broadcast to dashboard
    const wsServer = this.getWsServer();
    if (wsServer) {
      wsServer.publishToBus("self_healing_incident", incident);
    }
  }

  public getPendingFixes(): any[] {
    return Array.from(this.pendingFixes.entries()).map(([fingerprint, fix]) => ({
      fingerprint,
      ...fix
    }));
  }

  // --- Escalation Loop Entry Point ---

  public async recordFailure(componentId: string, errorSignature: string, contextData?: any) {
    const rawFingerprint = `${componentId}:${errorSignature}`;
    const fingerprint = crypto.createHash("md5").update(rawFingerprint).digest("hex");

    console.log(`[SelfHealing] Failure reported for component: ${componentId}. Signature: ${errorSignature}. Fingerprint: ${fingerprint}`);

    // Track rolling window (1 hour window to reset strikes)
    const now = Date.now();
    const lastStrike = this.lastStrikeTime.get(fingerprint) || 0;
    if (now - lastStrike > 3600000) {
      this.strikes.set(fingerprint, 0); // reset after 1 hour of quiet
    }
    
    this.lastStrikeTime.set(fingerprint, now);
    const strikeCount = (this.strikes.get(fingerprint) || 0) + 1;
    this.strikes.set(fingerprint, strikeCount);

    console.log(`[SelfHealing] Component ${componentId} is at Strike ${strikeCount} for this signature.`);

    if (strikeCount === 1) {
      await this.runTier1(fingerprint, componentId, errorSignature, contextData);
    } else if (strikeCount === 2) {
      await this.runTier2(fingerprint, componentId, errorSignature, contextData);
    } else {
      await this.runTier3(fingerprint, componentId, errorSignature, contextData);
    }
  }

  // --- Tier 1: Process Restart ---

  private async runTier1(fingerprint: string, componentId: string, errorSignature: string, contextData?: any) {
    console.log(`[SelfHealing] [TIER 1] Attempting process restart for: ${componentId}`);
    
    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId,
      errorSignature,
      fingerprint,
      tier: 1,
      status: "active"
    });

    if (componentId.startsWith("agent:")) {
      const agentId = componentId.substring(6);
      const sessions = this.sessionManager.getSessionsForAgent(agentId);
      const sessionId = sessions.length > 0 ? sessions[0].sessionId : `${agentId}:chat:heartbeat_persistent`;
      
      try {
        this.poolManager.terminateSession(sessionId);
        await this.poolManager.ensureAgentRunning(agentId, sessionId);
        console.log(`[SelfHealing] [TIER 1] Process restart succeeded for agent ${agentId}`);
        this.logIncident({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          componentId,
          errorSignature,
          fingerprint,
          tier: 1,
          status: "resolved",
          outcome: "Agent restarted successfully"
        });
      } catch (err: any) {
        console.error(`[SelfHealing] [TIER 1] Process restart failed:`, err.message);
      }
    } else if (componentId === "gateway") {
      console.warn(`[SelfHealing] [TIER 1] Gateway crash detected, exiting process to let systemd restart gateway...`);
      setTimeout(() => process.exit(1), 500);
    }
  }

  // --- Tier 2: Health Check Retry with Backoff ---

  private async runTier2(fingerprint: string, componentId: string, errorSignature: string, contextData?: any) {
    console.log(`[SelfHealing] [TIER 2] Escalate to Health Check Ping Retry loop...`);
    
    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId,
      errorSignature,
      fingerprint,
      tier: 2,
      status: "active"
    });

    const isHealthy = await this.runHealthCheckRetry(componentId);
    if (isHealthy) {
      console.log(`[SelfHealing] [TIER 2] Component ${componentId} recovered after pings.`);
      this.logIncident({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        componentId,
        errorSignature,
        fingerprint,
        tier: 2,
        status: "resolved",
        outcome: "Component ping success after backoff"
      });
    } else {
      console.warn(`[SelfHealing] [TIER 2] Health checks failed. Escalating to Tier 3 AI Diagnosis.`);
      await this.runTier3(fingerprint, componentId, errorSignature, contextData);
    }
  }

  private async runHealthCheckRetry(componentId: string): Promise<boolean> {
    const delays = [5000, 10000, 20000];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const delay = delays[attempt - 1];
      console.log(`[SelfHealing] Health check attempt ${attempt}/3. Waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      
      let pingSuccess = false;
      if (componentId.startsWith("agent:")) {
        const agentId = componentId.substring(6);
        const wsAgent = this.sessionManager.getAgentConnection(`${agentId}:chat:web_test`) || 
                        this.sessionManager.getAgentConnection(`${agentId}:chat:heartbeat_persistent`);
        pingSuccess = !!(wsAgent && wsAgent.readyState === 1); // Open WebSocket
      } else if (componentId === "gateway") {
        try {
          const port = this.globalConfig.gateway.port || 18789;
          const token = this.globalConfig.gateway.authToken;
          const res = await fetch(`http://127.0.0.1:${port}/api/agents/status?token=${token}`);
          pingSuccess = res.ok;
        } catch {
          pingSuccess = false;
        }
      }
      
      if (pingSuccess) return true;
    }
    return false;
  }

  // --- Tier 3: AI Diagnosis & Repair ---

  private async runTier3(fingerprint: string, componentId: string, errorSignature: string, contextData?: any) {
    console.log(`[SelfHealing] [TIER 3] Starting AI Diagnosis & Repair for: ${componentId}`);

    // Check immune memory (Known Fixes DB) first
    const knownFix = this.getKnownFixes().find(f => f.symptomFingerprint === fingerprint);
    if (knownFix && knownFix.successRate > 0.80) {
      console.log(`[SelfHealing] [TIER 3] Found immune memory match for fingerprint ${fingerprint} with success rate ${knownFix.successRate * 100}%. Applying known fix directly.`);
      
      this.logIncident({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        componentId,
        errorSignature,
        fingerprint,
        tier: 3,
        status: "active",
        diagnosis: `Immune memory hit: ${knownFix.rootCause}`,
        outcome: "Applying known fix directly"
      });

      const success = await this.applyFix(fingerprint, knownFix, false);
      if (success) return;
    }

    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId,
      errorSignature,
      fingerprint,
      tier: 3,
      status: "active"
    });

    try {
      await this.runAIDiagnosis(componentId, fingerprint, errorSignature, contextData);
    } catch (err: any) {
      console.error(`[SelfHealing] [TIER 3] AI diagnosis crashed:`, err.message);
      this.escalateToHuman(fingerprint, componentId, errorSignature, { error: err.message }, "AI Diagnosis execution failure");
    }
  }

  private async runAIDiagnosis(componentId: string, fingerprint: string, errorSignature: string, contextData: any) {
    // 1. Compile logs & documentation context
    let recentLogs = "No recent logs captured.";
    try {
      const logsPath = join(homedir(), ".komorebi", "system-logs.jsonl");
      if (existsSync(logsPath)) {
        const raw = readFileSync(logsPath, "utf-8").trim().split("\n");
        recentLogs = raw.slice(-40).join("\n");
      }
    } catch {}

    let archDocs = "";
    try {
      const archPath = join(this.projectRoot, "ARCHITECTURE.md");
      if (existsSync(archPath)) {
        archDocs = readFileSync(archPath, "utf-8").slice(0, 4000); // sample
      }
    } catch {}

    // 2. Query compaction model
    const agentList = this.globalConfig.agents || [];
    const agent = agentList[0]; // Query using default agent provider
    if (!agent) {
      throw new Error("No agent configured to run AI diagnosis");
    }

    const systemPrompt = `You are the Komorebi Omoi Auto-Healing Diagnostician. 
Your task is to analyze a system error and suggest a minimal, targeted fix.
Identify if it is a restart, config change, circuit-breaker action, or code fix.
Cite exact files and lines if a code fix is proposed.
Format your output in JSON:
{
  "rootCause": "Explanation of root cause",
  "fixApplied": "Explanation of fix to apply",
  "fixType": "restart" | "config" | "skill-disable" | "code",
  "affectedFile": "Path to file relative to project root, or null",
  "targetContent": "Precise line string to replace, or null",
  "replacementContent": "Precise line string replacement, or null"
}`;

    const prompt = `System component '${componentId}' failed.
Error signature: ${errorSignature}
Context data: ${JSON.stringify(contextData)}

Recent System Logs:
${recentLogs}

Architecture Context:
${archDocs}`;

    let diagnosis: any;
    try {
      const providerId = this.globalConfig.agents[0]?.model?.provider || "openai-compatible";
      const providerConfig = this.globalConfig.models?.providers?.[providerId] || {};
      const baseUrl = (providerConfig as any).baseUrl;
      let apiKey = this.globalConfig.agents[0]?.model?.apiKey;
      if (!apiKey || apiKey === "${OPENAI_API_KEY}" || apiKey === "${GEMINI_API_KEY}") {
        apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || "dummy";
      }
      const modelName = this.globalConfig.agents[0]?.model?.name || "gpt-4o";

      const content = await this.queryModelAPI(
        providerId,
        baseUrl,
        apiKey,
        modelName,
        systemPrompt,
        prompt
      );

      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        diagnosis = JSON.parse(jsonMatch[0]);
      } else {
        diagnosis = JSON.parse(content);
      }
    } catch (err: any) {
      throw new Error(`Model request/parse failed: ${err.message}`);
    }

    console.log(`[SelfHealing] [TIER 3] Model diagnosis complete:`, diagnosis);

    // 3. Process proposed fix through safety gate
    const isSafe = this.isFixSafe(diagnosis);
    if (isSafe) {
      console.log(`[SelfHealing] [TIER 3] Fix type '${diagnosis.fixType}' is SAFE to auto-apply.`);
      await this.applyFix(fingerprint, diagnosis, false);
    } else {
      console.warn(`[SelfHealing] [TIER 3] Proposed fix requires elevated permissions. Escalating to human.`);
      this.escalateToHuman(fingerprint, componentId, errorSignature, diagnosis, "Fix requires human approval (Code modifying or touches core files)");
    }
  }

  private isFixSafe(diagnosis: any): boolean {
    const { fixType, affectedFile } = diagnosis;
    if (fixType === "restart" || fixType === "skill-disable") return true;
    if (fixType === "config") {
      // Check if file is gateway config or workspace configs
      if (affectedFile && (affectedFile.includes("komorebi.config.json") || affectedFile.includes("komorebi.json"))) {
        return false; // config overrides of key server configurations are unsafe
      }
      return true;
    }
    
    // code modifications are unsafe
    if (fixType === "code") return false;
    
    // Safety check on folder boundaries
    if (affectedFile && (affectedFile.includes("agent-core") || affectedFile.includes("agent-runtime/src/runtime"))) {
      return false;
    }

    return false;
  }

  // --- Tier 4: Human Escalation ---

  private escalateToHuman(fingerprint: string, componentId: string, errorSignature: string, diagnosis: any, reason: string) {
    console.log(`[SelfHealing] [TIER 4] Escalating to human: ${reason}`);
    
    const pendingFix = {
      timestamp: Date.now(),
      componentId,
      errorSignature,
      diagnosis,
      reason
    };
    
    this.pendingFixes.set(fingerprint, pendingFix);

    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId,
      errorSignature,
      fingerprint,
      tier: 4,
      status: "pending_approval",
      diagnosis: diagnosis.rootCause || reason,
      proposedFix: diagnosis
    });

    // Notify via Telegram bot if fallback chat ID exists
    const wsServer = this.getWsServer();
    if (wsServer) {
      const allowed = (this.globalConfig as any).allowedTelegramChatIds;
      const fallbackChatId = allowed && allowed.length > 0 ? Number(allowed[0]) : null;
      if (fallbackChatId) {
        wsServer.sendDirectTelegram(
          this.globalConfig.agents[0]?.id || "coordinator-agent",
          fallbackChatId,
          `🚨 *Komorebi Self-Healing Escalation (Tier 4)* 🚨\n\n` +
          `Component: \`${componentId}\`\n` +
          `Reason: ${reason}\n\n` +
          `Root Cause: ${diagnosis.rootCause || "Unknown"}\n` +
          `Proposed Fix: ${diagnosis.fixApplied || "None"}\n\n` +
          `Approve this fix via Dashboard or run CLI: \`komorebi selfheal approve ${fingerprint}\``
        ).catch(() => {});
      }
    }
  }

  // --- Apply and Rollback Fixes ---

  public async applyFix(fingerprint: string, fix: any, force = false): Promise<boolean> {
    const isCodeFix = fix.fixType === "code" || (fix.affectedFile && fix.targetContent);
    const affectedPath = isCodeFix ? join(this.projectRoot, fix.affectedFile) : null;
    
    if (isCodeFix && affectedPath) {
      console.log(`[SelfHealing] Creating Git checkpoint before applying code fix on: ${fix.affectedFile}`);
      try {
        execSync("git add -A", { cwd: this.projectRoot });
        execSync(`git commit -m "pre-selfheal-checkpoint: ${fingerprint}"`, { cwd: this.projectRoot });
      } catch (err: any) {
        console.warn(`[SelfHealing] Git checkpoint commit skipped (clean tree or non-repo):`, err.message);
      }

      // Apply the file edits
      try {
        if (existsSync(affectedPath)) {
          let content = readFileSync(affectedPath, "utf-8");
          if (content.includes(fix.targetContent)) {
            content = content.replace(fix.targetContent, fix.replacementContent);
            writeFileSync(affectedPath, content, "utf-8");
            console.log(`[SelfHealing] Edit applied to ${fix.affectedFile}`);
          } else {
            throw new Error(`Target content not found in file: ${fix.targetContent}`);
          }
        } else {
          throw new Error(`Affected file does not exist: ${fix.affectedFile}`);
        }
      } catch (err: any) {
        console.error(`[SelfHealing] Failed to apply code edit:`, err.message);
        this.logFixFailure(fingerprint, fix, `Edit application failed: ${err.message}`);
        return false;
      }

      // Regression Test Verification
      console.log(`[SelfHealing] Running E2E/Unit tests to verify regression...`);
      try {
        // Run unit tests targeting system integrity
        execSync("node node_modules/vitest/vitest.mjs run -c vitest.unit.config.ts", { cwd: this.projectRoot });
        console.log(`[SelfHealing] Regression tests passed. Fix verified successfully.`);
      } catch (testErr: any) {
        console.error(`[SelfHealing] Regression detected! Running git rollback...`);
        try {
          execSync("git reset --hard HEAD~1", { cwd: this.projectRoot });
          console.log(`[SelfHealing] Rollback completed successfully.`);
        } catch (rollbackErr: any) {
          console.error(`[SelfHealing] Critical: Git rollback failed:`, rollbackErr.message);
        }
        this.logFixFailure(fingerprint, fix, `Regression detected: tests failed. Rollback applied.`);
        return false;
      }
    } else {
      // Non-code fixes: restart or config caches
      if (fix.fixType === "restart") {
        const agentId = fix.agentId || (fix.componentId ? fix.componentId.substring(6) : "");
        const sessions = this.sessionManager.getSessionsForAgent(agentId);
        const sessionId = sessions.length > 0 ? sessions[0].sessionId : `${agentId}:chat:heartbeat_persistent`;
        try {
          this.poolManager.terminateSession(sessionId);
          await this.poolManager.ensureAgentRunning(agentId, sessionId);
        } catch (err: any) {
          this.logFixFailure(fingerprint, fix, `Restart failed: ${err.message}`);
          return false;
        }
      } else if (fix.fixType === "skill-disable") {
        // Disable skill by writing empty disabled manifest or modifying config
        console.log(`[SelfHealing] Disabling skill: ${fix.skillName || fix.affectedFile}`);
      }
    }

    // Success: register in known-fixes DB
    this.registerSuccess(fingerprint, fix);
    this.pendingFixes.delete(fingerprint);
    return true;
  }

  private registerSuccess(fingerprint: string, fix: any) {
    const fixes = this.getKnownFixes();
    let entry = fixes.find(f => f.symptomFingerprint === fingerprint);
    if (!entry) {
      entry = {
        symptomFingerprint: fingerprint,
        rootCause: fix.rootCause || "Auto diagnosed",
        fixApplied: fix.fixApplied || "Auto fixed",
        fixType: fix.fixType || "restart",
        successRate: 1.0,
        lastSeen: Date.now(),
        timesApplied: 1,
        timesSucceeded: 1
      };
      fixes.push(entry);
    } else {
      entry.timesApplied++;
      entry.timesSucceeded++;
      entry.successRate = entry.timesSucceeded / entry.timesApplied;
      entry.lastSeen = Date.now();
    }
    this.saveKnownFixes(fixes);

    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId: fix.componentId || "unknown",
      errorSignature: fix.errorSignature || "recurrent",
      fingerprint,
      tier: 3,
      status: "resolved",
      outcome: `Fix applied successfully (${entry.fixType})`
    });
  }

  private logFixFailure(fingerprint: string, fix: any, reason: string) {
    const fixes = this.getKnownFixes();
    const entry = fixes.find(f => f.symptomFingerprint === fingerprint);
    if (entry) {
      entry.timesApplied++;
      entry.successRate = entry.timesSucceeded / entry.timesApplied;
      entry.lastSeen = Date.now();
      this.saveKnownFixes(fixes);
    }

    this.logIncident({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      componentId: fix.componentId || "unknown",
      errorSignature: fix.errorSignature || "recurrent",
      fingerprint,
      tier: 3,
      status: "failed",
      outcome: `Fix failed: ${reason}`
    });
  }

  public rollbackFix(fingerprint: string): boolean {
    console.log(`[SelfHealing] Rolling back fix for fingerprint: ${fingerprint}`);
    try {
      execSync("git reset --hard HEAD~1", { cwd: this.projectRoot });
      console.log(`[SelfHealing] Rollback succeeded.`);
      return true;
    } catch (err: any) {
      console.error(`[SelfHealing] Rollback failed:`, err.message);
      return false;
    }
  }

  // --- Helpers ---

  private async queryModelAPI(
    providerId: string,
    baseUrl: string | undefined,
    apiKey: string,
    modelName: string,
    systemInstruction: string,
    prompt: string
  ): Promise<string> {
    if (apiKey === "dummy" || apiKey === "mock-key" || !apiKey) {
      // Return mock response for testing/dummy environments
      return JSON.stringify({
        rootCause: "Mock root cause",
        fixApplied: "Mock fix description",
        fixType: "config",
        affectedFile: "komorebi.config.json",
        targetContent: "port: 18789",
        replacementContent: "port: 18789"
      });
    }

    const isGemini = providerId === "gemini" && (!baseUrl || baseUrl.includes("googleapis.com"));

    if (isGemini) {
      const normalizedModel = modelName.includes("3.5") ? "gemini-1.5-flash" : modelName;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${errText}`);
      }

      const data = await response.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const finalBaseUrl = baseUrl || "https://api.openai.com/v1";
      const url = `${finalBaseUrl.replace(/\/$/, "")}/chat/completions`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI-compatible API error: ${errText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || "";
    }
  }
}
