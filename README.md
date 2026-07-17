# 🌿 Komorebi Omoi

> **Komorebi (木漏れ日)** — sunlight filtering through leaves. **Omoi (思い)** — thought, feeling, intent.
> A self-hosted agentic AI runtime where thought filters through, one agent at a time.

Komorebi Omoi is an open-source, self-hosted multi-agent runtime inspired by
OpenClaw's architecture. Run up to 10 isolated AI agent personalities, each with
their own memory, skills, and behavioral boundaries, all reachable through
Telegram (and extensible to other channels) — with a real-time Dashboard, a
Gateway that owns every session, and a CLI as easy to set up as `komorebi init`.

Built for people who want an always-on personal AI assistant they fully own —
no cloud lock-in, runs comfortably on a Raspberry Pi 5.

---

## ✨ Features

- **Multi-Agent Runtime** — up to 10 isolated agent processes, each with its own
  `SOUL.md`, `AGENTS.md`, `USER.md`, `MEMORY.md`, `TOOLS.md`, `HEARTBEAT.md`
- **OpenAI-Compatible Models** — bring any OpenAI-compatible endpoint (Gemini,
  local models, OpenRouter, etc.), configurable per-agent
- **Telegram-Native** — full pairing/allowlist security, session isolation
  (DM/group/forum-topic), live-editing "preview streaming" replies, voice notes,
  reactions
- **ClawHub-Style Skills** — install, trust-verify, and hot-reload skills with
  progressive disclosure and circuit-breaker protection
- **Self-Healing** — 4-tier autonomous recovery ladder with a known-fixes
  database; the system detects and repairs its own failures
- **Learning Loop** — agents reflect on their own tool-call patterns and
  extract reusable skills over time
- **Proactive & Boundary-Aware** — a tiered autonomy model (DO/SUGGEST/ASK/NEVER)
  that learns your preferences instead of asking permission twice
- **Reliable Cron** — persisted, drift-resistant, idempotent scheduled jobs
  with exponential backoff
- **Real-Time Dashboard** — sessions, cron jobs, skills, bus traffic, health,
  and autonomy state, all live via WebSocket
- **CLI-First Setup** — `komorebi init` gets you running in minutes

---

## 🏗️ Architecture

```
Telegram Bot API
│
▼
grammY Runner (long polling)
│
▼
┌─────────────────────────────────────────────┐
│ GATEWAY │
│ Session Manager · Message Router · Queue │
│ Pairing & Allowlist · Cron Scheduler │
└───────────────┬───────────────────────────────┘
│ harness.runTurn()
▼
┌─────────────────────────────────────────────┐
│ AGENT RUNTIME (x10) │
│ Context Engine · Compaction · Tool Registry │
│ Skills (ClawHub) · Learning Loop · Watchdog │
└───────────────┬───────────────────────────────┘
│
▼
Response Formatter → Telegram
```

Full technical breakdown in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 🚀 Quick Start

```bash
npm install -g komorebi-omoi

komorebi init
# → walks you through: model provider, Telegram bot token,
#   number of agents, dmPolicy/groupPolicy defaults

komorebi start
# → Gateway + all configured agents come online

komorebi doctor
# → full health check across every subsystem
```

Dashboard available at `http://localhost:4173` after `komorebi start`.

### Requirements

- Node.js 22.19+
- An OpenAI-compatible model API key (Gemini, OpenRouter, local, etc.)
- A Telegram bot token ([get one from @BotFather](https://t.me/botfather))
- Raspberry Pi 5 (4GB+) or any Linux/macOS machine for self-hosting

---

## 📁 Project Structure

```
komorebi-omoi/
├── packages/
│ ├── gateway/ # Session manager, Telegram bridge, cron, pairing
│ ├── runtime/ # Agent core, harness, context engine, compaction
│ ├── dashboard/ # React/WS dashboard frontend
│ └── cli/ # komorebi CLI
├── agents/ # Per-agent workspace (gitignored — created at runtime)
├── docs/
│ ├── ARCHITECTURE.md
│ ├── CONFIGURATION.md
│ ├── SKILLS.md
│ └── SECURITY.md
├── examples/
│ └── komorebi.config.example.json
├── .env.example
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
└── README.md
```

---

## ⚙️ Configuration

Minimal `komorebi.json`:

```json
{
  "agents": {
    "defaults": {
      "provider": "openai-compatible",
      "model": "gemini-3.5-flash",
      "maxConcurrent": 5
    }
  },
  "channels": {
    "telegram": {
      "dmPolicy": "pairing",
      "groupPolicy": "allowlist",
      "textChunkLimit": 4000,
      "chunkMode": "newline"
    }
  }
}
```

Full reference in [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

---

## 🔐 Security

Komorebi Omoi agents can execute shell commands and read local files by
design — treat it like giving someone SSH access. Defaults are zero-trust:

- DM pairing required before any stranger's message reaches an agent
- Group allowlist blocks all unapproved chats silently
- Tool Policy + Elevated Permission + Sandbox as three independent layers
- Skill installs gated by a Trust Score Engine (VERIFIED/TRUSTED/UNKNOWN/SUSPICIOUS/UNTRUSTED)
- Gateway binds to localhost by default

Report vulnerabilities per [`SECURITY.md`](SECURITY.md) — do not open a public issue.

---

## 🗺️ Roadmap

- [ ] WhatsApp / Discord / Slack channel bridges
- [ ] Multimodal vision/voice pipeline (community contributions welcome)
- [ ] Web-based onboarding wizard
- [ ] ClawHub-compatible public skill registry mirror
- [ ] Multi-node clustering for >10 agents

---

## 🤝 Contributing

Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). Good first
issues are tagged `good-first-issue`.

---

## 📜 License

MIT © [indianicsoft](https://github.com/indianicsoft) — see [`LICENSE`](LICENSE)

---

## Acknowledgments

Architecturally inspired by [OpenClaw](https://openclaw.ai)'s Gateway/session
design and [Hermes](https://hermes-agent.nousresearch.com/). Komorebi Omoi is an independent project and is not affiliated with or
endorsed by OpenClaw.
