---
name: telegram-broadcast
description: Broadcasts a text message or update to multiple pre-configured Telegram chat IDs.
tags:
  - communication
  - notification
---

# Telegram Broadcast Skill

This skill details how to broadcast announcements, warnings, or regular status reports to multiple Telegram chat IDs.

## Operating Manual

### 1. Ingest Targets
Locate the target chat IDs from the user request or retrieve them from `MEMORY.md`. Typical format is an array of numeric identifiers.

### 2. Format Payload
Format the message. Keep paragraphs brief and utilize basic markdown formats:
*   Bold critical warnings or headers.
*   Use bulleted items for lists.

### 3. Execution Loop
For each target `chatId`, call the `telegram_send` tool:
- Text: The formatted announcement text.
- If a specific thread (forum topic) is requested, supply the `threadId` parameter.

### 4. Verification
Compile the output status of all tool calls. Summarize the results back to the user (e.g., "Successfully broadcast to 4 of 5 channels").
