---
title: "End-to-End Testing: Agent Persona Chat"
priority: high
status: not-started
depends-on: client-side chat renderer fix
---

# End-to-End Testing: Agent Persona Chat

Cannot begin until the chat renderer is fixed. Once ready:

## Test Plan

### 1. Server Startup
- [ ] Server starts without errors
- [ ] TRIGGERS.md parsed for all 3 agents (check console logs)
- [ ] Cron triggers registered (daily-freshness, nightly-audit)
- [ ] Hold registry created

### 2. Agent Persona Chat
- [ ] Send `thread:open-agent` with `agentPath: "System/wiki-manager"`
- [ ] Verify: ThreadManager created for agent container
- [ ] Verify: daily-rolling strategy resolves today's thread (UUID folder, date field in threads.json)
- [ ] Verify: wire spawned with `--session {threadId}`
- [ ] Verify: first prompt includes `system` field with PROMPT.md + MEMORY.md content
- [ ] Verify: subsequent prompts omit `system` field
- [ ] Verify: persona responds with awareness of its identity (knows it's the wiki manager)

### 3. Session Invalidation
- [ ] Touch MEMORY.md (change mtime)
- [ ] Send `thread:open-agent` again
- [ ] Verify: old thread archived (suspended in threads.json)
- [ ] Verify: new daily thread created
- [ ] Verify: fresh system context loaded

### 4. Trigger → Ticket → Run → Notification
- [ ] Edit a JS file in kimi-ide-server/lib/ to fire source-file-change trigger
- [ ] Verify: ticket created with `prompt: PROMPT_01.md` and `blocked_by: auto-hold`
- [ ] Verify: hold registry tracks the ticket
- [ ] Wait 9 minutes (or reduce for testing) → block removed
- [ ] Verify: dispatch claims and runs the ticket
- [ ] Verify: HISTORY.md gets one-liner appended
- [ ] Verify: if persona wire is active, it receives run completion notification

### 5. Strategy Behavior
- [ ] daily-rolling: open agent → today's thread. Close, reopen → same thread.
- [ ] daily-rolling: next day → new thread, old one viewable
- [ ] Verify threads.json has UUID keys with `date` field

### 6. Block Manager
- [ ] Multiple tickets from same trigger pile up
- [ ] Timer resets on each new ticket
- [ ] On expiry: all tickets unblocked
- [ ] Persona notified via onRelease callback
