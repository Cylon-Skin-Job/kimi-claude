---
title: "Phase 5: Auto-Block & Block Manager"
priority: high
status: not-started
implements: 07-agent-chat-and-hooks
depends-on: impl-phase-2, impl-phase-4
blocks: impl-phase-6
---

# Phase 5: Auto-Block & Block Manager

Tickets are auto-blocked on creation with a 9-minute cron timeout. Same-type tickets pile up and reset the timer. The fronting persona wakes on block expiry and run completion to manage the flow.

## Current State

**Blocking exists** in dispatch.js:
- `blocked_by: KIMI-XXX` — ticket waits for another ticket to close
- `blocks: "topic-name"` — blocks all tickets with matching topic in title
- `shouldDispatch()` checks both before claiming

**No auto-block.** Tickets are dispatched immediately when open + assignee matches + no blocks.

**No timer-based block removal.** Blocks are only cleared when the blocking ticket closes.

## Target State

```
Trigger fires → ticket created with blocked_by: "auto-hold"
  ↓
Timer set: 9 minutes (tracked by trigger name + agent)
  ↓
Another ticket from same trigger → timer resets to +9 min
  ↓
Timer fires → blocked_by cleared → dispatch picks it up
  ↓
Runner executes → notifies persona on completion
  ↓
Persona wakes → HISTORY.md update, decides what's next
```

## Steps

### 1. Auto-Block on Ticket Creation
- [ ] When `create-ticket` action fires from a TRIGGERS.md trigger:
  - Set `blocked_by: "auto-hold"` in ticket frontmatter
  - Record ticket in a hold registry: `{ triggerName, agentName, ticketId, timerId }`
- [ ] Non-trigger tickets (manually created) are NOT auto-blocked

### 2. Hold Timer Registry
- [ ] New module or section in dispatch: `holdRegistry`
- [ ] Map key: `${agentName}:${triggerName}` → `{ tickets: [ticketId, ...], timerId }`
- [ ] On new ticket from same trigger+agent:
  - Add ticket to the pile
  - Clear existing timer
  - Set new timer for 9 minutes
- [ ] On timer fire:
  - Remove `blocked_by: "auto-hold"` from all tickets in the pile
  - Clear the registry entry
  - Dispatch picks them up normally

### 3. Persona Wake on Block Expiry
- [ ] When hold timer fires and persona session is active:
  - Send a message to the persona's wire: "N tickets ready for review"
  - Persona decides: remove block (let run), bypass (skip stale), or reset timer
- [ ] When persona session is NOT active:
  - Just remove the block — let dispatch handle it automatically
  - Persona sees the results next time it wakes via HISTORY.md

### 4. Bypass Tagging
- [ ] New ticket state or tag: `state: bypassed` or `blocked_by: "bypass"`
- [ ] Dispatch skips bypassed tickets
- [ ] Persona can set bypass on older tickets that are superseded by newer ones

### 5. Run Completion Notification
- [ ] After runner completes a ticket:
  - If persona session is active for that agent, send completion message
  - Message includes: ticket title, prompt used, outcome, run path
- [ ] Persona can then do records maintenance (HISTORY.md already handled by Phase 3)

### 6. Update shouldDispatch()
- [ ] Recognize `blocked_by: "auto-hold"` as a valid block (already works — any non-null blocked_by blocks)
- [ ] Recognize `state: bypassed` as terminal (skip, don't dispatch)

## Files Modified
- `kimi-ide-server/lib/watcher/actions.js` — auto-block on trigger-sourced tickets
- `kimi-ide-server/lib/tickets/dispatch.js` — hold registry, timer management, bypass state
- `kimi-ide-server/server.js` — wire persona notification on block expiry + run completion

## New Concepts
- **Hold registry**: In-memory map of pending auto-holds. Not persisted — if server restarts, blocks remain on tickets but timers are lost. On restart, scan for `blocked_by: "auto-hold"` tickets and either clear them or re-set timers.
- **Bypass**: A ticket that was explicitly skipped by the persona. Terminal state — not re-dispatched.

## Verification
- [ ] Trigger creates ticket → ticket has `blocked_by: "auto-hold"`
- [ ] 9 minutes pass → block removed → dispatch claims and runs
- [ ] Second ticket from same trigger → timer resets (first ticket waits longer)
- [ ] Persona active → gets notification of ready tickets
- [ ] Persona bypasses a ticket → ticket marked bypassed, runner skips it
- [ ] Run completes → persona notified if active
- [ ] Server restart → auto-hold tickets detected and handled gracefully
