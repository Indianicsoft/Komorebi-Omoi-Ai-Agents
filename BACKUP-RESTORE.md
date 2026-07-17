# Komorebi Omoi Production Backup & Recovery Procedures

This guide defines the procedures for backing up and restoring active configurations, agent workspaces, and skill registries in the Komorebi Omoi runtime on a Raspberry Pi 5.

## 1. Backup Scope & Assets
The following directories under `~/.komorebi` are required to recover the complete operational state of the system:
1. **System Config**: `~/.komorebi/komorebi.json` (defines port bindings, Telegram bots, and agent manifests).
2. **Agent Workspaces**: `~/.komorebi/agents/` (contains files like `soul.md`, `identity.md`, `user.md`, `memory.md`, `agents.md`, `tools.md`, and history `session.jsonl`).
3. **Skill Locks**: `~/.komorebi/shared-skills/` and lock definitions under `.clawhub/`.

---

## 2. Automated Backup Procedure
Run the following SRE tarball command to create a timestamped backup archive of the system state:

```bash
mkdir -p ~/komorebi-backups
tar --exclude='**/node_modules' --exclude='**/.history' -czf ~/komorebi-backups/komorebi-backup-$(date +%F).tar.gz -C ~/.komorebi .
```

> [!NOTE]
> This command automatically excludes local history logs and workspace node_modules folder caches to keep the backup size optimized for Pi 5 storage profiles.

---

## 3. Disaster Recovery & Restoration
To perform a complete clean-slate restoration from a backup archive:

### Step A: Stop Active Daemons
Stop the gateway and all active agents before performing modifications on disk:
```bash
komorebi gateway stop
```

### Step B: Extract Backup
Wipe any corrupted workspace structures and extract the backup archive:
```bash
rm -rf ~/.komorebi/*
tar -xzf ~/komorebi-backups/komorebi-backup-YYYY-MM-DD.tar.gz -C ~/.komorebi
```

---

## 4. Post-Restore Verification Checks
Once restored, verify system health using the SRE integration suite:

1. **Verify Workspace Paths & Node Harnesses**:
   ```bash
   komorebi doctor
   ```
2. **Verify Security Policies & Key Interpolations**:
   ```bash
   komorebi security audit
   ```
3. **Start the Gateway**:
   ```bash
   komorebi gateway start
   ```
