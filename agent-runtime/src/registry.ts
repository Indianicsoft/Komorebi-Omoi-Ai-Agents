import { resolve, normalize, join } from "node:path";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import crypto from "node:crypto";
import { ToolDefinition, ToolExecutionContext, RegisteredTool, ToolPolicy } from "./types.js";
import { isToolPermitted } from "./policy.js";
import { checkElevatedPermissions } from "./approval.js";

const requireHelper = createRequire(import.meta.url);

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface SkillCircuitBreaker {
  state: CircuitState;
  failures: number;
  successes: number;
  history: boolean[];
  lastOpenedAt?: number;
  lastProbeAt?: number;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  public toolSkillMetadata = new Map<string, {
    skillName: string;
    skillPath: string;
    outputSchema?: any;
    idempotencyKey?: boolean;
    timeout?: number;
  }>();

  private activeConcurrency = new Map<string, number>();
  private dedupeCache = new Map<string, { result: string; timestamp: number }>();
  private circuitBreakers = new Map<string, SkillCircuitBreaker>();

  constructor(
    private readonly workspacePath: string,
    public readonly policy: ToolPolicy
  ) {
    this.loadCustomTools();
  }

  /**
   * Registers a tool in the registry.
   */
  public register(tool: RegisteredTool) {
    console.log(`[ToolRegistry] Registering tool: ${tool.definition.name}`);
    this.tools.set(tool.definition.name, tool);
  }

  public has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns a list of all registered tool definitions.
   */
  public getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Checks tool policy and executes the tool if permitted.
   */
  public async execute(
    name: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: Tool '${name}' not found in registry.`;
    }

    // 1. Tool Policy (deny-always-wins + groups) Check
    const allowed = isToolPermitted(name, this.policy as any);
    if (!allowed) {
      return `Access Denied: Tool '${name}' is blocked by the agent's policy rules.`;
    }

    // 2. Elevated Permission Gating
    const approved = await checkElevatedPermissions(name, args, context as any);
    if (!approved) {
      return `Access Denied: Elevated permission check failed or denied for tool '${name}'.`;
    }

    // 3. Path boundary check
    if (["read_file", "write_file", "edit_file"].includes(name)) {
      const targetPath = args.path || args.filepath || args.filePath;
      if (targetPath) {
        const resolvedTarget = resolve(this.workspacePath, targetPath);
        const resolvedWorkspace = resolve(this.workspacePath);

        let pathAllowed = resolvedTarget.startsWith(resolvedWorkspace);
        if (!pathAllowed && (this.policy as any).readWritePaths && (this.policy as any).readWritePaths.length > 0) {
          for (const whitelistPath of (this.policy as any).readWritePaths) {
            const resolvedWhitelist = resolve(whitelistPath);
            if (resolvedTarget.startsWith(resolvedWhitelist)) {
              pathAllowed = true;
              break;
            }
          }
        }

        if (!pathAllowed) {
          return `Access Denied: Path '${targetPath}' is outside the authorized workspace boundary.`;
        }
      }
    }

    // 4. Run execution with contract rules
    const skillMeta = this.toolSkillMetadata.get(name);

    // A. Concurrency Capping
    if (skillMeta) {
      const activeCount = this.activeConcurrency.get(skillMeta.skillName) || 0;
      if (activeCount >= 3) {
        return `Error: Concurrency cap exceeded. Max 3 concurrent calls permitted for skill '${skillMeta.skillName}'.`;
      }
      this.activeConcurrency.set(skillMeta.skillName, activeCount + 1);
    }

    try {
      // B. Idempotency Key Injection
      if (skillMeta && skillMeta.idempotencyKey) {
        const keySource = context.agentId || "unknown";
        const keyIntent = name;
        const keyTimeBucket = Math.floor(Date.now() / 60000);
        const idKey = crypto
          .createHash("md5")
          .update(keySource + keyIntent + JSON.stringify(args) + keyTimeBucket)
          .digest("hex");
        args.idempotencyKey = idKey;
      }

      // C. Outbound Deduping Check
      const isOutbound = /send|post|notify|telegram|publish/i.test(name);
      let dedupeKey = "";
      if (isOutbound) {
        const contentHash = crypto
          .createHash("md5")
          .update(JSON.stringify(args))
          .digest("hex");
        const timeBucket = Math.floor(Date.now() / 60000);
        dedupeKey = `${context.agentId || "unknown"}:${name}:${contentHash}:${timeBucket}`;
        
        const cached = this.dedupeCache.get(dedupeKey);
        if (cached && (Date.now() - cached.timestamp < 60000)) {
          console.log(`[ToolRegistry] Suppressed duplicate outbound call for '${name}' (dedupe hit)`);
          return cached.result;
        }
      }

      // D. Run Execution with Timeout + Retries Wrapper
      let attempts = 0;
      const maxAttempts = 3;
      const timeoutMs = (skillMeta?.timeout || 30) * 1000;
      let finalResult = "";
      let executionError: any = null;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const executePromise = tool.execute(args, context);
          const timeoutPromise = new Promise<never>((_, reject) => {
            const id = setTimeout(() => {
              reject(new Error(`Timeout: Execution exceeded limit of ${timeoutMs / 1000}s`));
            }, timeoutMs);
            if (id.unref) id.unref();
          });

          finalResult = await Promise.race([executePromise, timeoutPromise]);
          executionError = null;
          break;
        } catch (err: any) {
          executionError = err;
          const isRetryable = this.isRetryableError(err);
          if (!isRetryable || attempts >= maxAttempts) {
            break;
          }
          const backoff = Math.pow(2, attempts) * 500;
          const jitter = Math.random() * 200;
          const delay = backoff + jitter;
          console.warn(`[ToolRegistry] Retryable failure on '${name}' (attempt ${attempts}/${maxAttempts}). Retrying in ${delay.toFixed(0)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (executionError) {
        throw executionError;
      }

      // E. Output Schema Validation
      if (skillMeta && skillMeta.outputSchema) {
        let parsedOutput: any = null;
        try {
          parsedOutput = JSON.parse(finalResult);
        } catch {
          parsedOutput = finalResult;
        }

        const valid = validateJsonSchema(parsedOutput, skillMeta.outputSchema);
        if (!valid.passed) {
          console.warn(`[ToolRegistry] Output validation failed for '${name}':`, valid.error);
          try {
            args._validationError = `Previous call returned malformed output violating the schema. Error: ${valid.error}. Please correct the output structure.`;
            finalResult = await tool.execute(args, context);
            
            let retriedParsed = finalResult;
            try { retriedParsed = JSON.parse(finalResult); } catch {}
            const retriedValid = validateJsonSchema(retriedParsed, skillMeta.outputSchema);
            if (!retriedValid.passed) {
              return `Error: Output contract violation. Retried tool execution still returned malformed output: ${retriedValid.error}`;
            }
          } catch (retryErr: any) {
            return `Error: Output contract violation. Retried execution failed: ${retryErr.message}`;
          }
        }
      }

      if (isOutbound && dedupeKey) {
        this.dedupeCache.set(dedupeKey, { result: finalResult, timestamp: Date.now() });
      }

      if (skillMeta) {
        this.recordSkillExecutionResult(skillMeta.skillName, true);
      }

      return finalResult;
    } catch (err: any) {
      if (skillMeta) {
        this.recordSkillExecutionResult(skillMeta.skillName, false);
      }
      console.error(`[ToolRegistry] Error executing tool '${name}':`, err);
      return `Error: Execution failed: ${err.message}`;
    } finally {
      if (skillMeta) {
        const activeCount = this.activeConcurrency.get(skillMeta.skillName) || 1;
        this.activeConcurrency.set(skillMeta.skillName, Math.max(0, activeCount - 1));
      }
    }
  }

  private isRetryableError(err: any): boolean {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("auth") || msg.includes("forbidden") || msg.includes("401") || msg.includes("403")) {
      return false;
    }
    if (msg.includes("bad request") || msg.includes("invalid parameters") || msg.includes("400")) {
      return false;
    }
    return true;
  }

  public recordSkillExecutionResult(skillName: string, success: boolean) {
    let breaker = this.circuitBreakers.get(skillName);
    if (!breaker) {
      breaker = { state: "CLOSED", failures: 0, successes: 0, history: [] };
      this.circuitBreakers.set(skillName, breaker);
    }

    breaker.history.push(success);
    if (breaker.history.length > 10) {
      breaker.history.shift();
    }

    if (success) {
      breaker.successes++;
    } else {
      breaker.failures++;
    }

    if (breaker.state === "HALF_OPEN") {
      if (success) {
        console.log(`[CircuitBreaker] Skill '${skillName}' successfully recovered! Transitioning to CLOSED.`);
        breaker.state = "CLOSED";
        breaker.history = [];
      } else {
        console.warn(`[CircuitBreaker] Skill '${skillName}' probe failed. Transitioning back to OPEN.`);
        breaker.state = "OPEN";
        breaker.lastOpenedAt = Date.now();
      }
    } else if (breaker.state === "CLOSED") {
      const windowSize = breaker.history.length;
      const failuresCount = breaker.history.filter(s => !s).length;
      const failureRate = windowSize > 0 ? failuresCount / windowSize : 0;

      if (windowSize >= 5 && failureRate >= 0.5) {
        console.warn(`[CircuitBreaker] Skill '${skillName}' failure rate is ${(failureRate * 100).toFixed(0)}%. Opening circuit.`);
        breaker.state = "OPEN";
        breaker.lastOpenedAt = Date.now();
        this.notifyCircuitOpen(skillName, `Failure rate reached ${(failureRate * 100).toFixed(0)}%`);
      }
    }
  }

  public isSkillDisabled(skillName: string): boolean {
    const breaker = this.circuitBreakers.get(skillName);
    if (!breaker) return false;

    if (breaker.state === "OPEN") {
      const probeInterval = 30 * 60 * 1000;
      const timeSinceOpen = Date.now() - (breaker.lastOpenedAt || 0);
      if (timeSinceOpen >= probeInterval) {
        console.log(`[CircuitBreaker] Probe timer expired for skill '${skillName}'. Transitioning to HALF_OPEN to allow test call.`);
        breaker.state = "HALF_OPEN";
        breaker.lastProbeAt = Date.now();
        return false;
      }
      return true;
    }

    return false;
  }

  public setSkillCircuitState(skillName: string, state: CircuitState) {
    let breaker = this.circuitBreakers.get(skillName);
    if (!breaker) {
      breaker = { state: "CLOSED", failures: 0, successes: 0, history: [] };
      this.circuitBreakers.set(skillName, breaker);
    }
    breaker.state = state;
    if (state === "CLOSED") {
      breaker.history = [];
    } else if (state === "OPEN") {
      breaker.lastOpenedAt = Date.now();
    }
  }

  public getSkillCircuitData(skillName: string) {
    const breaker = this.circuitBreakers.get(skillName);
    if (!breaker) {
      return { state: "CLOSED", successRate: 1.0, runs: 0, history: [] };
    }
    const total = breaker.history.length;
    const successes = breaker.history.filter(s => s).length;
    return {
      state: breaker.state,
      successRate: total > 0 ? successes / total : 1.0,
      runs: total,
      history: breaker.history
    };
  }

  private notifyCircuitOpen(skillName: string, reason: string) {
    console.error(`[CIRCUIT BREAKER OPEN] Skill: '${skillName}' - Reason: ${reason}`);
    const logPath = join(homedir(), ".komorebi", "health-events.jsonl");
    const alertEntry = {
      timestamp: Date.now(),
      type: "skill_circuit_breaker_open",
      target: skillName,
      reason,
    };
    try {
      appendFileSync(logPath, JSON.stringify(alertEntry) + "\n", "utf-8");
    } catch {}
  }

  public hotReloadSkill(skillName: string, skillPath: string): boolean {
    console.log(`[ToolRegistry] Hot-reloading skill '${skillName}' from ${skillPath}...`);
    const backupTools = new Map(this.tools);
    const backupMetadata = new Map(this.toolSkillMetadata);

    try {
      for (const [toolName, meta] of this.toolSkillMetadata.entries()) {
        if (meta.skillName === skillName) {
          this.tools.delete(toolName);
          this.toolSkillMetadata.delete(toolName);
        }
      }
      this.loadToolsFromDir(skillPath, skillName);
      return true;
    } catch (err: any) {
      console.error(`[ToolRegistry] Hot-reload failed for skill '${skillName}': ${err.message}. Rolling back...`);
      this.tools = backupTools;
      this.toolSkillMetadata = backupMetadata;
      return false;
    }
  }

  public loadCustomTools() {
    const customToolsDir = join(this.workspacePath, "custom-tools");
    this.loadToolsFromDir(customToolsDir, null);

    const skillsDir = join(this.workspacePath, "skills");
    if (existsSync(skillsDir)) {
      try {
        const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const d of dirs) {
          this.loadToolsFromDir(join(skillsDir, d.name), d.name);
        }
      } catch (err: any) {
        console.error(`[ToolRegistry] Failed to scan skills dir:`, err.message);
      }
    }

    const pluginsDir = join(this.workspacePath, "plugins");
    if (existsSync(pluginsDir)) {
      try {
        const dirs = readdirSync(pluginsDir, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const d of dirs) {
          this.loadToolsFromDir(join(pluginsDir, d.name), d.name);
        }
      } catch (err: any) {
        console.error(`[ToolRegistry] Failed to scan plugins dir:`, err.message);
      }
    }
  }

  private loadToolsFromDir(dirPath: string, skillName: string | null) {
    if (!existsSync(dirPath)) return;
    
    let metadata: any = {};
    if (skillName) {
      const skillMd = join(dirPath, "SKILL.md");
      const pluginJson = join(dirPath, "plugin.json");
      const manifestJson = join(dirPath, "manifest.json");
      if (existsSync(skillMd)) {
        try {
          const content = readFileSync(skillMd, "utf-8");
          metadata = parseFrontmatter(content);
        } catch {}
      } else if (existsSync(pluginJson)) {
        try {
          metadata = JSON.parse(readFileSync(pluginJson, "utf-8"));
        } catch {}
      } else if (existsSync(manifestJson)) {
        try {
          metadata = JSON.parse(readFileSync(manifestJson, "utf-8"));
        } catch {}
      }
    }

    const loadRecursive = (currentDir: string) => {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === ".trust" || entry.name === "node_modules") continue;
          loadRecursive(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          try {
            const fileContent = readFileSync(fullPath, "utf-8");
            const compiled = new Function("module", "exports", "require", `${fileContent}\nreturn module.exports;`);
            const mockModule = { exports: {} as any };
            const toolObj = compiled(mockModule, mockModule.exports, requireHelper);
            if (toolObj && toolObj.definition && toolObj.execute) {
              this.register(toolObj);
              if (skillName) {
                this.toolSkillMetadata.set(toolObj.definition.name, {
                  skillName,
                  skillPath: dirPath,
                  outputSchema: metadata.outputSchema,
                  idempotencyKey: metadata.idempotencyKey,
                  timeout: metadata.timeout,
                });
              }
              console.log(`[ToolRegistry] Loaded custom tool '${toolObj.definition.name}' for skill '${skillName || "custom"}'`);
            }
          } catch (err: any) {
            console.error(`[ToolRegistry] Failed to load tool ${entry.name}:`, err.message);
          }
        }
      }
    };

    try {
      loadRecursive(dirPath);
    } catch {}
  }
}

function parseFrontmatter(content: string): any {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split("\n");
  const parsed: any = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (key === "idempotencyKey") {
      parsed.idempotencyKey = val === "true";
    } else if (key === "timeout") {
      parsed.timeout = parseInt(val, 10);
    }
  }

  const schemaMatch = match[1].match(/outputSchema:\s*(\{[\s\S]*?\})/);
  if (schemaMatch) {
    try {
      parsed.outputSchema = JSON.parse(schemaMatch[1]);
    } catch {}
  } else {
    const linesSchema = match[1].split("\n");
    let inSchema = false;
    let schemaLines: string[] = [];
    for (const l of linesSchema) {
      if (l.trim().startsWith("outputSchema:")) {
        inSchema = true;
      } else if (inSchema) {
        if (l.startsWith(" ") || l.startsWith("\t") || l.trim() === "") {
          schemaLines.push(l);
        } else {
          inSchema = false;
        }
      }
    }
    if (schemaLines.length > 0) {
      parsed.outputSchema = parseYamlSchema(schemaLines.join("\n"));
    }
  }

  return parsed;
}

function parseYamlSchema(yamlBlock: string): any {
  try {
    return JSON.parse(yamlBlock.trim());
  } catch {}

  const lines = yamlBlock.split("\n");
  const schema: any = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[2];
    const val = match[3].trim().replace(/^["']|["']$/g, "");
    
    if (key === "type") schema.type = val;
    else if (key === "required") {
      try {
        schema.required = JSON.parse(val);
      } catch {
        schema.required = val.replace(/[\[\]]/g, "").split(",").map(s => s.trim());
      }
    } else if (key === "properties") {
      schema.properties = {};
    } else if (schema.properties) {
      if (val) {
        if (!schema.properties[key]) schema.properties[key] = {};
        if (line.includes("type:")) schema.properties[key].type = val;
      }
    }
  }
  return schema;
}

function validateJsonSchema(data: any, schema: any): { passed: boolean; error?: string } {
  if (!schema) return { passed: true };
  if (schema.type) {
    const dataType = typeof data;
    if (schema.type === "object" && (dataType !== "object" || data === null)) {
      return { passed: false, error: `Expected type 'object', got '${dataType}'` };
    }
    if (schema.type === "array" && !Array.isArray(data)) {
      return { passed: false, error: `Expected type 'array', got non-array` };
    }
    if (schema.type === "string" && dataType !== "string") {
      return { passed: false, error: `Expected type 'string', got '${dataType}'` };
    }
    if (schema.type === "number" && dataType !== "number") {
      return { passed: false, error: `Expected type 'number', got '${dataType}'` };
    }
    if (schema.type === "boolean" && dataType !== "boolean") {
      return { passed: false, error: `Expected type 'boolean', got '${dataType}'` };
    }
  }
  if (schema.required && Array.isArray(schema.required)) {
    if (typeof data !== "object" || data === null) {
      return { passed: false, error: "Cannot validate required fields on non-object data" };
    }
    for (const req of schema.required) {
      if (!(req in data) || data[req] === undefined || data[req] === null) {
        return { passed: false, error: `Missing required property '${req}'` };
      }
    }
  }
  if (schema.properties && typeof data === "object" && data !== null) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (prop in data) {
        const subResult = validateJsonSchema(data[prop], propSchema);
        if (!subResult.passed) {
          return { passed: false, error: `Property '${prop}': ${subResult.error}` };
        }
      }
    }
  }
  return { passed: true };
}
