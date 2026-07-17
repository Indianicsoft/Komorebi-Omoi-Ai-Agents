# Komorebi Omoi

> A self-hosted, lightweight, multi-agent AI runtime optimized for Raspberry Pi 5 (8GB) and personal servers. Built with 7-layer security gating, an isolated agents pool, and unified event-bus messaging.

---

## ⚡ Quick Start: 5 Minutes to Working Chat Session

Copy and run the one-command installer on your Raspberry Pi 5 or local server:

```bash
curl -fsSL https://komorebi.ai/install.sh | bash
```

*(For Windows PowerShell hosts)*:
```powershell
irm https://komorebi.ai/install.ps1 | iex
```

The installer will auto-configure Node.js 22+, build the typescript packages, link the global `komorebi` CLI tool, and boot the TUI onboarding wizard.

---

## 🛠️ CLI Operations Guide

Manage your complete multi-agent orchestrator from the command line:

```bash
# Start the onboarding wizard to configure models, Telegram bots, and agents
komorebi onboard

# Update specific configurations (credentials, chat lists, ports, agent count)
komorebi configure

# Audit system dependencies, connectivity pings, and repair workspace states
komorebi doctor [--fix]

# Process Lifecycle daemons
komorebi gateway start | stop | status | restart
komorebi agents list | status | add
komorebi logs [--follow]
```

---

## ⚙️ Configuration Schema

All settings are serialized in `~/.komorebi/komorebi.json`:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "openai-compatible": {
        "baseUrl": "http://localhost:11434/v1",
        "apiKey": "your-api-key",
        "api": "openai-responses",
        "models": [{ "id": "gpt-4o", "name": "GPT-4o" }]
      }
    },
    "default": "openai-compatible/gpt-4o"
  },
  "gateway": {
    "port": 18789,
    "bindLocalOnly": true,
    "authToken": "secure-admin-token"
  },
  "channels": {
    "telegram": {
      "botToken": "123456:ABC-BotToken",
      "allowedChatIds": ["987654321"]
    }
  },
  "agents": [
    {
      "id": "komorebi-1",
      "name": "Komorebi-1",
      "workspace": "/home/user/.komorebi/agents/komorebi-1"
    }
  ]
}
```
No manual JSON editing is required for 95% of users; every parameter is configurable interactively via the `configure` command.
