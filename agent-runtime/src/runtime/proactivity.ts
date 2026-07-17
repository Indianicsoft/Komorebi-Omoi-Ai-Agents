import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

export interface UrgencyResult {
  score: number;
  urgent: boolean;
}

export class ProactivityManager {
  private baseDir: string;

  constructor(private readonly agentId: string, private readonly workspacePath: string) {
    this.baseDir = join(workspacePath, "proactivity");
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    const domainsDir = join(this.baseDir, "domains");
    if (!existsSync(domainsDir)) {
      mkdirSync(domainsDir, { recursive: true });
    }
    this.initializeDefaults();
  }

  private initializeDefaults() {
    const memoryPath = join(this.baseDir, "memory.md");
    if (!existsSync(memoryPath)) {
      writeFileSync(
        memoryPath,
        `# Global Proactivity Settings\n\n## Global Default Tier\n- Default Tier: SUGGEST\n\n## Learned Rules\n- Pattern: (read_file|list_dir|web_search|web_fetch|think|skills_load|skills_load_reference|skills_search|read_skill|memory_search|memory_get).* | Tier: DO\n- Pattern: .* | Tier: SUGGEST\n\nquieter: false\n`,
        "utf-8"
      );
    }
    const logPath = join(this.baseDir, "log.md");
    if (!existsSync(logPath)) {
      writeFileSync(logPath, `# Proactivity Action Log\n\n| Timestamp | Session ID | Domain | Action | Tier | Status |\n`, "utf-8");
    }
    const queuePath = join(this.baseDir, "digest_queue.json");
    if (!existsSync(queuePath)) {
      writeFileSync(queuePath, JSON.stringify([]), "utf-8");
    }
  }

  public async classifyAction(
    domain: string,
    action: string,
    sessionId: string
  ): Promise<"DO" | "SUGGEST" | "ASK" | "NEVER" | "UNCLASSIFIED"> {
    // Hard check NEVER boundaries for destructive commands
    if (action.includes("rm -rf /") || action.includes("delete") || action.includes("uninstall")) {
      const soulPath = join(this.workspacePath, "soul.md");
      if (existsSync(soulPath)) {
        const soul = readFileSync(soulPath, "utf-8").toLowerCase();
        if (soul.includes("never delete") || soul.includes("never uninstall")) {
          return "NEVER";
        }
      }
    }

    // 1. Check domains/<domain>.md first
    const domainPath = join(this.baseDir, "domains", `${domain}.md`);
    if (existsSync(domainPath)) {
      const content = readFileSync(domainPath, "utf-8");
      const resolved = this.parseRules(content, action);
      if (resolved) return resolved;
    }

    // 2. Check global memory.md
    const memoryPath = join(this.baseDir, "memory.md");
    if (existsSync(memoryPath)) {
      const content = readFileSync(memoryPath, "utf-8");
      const resolved = this.parseRules(content, action);
      if (resolved) return resolved;
    }

    return "UNCLASSIFIED";
  }

  private parseRules(content: string, action: string): "DO" | "SUGGEST" | "ASK" | "NEVER" | null {
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/-\s*Pattern:\s*(.*?)\s*\|\s*Tier:\s*(\w+)/i);
      if (match) {
        const patternStr = match[1].trim();
        const tier = match[2].trim().toUpperCase();
        try {
          const regex = new RegExp(patternStr, "i");
          if (regex.test(action)) {
            return tier as any;
          }
        } catch {
          if (action.includes(patternStr)) {
            return tier as any;
          }
        }
      }
    }
    return null;
  }

  public recordRule(domain: string, pattern: string, tier: string) {
    const domainPath = join(this.baseDir, "domains", `${domain}.md`);
    const dateStr = new Date().toISOString().split("T")[0];
    const ruleLine = `- Pattern: ${pattern} | Tier: ${tier} (confirmed ${dateStr})\n`;
    
    if (existsSync(domainPath)) {
      let content = readFileSync(domainPath, "utf-8");
      content += ruleLine;
      writeFileSync(domainPath, content, "utf-8");
    } else {
      writeFileSync(domainPath, `# ${domain} Proactivity Rules\n\n${ruleLine}`, "utf-8");
    }
  }

  public logAction(sessionId: string, domain: string, action: string, tier: string, status: string) {
    const logPath = join(this.baseDir, "log.md");
    const row = `| ${new Date().toISOString()} | ${sessionId} | ${domain} | ${action} | ${tier} | ${status} |\n`;
    if (existsSync(logPath)) {
      let content = readFileSync(logPath, "utf-8");
      content += row;
      writeFileSync(logPath, content, "utf-8");
    }
  }

  public getRecentNotificationCount(days: number = 1): number {
    const logPath = join(this.baseDir, "log.md");
    if (!existsSync(logPath)) return 0;
    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n");
    let count = 0;
    const now = Date.now();
    for (const line of lines) {
      if (line.startsWith("|") && !line.includes("Timestamp")) {
        const parts = line.split("|");
        const status = parts[6]?.trim();
        if (status === "DELIVERED" || status === "SENT") {
          const timeStr = parts[1]?.trim();
          if (timeStr) {
            const time = Date.parse(timeStr);
            if (!isNaN(time) && (now - time) < days * 24 * 60 * 60 * 1000) {
              count++;
            }
          }
        }
      }
    }
    return count;
  }

  public isQuieterEnabled(): boolean {
    const memoryPath = join(this.baseDir, "memory.md");
    if (!existsSync(memoryPath)) return false;
    const content = readFileSync(memoryPath, "utf-8");
    return content.toLowerCase().includes("quieter: true");
  }

  public setQuieter(val: boolean) {
    const memoryPath = join(this.baseDir, "memory.md");
    if (existsSync(memoryPath)) {
      let content = readFileSync(memoryPath, "utf-8");
      if (content.includes("quieter:")) {
        content = content.replace(/quieter:\s*\w+/gi, `quieter: ${val}`);
      } else {
        content += `\nquieter: ${val}\n`;
      }
      writeFileSync(memoryPath, content, "utf-8");
    }
  }

  public getDailyCap(): number {
    const defaultCap = 4;
    return this.isQuieterEnabled() ? Math.floor(defaultCap * 0.5) : defaultCap;
  }

  public queueDigestItem(item: { domain: string; action: string; timestamp: number }) {
    const queuePath = join(this.baseDir, "digest_queue.json");
    let queue: any[] = [];
    if (existsSync(queuePath)) {
      try {
        queue = JSON.parse(readFileSync(queuePath, "utf-8"));
      } catch {}
    }
    queue.push(item);
    writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
  }

  public getQueuedDigestItems(): any[] {
    const queuePath = join(this.baseDir, "digest_queue.json");
    if (!existsSync(queuePath)) return [];
    try {
      return JSON.parse(readFileSync(queuePath, "utf-8"));
    } catch {
      return [];
    }
  }

  public clearDigestQueue() {
    const queuePath = join(this.baseDir, "digest_queue.json");
    writeFileSync(queuePath, JSON.stringify([]), "utf-8");
  }

  public scoreUrgency(action: string, contextText: string): UrgencyResult {
    let score = 0;
    const lower = (action + " " + contextText).toLowerCase();
    
    if (lower.includes("critical") || lower.includes("error") || lower.includes("fail") || lower.includes("alert")) {
      score += 5;
    }
    if (lower.includes("security") || lower.includes("auth") || lower.includes("permission") || lower.includes("blocked")) {
      score += 4;
    }
    if (lower.includes("disk") || lower.includes("space") || lower.includes("cpu") || lower.includes("memory leak")) {
      score += 3;
    }
    if (lower.includes("schedule") || lower.includes("due") || lower.includes("deadline")) {
      score += 2;
    }
    
    return { score, urgent: score >= 5 };
  }
}
