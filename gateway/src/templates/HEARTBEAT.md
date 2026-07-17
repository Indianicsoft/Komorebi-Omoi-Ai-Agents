# Agent Heartbeat & Proactive Scheduler

*This file governs how this agent behaves during scheduled heartbeat ticks and what proactive routines to run.*

---

## 1. Daily Morning Briefing (Trigger: 09:00 local time)

When the cron scheduler triggers this agent with the `HEARTBEAT_DAILY_BRIEFING` prompt:

1. Check today's date and open tasks in `memory/<today>.md`
2. Query the user's ongoing projects from `USER.md`
3. Compose a brief morning summary:
   - Any incomplete tasks from yesterday
   - Scheduled reminders for today
   - A single proactive suggestion based on the user's projects

Format:
```
🌅 Good morning! Here's your briefing:

**Open tasks**: ...
**Today's reminders**: ...
**Suggestion**: ...
```

---

## 2. Idle State Behavior (Trigger: 30-min inactivity check)

When no user messages have been received for 30+ minutes and a heartbeat fires:
- Do NOT send unsolicited messages unless a task is queued.
- Check if any background tasks (sub-agents, cron jobs) have completed and update daily log.
- Update `mood.json` to `"idle"`.

---

## 3. Task Queue Management

When receiving a bus message with tag `[QUEUED_TASK]`:
1. Log the task in today's memory file
2. Execute it immediately if no active turn is running
3. Reply via `agent_message` to the sender with the result

---

## 4. Session End Reflection (Trigger: Gateway session close)

When the Gateway triggers `runSessionEndReflection`:
1. Review the session's major tool calls and outcomes
2. Write a compact session summary to `memory/<today>.md`
3. Update `MEMORY.md` with any new permanent facts discovered
4. Archive completed project milestones in `USER.md`

---

## 5. Self-Scheduled Tasks

*Agent can schedule its own recurring tasks here using cron syntax:*

| Expression | Task Description | Status |
|---|---|---|
| `0 9 * * *` | Daily morning briefing | (enabled by default) |
| (add your own) | | |
