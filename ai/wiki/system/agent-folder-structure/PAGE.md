# Agent Folder Structure

> One folder per agent. Standard files. The server reads them and enforces. That's it.

---

## Why This Matters

If you are building a new agent — or you are an agent-building agent — this page tells you where everything goes, what each file does, and why. Follow this structure and the system will discover and run your agent automatically.

---

## The Standard Files

Every agent lives in `ai/workspaces/background-agents/System/{agent-id}/` and contains:

```
{agent-id}/
├── IDENTITY.md        ← who the agent is (loaded at session start)
├── SESSION.md         ← session configuration (thread model, timeout, context loading)
├── TRIGGERS.md        ← what events activate this agent
├── MEMORY.md          ← user preferences discovered through conversation
├── LESSONS.md         ← process learnings accumulated across runs
├── HISTORY.md         ← activity log (recent events, daily summaries)
├── workflows/         ← numbered workflow definitions
│   ├── {Workflow Name}/
│   │   └── PROMPT.md  ← orchestrator instructions with YAML frontmatter
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

### IDENTITY.md — Who the Agent Is

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
- **Workflow:** {which PROMPT.md to run}
- **Ticket title template:** {how the auto-created ticket is named}
```

### MEMORY.md — User Preferences

Populated through conversation. When the user tells the agent something about how they want things done, it goes here. Read at session start alongside IDENTITY.md.

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
4. Human promotes valuable lessons into IDENTITY.md or workflow prompts, clears reviewed entries

[Token-threshold review ticket creation not yet implemented]

### HISTORY.md — Activity Log

What the agent has done recently. Daily summaries, event timestamps. The agent updates this after each run. Useful for the user to see recent activity at a glance.

### workflows/ — The Work Definitions

Each subfolder is a named workflow containing a `PROMPT.md` with YAML frontmatter and numbered orchestrator steps.

---

## Workflow PROMPT.md Anatomy

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
  write: ["ai/wiki/project/**"]        # what can be written
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
├── prompt.md          ← frozen copy of the workflow PROMPT.md
├── lessons.md         ← frozen copy of LESSONS.md at run time
├── manifest.json      ← status, timing, model, outcome
├── run-index.json     ← step-by-step progress tracker
├── 00-validate.md     ← Step 0: preflight check (always first)
├── 01-gather.md       ← evidence card for step 1
├── 01-gather.retry-1.md  ← rejected attempt (preserved, never deleted)
├── 02-propose.md      ← evidence card for step 2
└── ...
```

**Why frozen copies:** If IDENTITY.md or workflow prompts evolve over time, past runs retain the exact version that was active. This enables reproducibility and process auditing — compare how instructions were followed across runs.

**manifest.json status:** `pending` → `in_progress` → `completed` | `stopped` | `error`

**run-index.json:** The orchestrator reads this to know where it is. Enables crash recovery — restart, read the index, resume from the last completed step.

**Evidence cards:** Every step writes a markdown file with Decision, Evidence, Finding, and Confidence sections. Rejected attempts are preserved as `{NN}-{name}.retry-{N}.md`.

[Full attestation-based evidence cards per Evidence-Gated Execution not yet implemented — current cards document what happened but don't gate execution]

---

## Registry — How Agents Are Discovered

`ai/workspaces/background-agents/registry.json` maps bot names to agent folders:

```json
{
  "agents": {
    "kimi-wiki": { "folder": "System/wiki-manager", "status": "idle" },
    "kimi-code": { "folder": "System/code-manager", "status": "idle" },
    "kimi-ops":  { "folder": "System/ops-manager", "status": "idle" }
  }
}
```

The `bot_name` in a workflow's YAML frontmatter must match a key in this registry. That's the dispatch key — when a ticket is assigned to `kimi-wiki`, the runner looks up `System/wiki-manager` and runs the matching workflow.

---

## Creating a New Agent

1. Create folder: `ai/workspaces/background-agents/System/{agent-id}/`
2. Write IDENTITY.md (who it is, what it owns, read/write scope)
3. Write SESSION.md (thread model, timeout, context loading)
4. Write TRIGGERS.md (what events activate it)
5. Create empty MEMORY.md, LESSONS.md, HISTORY.md
6. Create `workflows/` with at least one workflow PROMPT.md
7. Create empty `runs/` directory
8. Add entry to `registry.json` with bot name → folder mapping
9. Read [Workflow Design Guide](../workflow-design/PAGE.md) to ensure workflows implement EGE
10. Read [Evidence-Gated Execution](../evidence-gated-execution/PAGE.md) to understand the validation philosophy

[Agent-building agent that automates steps 1-10 not yet implemented]

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
