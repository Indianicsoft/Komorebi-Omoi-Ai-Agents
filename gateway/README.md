# Komorebi Omoi - Gateway Daemon

The Gateway serves as the orchestrator control plane of the **Komorebi Omoi** runtime. It manages user chat sessions, intercepts and normalizes messaging feeds from Telegram, implements execution queuing, and acts as the process manager for isolated Agent Runtimes.

---

## Getting Started

### 1. Environment Configuration

Create a `.env` file in the `gateway/` folder (or at the root of the workspace):

```ini
# Security Token required by clients (Agents / CLI) to talk to the Gateway
OPENKOMOREBI_GATEWAY_TOKEN=kore_admin_super_secret_token_change_me_12345

# Optional: Environment variables used in komorebi.config.json
GEMINI_API_KEY=your_gemini_api_key_here
BRAVE_API_KEY=your_brave_api_key_here
```

### 2. Installation & Compilation

Make sure dependencies are installed using `--no-bin-links` to bypass file system limits on NTFS/exFAT mounts:

```bash
cd gateway
npm install --no-bin-links
```

To build/typecheck the TypeScript source files:
```bash
npm run build
```

### 3. Running the Gateway Daemon

To compile and start the gateway process:
```bash
npm run gateway
```
The server will bind to `127.0.0.1:18789` (WebSocket server) and start listening for inbound Telegram client requests and agent processes.

---

## WebSocket RPC Protocol Reference

Communication between the Gateway and Agent processes is WebSocket-first using JSON frames.

### Message Frame Standard

1. **Request Frame (`type: "req"`)**:
   ```json
   {
     "type": "req",
     "id": "c1f786d7-8cfb-4e1b-b461-9c60dfd43c7b",
     "method": "methodName",
     "params": { ... }
   }
   ```
2. **Response Frame (`type: "res"`)**:
   ```json
   {
     "type": "res",
     "id": "c1f786d7-8cfb-4e1b-b461-9c60dfd43c7b",
     "ok": true,
     "payload": { ... }
   }
   ```
   *In case of error:*
   ```json
   {
     "type": "res",
     "id": "c1f786d7-8cfb-4e1b-b461-9c60dfd43c7b",
     "ok": false,
     "error": "Detailed description of error"
   }
   ```
3. **Event Frame (`type: "evt"`)**:
   ```json
   {
     "type": "evt",
     "event": "event:name",
     "data": { ... }
   }
   ```

### Gateway Methods (Callable by Agent Runtimes)

*   `registerAgent({ agentId, sessionId })`:
    Registers the connected client to listen for incoming Telegram messages matching that specific agent and session.
*   `sendTelegramMessage({ agentId, chatId, threadId, text, parseMode })`:
    Sends an outbound text/media message back to the Telegram chat. Supports optional target thread IDs (forum topics).
*   `busPublish({ topic, message })`:
    Publishes a message to the internal brokerless event bus.
*   `busSubscribe({ topic })`:
    Subscribes the connection to broadcast updates published on the specific bus topic channel.

### Client Methods (Callable by Gateway)

*   `handleMessage({ envelope, sessionKey })`:
    Triggered when a Telegram user sends a normalized message. The Gateway awaits the response (`ok: true`) to resolve the session queue and proceed with subsequent queue items.
