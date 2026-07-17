standard PR/issue guidelines, plus a note that new
ClawHub-style skills should go through the Trust Score Engine checks before
being proposed for the examples/skills directory.

Pre-Publish Checklist

- [ ] Create repo at github.com/indianicsoft/komorebi-omoi (Public)
- [ ] Add .gitignore BEFORE first `git add .` (blocks node_modules/, agents/, .env, *.sqlite)
- [ ] Push source only — no ~/.komorebi/ runtime state, no real bot tokens/API keys
- [ ] Add README.md, LICENSE (MIT), CONTRIBUTING.md, SECURITY.md
- [ ] Add .env.example with placeholder keys (never real ones)
- [ ] Add examples/komorebi.config.example.json (no real Telegram allowlist IDs)
- [ ] Add a Social Preview banner (1280×640px) in repo Settings → Social Preview
- [ ] Add all GitHub Topics listed above
- [ ] Double-check no SOUL.md/MEMORY.md/USER.md with real personal data is committed
- [ ] Publish release v0.1.0 with feature highlights as notes
- [ ] Open 8-10 starter "good-first-issue" tickets (e.g. "Add Discord channel bridge stub")
- [ ] Pin the repo to your @indianicsoft profile
