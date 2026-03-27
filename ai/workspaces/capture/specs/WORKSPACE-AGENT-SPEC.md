# Workspace Agent Model Spec

> Every workspace gets an agent. Every agent follows the same model.

---

## What This Is

A universal pattern for scoping AI agents to workspaces. Each workspace in `ai/workspaces/` defines its agent through a set of files that control identity, capabilities, process, and context. The server reads these files and enforces them — it doesn't care which workspace it's running.

---

## The Files

### Per-Workspace (5 files)

```
ai/workspaces/{workspace}/
├── PROMPT.md         ← who the agent is
├── TOOLS.md          ← what it can do
├── WORKFLOW.md       ← how it does work
├── api.json          ← model/provider preferences (hot-swapped on session start)
├── workspace.json    ← metadata and settings
└── ...               ← workspace-specific content
```

### Project-Level (1 file)

```
ai/
├── STATE.md          ← cross-workspace activity trail
└── workspaces/
```

---

## PROMPT.md — Agent Identity

Loaded at session start. Defines who the agent is, what it owns, and how it behaves.

**Loaded when:** Session starts (kimi `--wire` process spawns for this workspace).

**Contains:**
- Agent role and purpose
- What this workspace owns (files, folders, domains)
- Read/write scope
- Personality and communication style (if any)
- Pointers to relevant wiki topics or docs

**Example (wiki workspace):**
```markdown
You are the wiki custodian for the kimi-claude project.

Your workspace: ai/workspaces/wiki/
Your domain: maintaining wiki topic pages (PAGE.md files)

You own: ai/workspaces/wiki/*/PAGE.md, CHAT.md, LOG.md
You read: the entire project (code, git, other workspaces, docs)
You write: only within your workspace

When asked about a topic, read its PAGE.md. When asked to update,
follow WORKFLOW.md. When uncertain, note in CHAT.md — don't edit.
```

**Rules:**
- Keep under 500 tokens — this loads every session
- Identity, not procedure — WORKFLOW.md handles process
- No tool definitions — TOOLS.md handles that
- Must state read/write scope explicitly

---

## TOOLS.md — Agent Capabilities

Defines what tools the agent can and cannot use. The server filters tool calls against this file.

**Loaded when:** Session starts. Checked before every tool execution.

**Format:**
```markdown
# Tools

## Allowed
- read_file: any path in the project
- glob: any pattern
- grep: any pattern
- git_log: read-only
- git_diff: read-only

## Restricted
- write_file: only within ai/workspaces/wiki/
- edit_file: only within ai/workspaces/wiki/

## Denied
- shell_exec: no arbitrary shell commands
- git_commit: wiki agent does not commit
- git_push: wiki agent does not push
```

**Enforcement model:**
- **Allowed** — tool call passes through
- **Restricted** — tool call passes through only if target matches the constraint (path prefix, pattern, etc.)
- **Denied** — tool call is blocked, agent receives an error message

**Rules:**
- Broad read, scoped write is the default pattern
- Each workspace defines its own restrictions
- The server reads TOOLS.md and applies the rules — the agent cannot override them
- If TOOLS.md doesn't exist, the workspace inherits project-level defaults

---

## WORKFLOW.md — Process Rules

The process guardrail. Injected into agent context before any write or edit operation.

**Loaded when:** The agent issues a write, edit, or create tool call. The server intercepts the call, injects WORKFLOW.md into context, then allows the tool to execute.

This is not a suggestion. It's a gate. The agent sees the workflow rules immediately before every mutation. It cannot skip them.

**Contains:**
- Pre-write checklist (what to verify before changing anything)
- Post-write requirements (what to update after changing something)
- Quality gates (when to proceed vs. when to stop and ask)
- STATE.md update rules (always — see below)

**Example (wiki workspace):**
```markdown
# Workflow

## Before any edit to PAGE.md
1. Read the current PAGE.md
2. Read LOG.md for recent changes
3. Identify the source (commit, ticket, conversation, discovery)
4. If the source is ambiguous, note in CHAT.md and do not edit

## After any edit to PAGE.md
1. Append an entry to the topic's LOG.md:
   - Date and title
   - Source (commit hash, ticket ID, conversation, manual)
   - What changed
   - Why
2. Record reasoning in CHAT.md
3. Update ai/STATE.md with a summary of what was done

## Quality gates
- Do not edit PAGE.md based on speculation
- Do not remove content unless the source material confirms removal
- If a code file was deleted, verify it's truly gone before removing from wiki
- When in doubt, add a note to CHAT.md instead of editing PAGE.md
```

**STATE.md update rule (universal):**

Every workspace's WORKFLOW.md must include:

```markdown
## After completing any work
Append a summary to ai/STATE.md:
- Timestamp
- Workspace name
- What was done
- What triggered it
- Any loose threads for other workspaces
```

This is how STATE.md stays current. Each agent writes to it as part of its workflow.

---

## api.json — Model & Provider Preferences

Each workspace declares its preferred model configuration. The server reads this at session start and hot-swaps the CLI config before spawning the agent process.

**Loaded when:** Session starts. The server reads `api.json`, applies overrides to the CLI config, then spawns the kimi `--wire` process with the workspace's preferred settings.

**Format:**
```json
{
  "workspace": "wiki",
  "description": "Fast model for wiki updates — speed over depth",
  "model": {
    "provider": "managed:kimi-code",
    "model": "kimi-for-coding",
    "thinking": false,
    "max_context_size": 131072
  },
  "overrides": {
    "default_thinking": false,
    "loop_control.max_steps_per_turn": 50,
    "loop_control.max_retries_per_step": 2
  },
  "notes": "Human-readable rationale for these choices"
}
```

**Fields:**
- `model.provider` — which provider to use (maps to `[providers]` in kimi config.toml)
- `model.model` — model identifier
- `model.thinking` — whether to enable thinking/reasoning mode
- `model.max_context_size` — context window limit for this workspace
- `overrides` — key-value pairs that override kimi config.toml settings (dot notation for nested keys)
- `notes` — why these settings were chosen (not machine-read, for humans)

**How hot-swapping works:**

1. Server reads workspace's `api.json`
2. Server reads the base `~/.kimi/config.toml`
3. Server creates a temporary config with overrides applied
4. Server spawns kimi `--wire` with `--model-config` pointing to the temp config
5. When the session ends, the temp config is cleaned up

The base config.toml is never modified. Each workspace gets its own overlay.

**Examples by workspace:**

| Workspace | Thinking | Context | Max Steps | Rationale |
|-----------|----------|---------|-----------|-----------|
| wiki | off | 131K | 50 | Short, targeted edits. Speed matters. |
| coding-agent | on | 262K | 100 | Deep reasoning. Complex multi-file operations. |
| issues | off | 131K | 30 | Ticket triage is fast, structured work. |
| rocket | on | 262K | 100 | Deployments need careful reasoning. |

**If api.json doesn't exist:** The workspace inherits the base config.toml settings unchanged.

---

## workspace.json — Metadata

Machine-readable workspace configuration.

```json
{
  "id": "wiki",
  "name": "Wiki",
  "createdAt": "2026-03-20T14:00:00-07:00",
  "settings": {
    "sessionType": "persistent",
    "maxIdleMinutes": 30
  },
  "agent": {
    "readScope": "project",
    "writeScope": "workspace",
    "triggerSources": ["commit", "ticket", "schedule", "manual"]
  }
}
```

**Fields:**
- `id` — workspace identifier, matches folder name
- `settings.sessionType` — `persistent` (always running) or `on-demand` (spawned when tab opens)
- `agent.readScope` — `project` (entire repo) or `workspace` (own folder only)
- `agent.writeScope` — `workspace` (own folder) or `topic` (per-topic in wiki)

---

## ai/STATE.md — Cross-Workspace Activity Trail

Lives at the project root (`ai/STATE.md`), not inside any workspace. Every workspace agent reads it at session start and writes to it as part of WORKFLOW.md.

**Purpose:** When you jump from one workspace to another, the new agent knows where you came from, what was happening, and what might be relevant.

**Format:**
```markdown
# Project State

## 2026-03-20 15:30 — wiki
Updated secrets/PAGE.md with new token expiry date.
Source: commit abc123 (token rotation).
Loose thread: gitlab/PAGE.md may need the same update.

## 2026-03-20 15:15 — code
Committed lib/secrets.js changes for token rotation.
Rotated GITLAB_TOKEN, new expiry 2026-06-20.
Loose thread: wiki should reflect new expiry.

## 2026-03-20 14:00 — wiki
Created initial wiki pages: Home, Secrets, GitLab, Wiki-System.
Source: conversation during secrets manager implementation.
```

**Rules:**
- Newest entry at the top
- Each entry: timestamp, workspace, summary, source, loose threads
- Keep entries concise (2-4 lines each)
- "Loose threads" = things another workspace might need to act on
- Trim entries older than 7 days (or when the file exceeds 200 lines)
- Every workspace's WORKFLOW.md includes the STATE.md update step

**What STATE.md is NOT:**
- Not a log of every tool call (too noisy)
- Not a replacement for LOG.md (topic-specific change trail stays in LOG.md)
- Not a task queue (STATUS.md in `.ai-project/bulletin/` handles that)
- Not git history (git log is authoritative for code changes)

STATE.md captures the **narrative** — what was the human doing, what decisions were made, where did they leave off, what's unfinished.

---

## Session Lifecycle

### Starting a Workspace Session

```
1. User opens workspace tab (or agent triggered by event)
2. Server reads api.json → creates temp config overlay → applies model/provider prefs
3. Server spawns kimi --wire process with workspace-specific config
4. Server loads:
   a. PROMPT.md     → system context
   b. STATE.md      → recent cross-workspace activity (from ai/ root)
   c. TOOLS.md      → tool filtering rules (held by server, not sent to agent)
4. Agent is ready — sees its identity + recent project context
```

### During a Session

```
Agent receives user message or trigger event
  │
  ├─ Read operation → passes through (broad read)
  │
  └─ Write/edit operation
      │
      ├─ Server checks TOOLS.md → Denied? → error to agent
      ├─ Server checks TOOLS.md → Restricted? → verify path constraint
      │
      └─ Passes? → Server injects WORKFLOW.md into context
                    → Agent sees process rules
                    → Tool executes
                    → Agent follows post-write steps (LOG.md, STATE.md)
```

### Ending a Session

```
1. Agent's final WORKFLOW.md step: update ai/STATE.md
2. Session suspends (idle timeout or tab close)
3. kimi process enters grace period, then suspends
4. Session state preserved for resume
```

---

## The Injection Model

```
┌─────────────────────────────────────────────────────────┐
│ Pre-Session                                             │
│   api.json read → CLI config hot-swapped                │
├─────────────────────────────────────────────────────────┤
│ Session Start                                           │
│   PROMPT.md + ai/STATE.md loaded into system context    │
├─────────────────────────────────────────────────────────┤
│ Any Read                                                │
│   Unrestricted (whole project)                          │
├─────────────────────────────────────────────────────────┤
│ Any Write/Edit                                          │
│   1. TOOLS.md checked (server-side, not visible to AI)  │
│   2. WORKFLOW.md injected (visible to AI, in context)   │
│   3. Tool executes                                      │
├─────────────────────────────────────────────────────────┤
│ After Work                                              │
│   WORKFLOW.md requires: update ai/STATE.md              │
└─────────────────────────────────────────────────────────┘
```

---

## Applying to Workspaces

Every workspace uses the same four files. The content differs.

| Workspace | PROMPT.md focus | TOOLS.md restrictions | WORKFLOW.md gates | api.json |
|-----------|----------------|----------------------|-------------------|----------|
| **wiki** | Wiki custodian, owns PAGE.md files | Write restricted to wiki/ | Read before edit, log after edit, cite sources | Fast: thinking off, 131K context |
| **code** | Coding agent, owns source files | Write restricted to src/ | Build before commit, run tests, check exports | Full: thinking on, 262K context |
| **issues** | Issue tracker, owns issue state | Write restricted to issues/ | Verify before closing, link to commits | Fast: thinking off, 131K context |
| **rocket** | Deployment agent, owns infra | Shell access allowed (restricted) | Verify env before deploy, rollback plan required | Full: thinking on, 262K context |
| **skills** | Skill maintainer, owns commands | Write restricted to skills/ | Test skill before publishing, sync across tools | Full: thinking on, 262K context |

The server doesn't know any of this. It reads the files and enforces. Adding a new workspace = creating a folder with four files.

---

## Design Decisions

### Why four files instead of one big config?

Each file has a different injection point. PROMPT.md loads once. TOOLS.md is checked per-tool-call. WORKFLOW.md injects per-write. Merging them means the agent sees everything all the time — that's noise. Separation means the right context arrives at the right moment.

### Why WORKFLOW.md injects on write, not on session start?

If loaded at session start, the agent forgets the rules by the time it writes (context window drift). Injecting immediately before the write means the rules are fresh in context when the agent makes its decision. It's a just-in-time guardrail.

### Why STATE.md at project root, not per-workspace?

STATE.md is the cross-workspace bridge. If it lives inside a workspace, other workspaces can't find it without knowing where to look. At `ai/STATE.md`, every agent knows exactly where the breadcrumb trail lives.

### Why not enforce TOOLS.md via prompt?

Prompt-based restrictions are suggestions. The agent can ignore them under pressure ("sure, I'll just write this one file outside my scope..."). Server-side enforcement means denied = denied. The agent gets an error, not a temptation.

### Why agents write STATE.md in WORKFLOW.md, not via a hook?

Hooks are invisible to the agent. If a hook writes STATE.md, the agent doesn't know what was written and can't ensure quality. When the agent writes it as a workflow step, it summarizes its own work accurately, includes loose threads, and takes ownership of continuity.

---

## For New Projects

When the kimi-claude IDE opens a new project:

1. Create `ai/STATE.md` (empty or with initial entry)
2. For each workspace that needs an agent:
   - Create folder in `ai/workspaces/`
   - Add PROMPT.md, TOOLS.md, WORKFLOW.md, workspace.json
3. Server discovers workspaces by scanning `ai/workspaces/*/workspace.json`
4. Each workspace's agent is available when its tab opens

The model is file-driven. No database, no service registration, no config server. Files in folders. The server reads them. That's it.
