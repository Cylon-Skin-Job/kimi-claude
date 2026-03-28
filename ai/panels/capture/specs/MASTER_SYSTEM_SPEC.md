---
title: Master System Spec — Kimi IDE
created: 2026-03-27
status: master
supersedes: DECLARATIVE_WORKSPACE_SYSTEM_SPEC, RENDER_PIPELINE_REFACTOR_SPEC, scope-and-chat-architecture
---

# Kimi IDE — Master System Spec

Everything in one place. The definitive reference for how the system works, how it should work, and what's left to build.

---

## 1. Core Principle

**The app is a runtime. The project tree is the program.**

Code reads folders, loads configs, applies themes, renders content. All individualized logic — agents, workflows, styling, integrations, scheduling — lives in the file system. New capabilities require new files, not new code. The only code changes are new content-type renderers.

---

## 2. Directory Structure

```
ai/
  system/                                    ← FRAMEWORK (same in every project)
    scripts/                                 ← Global Node.js commands (npm bin)
    workspace-settings/
      workspaces.json                        ← Sidebar order
      theme.css                              ← System-wide CSS defaults
      icon-map.json                          ← File/folder icon definitions
      content-types/
        capture.json                         ← Tile row display
        file-explorer.json                   ← Tree + viewer display
        chat.json                            ← Conversation display
        terminal.json                        ← Split pane display
        wiki.json                            ← Wiki page display
        ticket-board.json                    ← Issue columns display
        bots.json                            ← Agent cards display
    templates/
      workspaces/{type}/                     ← Workspace templates
      content-types/{type}/                  ← Content-type templates
      agents/{type}/                         ← Agent templates
    wiki/                                    ← System docs (setup, architecture)
    secrets/                                 ← Encrypted credentials (safeStorage)

  project/                                   ← INSTANCE (unique per project)
    config.json                              ← Project name, default model
    workspaces/                              ← Active workspaces
    chat/ or threads/                        ← Project-level conversation
    wiki/                                    ← Project-specific knowledge
```

### System vs Project

| | `ai/system/` | `ai/project/` |
|---|---|---|
| Scope | All projects | One project |
| Git | Own repo (submodule) | Pushed with project |
| Contains | Scripts, templates, settings, system wiki | Workspaces, conversations, project wiki |
| Updates | Framework releases | Project development |

---

## 3. Workspaces

### Discovery

The engine scans `ai/project/workspaces/` for folders. Order comes from `ai/system/workspace-settings/workspaces.json`. Dot-prefixed folders (`.wiki`) are hidden from the sidebar but still functional.

### Workspace Folder

```
{workspace}/
  config.json              ← name, icon, description
  theme.css                ← style overrides (inherits system defaults)
  {content-type}/          ← folder name matches a content-type definition
  tabs/                    ← optional: multiple content-types as tabs
    {tab}/
      tab.json             ← { contentType, icon, label }
  chat/ or threads/        ← workspace-scoped conversation
```

### Core Workspaces (protected)

| Workspace | Purpose | Chat Type |
|-----------|---------|-----------|
| **Wiki** | Knowledge layer | Pop-up (system-wide) |
| **Settings** | System config | None |
| **Code** | File viewer | Threads (multi-thread) |
| **Bots** | Agent management | Per-bot cards |
| **Issues** | Ticket routing | Chat (daily rolling) |

### Optional Workspaces

Capture, Terminal, Browser, and any user-created workspace from templates.

### Hiding

```
Hide:  mv workspaces/wiki  workspaces/.wiki
Show:  mv workspaces/.wiki workspaces/wiki
```

Hidden workspaces still function (bots read them, tickets route to them). They just leave the sidebar.

---

## 4. Content Types

Folder name inside a workspace matches a content-type definition in `system/workspace-settings/content-types/`. The definition declares layout, features, and rendering rules.

```json
{
  "id": "capture",
  "layout": "tile-grid",
  "features": { "imageSupport": true, "filePreview": true },
  "rendering": { "folderDisplay": "tile-row", "fileDisplay": { "image": "thumbnail", "default": "document-tile" } },
  "icon": "open_run"
}
```

**Resolution:** folder name → look up `content-types/{name}.json` → render using that layout. Not found → fall back to generic file list.

---

## 5. CSS Cascade

```
system/workspace-settings/theme.css     ← base
  ↓
workspaces/{ws}/theme.css               ← workspace override
  ↓
workspaces/{ws}/{content}/theme.css     ← content-type override
  ↓
workspaces/{ws}/{content}/{item}/theme.css ← component override
```

Same variable names at every level. Last definition wins. A card can override its workspace's colors. A workspace can override the system defaults. Everything inherits unless overridden.

### Core Variables

```css
--chrome-bg, --chrome-border, --chrome-text
--ws-bg, --ws-border, --ws-surface
--color-primary, --color-primary-rgb, --color-secondary, --color-accent
--text-primary, --text-secondary, --text-dim, --text-muted
--bg-card, --bg-card-hover, --bg-input, --bg-selected
--border-card, --border-input, --border-active, --border-glow
--card-radius, --card-padding, --card-shadow
--sidebar-width, --chat-width, --panel-gap
```

---

## 6. Conversation System

### The Rule: Folder Name Is The Config

```
chat/      → daily rolling, one per day, ordered by date
threads/   → multi-thread, ordered by last interaction
```

### Depth Determines Display

| Location | Display | Scope |
|----------|---------|-------|
| `ai/project/chat or threads` | Right panel (persistent) | Entire project |
| `ai/project/workspaces/chat or threads` | Shared sidebar chat | Workspaces without their own |
| `workspaces/{ws}/{content}/chat or threads` | Floating pop-up | One workspace |
| `workspaces/{ws}/{content}/{folder}/chat or threads` | Card that expands | One agent in content |

### Self-Contained Conversation

```
{conversation-name}/
  chat.json or thread.json    ← sessionId, config, systemContext, enrichment
  history.json                ← structured exchanges
```

### Metadata JSON

```json
{
  "sessionId": "uuid",
  "created": "ISO-8601",
  "lastActive": "ISO-8601",
  "config": { "model": "...", "cli": "...", "endpoint": "...", "maxTokens": 8192 },
  "systemContext": { "prompt": "...", "loadedFiles": ["IDENTITY.md", "MEMORY.md"], "loadedAt": "..." },
  "enrichment": { "summary": "...", "tags": [], "entities": [], "embedding": [], "enrichedAt": "..." }
}
```

`sessionId` is the real key. Folder name is for humans. Two threads can share a name — the UI resolves by sessionId.

### Behavioral Differences

| | `chat/` | `threads/` |
|---|---|---|
| Folder naming | Date (`2026-03-26`) | Thread name |
| Ordering | By date | By `lastActive` |
| Creation | Auto: one per day | Manual: "New Chat" placeholder |
| Duplicates | Impossible | Allowed (sessionId is the key) |
| Rename | Never | Background process or user |

---

## 7. Agents

### Definition by Folder Contents

```
{agent}/
  IDENTITY.md              ← personality, role, focus
  MEMORY.md                ← persistent memory
  LESSONS.md               ← learned patterns (agent-scoped)
  SESSION.md               ← harness config (model, CLI, endpoint, timeout)
  TRIGGERS.md              ← event-driven activation rules
  theme.css                ← agent-specific styling
  workflows/
    {workflow-name}/
      PROMPT.md            ← the workflow steps
      TRIGGERS.md          ← when this workflow fires
      LESSONS.md           ← workflow-scoped lessons
  runs/                    ← execution history (snapshot copies)
```

No type enum. The combination of files defines behavior.

### SESSION.md: Harness Config

```yaml
---
model: claude-sonnet-4-6
cli: kimi
endpoint: https://api.anthropic.com/v1/messages
idle-timeout: 9m
system-context:
  - IDENTITY.md
  - MEMORY.md
max-sessions: 5
---
```

### Workflows

Each workflow is a self-contained folder. For runs, the entire folder is snapshot-copied — the prompt, triggers, and lessons active at the time travel with the run.

### Bot Detail UI (current implementation)

```
┌──────────────────────────────────────────────────────┐
│ 🤖 Wiki Manager              idle              [✕]  │
│                                                      │
│ (Workflows)  (Runs)  (Settings)    ← pill buttons    │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Sidebar cards │ Content viewer    │  Chat area   │ │
│ │ (changes per  │ (selected card)   │              │ │
│ │  active tab)  │                   │  [input]     │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

- **Workflows tab:** sidebar shows workflow cards with name + description. Content shows step cards (left) + detail (right).
- **Runs tab:** sidebar shows run list. Click a run → workflow steps (left) + evidence cards (right).
- **Settings tab:** sidebar shows IDENTITY, MEMORY, LESSONS, SESSION, TRIGGERS. Content shows plain text.

### Workflow Step View

```
Steps (left)              Detail (right)
┌──────────┐         ┌──────────────────────┐
│ 1. Gather │─────────│ Full step content    │
└──────────┘         │ with sub-agent cards │
     │               │ and evaluate badges  │
     ▼               └──────────────────────┘
┌──────────┐
│ 2. Propose│
└──────────┘
```

Click a step card → detail fills the right. Whole container scrolls together.

### Run View (future)

Same layout but left column shows the workflow steps, right column shows evidence cards — what the agent actually produced for each step. 1:1 connection lines.

---

## 8. Render Pipeline

### Orb (gatekeeper — not part of render)

- 500ms delay → 1500ms expand → hold until first token → 500ms disposal
- Dynamic: stays alive until first token, never leaves a gap
- Never appears a second time

### Tool Segments

```
LiveToolSegment → skipShimmer (first segment) or shimmer (200ms)
  → ToolCallBlock (header + icon)
  → reveal/ orchestrator + parsers
  → typing cursor during reveal
  → collapse → done
```

### Text Segments

```
LiveTextSegment → parseTextChunks() dispatcher
  → sub-renderers: paragraph, header, code-fence, list
  → chunk buffer + speed attenuator
  → typing cursor
  → markdownToHtml via transforms/
```

### Transforms (single source of truth)

```
src/lib/transforms/
  ├── markdown.ts     ← ONE configured marked instance
  └── code.ts         ← ONE escapeHtml, codeBlockHtml, preWrapHtml
```

### Text Module

```
src/lib/text/
  ├── index.ts              ← parseTextChunks(), renderTextInstant(), dispatcher
  ├── chunk-boundary.ts     ← boundary detection
  ├── chunk-buffer.ts       ← queue + speed attenuator
  ├── html-utils.ts         ← truncation, char counting
  └── renderers/
      ├── paragraph.ts, header.ts, code-fence.ts, list.ts
```

---

## 9. Zero-Code Backend

Bots + scripts + triggers + secrets = any API, any schedule, no code.

```
FRAMEWORK PROVIDES:          BOTS USE:
  Secrets manager              → API keys for any service
  Ticketing system             → Scheduling, task assignment
  Cron/block triggers          → Recurring execution
  Script execution             → Any Node.js script
  File watcher                 → Event-driven activation
```

**Example: Enrichment pipeline**
```
enrichment-agent/
  ├── PROMPT.md         ← "Scan conversations, extract metadata"
  ├── TRIGGERS.md       ← cron: hourly
  ├── scripts/
  │   └── enrich.js     ← embeddings API call
  └── IDENTITY.md
```

No pipeline to build. No infrastructure. Just a bot with a script.

### System Update Federation

When `ai/system/` updates, a federation bot diffs against project instances and creates a review ticket. Nothing auto-applies. User reviews each change.

---

## 10. Cross-Platform (Electron)

### What Electron Handles
- `safeStorage` → macOS Keychain / Windows DPAPI / Linux libsecret
- `node-pty` → terminal emulation on all platforms
- `xterm.js` → browser-based terminal rendering
- IPC → local terminal (no WebSocket needed)

### Gotchas

| Concern | Fix |
|---------|-----|
| Path separators | `path.join()` everywhere |
| Shell scripts | All scripts `.js`, no `.sh` |
| Symlinks on Windows | Directory junctions (`mklink /J`), no admin |
| Line endings | Handle `\n` and `\r\n` |
| CLI detection | Platform-aware lookup at startup |
| File permissions | Always `node script.js`, never `./script.js` |
| Process management | `kill-port` package or platform detection |

### Scripts as Terminal Commands

```json
{
  "bin": {
    "kimi-restart": "./scripts/restart.js",
    "kimi-enrich": "./ai/scripts/enrich.js",
    "kimi-sync-wiki": "./ai/scripts/sync-wiki.js"
  }
}
```

---

## 11. Template System

### Template → Instance Flow

```
Create workspace → pick template → copy to ai/project/workspaces/{name}/
Add agent        → pick template → copy to workspace/agent/
Add content-type → pick template → copy to workspace/{type}/
```

Instance is independent. Customization doesn't touch the template. Framework updates bring new templates; existing instances are untouched.

---

## 12. What's Built vs What's Planned

### Built (working today)
- [x] Dynamic orb with token-aware disposal
- [x] Shimmer skip for first segment
- [x] Typing cursor in tool + text segments
- [x] Text sub-renderer dispatch (paragraph, header, code-fence, list)
- [x] Unified transforms (markdownToHtml, escapeHtml)
- [x] Symlink support in file explorer (folder_special icon)
- [x] Image serving + thumbnail rendering in capture
- [x] Screenshot symlink (Desktop → capture)
- [x] Single server (removed duplicate Python server)
- [x] Bot detail view (card layout, pill tabs, sidebar + content + chat)
- [x] Workflow folders (PROMPT.md + TRIGGERS.md + LESSONS.md per workflow)
- [x] Prompt card view (step cards with detail panel)
- [x] Terminal workspace (mockup UI)
- [x] Timing instrumentation (SEND → FIRST TOKEN → ORB → RENDER SIGNAL)

### Planned (specced, not built)
- [ ] `ai/system/` + `ai/project/` directory split
- [ ] Declarative content-type resolution (folder name → JSON → renderer)
- [ ] CSS cascade engine (system → workspace → content → component)
- [ ] Shared icon-map.json (replace 3 duplicated maps)
- [ ] Tab system (tabs/ folder with tab.json per tab)
- [ ] Template picker UI (create workspace/agent/content from templates)
- [ ] Conversation system (chat/ vs threads/ folder convention)
- [ ] chat.json / thread.json metadata with enrichment fields
- [ ] Terminal wiring (node-pty + xterm.js)
- [ ] Run execution + evidence capture
- [ ] System update federation bot
- [ ] Cross-platform script conversion (.sh → .js)
- [ ] Electron wrapper
- [ ] safeStorage secrets migration
- [ ] OAuth browser integration

### Known Bugs
- [ ] Wiki, Agents, Issues, Skills workspaces stuck on "Loading" (workspace-loading-bug.md)
- [ ] User chat bubble renders twice on refresh
- [ ] Line-break parser stall on thinking content without newlines

---

## 13. Open Questions

1. Hot reload for theme.css changes?
2. Content-type inheritance?
3. Multiple agents per workspace?
4. Tab persistence across sessions?
5. OAuth flow for services requiring browser auth?
6. Run snapshot format — full copy or diff from template?
