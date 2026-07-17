# WakeEvent Protocol & Input Normalization

All agent actions in Komorebi Omoi are triggered by a normalized `WakeEvent` structure. No code path is permitted to invoke the agent runtime directly without passing through this boundary.

## 1. WakeEvent Schema

```typescript
export interface WakeEvent {
  type: "message" | "heartbeat" | "cron" | "hook" | "webhook";
  sessionId: string;
  agentId: string;
  payload: {
    message?: string;
    envelope?: any;
    cadence?: string;      // For heartbeat ticks
    cronExpression?: string; // For cron schedules
    hookName?: string;     // For hook subscriptions
    hookData?: any;        // Context details
    body?: any;            // External webhook JSON data
    headers?: Record<string, string>;
  };
  timestamp: number;
}
```

## 2. The Five Input Sources

### A. Message
- **Trigger**: Inbound message from Telegram or WebChat.
- **Normalization**: Translates the raw chat message and metadata envelope into a `"message"` type event.

### B. Heartbeat
- **Trigger**: Periodic intervals (default 30 mins) based on the agent's `HEARTBEAT.md` config.
- **Normalization**: Checks for proactive tasks or opportunites and formats a heartbeat tick wake trigger.

### C. Cron
- **Trigger**: Gateway cron job schedules.
- **Normalization**: Runs at scheduled intervals, passing the cron expression and prompt definition to the agent.

### D. Hook
- **Trigger**: A plugin hook event fired inside the runtime.
- **Normalization**: Activates the agent turn on events like file alterations or repository status changes.

### E. Webhook
- **Trigger**: POST request on the Gateway's HTTP endpoint.
- **Normalization**: Maps incoming payloads, route parameters, and authorization headers to the target session key.
