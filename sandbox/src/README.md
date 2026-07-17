# Sandbox Module

This module implements the security boundary wrapper for running arbitrary script files or system tools.

## Sandbox Mechanism: Bubblewrap (bwrap)

On the Raspberry Pi 5, full virtual machine virtualization or heavy Docker daemon isolation poses unnecessary RAM overhead. We use **Bubblewrap** (`bwrap`) to achieve lightweight process namespace isolation:

### Default Sandboxing Script Pattern
```bash
bwrap \
  --ro-bind /usr /usr \
  --ro-bind /lib /lib \
  --ro-bind /lib64 /lib64 \
  --ro-bind /bin /bin \
  --ro-bind /sbin /sbin \
  --ro-bind /etc/alternatives /etc/alternatives \
  --dir /tmp \
  --proc /proc \
  --dev /dev \
  --unshare-all \
  --hostname sandbox-agent \
  --bind "${AGENT_WORKSPACE}" /workspace \
  --chdir /workspace \
  python3 script.py
```

### Constraints Applied
*   `--unshare-all`: Clones IPC, mount, network, PID, user, and UTS namespaces.
*   `--ro-bind`: Key operating system directories are bind-mounted read-only.
*   `--bind`: Only the agent's designated workspace directory is mounted writeable.
*   `--unshare-net` (by default): Completely blocks all network socket creation inside tool runs unless `networkAccess: true` is set in the agent's tool policy.
