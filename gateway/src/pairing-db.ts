// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export interface PairingRecord {
  code: string;
  telegramUserId: number;
  agentId: string;
  requestedAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "rejected" | "expired";
}

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const stateDir = join(homedir(), ".komorebi", "state");
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const dbPath = join(stateDir, "komorebi.sqlite");
  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS pairings (
      code TEXT PRIMARY KEY,
      telegramUserId INTEGER NOT NULL,
      agentId TEXT NOT NULL,
      requestedAt INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      status TEXT NOT NULL
    )
  `);
  return dbInstance;
}

export function generateSetupCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function createPairing(telegramUserId: number, agentId: string): string {
  const db = getDb();
  
  // Clean expired pairings to keep DB tidy
  const now = Date.now();
  db.prepare("UPDATE pairings SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(now);

  // Check pending count per user per agent
  const countRow: any = db.prepare("SELECT COUNT(*) as count FROM pairings WHERE telegramUserId = ? AND agentId = ? AND status = 'pending'").all(telegramUserId, agentId)[0];
  const count = countRow?.count ?? 0;

  if (count >= 3) {
    // Delete the oldest pending request for this user/agent
    db.prepare(`
      DELETE FROM pairings WHERE code IN (
        SELECT code FROM pairings 
        WHERE telegramUserId = ? AND agentId = ? AND status = 'pending' 
        ORDER BY requestedAt ASC 
        LIMIT 1
      )
    `).run(telegramUserId, agentId);
  }

  const code = generateSetupCode();
  const requestedAt = Date.now();
  const expiresAt = requestedAt + 3600 * 1000; // 1 hour expiration
  const status = "pending";

  db.prepare("INSERT INTO pairings (code, telegramUserId, agentId, requestedAt, expiresAt, status) VALUES (?, ?, ?, ?, ?, ?)").run(
    code,
    telegramUserId,
    agentId,
    requestedAt,
    expiresAt,
    status
  );

  return code;
}

export function getPairing(code: string): PairingRecord | null {
  const db = getDb();
  // Auto expire first
  const now = Date.now();
  db.prepare("UPDATE pairings SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(now);

  const row = db.prepare("SELECT * FROM pairings WHERE code = ?").all(code)[0] as any;
  if (!row) return null;
  return {
    code: row.code,
    telegramUserId: Number(row.telegramUserId),
    agentId: row.agentId,
    requestedAt: Number(row.requestedAt),
    expiresAt: Number(row.expiresAt),
    status: row.status as any
  };
}

export function listPairings(agentId?: string, pendingOnly?: boolean): PairingRecord[] {
  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE pairings SET status = 'expired' WHERE status = 'pending' AND expiresAt < ?").run(now);

  let query = "SELECT * FROM pairings";
  const conditions: string[] = [];
  const params: any[] = [];

  if (agentId) {
    conditions.push("agentId = ?");
    params.push(agentId);
  }
  if (pendingOnly) {
    conditions.push("status = 'pending'");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY requestedAt DESC";

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(row => ({
    code: row.code,
    telegramUserId: Number(row.telegramUserId),
    agentId: row.agentId,
    requestedAt: Number(row.requestedAt),
    expiresAt: Number(row.expiresAt),
    status: row.status as any
  }));
}

export function approvePairing(code: string, agentId: string): PairingRecord {
  const pairing = getPairing(code);
  if (!pairing) throw new Error("Pairing code not found or expired.");
  if (pairing.agentId !== agentId) throw new Error("Pairing code is for a different agent.");
  if (pairing.status !== "pending") throw new Error(`Pairing code already ${pairing.status}.`);

  const db = getDb();
  db.prepare("UPDATE pairings SET status = 'approved' WHERE code = ?").run(code);
  pairing.status = "approved";

  // Add the user to the agent's allow list
  addUserToAgentAllowList(pairing.agentId, pairing.telegramUserId);

  return pairing;
}

function addUserToAgentAllowList(agentId: string, telegramUserId: number) {
  const userConfigPath = join(homedir(), ".komorebi", "komorebi.json");
  let config: any = {};
  if (existsSync(userConfigPath)) {
    try {
      config = JSON.parse(readFileSync(userConfigPath, "utf-8"));
    } catch {}
  }

  if (!config.agents) {
    config.agents = [];
  }

  let agent = config.agents.find((a: any) => a.id === agentId);
  if (!agent) {
    // If agent is not in komorebi.json, check komorebi.config.json in project root
    const rootConfigPath = join(process.cwd(), "komorebi.config.json");
    if (existsSync(rootConfigPath)) {
      try {
        const rootConfig = JSON.parse(readFileSync(rootConfigPath, "utf-8"));
        const rootAgent = rootConfig.agents?.find((a: any) => a.id === agentId);
        if (rootAgent) {
          // Clone it to user config
          agent = JSON.parse(JSON.stringify(rootAgent));
          config.agents.push(agent);
        }
      } catch {}
    }
  }

  if (!agent) {
    // Create skeleton
    agent = { id: agentId, name: agentId };
    config.agents.push(agent);
  }

  if (!agent.channels) {
    agent.channels = {};
  }
  if (!agent.channels.telegram) {
    agent.channels.telegram = {};
  }
  if (!agent.channels.telegram.allowFrom) {
    agent.channels.telegram.allowFrom = [];
  }

  // Ensure it's a numeric array and add it
  const allowFrom = agent.channels.telegram.allowFrom;
  if (!allowFrom.includes(telegramUserId)) {
    allowFrom.push(telegramUserId);
  }

  writeFileSync(userConfigPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`[PairingDB] Added user ${telegramUserId} to agent ${agentId} allowlist.`);
}
