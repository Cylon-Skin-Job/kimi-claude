# Agent Folder Structure

> One folder per agent. Groups organize agents into rows. The server reads them and enforces. That's it.

---

## Why This Matters

If you are building a new agent — or you are an agent-building agent — this page tells you where everything goes, what each file does, and why. Follow this structure and the system will discover and run your agent automatically.

---

## Agent Groups

Agents live inside **groups** — named folders that organize agents into rows in the tiles UI. Each group is a folder with its own `index.json` and one or more agent folders inside it.

```
ai/workspaces/background-agents/
├── index.json                    ← workspace identity
├── agents.json                   ← agent status dashboard
├── registry.json                 ← bot name → agent path mapping
│
├── System/                       ← ships with app, frozen (rank 1)
│   ├── index.json                ← group identity
│   ├── wiki-manager/             ← agent
│   ├── code-manager/             ← agent
│   └── ops-manager/              ← agent
│
├── Research Tools/               ← user-created (rank 10)
│   ├── index.json                ← group identity
│   ├── paper-scraper/            ← agent
│   └── enrichment-agent/         ← agent
│
└── My Automations/               ← user-created (rank 20)
    ├── index.json
    └── daily-reporter/
```

### The System Group

`System/` ships with the app and is `frozen: true`. It contains the default agents (wiki-manager, code-manager, ops-manager). The user cannot modify agents in this group — but they can **clone** an agent from System into another group and customize the clone.

On app update, System agents are updated automatically (new workflows, improved prompts, etc.) without affecting user-created agents.

### Creating a New Group

1. Create a folder inside `ai/workspaces/background-agents/` (e.g., `Research Tools/`)
2. Add an `index.json` following the [Universal Index](../universal-index/PAGE.md) schema:

```json
{
  "version": "1.0",
  "id": "research-tools",
  "label": "Research Tools",
  "type": "agent-group",
  "rank": 10,
  "sort": "ranked",
  "frozen": false,
  "children": [],
  "settings": {}
}
```

3. The tiles UI renders a new row labeled "Research Tools" beneath System

New groups default to rank 10 (after System at rank 1, before any high-numbered groups). Adjust rank to control ordering.

### Cloning an Agent

To create a new agent based on an existing one:

1. Copy the agent folder from one group to another (e.g., `System/wiki-manager/` → `Research Tools/my-wiki-agent/`)
2. Edit PROMPT.md to define the new agent's role and scope
3. Rename the `bot_name` in WORKFLOW.md frontmatter to a unique name
4. Add the new bot name to `registry.json`
5. Clear LESSONS.md, HISTORY.md, MEMORY.md (those belong to the original)
6. The new agent is immediately functional with the cloned workflows as a starting point

---

## The Standard Agent Files

Every agent folder contains:

```
{agent-id}/
├── index.json         ← agent identity (universal index schema)
├── PROMPT.md        ← who the agent is (loaded at session start)
├── SESSION.md         ← session configuration (thread model, timeout, context loading)
├── TRIGGERS.md        ← what events activate this agent
├── MEMORY.md          ← user preferences discovered through conversation
├── LESSONS.md         ← process learnings accumulated across runs
├── HISTORY.md         ← activity log (recent events, daily summaries)
├── styles.css         ← UI styling for the agent tile
├── workflows/         ← workflow definitions
│   ├── {Workflow Name}/
│   │   └── WORKFLOW.md  ← orchestrator instructions with YAML frontmatter
│   └── ...
├── runs/              ← execution history (one folder per ticket)
│   └── {timestamp}/
│       ├── ticket.md
│       ├── prompt.md
│       ├── lessons.md
│       ├── manifest.json
│       ├── run-index.json
│       └── steps/
│           ├── 00-validate.md
│           ├── 01-gather.md
│           └── ...
└── threads/           ← conversation threads (if agent has chat)
```

---

## File-by-File Guide

### index.json — Agent Identity

Follows the [Universal Index](../universal-index/PAGE.md) schema. Declares the agent's ID, label, icon, rank within its group, and settings.

```json
{
  "version": "1.0",
  "id": "wiki-manager",
  "label": "Wiki Manager",
  "description": "Manages the project wiki as a living knowledge base",
  "type": "agent",
  "rank": 1,
  "icon": "edit_note",
  "color": "#e91e8a",
  "sort": "manual",
  "created": "2026-03-20T20:00:00Z",
  "frozen": false,
  "settings": {}
}
```

### PROMPT.md — Who the Agent Is

Loaded at session start. The system prompt. Defines role, domain, scope, and standards.

**Must include:**
- What this agent owns (specific file paths)
- Read/write scope
- Which prompts/workflows it has and when each triggers
- How it works (never executes directly — triggers create tickets, runner executes)
- What it does when the user talks to it directly

**Keep under 500 tokens.** This loads every session. Identity, not procedure — workflows handle process.

### SESSION.md — Session Configuration

How the agent's CLI session behaves.

**Contains:**
- Thread model (`daily-rolling`, `per-ticket`, `persistent`)
- Session invalidation rules (e.g., re-read on MEMORY.md change)
- Idle timeout
- What files load as system context

### TRIGGERS.md — Activation Events

Defines when this agent wakes up. Each trigger maps an event to a workflow prompt.

**Trigger types:**
- `source-file-change` — glob pattern matches a file change
- `wiki-page-changed` — a PAGE.md is edited
- `cron` — scheduled (daily, weekly, etc.)
- `ticket-assigned` — a ticket is assigned to this agent's bot name
- `manual` — user explicitly invokes

**Format:**
```markdown
## {trigger-name}
- **Event:** {what happens}
- **Glob/Schedule:** {pattern or cron expression}
- **Workflow:** {which WORKFLOW.md to run}
- **Ticket title template:** {how the auto-created ticket is named}
```

### MEMORY.md — User Preferences

Populated through conversation. When the user tells the agent something about how they want things done, it goes here. Read at session start alongside PROMPT.md.

Starts empty. Grows over time.

### LESSONS.md — Institutional Memory

Append-only log of things the agent learned across runs. After each run, if the orchestrator encountered something unexpected — a mistake caught, a pattern discovered, a gotcha — it appends an entry.

**Entry format:**
```markdown
### {date} — {short title}
{What happened, what was learned, what to watch for next time.}
```

**Lifecycle:**
1. Frozen copy drops into each run folder at start (so the run has the lessons that were known at that time)
2. New lessons append to the live file after run completion
3. When unreviewed content exceeds ~500 tokens, a review ticket is created for the human
4. Human promotes valuable lessons into PROMPT.md or WORKFLOW.md prompts, clears reviewed entries

[Token-threshold review ticket creation not yet implemented]

### HISTORY.md — Activity Log

What the agent has done recently. Daily summaries, event timestamps. The agent updates this after each run. Useful for the user to see recent activity at a glance.

### styles.css — Agent Tile Styling

Custom CSS for this agent's tile in the UI. Falls back to template if not present. See [Template Fallback](../template-fallback/PAGE.md).

### workflows/ — The Work Definitions

Each subfolder is a named workflow containing a `WORKFLOW.md` with YAML frontmatter and numbered orchestrator steps.

---

## WORKFLOW.md Anatomy

```yaml
---
bot_name: kimi-wiki                    # dispatch key — matches registry.json
description: Updates wiki pages        # human-readable
icon: edit_note                        # Material icon name
color: "#e91e8a"                       # UI accent color
model:
  thinking: false                      # reasoning mode on/off
  max_context_size: 131072             # context window
limits:
  max_concurrent_runs: 1              # parallel execution cap
  timeout_minutes: 10                 # kill after this
  max_retries: 2                      # per-step retry limit
  confidence_threshold: 70            # below this = stop
scope:
  read: ["*"]                         # what can be read
  write: ["ai/wiki/project/**"]       # what can be written
schedule:                              # optional cron trigger
  cron: "0 9 * * *"
  ticket_title: "Daily freshness check"
---

# {Workflow Name}

You are an orchestrator. You delegate each step to a sub-agent...

## Steps

### 1. Gather
Spawn a sub-agent to...

### 2. Propose
Spawn a sub-agent with the gather output...

### 3. Execute
...
```

**Key rules:**
- Each step is delegated to a sub-agent — the orchestrator evaluates, not executes
- Sub-agent context is discarded after each step
- The orchestrator accumulates findings across steps
- Below confidence threshold = stop and mark the ticket
- Every workflow should implement [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) — see [Workflow Design Guide](../workflow-design/PAGE.md)

---

## Run Folders — The Audit Trail

Every workflow execution creates a run folder in `{agent-id}/runs/{timestamp}/`.

```
runs/{timestamp}/
├── ticket.md          ← frozen copy of the triggering ticket
├── prompt.md          ← frozen copy of the WORKFLOW.md
├── lessons.md         ← frozen copy of LESSONS.md at run time
├── manifest.json      ← status, timing, model, outcome
├── run-index.json     ← step-by-step progress tracker
├── 00-validate.md     ← Step 0: preflight check (always first)
├── 01-gather.md       ← evidence card for step 1
├── 01-gather.retry-1.md  ← rejected attempt (preserved, never deleted)
├── 02-propose.md      ← evidence card for step 2
└── ...
```

**Why frozen copies:** If PROMPT.md or WORKFLOW.md files evolve over time, past runs retain the exact version that was active. This enables reproducibility and process auditing — compare how instructions were followed across runs.

**manifest.json status:** `pending` → `in_progress` → `completed` | `stopped` | `error`

**run-index.json:** The orchestrator reads this to know where it is. Enables crash recovery — restart, read the index, resume from the last completed step.

**Evidence cards:** Every step writes a markdown file with Decision, Evidence, Finding, and Confidence sections. Rejected attempts are preserved as `{NN}-{name}.retry-{N}.md`.

[Full attestation-based evidence cards per Evidence-Gated Execution not yet implemented — current cards document what happened but don't gate execution]

---

## Registry — How Agents Are Discovered

`ai/workspaces/background-agents/registry.json` maps bot names to agent folders. The folder path includes the group:

```json
{
  "agents": {
    "kimi-wiki": { "folder": "System/wiki-manager", "status": "idle" },
    "kimi-code": { "folder": "System/code-manager", "status": "idle" },
    "kimi-ops":  { "folder": "System/ops-manager", "status": "idle" },
    "my-scraper": { "folder": "Research Tools/paper-scraper", "status": "idle" }
  }
}
```

The `bot_name` in a workflow's YAML frontmatter must match a key in this registry. That's the dispatch key — when a ticket is assigned to `my-scraper`, the runner looks up `Research Tools/paper-scraper` and runs the matching workflow.

---

## Creating a New Agent

### From scratch

1. Choose or create a group folder (e.g., `Research Tools/`)
2. Create the agent folder inside it: `Research Tools/{agent-id}/`
3. Add `index.json` (type: "agent", with label, icon, rank)
4. Write PROMPT.md (who it is, what it owns, read/write scope)
5. Write SESSION.md (thread model, timeout, context loading)
6. Write TRIGGERS.md (what events activate it)
7. Create empty MEMORY.md, LESSONS.md, HISTORY.md
8. Create `workflows/` with at least one WORKFLOW.md
9. Create empty `runs/` directory
10. Add entry to `registry.json` with bot name → group/folder mapping
11. Add the agent ID to the group's `index.json` children array
12. Read [Workflow Design Guide](../workflow-design/PAGE.md) to ensure workflows implement EGE
13. Read [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) to understand the validation philosophy

### By cloning

1. Copy an existing agent folder to a new group (or the same group with a new name)
2. Update `index.json` with a new ID and label
3. Update PROMPT.md for the new role
4. Change `bot_name` in all WORKFLOW.md files to a unique name
5. Add the new bot name to `registry.json`
6. Clear LESSONS.md, HISTORY.md, MEMORY.md
7. Add the agent ID to the group's `index.json` children array

[Agent-building agent that automates these steps not yet implemented]

---

## Workspace-Level Agent Files

Interactive workspaces (like the wiki viewer or coding agent) also have agent files, but with a different structure defined by the workspace agent model:

```
ai/workspaces/{workspace}/
├── PROMPT.md         ← agent identity (loaded at session start)
├── TOOLS.md          ← allowed/restricted/denied tool access
├── WORKFLOW.md       ← process rules (injected before every write)
├── api.json          ← model/provider preferences
└── index.json        ← workspace identity (universal index schema)
```

**Key difference:** WORKFLOW.md injects *just-in-time before writes*, not at session start. This keeps process rules fresh in context when the agent makes mutations. TOOLS.md is enforced server-side — the agent cannot override restrictions.

See the Workspace Agent Model spec (`ai/workspaces/capture/specs/WORKSPACE-AGENT-SPEC.md`) for full details.
