import { describe, it, expect, beforeAll } from "vitest";
import { ProactivityManager } from "../../agent-runtime/src/runtime/proactivity.js";
import { join } from "node:path";
import { homedir } from "node:os";
import { writeFileSync, mkdirSync } from "node:fs";

describe("Proactivity Classifier & Cap Logic Unit Tests", () => {
  let manager: ProactivityManager;
  const agentId = "test-agent";

  beforeAll(() => {
    const agentDir = join(homedir(), ".komorebi", "agents", agentId);
    
    // Clean up pre-existing files to guarantee clean state
    const proactivityDir = join(agentDir, "proactivity");
    const { rmSync, existsSync } = require("node:fs");
    if (existsSync(proactivityDir)) {
      try {
        rmSync(proactivityDir, { recursive: true, force: true });
      } catch {}
    }

    mkdirSync(agentDir, { recursive: true });
    
    // Write mock soul.md with NEVER rules
    writeFileSync(
      join(agentDir, "soul.md"),
      `# Agent Soul\n\n## Behavioral Boundaries\n- NEVER delete files\n- NEVER uninstall packages\n`,
      "utf-8"
    );

    manager = new ProactivityManager(agentId, agentDir);
  });

  it("should classify destructive commands as NEVER based on soul.md", async () => {
    const tier = await manager.classifyAction("files", "delete some file", "session-123");
    expect(tier).toBe("NEVER");
  });

  it("should score urgency correctly based on keywords", () => {
    const criticalRes = manager.scoreUrgency("critical memory leak", "System is failing");
    expect(criticalRes.urgent).toBe(true);
    expect(criticalRes.score).toBeGreaterThanOrEqual(5);

    const normalRes = manager.scoreUrgency("read some config file", "Just routine checks");
    expect(normalRes.urgent).toBe(false);
    expect(normalRes.score).toBeLessThan(5);
  });

  it("should respect quieter mode cap adjustments", () => {
    const standardCap = manager.getDailyCap();
    expect(standardCap).toBe(4);

    manager.setQuieter(true);
    const reducedCap = manager.getDailyCap();
    expect(reducedCap).toBe(2); // 50% cap reduction
  });
});
