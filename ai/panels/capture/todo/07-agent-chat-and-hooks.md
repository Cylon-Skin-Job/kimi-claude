---
title: "Unified Agent Model: Identity, Triggers & Sessions"
priority: high
status: not-started
depends-on: 01-agent-prompts
---

# Unified Agent Model: Identity, Triggers & Sessions

One managed workspace per domain. One fronting persona. Multiple numbered prompts. Triggers bind events to prompts and create tickets directly. The fronting persona is a block manager and domain expert — it never executes runs, only controls when work proceeds. Everything the persona does is expressed as triggers + prompts. No special cases.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Agent Managed Workspace                      │
│            (e.g., agents/wiki-manager/)                   │
│                                                           │
│  PROMPT.md  ← who you are (points to wiki for standards)│
│  MEMORY.md    ← user relationship (preferences, persona)  │
│  HISTORY.md   ← run activity log (recent + daily)         │
│  LESSONS.md   ← process learnings (craft improvement)     │
│  TRIGGERS.md  ← when to activate + which prompt to run    │
│  PROMPT_NN.md ← runner specializations                    │
│                                                           │
│  ┌───────────────────────────────────────────────┐       │
│  │     Fronting Persona (block manager + expert)  │       │
│  │                                               │       │
│  │  Loads: PROMPT.md + MEMORY.md               │       │
│  │  Reads: HISTORY.md, LESSONS.md, runs/          │       │
│  │  Can introspect: own prompts, triggers, domain │       │
│  │  Wakes on: block expiry, run completion        │       │
│  │  Actions: set/remove/bypass blocks, maintain   │       │
│  │           records, self-reflect, advise user   │       │
│  │  NEVER executes runs                           │       │
│  └──────────────┬────────────────────────────────┘       │
│                 │ manages blocks                          │
│  ┌──────────────▼────────────────────────────────┐       │
│  │        Trigger System (automated)              │       │
│  │                                               │       │
│  │  File changes / crons → create tickets directly│       │
│  │  Each ticket auto-blocked (9-min cron timeout) │       │
│  │  Same-type tickets pile up, reset cron (+9 min)│       │
│  │  Ticket carries: prompt field (PROMPT_NN.md)   │       │
│  └──────────────┬────────────────────────────────┘       │
│                 │ block expires → runner picks up         │
│  ┌──────────────▼────────────────────────────────┐       │
│  │        Background Runner (ephemeral)           │       │
│  │                                               │       │
│  │  Loads: PROMPT_NN.md (from ticket) + LESSONS.md│       │
│  │  Writes: runs/{timestamp}/, HISTORY.md (1-liner)│       │
│  │  Notifies persona on completion                │       │
│  │  No persona awareness, no MEMORY.md            │       │
│  └───────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

## Block Manager Pattern

The fronting persona is a sleeping gatekeeper, not an executor. It controls *when* work proceeds.

### Flow

```
Trigger fires → ticket created (auto-blocked, 9-min cron)
  ↓
More tickets of same type arrive → pile up, cron resets to +9 min
  ↓
Cron expires → persona wakes
  ↓
Persona checks the pile:
  → Remove block on ticket(s) ready to run
  → Bypass stale/superseded tickets (skip them)
  → Reset cron if not ready yet
  ↓
Runner picks up unblocked ticket → executes → notifies persona
  ↓
Persona wakes on completion:
  → Updates HISTORY.md (one-liner)
  → Checks for LESSONS.md-worthy patterns
  → Goes back to sleep
```

### What the Persona Does

| Action | When |
|--------|------|
| Set block | Auto, on new ticket |
| Remove block | Block expiry — pile is ready |
| Bypass ticket | Older ticket superseded by newer one |
| Reset cron | Not ready yet, wait longer |
| Delete cron | All tickets handled, nothing pending |
| Records maintenance | Run completion notification |
| Self-reflect | User asks, or scheduled trigger |
| Introspect domain | User points at a problem — persona investigates using agentic tools |

### No Special Cases

Everything the persona does is a trigger + prompt. Want it to detect drift from wiki standards? Add a trigger and a prompt. Want it to review its own LESSONS.md periodically? Cron trigger + prompt. Want it to edit its own prompts when it discovers improvements? Trigger + prompt. The mechanism is uniform.

## Session Model

### Session Invalidation via MEMORY.md

```
User opens agent tab:
  MEMORY.md mtime > last message in current --session?
    → Yes: archive thread to threads/, start fresh with PROMPT.md + MEMORY.md
    → No:  reattach to existing session
```

- MEMORY.md changes = persona context changed = need fresh session
- HISTORY.md changes = new activity = existing session can absorb it
- No background compaction process needed

### Nightly Audit

```yaml
# In TRIGGERS.md
---
name: nightly-audit-and-consolidate
type: cron
schedule: "daily 02:00"
condition: "lastChatMessage.age > 30m"
retry: "30m"
prompt: PROMPT_AUDIT.md
message: |
  Nightly audit. Review today's runs, extract lessons,
  consolidate HISTORY.md.
---
```

- Condenses HISTORY.md "Recent" entries into a daily summary line
- Only touches MEMORY.md if a new pattern is discovered (which triggers session invalidation)
- Condition prevents running while user is actively chatting
- Retry checks again in 30 minutes if condition fails

## Tasks

### PROMPT.md
- [ ] Define format: persona, scope, lifecycle rules, pointer to wiki standards page
- [ ] PROMPT.md tells the agent: "The standard for your work is in the wiki. Your prompts execute that standard."
- [ ] Write PROMPT.md for wiki-manager, code-manager, ops-manager

### MEMORY.md — User Relationship Persistence
- [ ] Format: active instructions, user preferences, persona continuity notes
- [ ] Updated by the fronting persona after user interactions
- [ ] mtime serves as session invalidation signal
- [ ] On session start: load PROMPT.md + MEMORY.md as system context

### HISTORY.md — Activity Log
- [ ] Format: "Recent" section (granular, since last audit) + "Daily Summaries" section (condensed)
- [ ] Runner appends one-liner after each completed run
- [ ] Nightly audit condenses Recent → daily summary, clears Recent
- [ ] Progressive disclosure: HISTORY.md → runs/manifest.json → runs/steps/
- [ ] Rolling window: keep 14 days of daily summaries

### Block Manager Infrastructure
- [ ] Auto-block on ticket creation: new ticket gets a block + 9-min cron timeout
- [ ] Same-type debounce: additional tickets of same type reset cron to +9 min
- [ ] Block expiry notification: wake fronting persona when cron fires
- [ ] Run completion notification: wake fronting persona when runner finishes
- [ ] Persona actions: set block, remove block, bypass (skip stale), reset cron, delete cron
- [ ] Bypass tagging: mark skipped tickets so runner ignores them

### TRIGGERS.md — Trigger-to-Prompt Binding
- [ ] Each trigger block specifies: name, type, events, match, exclude, condition, gate, delay, prompt, message
- [ ] Triggers create tickets directly — no fronting persona in loop
- [ ] Ticket frontmatter carries `prompt: PROMPT_NN.md`
- [ ] Trigger conditions: lastChatMessage.age, fileStats, parentStats, etc.
- [ ] Gate types: debounce, immediate, resettable-delay, time-window
- [ ] Retry field for failed conditions
- [ ] All persona behaviors expressed as trigger + prompt — no hardcoded special cases

### Session Management
- [ ] On tab open: compare MEMORY.md mtime vs last message timestamp in current session
- [ ] If MEMORY.md newer: archive thread to threads/, spawn fresh session
- [ ] If session still valid: reattach with --session {threadId}
- [ ] Thread archival: move to threads/{date}/ with CHAT.md + history.json
- [ ] No multi-thread UI — single chat area, no thread list/switching

### Runner Integration
- [ ] Runner reads `prompt` field from ticket frontmatter → loads that PROMPT_NN.md
- [ ] After run completes: append one-liner to HISTORY.md with timestamp, prompt used, outcome, run path
- [ ] Manifest records which prompt was used: `"prompt": "PROMPT_02.md"`

### Wiki as Living Standard
- [ ] Create Wiki-Editing-Standards page — how wiki updates should be done properly
- [ ] PROMPT.md references this page — the agent checks its work against the wiki
- [ ] If prompts drift from wiki standards → user or agent adjusts prompts to realign
- [ ] Future: agent pages for code standards, ops standards, etc.

## Example TRIGGERS.md (wiki-manager)

```yaml
---
name: source-file-change
type: file-change
events: [modify, create, delete]
match: "kimi-ide-server/lib/**/*.js"
exclude: ["ai/workspaces/capture/**"]
gate: debounce
delay: 20m
prompt: PROMPT_01.md
message: |
  Source file changed: {{filePath}} ({{event}})
  Delta: {{delta}}
---

---
name: wiki-page-changed
type: file-change
events: [modify]
match: "ai/workspaces/wiki/**/PAGE.md"
gate: immediate
prompt: PROMPT_03.md
message: |
  Wiki page changed: {{filePath}}
  Check edges for consistency.
---

---
name: daily-freshness
type: cron
schedule: "daily 09:00"
prompt: PROMPT_02.md
message: |
  Scheduled freshness check.
---

---
name: nightly-audit
type: cron
schedule: "daily 02:00"
condition: "lastChatMessage.age > 30m"
retry: "30m"
prompt: PROMPT_AUDIT.md
message: |
  Nightly audit. Consolidate HISTORY.md and review LESSONS.md.
---
```

## Design Decisions

- **PROMPT.md, not ASSISTANT.md**: No collision with CLI terminology. Says exactly what it is.
- **Persona as block manager, not executor**: The persona never runs work. It controls *when* work runs by managing blocks. This keeps it lightweight and gives it intelligent scheduling power — it can see the pile, skip stale work, batch related tickets.
- **Auto-block with debounce cron**: Moves debounce logic out of the trigger system and into a layer the persona controls. Triggers fire immediately and create tickets; the persona decides when to release them.
- **Self-aware persona**: The persona can introspect its own configuration — prompts, triggers, lessons, runs. When the user points at a problem, the persona investigates using agentic tools rather than requiring the user to diagnose.
- **Everything is a trigger + prompt**: No special cases, no hardcoded behaviors. Self-reflection, drift detection, prompt editing, records maintenance — all expressed uniformly as trigger blocks pointing to prompt files.
- **Three memory files, three purposes**: MEMORY.md (relationship), HISTORY.md (activity), LESSONS.md (craft). Different lifecycles, different audiences.
- **MEMORY.md mtime as session signal**: Simple stat check, no background process, no wind-down trigger.
- **Wiki as standard, prompts as execution**: The wiki explains *how to do the work properly*. Prompts implement that standard. Drift between them is visible and correctable.
- **Progressive disclosure for run history**: HISTORY.md → manifest.json → step evidence. Agent only goes as deep as needed.
- **Nightly audit with condition gate**: Won't interrupt active user sessions. Retries if needed.
