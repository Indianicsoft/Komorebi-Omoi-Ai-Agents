# ClawHub Skill Installation Security & Trust Policies

Every skill installation is evaluated by a multi-layer security architecture before being activated inside any agent process.

## 1. Static Scanner Heuristics (Best-Effort)

> [!WARNING]
> The static analysis scanner run during installation (`komorebi skills install` or dashboard installation) is a **best-effort heuristic scan** for dangerous patterns. It is **not a formal verification guarantee**.
> Obfuscated code, dynamically loaded remote payloads, or complex injection vectors might bypass static analysis.

The static scanner performs inline pattern matching on `.md`, `.sh`, `.js`, and `.ts` files inside skill packages for:
- **Dynamic Code Execution**: Rejects packages using `eval(...)`.
- **Raw Command Execution**: Rejects packages invoking shell execution (`exec(...)`, `execSync(...)`) without explicitly declaring it in the permissions manifest.
- **Undeclared Outbound Calls**: Rejects packages making network calls (`fetch(...)`, `http.get(...)`, `axios`, etc.) when the permissions manifest states `networkAccess: false`.

## 2. Unverified Publisher Warning Badges

- Any skill package not published by a **ClawHub Verified Publisher** or lacking signature authentication will display a visible **yellow warning badge** `[Unverified]` in the CLI, on the dashboard, and when candidate lists are shown to users.
- Agents are instructed to explicitly mention the unverified status of skills to users during self-install requests.

## 3. Human-in-the-Loop Confirmation Gating

Regardless of whether an agent has `autoInstallSkills: true` configured:
- **Skills requesting `exec` (shell operation) or `network` permissions ALWAYS require explicit human confirmation.**
- The runtime will route a command approval request to the user via Telegram/WebChat and wait for click-action approval. The agent process is blocked from installing the skill until approval is received.
- Deny-always-wins: If the skill requests permissions not granted to the target agent process (defined in `agent.config.json` -> `toolPolicy`), the install is **unconditionally refused** without prompting the user.

## 4. Rate-Limiting

- Agents are restricted to a maximum of **5 self-install attempts per hour** to prevent looping behaviors or malicious installation storms. Attempt counters are persisted in the agent's lock file (`.clawhub/lock.json`) and checked dynamically.
