# Ticketing System Specification

Local-first ticketing with GitLab Issues as the collaboration layer. Tickets are created locally, synced bidirectionally with GitLab, and dispatched to background agents by assignment.

---

## Core Model: Three Columns, One Mechanism

```
INBOX              OPEN                COMPLETED
(assigned: human)  (assigned: bot)     (state: closed)
```

The column is determined entirely by **assignee + state**. No lifecycle labels, no routing tags, no status fields.

- **Assigned to a human** → INBOX (human decides what to do)
- **Assigned to a bot name** → OPEN (server dispatches to agent, agent runs)
- **Closed** → COMPLETED (done)

---

## Ownership Model

```
Local wiki     = source of truth      → GitLab = sandbox/collaboration
Local tickets  = source of truth      → GitLab = sandbox/collaboration
GitHub         = frozen/published
```

| Scenario | Source of truth | Sync direction |
|----------|----------------|----------------|
| You create a ticket locally | Local | Push → GitLab |
| Friend creates an issue on GitLab | GitLab | Pull → local |
| Agent changes status locally | Local | Push → GitLab |
| Friend comments on GitLab | GitLab | Pull → local |
| Agent closes ticket locally | Local | Push closed → GitLab |

Rule: **Whoever created it owns it. Status always syncs both ways.**

---

## Workspace Ownership

Each workspace owns its domain. No workspace reaches into another's logic.

```
Cron jobs       →  create tickets, assign bots. That's it.
Issues          →  the board. Sync, status, columns. That's it.
Agents          →  run the work. Own the runner, wire loop, everything.
```

The server is a thin relay between workspaces. It doesn't own business logic.

### Handoff Sequence

```
Cron:    "Here's a ticket. Assigned to kimi-wiki."  → drops in issues/tickets/
Issues:  "New ticket."                               → syncs to GitLab, on the board
Issues:  "Assigned to a bot."                        → notifies agents workspace
Agents:  "Got it."                                   → loads agent folder, runs prompts
Agents:  "Done."                                     → notifies issues to close it
Issues:  "Closed."                                   → syncs closed state to GitLab
```

---

## Local Ticket Format

Tickets live as markdown files with frontmatter.

**Location:** `ai/workspaces/issues/` (open tickets at root, closed in `done/`)

```
ai/workspaces/issues/
├── workspace.json
├── sync.json              ← last sync timestamp, ID counter
├── KIMI-0001.md           ← open (inbox or dispatched)
├── KIMI-0002.md           ← open
├── done/
│   ├── KIMI-0003.md       ← closed
│   └── KIMI-0004.md       ← closed
└── scripts/
    ├── create-ticket.js   ← programmatic ticket creation
    └── sync-tickets.js    ← issues workspace owns its own sync
```

Open vs closed is structural: root = active, `done/` = completed. The dispatch watcher only watches the root directory.

### Ticket File

```markdown
---
id: KIMI-0014
gitlab_iid: 23
title: Update secrets page token expiry
assignee: kimi-wiki
created: 2026-03-21T10:00:00
author: local
state: open
---

The secrets page lists token expiry as 2026-03-22 but it was
rotated to 2026-06-20. Update PAGE.md to reflect the new date.
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Local ticket ID (KIMI-NNNN) |
| `gitlab_iid` | Number | GitLab issue number (set after first sync) |
| `title` | String | One-line summary |
| `assignee` | String | Human username or bot name (dispatch key) |
| `created` | ISO 8601 | Creation timestamp |
| `author` | `local` or `gitlab` | Where the ticket originated |
| `state` | `open` or `closed` | Mirrors GitLab's two-state model |
| `blocks` | String | Topic or resource name this ticket blocks updates to |
| `blocked_by` | String | Ticket ID (KIMI-NNNN) that must close before this ticket dispatches |

### sync.json

```json
{
  "last_sync": "2026-03-21T10:30:00",
  "next_id": 15,
  "bot_accounts": {
    "kimi-wiki": { "gitlab_user_id": 12345 },
    "kimi-code": { "gitlab_user_id": 12346 },
    "kimi-bot": { "gitlab_user_id": 12347 }
  }
}
```

---

## Dispatch Logic

The server watches `issues/tickets/` for changes. Dispatch is three conditions:

```javascript
function shouldDispatch(ticket) {
  if (ticket.state !== 'open') return false;
  const agent = findAgentByBotName(ticket.assignee);
  if (!agent) return false;  // assigned to human, skip
  if (agent.activeRuns >= agent.limits.max_concurrent_runs) return false;
  if (ticket.blocked_by && isTicketOpen(ticket.blocked_by)) return false;  // blocked
  if (isTopicBlocked(ticket, allTickets)) return false;  // another ticket blocks this topic
  return true;
}

function isTopicBlocked(ticket, allTickets) {
  // If this ticket targets a topic that another open ticket has a "blocks" claim on, skip
  // e.g., an edge review ticket blocks future content updates to the same topic
  const topic = extractTopic(ticket);  // derived from ticket title/body
  if (!topic) return false;
  return allTickets.some(t =>
    t.state === 'open' && t.blocks === topic && t.id !== ticket.id
  );
}
```

No routing labels. No domain tags. The agent folder is the routing. The assignee is the dispatch key. Blocking is enforced by the `blocks` and `blocked_by` fields — a ticket won't dispatch if its blocker is still open.

### Detection

Use `fs.watch` on the issues root directory. No polling. The `done/` subfolder is excluded — only active tickets trigger dispatch.

```javascript
fs.watch('ai/workspaces/issues/', (event, filename) => {
  if (!filename.endsWith('.md') || !filename.startsWith('KIMI-')) return;
  const ticket = parseTicket(filename);
  if (shouldDispatch(ticket)) dispatch(ticket);
});
```

---

## Agent Folder Convention

The agent folder contains everything an agent needs to run. No external routing info required.

```
ai/workspaces/background-agents/
├── workspace.json
├── runner.js                 ← agents workspace owns execution
├── registry.json             ← bot name → agent folder mapping
└── agents/
    └── wiki-updater/
        ├── AGENT.md          ← identity, scope, constraints
        ├── WORKFLOW.md       ← execution order, rules, guardrails
        ├── agent.json        ← metadata, triggers, limits
        ├── hooks.js          ← optional: beforeRun(), afterStep(), afterRun()
        ├── prompts/
        │   ├── 01-gather.md
        │   ├── 02-propose.md
        │   ├── 03-edges.md
        │   ├── 04-execute.md
        │   └── 05-verify.md
        └── runs/
            └── 2026-03-21T10-30/
                ├── ticket.md       ← frozen copy of the ticket
                ├── AGENT.md        ← frozen copy
                ├── WORKFLOW.md     ← frozen copy
                ├── manifest.json
                └── steps/
                    ├── 01-gather.md
                    ├── 02-propose.md
                    └── ...
```

### AGENT.md

Who the agent is. Loaded as the system prompt.

```markdown
# Wiki Updater

You update wiki pages when source material changes.

## Scope
- You own: ai/workspaces/wiki/*/PAGE.md, ai/workspaces/wiki/*/LOG.md
- You read: entire project (code, git, other workspaces)
- You write: only wiki topic files + ai/STATE.md

## Constraints
- Never skip the workflow steps
- Never edit files outside your scope
- If confidence is below 70%, stop and mark the ticket
```

### Numbered Prompts

Each prompt is a discrete turn in the wire protocol conversation. The runner feeds them in order.

**01-gather.md:**
```markdown
Read the ticket and gather all relevant source material.

Ticket:
{{ticket_body}}

Steps:
1. Read the target topic's PAGE.md
2. Read related source code files referenced in the ticket
3. Check git log for recent changes to those files
4. Read ai/STATE.md for recent cross-workspace activity

Report what you found. List every source you read.
```

**02-propose.md:**
```markdown
Based on what you gathered:

{{step_01_output}}

Propose specific changes to the target PAGE.md.

For each change:
- What to change (before → after)
- Why (cite the source)
- Confidence level (high/medium/low)

If any change is below 70% confidence, explain why and recommend stopping.
```

Prompts use `{{template_vars}}` for context injection. The runner substitutes ticket body and previous step outputs.

### agent.json

```json
{
  "id": "wiki-updater",
  "name": "Wiki Updater",
  "bot_name": "kimi-wiki",
  "description": "Updates wiki pages when source material changes",
  "icon": "edit_note",
  "color": "#e91e8a",

  "model": {
    "thinking": false,
    "max_context_size": 131072
  },

  "limits": {
    "max_concurrent_runs": 1,
    "max_depth": 3,
    "timeout_minutes": 10
  }
}
```

The `bot_name` field maps to the GitLab assignee name. That's the dispatch key.

### registry.json

Maps bot names to agent folders. The dispatch system reads this — nothing else.

```json
{
  "version": "1.0",
  "agents": {
    "kimi-wiki": {
      "folder": "agents/wiki-updater",
      "status": "idle"
    },
    "kimi-code": {
      "folder": "agents/bug-fixer",
      "status": "idle"
    },
    "kimi-review": {
      "folder": "agents/code-reviewer",
      "status": "idle"
    }
  }
}
```

### hooks.js (Optional)

Per-agent escape hatch for custom server-side behavior. Most agents won't have this.

```javascript
module.exports = {
  // Called before the prompt loop starts
  beforeRun(ticket, agentConfig) { },

  // Called after each step completes
  afterStep(stepNumber, stepOutput, context) { },

  // Called after all prompts complete
  afterRun(manifest, ticket) { }
};
```

The runner checks for hooks.js and calls them if present. Absence = no hooks = default behavior.

---

## Wire Protocol Execution Loop

Owned by the agents workspace (`background-agents/runner.js`).

```
1. Receive dispatch (ticket + agent folder path)
2. Read agent.json → model config
3. Read AGENT.md → system prompt
4. Read ai/STATE.md → cross-workspace context
5. Create run folder: agents/{id}/runs/{timestamp}/
6. Freeze: copy ticket.md, AGENT.md, WORKFLOW.md into run folder
7. Spawn kimi --wire with agent model config
8. For each prompt in prompts/ (sorted numerically):
   a. Read prompt template
   b. Substitute {{ticket_body}}, {{step_NN_output}} vars
   c. Send to model via wire protocol
   d. Capture response → save to runs/{timestamp}/steps/NN-{name}.md
   e. If response contains STOP signal → break, mark ticket
   f. If hooks.afterStep exists → call it
9. Write manifest.json
10. Post summary comment to GitLab issue (via sync)
11. Close ticket (state: closed)
12. Update ai/STATE.md
13. Update registry.json status → "idle"
```

### Context Injection

Each prompt sees:
- The ticket body (always)
- Output from all previous steps (accumulated)
- WORKFLOW.md rules (always available)

The runner builds the context window incrementally:
```
Step 1: system=AGENT.md, user=prompt_01(ticket_body)
Step 2: system=AGENT.md, user=prompt_02(ticket_body + step_01_output)
Step 3: system=AGENT.md, user=prompt_03(ticket_body + step_01_output + step_02_output)
...
```

---

## GitLab Sync

Owned by the issues workspace (`issues/scripts/sync-tickets.js`).

### Push (local → GitLab)

```
For each ticket in tickets/:
  No gitlab_iid?
    → POST /api/v4/projects/:id/issues
    → Write iid back to ticket frontmatter
  Has gitlab_iid?
    → Compare assignee + state
    → PATCH /api/v4/projects/:id/issues/:iid if changed
  State closed locally?
    → PUT /issues/:iid with state_event=close
```

### Pull (GitLab → local)

```
GET /api/v4/projects/:id/issues?updated_after={last_sync}&scope=all
For each issue:
  No local file?
    → Create ticket.md with author: gitlab
  Has local file?
    → Update assignee/state if changed on GitLab
  New comments?
    → Append to local ticket (or separate comments section)
Write sync.json with new timestamp
```

### Conflict Resolution

Last-write-wins on assignee and state. Comments are append-only (no conflict possible).

### GitLab Metadata Usage

| GitLab Field | How it's used |
|-------------|---------------|
| Title | Ticket summary |
| Description | Ticket body (the prompt context) |
| Assignee | Dispatch key (human = inbox, bot = run) |
| State | open/closed (the only two states) |
| Labels | Optional — human organization only (not used by dispatch) |
| Comments | Agent posts step summaries, humans can reply |
| Milestone | Optional — batch grouping for humans |
| Due date | Optional — deadlines for humans |
| Linked issues | Parent/child ticket chains |

Labels, milestones, due dates, and weight are for humans browsing GitLab. The dispatch system ignores them.

---

## Child Tickets (Agent Chaining)

When an agent discovers downstream work during its prompt sequence:

```
Agent running 03-edges.md discovers gitlab page is stale
  → Agent output includes: CHILD_TICKET: kimi-wiki "gitlab page references outdated token expiry"
  → Runner parses this signal
  → Creates new local ticket, assigns to the named bot
  → New ticket syncs to GitLab
  → New ticket goes through the same dispatch loop
  → Parent ticket's manifest records child ticket ID
```

The agent doesn't dispatch the child. It declares "this needs to happen." The system handles the rest.

### Preventing Infinite Loops

- `limits.max_depth` in agent.json — agent won't create children beyond this depth
- Circuit breaker: if a child ticket targets the same topic as an ancestor, stop
- Manifest tracks lineage: parent → child → grandchild

---

## Cron Jobs — Ticket Factories

Cron jobs live wherever makes sense (system crontab, or a `cron/` workspace). They create tickets and assign bots. That's it.

```bash
# Daily wiki freshness — 9am
0 9 * * * curl -s -X POST \
  "https://gitlab.com/api/v4/projects/$PROJECT_ID/issues" \
  -H "PRIVATE-TOKEN: $(security find-generic-password -a kimi-ide -s GITLAB_TOKEN -w)" \
  -d "title=Daily wiki freshness check — $(date +%Y-%m-%d)" \
  -d "assignee_id=$KIMI_WIKI_USER_ID"
```

Or locally:
```bash
# Create local ticket, sync will push to GitLab
0 9 * * * node ai/workspaces/issues/scripts/create-ticket.js \
  --title "Daily wiki freshness check" \
  --assignee kimi-wiki \
  --body "Check all wiki topics for staleness against recent commits."
```

The cron doesn't know what "wiki freshness" means. It creates the ticket. The agent folder has all the intelligence.

---

## Server Module Structure

The server stays thin. Each workspace owns its logic.

```
kimi-ide-server/
├── server.js                         ← thin relay: routes WebSocket messages
├── lib/
│   ├── secrets.js                    ← macOS Keychain accessor
│   └── tickets/
│       └── loader.js                 ← reads ticket file, returns parsed frontmatter + body

ai/workspaces/
├── issues/
│   ├── workspace.json
│   ├── sync.json
│   ├── KIMI-0001.md                  ← open tickets at root
│   ├── done/                         ← closed tickets
│   └── scripts/
│       ├── create-ticket.js          ← programmatic ticket creation
│       └── sync-tickets.js           ← GitLab ↔ local sync
│
└── background-agents/
    ├── workspace.json
    ├── runner.js                     ← wire protocol execution loop
    ├── registry.json                 ← bot name → agent folder
    └── agents/
        └── {agent-id}/
            ├── AGENT.md
            ├── WORKFLOW.md
            ├── agent.json
            ├── hooks.js              ← optional
            ├── prompts/
            └── runs/
```

### server.js Additions

```javascript
// Thin relay — no business logic
case 'ticket_created':    // forward to issues workspace watcher
case 'ticket_dispatch':   // issues → agents workspace
case 'ticket_closed':     // agents → issues workspace
case 'ticket_sync':       // trigger GitLab sync
```

---

## Collaboration Flow

### You create work for a friend

1. You create ticket locally (or agent creates it)
2. Assign to friend's GitLab username
3. Sync pushes to GitLab → friend sees it in INBOX column
4. Friend works on it, comments on GitLab
5. Friend closes it (or reassigns to a bot)
6. Next sync pulls status change

### Friend creates work for you

1. Friend opens GitLab Issue
2. Assigns to you (or leaves unassigned → you triage)
3. Next sync pulls it → creates local ticket with `author: gitlab`
4. You see it in your INBOX
5. You assign to a bot → moves to OPEN → agent runs
6. Agent closes → sync pushes closed to GitLab
7. Friend sees the resolution

### You + bot collaborate on a ticket

1. You're assigned to a ticket (INBOX)
2. You add bot as co-assignee (or reassign entirely)
3. Bot runs, posts step summaries as comments
4. You review the comments
5. You close when satisfied

---

## What This Does NOT Do

- **No routing labels.** The agent folder is the routing. The assignee is the dispatch key.
- **No lifecycle labels.** Column is determined by assignee + state. That's it.
- **No polling.** `fs.watch` for local dispatch. Sync runs on a schedule or manually.
- **No business logic in server.js.** Workspaces own their domains.
- **No custom protocols.** Reuses existing WebSocket messages and file operations.
