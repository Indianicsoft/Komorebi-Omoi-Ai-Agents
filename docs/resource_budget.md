# Resource Budget Analysis: Raspberry Pi 5 (8GB)

This document provides a detailed resource allocation plan for **Komorebi Omoi** running on a **Raspberry Pi 5 (8GB RAM, 4-core ARM Cortex-A76)**. The objective is to safely run up to 10 isolated agent instances concurrently without triggering the Linux Out-Of-Memory (OOM) killer or degrading system responsiveness.

---

## 1. System Profile & Constraints

*   **Processor**: Broadcom BCM2712 (4-core ARM Cortex-A76 @ 2.4GHz)
*   **Total RAM**: 8,192 MB (approx. 7,850 MB usable by user-space, assuming small GPU reservation)
*   **Storage**: MicroSD (UHS-I) or PCIe NVMe SSD (Recommended for fast database writes and workspace creation)
*   **Primary Workload**: Orchestration, state management, MCP protocol handshakes, vector DB lookups, local file system manipulation, and outbound network requests to the Gemini API.
*   **Offloaded Workload**: Core LLM inference is performed via the external **Gemini 3.5 Flash** API. The Pi 5 does *not* host any local neural network parameters.

---

## 2. Isolation Model Evaluation

To run 10 concurrent, isolated agents, we evaluate three primary isolation strategies:

| Metric | Container Isolation (Docker) | Process Isolation (Bubblewrap/systemd) | Worker Thread Isolation (Node/Python) |
| :--- | :--- | :--- | :--- |
| **Memory Overhead** | High (~150MB - 250MB per agent) | **Low (~30MB - 50MB per agent)** | Very Low (~10MB per agent) |
| **Security Boundaries** | Strong (Kernel namespaces) | **Strong (Kernel namespaces / bwrap)** | Weak (Shared memory address space) |
| **Fault Tolerance** | Strong (Process crash isolation) | **Strong (Process crash isolation)** | Weak (Unhandled error can crash process) |
| **Storage Footprint** | Heavy (Multiple Docker image layers)| **Light (Shared host libs / packages)** | Very Light (Single codebase) |
| **Raspberry Pi Fit** | Poor (3.0+ GB RAM just for container idle) | **Excellent (Fits within 10% RAM budget)** | Medium (Risk of memory leaks, poor security)|

### Recommendation: Process-Level Isolation with Linux Namespaces (Bubblewrap)
We recommend **Process-Level Isolation**. Each agent is spawned as a distinct OS process (e.g., Python runtime for the ReAct loop). 
Security and isolation are achieved using **Bubblewrap (`bwrap`)** (the sandbox engine behind Flatpak) or **systemd-run** with user namespaces:
1.  **Shared Runtime Libraries**: All processes share the host OS memory cache for Python binaries and common system libraries (`libc`, standard libraries). This reduces physical RAM footprint.
2.  **Resource Caps (cgroups)**: We enforce hard memory and CPU limits per process using Linux Control Groups (`cgroups`).
3.  **Strict File System Jailing**: The agent's process is chrooted into its own workspace folder (`/workspace/agent_ID`), with the rest of the host file system mounted as read-only or hidden entirely.
4.  **Network Policies**: The agent runtime has network access to contact the Gateway and the Gemini API, but tool execution subprocesses are run with net namespace isolation disabled (no network access) unless explicitly whitelisted by the agent's tool policy.

---

## 3. Memory Budget Breakdown (Total: 8,192 MB)

To prevent OOM, we set a strict memory ceiling on every component of the system.

```
+-------------------------------------------------------------+
| OS & Daemon Overhead (1,024 MB)                            |
+-------------------------------------------------------------+
| Gateway, Telegram Bridge & Event Bus (400 MB)              |
+-------------------------------------------------------------+
| Database & Vector Store (SQLite/Qdrant) (500 MB)           |
+-------------------------------------------------------------+
| 10 x Isolated Agents (500 MB Limit per Agent = 5,000 MB)    |
+-------------------------------------------------------------+
| Unallocated RAM Buffer & Swap Space (1,268 MB)              |
+-------------------------------------------------------------+
```

### Allocation Details

1.  **Operating System (Debian/Raspberry Pi OS Lite)**: **1,024 MB**
    *   Systemd, SSH, logging, basic kernel drivers, page tables, and file cache.
2.  **Komorebi Control Plane (Node.js / TS)**: **400 MB**
    *   **Gateway / Orchestrator**: ~250 MB RSS (Resident Set Size).
    *   **Telegram grammY Channel Bridge**: ~150 MB RSS.
3.  **Shared Bus & Data Services**: **500 MB**
    *   **Inter-Agent Bus**: In-memory message routing (Redis or Node-embedded Event Broker): ~100 MB.
    *   **Vector DB / Memory Storage**: ChromaDB or Qdrant run in single-node embedded mode, with vector databases for 10 agents restricted to SQLite/file backends to avoid dedicated server daemon overheads: ~400 MB.
4.  **Agent Pool (10 Instances)**: **5,000 MB**
    *   **Memory Ceiling per Agent**: **500 MB**
    *   **Baseline Python agent execution overhead**: ~45 MB.
    *   **Execution buffer (for tools running compiler tasks, parsing JSON, writing files)**: ~455 MB.
5.  **Free Memory Buffer**: **1,268 MB**
    *   Essential cache cushion to prevent disk thrashing and absorb temporary bursts.

### OOM Prevention Strategy
Each agent is started using a wrapper script that imposes a `cgroup` memory limit of `500M`.
```bash
# Example invocation via systemd-run to bind the agent process to a 500MB RAM limit
systemd-run --scope -p MemoryMax=500M -p MemorySwapMax=100M --user python agent-runtime/src/main.py --agent-id agent_001
```
If an agent executes an out-of-control script that leaks memory, only *that specific agent process* is killed by the kernel. The Gateway detects the termination, closes the connection, outputs a clean crash observation to the user via Telegram, and restarts the agent.

---

## 4. CPU & Threading Budget

The Pi 5 features 4 physical Cortex-A76 cores. Because the agents offload all heavy inference (LLM calls) to external APIs, they operate primarily in an **I/O-bound** state (waiting for networks or reading/writing workspaces). 

To prevent a single runaway loop (e.g., `while True: pass`) from freezing the entire Pi, we budget CPU time slices:

1.  **OS & Control Plane Core Pinning**:
    *   We allocate cores `0` and `1` as preferred cores for the OS, Gateway, and Telegram Bridges.
2.  **Agent CPU Shares**:
    *   We assign a maximum CPU weight of `50` (or `CPUQuota=50%` in systemd) to each agent.
    *   If 4 agents simultaneously enter infinite computational loops, they will be throttled to use no more than 50% of a single core each, leaving 2 full cores completely free to handle Telegram polling, Gateway orchestration, and system CLI.

---

## 5. Storage (Disk I/O) Budget

A major bottleneck on the Raspberry Pi 5 is SD card write speed. With 10 agents writing logs, vector indexes, and workspace files, disk I/O could saturate and freeze the system.

### Mitigations
*   **Log Batching**: Agent execution traces are held in RAM and flushed to SQLite databases in batches every 5 seconds.
*   **Vector Index Buffering**: Long-term memory index writes are staged in-memory and committed to disk asynchronously.
*   **Workspace tmpfs option**: For agents performing highly transient tasks (scratch calculations), their workspaces are mounted as a `tmpfs` (RAM-disk) limited to 50MB, bypassing the SD card entirely.
