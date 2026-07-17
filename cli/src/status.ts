import axios from "axios";
import { loadConfig } from "./config.js";
import pc from "picocolors";

export async function showAgentsStatus() {
  const config = loadConfig();
  const token = config.gateway.authToken;
  const port = config.gateway.port;
  const host = config.gateway.bindLocalOnly ? "127.0.0.1" : "0.0.0.0";

  const statusUrl = `http://127.0.0.1:${port}/api/agents/status`;
  console.log(pc.blue(`[CLI] Querying active agents list from: ${statusUrl}...`));

  try {
    const response = await axios.get(statusUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 5000
    });

    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) {
      console.log(pc.yellow("No active agent sessions are currently tracked in the pool."));
      return;
    }

    renderTable(data);
  } catch (err: any) {
    console.error(pc.red(`[CLI] Error connecting to Gateway status endpoint: ${err.message}`));
    console.log(pc.yellow("Ensure the Gateway is running (execute 'komorebi gateway start')"));
    process.exit(1);
  }
}

function renderTable(data: any[]) {
  console.log(pc.cyan("--------------------------------------------------------------------------------------------------"));
  console.log(pc.cyan("| Agent ID             | Session ID                     | PID    | RAM (MB) | Uptime     | Restarts | Status   |"));
  console.log(pc.cyan("--------------------------------------------------------------------------------------------------"));
  for (const item of data) {
    const agentId = item.agentId.padEnd(20).slice(0, 20);
    const sessionId = item.sessionId.padEnd(30).slice(0, 30);
    const pid = String(item.pid || "N/A").padEnd(6);
    const ram = `${item.ramUsageMb} MB`.padEnd(8);
    
    // Format uptime
    const uptimeSec = Math.floor(item.uptimeMs / 1000);
    const m = Math.floor(uptimeSec / 60);
    const s = uptimeSec % 60;
    const uptimeStr = `${m}m ${s}s`.padEnd(10);
    
    const restarts = String(item.restarts).padEnd(8);
    const status = item.status.padEnd(8);

    console.log(`| ${agentId} | ${sessionId} | ${pid} | ${ram} | ${uptimeStr} | ${restarts} | ${status} |`);
  }
  console.log(pc.cyan("--------------------------------------------------------------------------------------------------"));
}
