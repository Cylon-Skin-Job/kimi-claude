---
title: "SESSION.md and Chat Architecture"
status: spec
priority: high
relates-to: impl-phase-6-chat-integration, generic-workspace-router
---

# SESSION.md and Chat Architecture

Folder depth determines chat display mode. SESSION.md defines thread behavior. IDENTITY.md defines persona focus. No configuration needed beyond where you put the files.

## The Rule

The depth of SESSION.md in the folder tree determines how chat renders:

| Depth | Location | Display Mode | Scope |
|-------|----------|-------------|-------|
| Root | `ai/SESSION.md` | Always visible — persistent panel or global floating | Entire project, all workspaces |
| Workspace | `ai/workspaces/{ws}/SESSION.md` | Fullscreen — chat *is* the workspace | One workspace |
| Agent folder | `ai/workspaces/{ws}/agent/SESSION.md` | Pop-up — draggable floating window over content | One workspace, non-blocking |
| Container | `ai/workspaces/{ws}/{folder}/{agent}/SESSION.md` | Tile row — click agent to open panel | One agent within a group |

### Examples

```
ai/
├── SESSION.md                                          ← root: always-visible project assistant
└── workspaces/
    ├── coding-agent/
    │   ├── SESSION.md                                  ← workspace: fullscreen chat
    │   └── threads/
    ├── wiki/
    │   ├── agent/
    │   │   ├── SESSION.md                              ← agent folder: pop-up floating
    │   │   ├── IDENTITY.md
    │   │   └── threads/
    │   └── (wiki content...)
    ├── issues/
    │   ├── SESSION.md                                  ← workspace: fullscreen (or inline)
    │   └── threads/
    └── background-agents/
        └── System/
            ├── wiki-manager/
            │   ├── SESSION.md                          ← container: tile/panel
            │   ├── IDENTITY.md
            │   └── threads/
            ├── code-manager/
            │   ├── SESSION.md
            │   └── threads/
            └── ops-manager/
                ├── SESSION.md
                └── threads/
```

## SESSION.md Format

```yaml
---
thread-model: multi-thread | daily-rolling | single-persistent
session-invalidation: memory-mtime | none
idle-timeout: 9m
system-context:
  - IDENTITY.md
  - MEMORY.md
max-sessions: 5
---
```

### Thread Models

| Model | Behavior | Thread ID | Used by |
|-------|----------|-----------|---------|
| `multi-thread` | UUID folders, New Chat button, thread list, auto-rename | UUID | Coding agent |
| `daily-rolling` | Date folders, one per day, auto-open today's | `YYYY-MM-DD` | Issues, agent personas |
| `single-persistent` | One thread, no list, no creation UI | Fixed ID | Project-scoped root agent |

### Session Invalidation

| Mode | Behavior |
|------|----------|
| `memory-mtime` | If MEMORY.md mtime > last message timestamp → archive thread, start fresh |
| `none` | Threads persist until manually archived or model-specific rollover |

## Display Modes (Derived from Depth)

### Root (ai/SESSION.md) — Always Visible
- Persistent panel or floating window
- Doesn't change when you switch workspaces
- Same conversation everywhere
- Focus: recent chat exchanges across all workspaces, cross-cutting view
- The "what's been happening" agent

### Workspace (workspaces/{ws}/SESSION.md) — Fullscreen
- Chat *is* the workspace view
- Full content area
- Thread list sidebar (if multi-thread)
- The coding agent, the issues assistant

### Agent Folder (workspaces/{ws}/agent/SESSION.md) — Pop-up
- Draggable floating window over workspace content
- Non-blocking — you can still see and interact with the workspace
- One folder deep signals "I'm an agent within this workspace, not the workspace itself"
- The wiki assistant that you talk to while reading pages

### Container (workspaces/{ws}/{folder}/{agent}/SESSION.md) — Panel
- Tile row display in parent workspace
- Click agent tile → panel slides out (or inline chat area)
- Nested two levels deep signals "I'm one of many agents in a group"
- Background agent personas

## What Each Agent Sees

Every agent at every level has the same tools (Read, Edit, Grep, Bash, etc.). The differentiation is in what IDENTITY.md tells it to focus on:

| Scope | Default Focus |
|-------|--------------|
| Root | Recent exchanges across all workspace threads, cross-workspace activity |
| Workspace | Files and state within that workspace |
| Agent folder | Workspace content + its own domain knowledge |
| Container | Its own prompts, triggers, lessons, history, runs |

An agent *can* read anything. IDENTITY.md tells it what to *care about*.

## Relationship to Other Files

| File | Purpose | Scope |
|------|---------|-------|
| SESSION.md | Thread model, session behavior, display mode (via depth) | How chat works |
| IDENTITY.md | Persona definition, domain, standards pointer | Who the agent is |
| MEMORY.md | User relationship, preferences, instructions | What the agent remembers about you |
| HISTORY.md | Run activity log | What the agent has done |
| LESSONS.md | Process learnings | What the agent has learned about its work |
| TRIGGERS.md | Activation rules | When the agent wakes up |
| styles.css | Display metadata (icon, color) | How the agent looks |

SESSION.md replaces workspace.json's `hasChat`, `threadDefaults`, and session settings for chat configuration. workspace.json retains ownership of display config (theme, icon, type, folders).

## Discovery

At startup, the server:
1. Walks the `ai/` tree looking for SESSION.md files
2. For each, determines depth (root/workspace/agent-folder/container)
3. Creates a ThreadManager at that path
4. Registers the display mode for the client

The client receives the registered scopes and knows how to render each one.

## Future

- Bookkeeping app: `ai/SESSION.md` with `single-persistent` — one conversation that follows you everywhere
- Email workspace: `ai/workspaces/email/agent/SESSION.md` — pop-up assistant over inbox
- Custom agent groups: `ai/workspaces/background-agents/MyAgents/{agent}/SESSION.md` — user-created containers
