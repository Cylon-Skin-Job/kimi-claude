---
title: Declarative Workspace System
created: 2026-03-26
status: draft
priority: high
---

# Declarative Workspace System

## Problem

Workspace configuration is currently scattered:
- Per-workspace `workspace.json` files define name, icon, rank, theme, layout
- Content display logic is hardcoded in React components (`ContentArea.tsx` routes by workspace ID)
- Icon maps are duplicated across 3 files (`FileViewer.tsx`, `DocumentTile.tsx`, `FolderNode.tsx`)
- Adding a new workspace requires code changes
- No way to compose workspaces from reusable parts
- Styling is baked into CSS files, not configurable per-workspace

## Goal

A fully declarative system where:
- Workspaces are defined by folder structure, not code
- Content display is determined by dropping a content-type folder into a workspace
- Agent behavior is determined by agent folder contents
- Styling cascades from system → workspace → content-type → component
- New workspaces require zero code changes — just create folders and JSON

---

## Architecture

### Directory Structure

```
ai/
  system/
    workspace-settings/
      workspaces.json              ← global registry (folder names + rank order)
      theme.css                    ← system-wide CSS variable defaults
      content-types/
        capture.json               ← capture display definition
        file-explorer.json         ← file tree display definition
        chat.json                  ← chat/conversation display definition
        terminal.json              ← terminal pane display definition
        wiki.json                  ← wiki page display definition
        ticket-board.json          ← issue tracker display definition
      icon-map.json                ← shared file/folder icon definitions

  workspaces/
    {workspace-name}/
      config.json                  ← workspace-specific config (name, icon, description)
      theme.css                    ← workspace style overrides (inherits system defaults)
      agent/                       ← agent type (folder contents define behavior)
      {content-folder}/            ← content type (folder name matches a content-type)
        theme.css                  ← content-type style overrides
        {component}/               ← individual items within content
          theme.css                ← component-level style overrides
      tabs/                        ← optional: tabbed content view
        {tab-name}/                ← each tab is a content-type folder
          theme.css                ← per-tab style overrides
```

### Example: Current Workspaces Migrated

```
ai/workspaces/

  coding-agent/
    config.json                    ← { "name": "Code", "icon": "code_blocks" }
    theme.css                      ← cyan theme overrides
    agent/                         ← coding agent (prompts, identity, triggers)
    file-explorer/                 ← displays as file tree
    chat/                          ← displays as chat area

  capture/
    config.json                    ← { "name": "Capture", "icon": "open_run" }
    theme.css                      ← blue theme overrides
    capture/                       ← displays as tile rows
      specs/
      todo/
      screenshots/                 ← symlink to ~/Desktop/Screenshots

  terminal/
    config.json                    ← { "name": "Terminal", "icon": "terminal" }
    theme.css                      ← green theme overrides
    terminal/                      ← displays as split panes

  issues/
    config.json                    ← { "name": "Issues", "icon": "business_messages" }
    theme.css                      ← yellow theme overrides
    ticket-board/                  ← displays as ticket columns

  wiki/
    config.json                    ← { "name": "Wiki", "icon": "full_coverage" }
    theme.css                      ← pink theme overrides
    wiki/                          ← displays as wiki pages
```

### Example: Composable Workspace

```
  inbox/
    config.json                    ← { "name": "Inbox", "icon": "inbox" }
    theme.css
    agent/                         ← triage agent
    tabs/
      incoming/                    ← capture content-type (tile view)
        theme.css                  ← custom tile colors for inbox items
      active/                      ← ticket-board content-type
      archive/                     ← capture content-type (read-only view)
```

---

## Global Registry

### `workspaces.json`

```json
{
  "order": [
    "capture",
    "coding-agent",
    "terminal",
    "issues",
    "wiki",
    "background-agents",
    "skills"
  ]
}
```

Rank is array position. Adding a workspace = add its folder name to the array. Removing = delete from array (folder can stay for archival).

---

## Content-Type Definitions

### `content-types/capture.json`

```json
{
  "id": "capture",
  "name": "Capture",
  "description": "Tile row view — renders subfolders as horizontal scrollable rows",
  "layout": "tile-grid",
  "features": {
    "imageSupport": true,
    "filePreview": true,
    "dragDrop": false
  },
  "rendering": {
    "folderDisplay": "tile-row",
    "fileDisplay": {
      "markdown": "document-tile",
      "image": "image-thumbnail",
      "json": "document-tile",
      "default": "document-tile"
    }
  },
  "icon": "open_run"
}
```

### `content-types/file-explorer.json`

```json
{
  "id": "file-explorer",
  "name": "File Explorer",
  "description": "Tree view with file viewer panel",
  "layout": "tree-viewer",
  "features": {
    "fileTree": true,
    "fileViewer": true,
    "syntaxHighlight": true,
    "lineNumbers": true
  },
  "rendering": {
    "treeDisplay": "file-tree",
    "fileDisplay": "code-viewer"
  },
  "icon": "folder_open"
}
```

### `content-types/terminal.json`

```json
{
  "id": "terminal",
  "name": "Terminal",
  "description": "Split terminal panes with session list",
  "layout": "split-pane-sidebar",
  "features": {
    "splitPanes": true,
    "maxPanes": 3,
    "sessionList": true
  },
  "rendering": {
    "paneDisplay": "xterm",
    "sidebarDisplay": "session-list"
  },
  "icon": "terminal"
}
```

### `content-types/chat.json`

```json
{
  "id": "chat",
  "name": "Chat",
  "description": "Conversational interface with message list and input",
  "layout": "message-list-input",
  "features": {
    "streaming": true,
    "orb": true,
    "typingAnimation": true,
    "threadManagement": true
  },
  "rendering": {
    "liveSegments": "LiveSegmentRenderer",
    "instantSegments": "InstantSegmentRenderer"
  },
  "icon": "chat"
}
```

---

## Shared Icon Map

### `icon-map.json`

Single source of truth for all file/folder icons. Replaces the three duplicated maps.

```json
{
  "files": {
    "js": "javascript",
    "jsx": "code",
    "ts": "terminal",
    "tsx": "code",
    "css": "css",
    "html": "html",
    "json": "data_object",
    "md": "description",
    "txt": "text_snippet",
    "sh": "terminal",
    "py": "code",
    "yaml": "settings",
    "yml": "settings",
    "toml": "settings",
    "png": "image",
    "jpg": "image",
    "jpeg": "image",
    "gif": "image",
    "svg": "image",
    "webp": "image",
    "pdf": "picture_as_pdf",
    "lock": "lock",
    "log": "receipt_long",
    "env": "vpn_key",
    "default": "draft"
  },
  "folders": {
    "default": "folder",
    "expanded": "folder_open",
    "empty": "folder",
    "symlink": "folder_special",
    "node_modules": "folder_off",
    "dist": "folder_zip",
    ".git": "source"
  },
  "special": {
    ".gitignore": "visibility_off",
    "package.json": "inventory_2",
    "tsconfig.json": "settings",
    "README.md": "menu_book",
    "LICENSE": "gavel",
    "Dockerfile": "deployed_code",
    ".env": "vpn_key"
  }
}
```

---

## CSS Cascade

### Principle

Every level uses the same CSS variable names. Each level can override any variable. The engine loads them in order — last definition wins.

```
system/workspace-settings/theme.css        ← loaded first (base)
  ↓
workspaces/{name}/theme.css                ← loaded second (workspace override)
  ↓
workspaces/{name}/{content}/theme.css      ← loaded third (content override)
  ↓
workspaces/{name}/{content}/{item}/theme.css  ← loaded fourth (component override)
```

### System Defaults (`system/workspace-settings/theme.css`)

```css
/* ── Chrome (outside workspaces) ── */
--chrome-bg: #000000;
--chrome-border: rgba(255, 255, 255, 0.08);
--chrome-text: rgba(255, 255, 255, 0.6);

/* ── Workspace ── */
--ws-bg: #0d0d0d;
--ws-border: rgba(255, 255, 255, 0.1);
--ws-surface: #111111;

/* ── Colors ── */
--color-primary: #888888;
--color-primary-rgb: 136, 136, 136;
--color-secondary: #666666;
--color-accent: #aaaaaa;

/* ── Text ── */
--text-primary: #ffffff;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-dim: rgba(255, 255, 255, 0.5);
--text-muted: rgba(255, 255, 255, 0.3);

/* ── Backgrounds ── */
--bg-card: rgba(255, 255, 255, 0.03);
--bg-card-hover: rgba(255, 255, 255, 0.06);
--bg-input: rgba(255, 255, 255, 0.05);
--bg-selected: rgba(var(--color-primary-rgb), 0.1);

/* ── Borders ── */
--border-card: rgba(255, 255, 255, 0.06);
--border-input: rgba(255, 255, 255, 0.1);
--border-active: var(--color-primary);
--border-glow: rgba(var(--color-primary-rgb), 0.4);

/* ── Cards / Tiles ── */
--card-radius: 8px;
--card-padding: 12px;
--card-shadow: none;

/* ── Layout ── */
--sidebar-width: 200px;
--panel-gap: 1px;
```

### Workspace Override Example (`workspaces/coding-agent/theme.css`)

```css
/* Only override what's different — everything else inherits */
--color-primary: #00d4ff;
--color-primary-rgb: 0, 212, 255;
--ws-bg: #0a0d14;
--ws-border: rgba(0, 212, 255, 0.15);
```

### Content Override Example (`workspaces/coding-agent/file-explorer/theme.css`)

```css
/* Tree-specific tweaks */
--card-radius: 4px;
--bg-selected: rgba(0, 212, 255, 0.08);
```

### Component Override Example (individual bot card)

```css
/* This specific bot gets a red accent */
--color-primary: #ef4444;
--color-primary-rgb: 239, 68, 68;
--border-active: #ef4444;
```

---

## Agent Definition

Agents are defined by their folder contents, not by a type name. The presence of specific files determines behavior.

```
agent/
  ├── PROMPT_01.md         ← system prompt (required)
  ├── PROMPT_02.md         ← context prompt (optional)
  ├── IDENTITY.md          ← agent personality/role
  ├── MEMORY.md            ← persistent memory
  ├── LESSONS.md           ← learned patterns
  ├── TRIGGERS.md          ← event-driven activation rules
  ├── SESSION.md           ← current session state
  ├── HISTORY.md           ← past session log
  └── theme.css            ← agent-specific styling
```

No agent type enum. The combination of prompts, triggers, and identity files defines what the agent does. A "coding agent" has code-focused prompts. A "triage agent" has routing-focused prompts. The system doesn't need to know the difference — it just loads the files and passes them to the model.

---

## Tab System

When a workspace contains a `tabs/` folder, the content area renders a tab bar. Each subfolder is a tab. The tab's content-type is determined by the folder name matching a content-type definition.

```
workspace/
  tabs/
    code/              ← matches content-type "file-explorer"? No.
    ...
```

Wait — the folder name inside `tabs/` is the **tab label**, not the content-type. We need a way to declare the content-type per tab. Two options:

### Option A: Config file per tab

```
tabs/
  code/
    tab.json           ← { "contentType": "file-explorer", "icon": "code" }
  capture/
    tab.json           ← { "contentType": "capture", "icon": "open_run" }
```

### Option B: Content-type folder inside the tab

```
tabs/
  code/
    file-explorer/     ← the content-type folder itself
  capture/
    capture/           ← the content-type folder itself
```

**Recommendation: Option A.** It's cleaner — one config file declares intent. The tab folder itself holds the tab's data/content. Option B has awkward nesting.

### Tab Bar Rendering

```
┌──────┬─────────┬─────────┐
│ Code │ Capture │ Archive │    ← tab icons from tab.json or content-type default
├──────┴─────────┴─────────┤
│                           │
│  Content area renders     │
│  based on active tab's    │
│  content-type definition  │
│                           │
└───────────────────────────┘
```

### Tab Config

```json
{
  "contentType": "file-explorer",
  "icon": "code",
  "label": "Code"
}
```

If `icon` is omitted, falls back to the content-type's default icon.
If `label` is omitted, uses the folder name.

---

## Engine: How It Loads

### Startup Sequence

```
1. Read system/workspace-settings/workspaces.json → ordered workspace list
2. Load system/workspace-settings/theme.css → set as :root CSS variables
3. Load system/workspace-settings/icon-map.json → store in memory
4. For each workspace in order:
   a. Read {workspace}/config.json → name, icon, description
   b. Read {workspace}/theme.css → overlay on system variables (scoped to workspace)
   c. Scan for content-type folders (match names against content-types/*.json)
   d. Scan for tabs/ folder → load tab.json per tab
   e. Scan for agent/ folder → detect agent presence
5. Build sidebar from workspace list
6. On workspace switch:
   a. Apply workspace theme.css variables
   b. Load content-type definition
   c. Render content area using content-type's layout
   d. Load any content/component-level theme.css overrides
```

### Content-Type Resolution

```
For a folder named "capture" inside a workspace:
  → Look up content-types/capture.json
  → Found? Use its layout definition to render
  → Not found? Fall back to generic file list view
```

### CSS Variable Application

```javascript
// Pseudo-code for cascade loading
function applyThemeCascade(workspaceId, contentPath, componentPath) {
  // Start with system defaults
  loadCssVariables('ai/system/workspace-settings/theme.css');

  // Overlay workspace
  loadCssVariables(`ai/workspaces/${workspaceId}/theme.css`);

  // Overlay content-type
  if (contentPath) {
    loadCssVariables(`ai/workspaces/${workspaceId}/${contentPath}/theme.css`);
  }

  // Overlay component
  if (componentPath) {
    loadCssVariables(`ai/workspaces/${workspaceId}/${contentPath}/${componentPath}/theme.css`);
  }
}
```

Each `loadCssVariables` reads the CSS file, extracts custom property declarations, and sets them on the appropriate DOM container element. Later declarations override earlier ones — standard CSS cascade.

---

## Migration Path

### Phase 1: Create system directory + icon map
- Create `ai/system/workspace-settings/`
- Move icon maps from code into `icon-map.json`
- Create `theme.css` with current system defaults
- Update code to read icon map from the file instead of hardcoded maps

### Phase 2: Content-type definitions
- Create `content-types/*.json` for each existing content type
- Map existing hardcoded layouts to content-type definitions
- Update `ContentArea.tsx` to resolve content-type from folder name

### Phase 3: Workspace config migration
- Replace per-workspace `workspace.json` with `config.json` (lighter, no layout/theme)
- Create `workspaces.json` global registry with order
- Generate `theme.css` per workspace from current inline theme objects

### Phase 4: CSS cascade engine
- Build the `loadCssVariables` cascade loader
- Replace all hardcoded theme application with cascade
- Test that overrides work at each level

### Phase 5: Tab system
- Build tab bar component
- Detect `tabs/` folder, load `tab.json` per tab
- Route tab content to content-type renderer

### Phase 6: Remove hardcoded workspace routing
- Delete `ContentArea.tsx` workspace ID switch statement
- All routing done by content-type resolution
- Remove static workspace type constants

---

## What This Enables

1. **Zero-code workspace creation** — create folder, add config.json, drop in content-type folders
2. **Composable layouts** — mix and match content-types via tabs
3. **Per-component theming** — any card, tile, or panel can override its parent's theme
4. **Portable content-types** — capture view works in any workspace that drops in a capture folder
5. **Agent independence** — agents are defined by file contents, not workspace type
6. **User customization** — change colors, icons, borders by editing CSS files, no code
7. **Plugin ecosystem** — third-party content-types are just a JSON definition + a ui/ folder

---

## Conversation System

### The Rule: Folder Name Is The Config

```
chat/      → daily rolling conversation, one per day, ordered by date
threads/   → multi-thread conversations, ordered by last interaction
```

No config file determines chat type. The folder name IS the declaration. Both use identical internal structure.

### Depth Determines Display

```
LOCATION                                          DISPLAY              SCOPE
────────────────────────────────────────────────────────────────────────────
ai/chat or ai/threads                             right panel          entire project, persists across
                                                  (always visible)     workspace switches

ai/workspaces/chat or ai/workspaces/threads       left sidebar chat    shared by workspaces that
                                                                       don't have their own

ai/workspaces/{ws}/{content}/chat or threads      floating pop-up      one workspace, non-blocking
                                                  (lower right)

ai/workspaces/{ws}/{content}/{folder}/chat or     card/tile that       one agent within content,
threads                                           expands fullscreen   embedded in rows or tiles
```

### Self-Contained Conversation Folders

Every conversation is a portable, self-contained folder:

```
threads/
  ├── Fix render pipeline/
  │   ├── thread.json          ← metadata + config + system prompt
  │   └── history.json         ← conversation exchanges
  │
  └── New Chat/
      ├── thread.json
      └── history.json

chat/
  ├── 2026-03-26/
  │   ├── chat.json            ← metadata + config + system prompt
  │   └── history.json
  │
  └── 2026-03-25/
      ├── chat.json
      └── history.json
```

### Conversation Metadata (`thread.json` / `chat.json`)

Same schema, different filename to match parent convention:

```json
{
  "sessionId": "769d776f-88f6-421a-9326-cc97d6a2a604",
  "created": "2026-03-26T14:00:00Z",
  "lastActive": "2026-03-26T15:30:00Z",
  "status": "active",

  "config": {
    "model": "claude-sonnet-4-6",
    "cli": "kimi",
    "endpoint": "https://api.anthropic.com/v1/messages",
    "maxTokens": 8192,
    "temperature": 0.7
  },

  "systemContext": {
    "prompt": "You are a coding assistant focused on the kimi-claude project...",
    "loadedFiles": [
      "IDENTITY.md",
      "MEMORY.md",
      "CLAUDE.md"
    ],
    "loadedAt": "2026-03-26T14:00:00Z"
  }
}
```

Key points:
- `sessionId` is the real identifier — the UI binds to this, not the folder name
- System prompt that was active at chat start is preserved
- API config is per-conversation — different agents can use different models/endpoints
- Copy the folder anywhere and you have full context

### Behavioral Differences

| | `chat/` | `threads/` |
|---|---|---|
| Folder naming | Date (`2026-03-26`) | Thread name (`Fix render pipeline`) |
| Ordering | By date (natural sort) | By `lastActive` in JSON |
| Creation | Auto: one per day, no duplicates | Manual: "New Chat" placeholder |
| Duplicate names | Impossible (dates unique) | Allowed (sessionId is the key) |
| New chat blocking | N/A | Can't create new until "New Chat" is renamed |
| Rename | Never | Background process or user |

### What's Identical

- JSON schema (`thread.json` = `chat.json` structurally)
- `history.json` format (structured exchanges with parts)
- How the server reads/writes them (one module, one format)
- How the client displays conversations (same message list, same segments)
- SESSION.md for agent harness config (model, CLI, endpoint)

### SESSION.md: Agent Harness Config

SESSION.md lives alongside (or above) the conversation folder. It tells the harness HOW to run the agent — orthogonal to the chat/threads display behavior.

```yaml
---
thread-model: multi-thread | daily-rolling
session-invalidation: memory-mtime | none
idle-timeout: 9m
system-context:
  - IDENTITY.md
  - MEMORY.md
max-sessions: 5
---
```

Folder name determines display. SESSION.md determines execution.

### Enrichment Pipeline (Future)

The conversation JSON is designed to grow. An enrichment bot runs on a cron schedule and appends metadata:

```json
{
  "sessionId": "...",
  "config": { ... },
  "systemContext": { ... },

  "enrichment": {
    "summary": "Debugging the render pipeline gap between orb and thinking block",
    "tags": ["render", "timing", "orb", "animation"],
    "entities": ["LiveSegmentRenderer", "orchestrator.ts", "timing.ts"],
    "embedding": [0.012, -0.034, ...],
    "enrichedAt": "2026-03-26T16:00:00Z"
  }
}
```

The enrichment agent is just another bot:

```
background-agents/System/enrichment-agent/
  ├── PROMPT_01.md         ← "Scan conversations, extract metadata"
  ├── TRIGGERS.md          ← cron: hourly, or on new chat/thread.json
  ├── SESSION.md           ← model config for enrichment API calls
  ├── scripts/
  │   └── enrich.js        ← API calls for embeddings, NER, tagging
  └── IDENTITY.md          ← "I enrich conversation metadata"
```

Uses the secrets manager for API keys. Uses the ticketing system for scheduling. Uses the block system for cron triggers. No custom pipeline code — just a bot with a script.

---

## The Zero-Code Backend Principle

The app is a runtime. It reads folders, loads configs, executes scripts. All individualized logic lives in the project tree.

```
CODE (the app):
  - Reads folder structures
  - Loads JSON configs
  - Applies CSS cascades
  - Renders content-types
  - Manages WebSocket connections
  - Runs the harness (PTY, CLI bridges)

PROJECT TREE (user/AI controlled):
  - Workspace definitions (folders + JSON)
  - Agent behavior (prompts, identity, triggers)
  - Styling (theme.css at every level)
  - Background processes (bot scripts + cron triggers)
  - API integrations (scripts + secrets manager)
  - Enrichment pipelines (bots with scripts)
  - Scheduling (ticketing system + block ticks)
```

What this means:
- **No backend code for new integrations** — write a script, give a bot access to it, schedule via cron
- **No backend code for new workspaces** — create folders, drop in content-types
- **No backend code for new agents** — write prompts and identity files
- **No backend code for new processes** — bot + script + trigger + secrets = any API, any schedule
- **The framework builds the backend** — bots use the same tools (secrets, tickets, crons, scripts) to create any process

The only thing that requires code changes: new content-type renderers (the React components that display a content-type). Everything else is folders and files.

---

## System / Project Split

### Principle

`ai/system/` is the framework — identical across every project. `ai/project/` is the instance — unique per project. System is the class, project is the object.

### Directory Structure

```
ai/
  system/                                ← SAME in every project (git submodule or shared)
    scripts/                             ← global Node.js commands
    workspace-settings/                  ← content-type definitions, icon-map, base theme
    wiki/                                ← system docs (setup wizard, cross-platform, architecture)
    secrets/                             ← encrypted credential blobs (via safeStorage)
    templates/
      workspaces/
        coding/                          ← config.json, theme.css, default SESSION.md
        capture/                         ← config.json, theme.css, folder scaffolding
        terminal/                        ← config.json, theme.css, ui/
        wiki/                            ← config.json, theme.css, wiki structure
        blank/                           ← minimal config.json + theme.css
      content-types/
        chat/                            ← default chat.json structure
        threads/                         ← default thread.json structure
        file-explorer/                   ← ui/ files for tree view
        ticket-board/                    ← ui/ files for ticket columns
        capture/                         ← ui/ files for tile rows
      agents/
        coding-agent/                    ← PROMPT_01.md, IDENTITY.md, SESSION.md
        triage-agent/                    ← routing-focused prompts
        enrichment-agent/                ← prompts + enrich.js script
        blank/                           ← minimal PROMPT_01.md + IDENTITY.md

  project/                               ← UNIQUE per project
    workspaces/                          ← instantiated workspaces (copies from templates)
    chat/ or threads/                    ← project-level conversation
    wiki/                                ← project-specific decisions and domain knowledge
    config.json                          ← project name, default model, etc.
```

### Template → Instance Flow

```
User: "Create a new workspace"
  → UI shows template picker (reads ai/system/templates/workspaces/)
  → User picks "capture" template
  → System copies template into ai/project/workspaces/{user-chosen-name}/
  → User customizes theme.css, drops in content-types, adds agents
  → Instance is fully independent — changes don't touch the template

User: "Add an agent to this workspace"
  → UI shows agent template picker (reads ai/system/templates/agents/)
  → User picks "triage-agent"
  → System copies template into ai/project/workspaces/{ws}/agent/
  → User edits PROMPT_01.md, IDENTITY.md to customize
  → Instance is independent

User: "Add a chat to this workspace"
  → UI shows content-type picker
  → User picks "chat" (daily rolling) or "threads" (multi-thread)
  → System copies template into ai/project/workspaces/{ws}/chat/ or threads/
  → First conversation auto-creates from template defaults
```

### What Lives Where

| Item | `ai/system/` | `ai/project/` |
|------|-------------|---------------|
| Scripts (enrich, sync, credential) | Yes — global commands | No |
| Content-type definitions (JSON) | Yes — shared definitions | No |
| Icon map | Yes — single source of truth | No |
| Base theme CSS | Yes — system defaults | No |
| Templates (workspace, agent, content) | Yes — the "library" | No |
| System wiki (setup, architecture, cross-platform) | Yes — framework docs | No |
| Workspace instances | No | Yes — instantiated from templates |
| Project wiki (domain decisions, specs) | No | Yes — project-specific |
| Conversations (chat.json, thread.json) | No | Yes — project-specific |
| Project config | No | Yes — project name, default model |

### Portability

- **New project:** Copy or symlink `ai/system/`, create empty `ai/project/`. All scripts, settings, templates, and system wiki are available immediately.
- **Framework update:** Pull new `ai/system/` (git submodule update). Existing project instances are untouched. New templates are available for future use.
- **Share a workspace:** Copy an `ai/project/workspaces/{name}/` folder to another project. It's self-contained — config, theme, conversations, agent files all travel together.
- **Share an agent:** Copy an agent folder. Prompts, identity, triggers, lessons, scripts — all portable.

### System Wiki vs Project Wiki

| | System Wiki (`ai/system/wiki/`) | Project Wiki (`ai/project/wiki/`) |
|---|---|---|
| Content | How the framework works | How this project works |
| Examples | Setup wizard, cross-platform guide, content-type docs | Render pipeline decisions, API design, domain knowledge |
| Updates with | Framework version | Project development |
| Shared across | All projects | One project |

---

## Git Model

### Two Repos, Clean Separation

```
system repo (framework)              project repo (your app)
  ├── scripts/                         ├── src/
  ├── templates/                       ├── server/
  ├── workspace-settings/              ├── ai/project/
  ├── wiki/                            │     ├── workspaces/
  └── secrets/                         │     ├── wiki/
                                       │     ├── chat/ or threads/
        ↓ git submodule               │     └── config.json
        linked at ai/system/           └── ai/system/ → submodule ref
```

### What Gets Ignored vs Pushed

```gitignore
# Project .gitignore
ai/system/              ← managed as submodule, has its own repo
```

`ai/project/` pushes with the project repo. Workspace configs, project wiki, conversation history, agent customizations — all version-controlled alongside the code.

| | Pushed with project | Managed separately |
|---|---|---|
| `ai/project/workspaces/` | Yes — workspace instances, themes, agents | |
| `ai/project/wiki/` | Yes — project decisions and domain knowledge | |
| `ai/project/config.json` | Yes — project identity | |
| `ai/project/chat/` or `threads/` | Yes — conversation history | |
| `ai/system/` | | Submodule → own repo, pinned version |

### Agent Context Clarity

The file structure eliminates ambiguity for agents:

- **"What project am I in?"** → read `ai/project/config.json`
- **"What are my system tools?"** → read `ai/system/scripts/`
- **"What templates are available?"** → read `ai/system/templates/`
- **"What are this project's decisions?"** → read `ai/project/wiki/`
- **"How does the framework work?"** → read `ai/system/wiki/`

No overlap. The tree IS the context boundary. Agents grepping for project knowledge stay in `ai/project/`. Agents checking system capabilities stay in `ai/system/`. Scoping is baked into the folder structure.

### Clone / Deploy Flow

```
Clone project:
  git clone project-repo
  git submodule update --init        ← pulls ai/system/ at pinned version
  → Full project context + framework ready immediately

Update framework:
  cd ai/system && git pull           ← new templates, scripts, system wiki
  → Triggers system update federation (see below)

Deploy to prod:
  git push                           ← project code + ai/project/ pushed together
  → Deployed instance has full workspace configs, wiki, agent configs
  → ai/system/ pinned to known stable version via submodule ref
```

---

## System Update Federation

When `ai/system/` is updated (submodule pull), a watcher bot detects the diff and generates a changelog ticket.

### Trigger

The existing file watcher system detects changes in `ai/system/`. A filter registered for system file changes fires the federation bot.

### Ticket Format

```
TICKET: System Update Available (v1.4.2 → v1.5.0)

Changes detected:
  modified:  templates/agents/coding-agent/PROMPT_01.md
  added:     templates/content-types/kanban/
  modified:  workspace-settings/icon-map.json (3 new icons)
  modified:  scripts/enrich.js (embedding model upgrade)

Affected instances in your project:
  - workspaces/coding-agent/agent/ ← uses coding-agent template (diverged 12 days ago)
  - workspaces/capture/ ← uses icon-map (current)

Actions:
  [ ] Review diff for templates/agents/coding-agent/PROMPT_01.md
  [ ] Accept new kanban content-type (no existing instances)
  [ ] Merge icon-map changes (additive, safe)
  [ ] Review enrich.js changes (breaking: new API param)
```

### Federation Rules

- **Nothing auto-applies.** All changes require user review.
- **Additive changes** (new templates, new icons) are flagged as safe — low friction to accept.
- **Modified templates** are compared against project instances to show divergence. User decides whether to merge, ignore, or manually cherry-pick changes.
- **Breaking changes** (script API changes, removed features) are flagged prominently.
- **Instances that haven't diverged** from the template can auto-merge (with user consent).
- **Instances that have been customized** show a diff between the old template, the new template, and the instance — three-way merge view.

### Bot Implementation

Just another background agent:

```
background-agents/System/federation-agent/
  ├── PROMPT_01.md         ← "Compare system updates against project instances"
  ├── TRIGGERS.md          ← watch: ai/system/ file changes
  ├── scripts/
  │   └── diff-templates.js ← compares template versions to instances
  └── IDENTITY.md          ← "I manage framework updates for this project"
```

Uses the ticketing system to create review tickets. Uses the existing watcher infrastructure for triggers. No new code — just a bot with a script and a trigger.

---

## Default Workspace Configuration

### Renames

- "Skills" → **"Settings"** (system configuration, not a workspace for browsing)
- "Agents" → **"Bots"** (clearer, friendlier, matches the card/tile paradigm)

### Core Workspaces (protected — cannot be deleted)

These are the minimum viable system. Deleting any of them degrades or breaks core functionality. The UI should resist deletion with an explanation of what breaks.

| Workspace | Purpose | Chat Type | Why Protected |
|-----------|---------|-----------|---------------|
| **Wiki** | System + project knowledge | Pop-up (system-wide AI) | Framework docs, project decisions, system wiki — removing it loses the knowledge layer |
| **Settings** | System configuration | None (config UI) | Workspace settings, content-type management, icon map, theme editor — removing it locks you out of configuration |
| **Code** (file viewer) | Browse and edit project files | Threads (workspace-scoped, multi-thread) | Primary development interface — removing it loses file access |
| **Bots** (formerly Agents) | Background agent management | Cards that expand (per-bot chat) | Agent monitoring, triggers, runs, lessons — removing it loses automation visibility |
| **Issues** | Ticket routing and tracking | Chat (workspace-scoped, daily rolling) | Ticketing drives the entire scheduling and federation system — removing it breaks cron triggers, update federation, and bot task assignment |

### Optional Workspaces (user can add/remove freely)

| Workspace | Purpose | Default Included |
|-----------|---------|-----------------|
| Capture | Tile rows for specs, todos, screenshots, playground | Yes |
| Terminal | Split-pane terminal sessions | Yes |
| Browser | Embedded web view (future) | No |
| Custom | Any user-created workspace from templates | No |

### Chat Paradigm Showcase

The core workspaces demonstrate all four chat display types out of the box:

```
DISPLAY TYPE          WORKSPACE       HOW IT WORKS
─────────────────────────────────────────────────────────
System-wide pop-up    Wiki            AI assistant floats over wiki content.
                                      Persists across workspace switches.
                                      "Ask about anything" agent.

Workspace threads     Code            Multi-thread sidebar. New Chat button.
                                      Thread list, auto-rename. Scoped to
                                      coding context. The primary dev chat.

Workspace chat        Issues          Daily rolling. One conversation per day.
                                      Scoped to ticket triage and routing.
                                      No thread list — just today's chat.

Bot cards             Bots            Each bot is a card/tile. Click to expand
                                      into full-screen chat with that bot.
                                      Each has its own SESSION.md, identity,
                                      and conversation history.
```

A new user sees all four paradigms working immediately. No setup required — the default config IS the tutorial.

### Protected Workspace Deletion Behavior

When a user attempts to delete a core workspace:

```
┌─────────────────────────────────────────────┐
│  Cannot delete "Wiki"                        │
│                                              │
│  This is a core workspace. Removing it       │
│  would break:                                │
│  • System documentation access               │
│  • Project decision history                  │
│  • System-wide AI assistant                  │
│                                              │
│  You can hide it from the sidebar instead.   │
│                                              │
│  [ Hide from sidebar ]    [ Cancel ]         │
└─────────────────────────────────────────────┘
```

Hiding uses Unix dot-prefix convention — rename the folder:

```
Hide:  mv workspaces/wiki  workspaces/.wiki
Show:  mv workspaces/.wiki workspaces/wiki
```

The workspace discovery engine already skips dot-prefixed entries (`entry.name.startsWith('.')`). A hidden workspace still exists on disk — bots can still read it, tickets still route to it, the wiki agent still functions. It just doesn't appear in the sidebar. No config files, no registry — the dot prefix IS the mechanism.

---

## Open Questions

1. **Hot reload** — should the engine watch for theme.css changes and live-update? Or require restart?
2. **Content-type inheritance** — can content-types extend other content-types? (e.g., `capture-readonly` extends `capture` but disables drag-drop)
3. **Agent folder naming** — should it always be `agent/` or can it be a custom name? Multiple agents per workspace?
4. **Tab persistence** — remember which tab was last active per workspace?
5. **Default workspace template** — when creating a new workspace, copy a template folder with default config.json + theme.css?
6. **OAuth browser integration** — for services that require OAuth flows, need a mechanism to open browser auth and store the resulting token via secrets manager
