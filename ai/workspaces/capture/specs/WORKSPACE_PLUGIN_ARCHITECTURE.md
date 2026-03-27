---
title: "Workspace Plugin Architecture — Runtime-Loaded Submodules"
status: draft
relates-to: workspace-loading-bug, shared-tile-row-abstraction, workspace-folder-config
---

# Workspace Plugin Architecture

## Problem

The workspace system is hard-coded in 16+ locations across the client. Adding a workspace requires editing 8 files. Three workspaces (Wiki, Issues, Agents) are broken due to a duplicated-but-flawed data loading pattern (`loadedRef`), while two others (Capture, Code Agent) work because they independently implemented a correct pattern. Meanwhile, dynamic discovery infrastructure (`lib/workspaces.ts`, server `__workspaces__` pseudo-workspace) is fully implemented but never called.

The system should be:
- **Type-driven** — each workspace folder declares its type in `workspace.json`, and the engine loads the matching submodule
- **Runtime-loaded** — UI modules (template, styles, behavior) live in the workspace folder and are loaded from disk at runtime via Electron, not compiled into the app
- **Hot-customizable** — users can edit workspace UI files after build; changes reflect without recompile
- **Zero-registration** — creating a new workspace folder with a `workspace.json` is sufficient; no client code changes

## Current State

### What exists

| Layer | Current | Status |
|-------|---------|--------|
| `workspaces.json` | Master registry with rank ordering (9 workspaces) | Exists, not read by client |
| `workspace.json` per folder | Rich metadata with `type`, `theme`, `icon`, `hasChat` | Exists, not read by client |
| `lib/workspaces.ts` | `discoverWorkspaces()`, `loadAllWorkspaces()`, `applyWorkspaceTheme()` | Implemented, never called |
| Server `__workspaces__` | Pseudo-workspace for folder discovery | Works |
| `WorkspaceId` union type | Hard-coded 7-item string literal union | Must update manually |
| `WORKSPACE_CONFIGS` | Hard-coded config map (name, color, icon, hasChat) | Must update manually |
| `ContentArea.tsx` | if/else routing to workspace components | Must update manually |
| `App.tsx` | if/else layout branching (full-width vs sidebar+chat) | Must update manually |
| `variables.css` | Hard-coded `.workspace-{id}` CSS classes | Must update manually |
| `workspaceStore.ts` | Hard-coded initial state for 7 workspaces | Must update manually |
| Data hooks | 3 broken copies (`useWikiData`, `useAgentData`, `useTicketData`) + 2 working ones (`useFileTree`, `TileRow`) | Duplicated, inconsistent |

### The `type` field today

Each `workspace.json` already declares a type:

| Type | Workspaces | What it renders |
|------|-----------|-----------------|
| `file-explorer` | capture, coding-agent | Folder tree / tile rows |
| `wiki-viewer` | wiki | Knowledge graph with topics |
| `ticket-board` | issues | Indexed ticket list |
| `agent-tiles` | background-agents | Agent lifecycle cards |
| `pipeline` | pre-flight, launch | Build/validation stages |
| `review` | review | Code review interface |
| `skill-manager` | skills | Command registry |

### The naming mismatch

| Filesystem ID | Client ID | Problem |
|--------------|-----------|---------|
| `background-agents` | `claw` | Different names for same workspace |
| `pre-flight` | — | Not in client at all |
| `launch` | `rocket` | Different names |
| `review` | — | Not in client at all |

**Resolution:** The filesystem ID (folder name) becomes the canonical ID. Client aliases are removed.

---

## Design

### 1. Workspace Folder Structure

Each workspace folder is self-contained:

```
ai/workspaces/{name}/
├── workspace.json              ← REQUIRED: config, type, theme, layout
├── index.json                  ← OPTIONAL: data index (for index-based types)
├── ui/                         ← OPTIONAL: runtime-loaded display module
│   ├── template.html           ← Content area markup
│   ├── styles.css              ← Scoped CSS (design tokens with fallbacks)
│   └── module.js               ← Vanilla JS lifecycle (mount/unmount/onData)
├── ... (workspace data files)
```

If `ui/` is absent, the engine falls back to a **built-in submodule** matched by `workspace.json.type`. This means:
- Shipped workspaces can use built-in submodules (compiled, optimized)
- Custom workspaces can provide their own `ui/` folder (runtime-loaded, editable)
- Any workspace can override a built-in submodule by adding a `ui/` folder

### 2. Workspace Types Collapse to Submodules

Looking at what the types actually do under the hood, they reduce to fewer patterns:

| Submodule | Handles types | Data pattern | Built-in |
|-----------|--------------|--------------|----------|
| `index-viewer` | `wiki-viewer`, `ticket-board`, `agent-tiles`, `skill-manager` | Load `index.json` → parse → render items | Yes |
| `folder-browser` | `file-explorer` | Load file tree → render tiles/tree | Yes |
| `pipeline-runner` | `pipeline`, `review` | Config-driven stages | Yes |
| `custom` | `custom` | User-defined (requires `ui/` folder) | No |

The `index-viewer` submodule is the critical one — it replaces the three broken hooks with one correct implementation.

### 3. Extended `workspace.json` Schema

```jsonc
{
  // === REQUIRED (existing) ===
  "id": "wiki",
  "name": "Wiki",
  "type": "wiki-viewer",
  "icon": "full_coverage",
  "hasChat": true,
  "theme": {
    "primary": "#ec4899",
    "sidebar_bg": "#12101a",
    "content_bg": "#0d0d0d",
    "panel_border": "#ec489933"
  },

  // === NEW FIELDS ===
  "layout": "full",              // "full" | "chat-content" | "sidebar-chat-content"
                                 // Replaces hard-coded if/else in App.tsx
                                 // Default: "sidebar-chat-content" if hasChat, "full" otherwise

  "submodule": "index-viewer",   // OPTIONAL: explicit submodule override
                                 // If omitted, derived from type → submodule mapping
                                 // If "custom", requires ui/ folder

  "dataSource": {                // OPTIONAL: how this workspace loads its data
    "indexPath": "index.json",   // File to load on mount (default: "index.json")
    "itemPath": "{id}/PAGE.md",  // Template for loading item detail
    "parseAs": "json"            // "json" | "markdown" | "text"
  },

  // === EXISTING OPTIONAL ===
  "description": "...",
  "settings": {},
  "folders": {},
  "threadDefaults": {},
  "wikiExempt": false,
  "createdAt": "ISO-8601"
}
```

**Layout values:**

| Value | Renders | Used by |
|-------|---------|---------|
| `full` | ContentArea only | wiki, agents, custom dashboards |
| `chat-content` | ChatArea + ContentArea | issues |
| `sidebar-chat-content` | Sidebar + ChatArea + ContentArea | coding-agent, capture, skills |

### 4. Engine Architecture (Electron)

The compiled app is the **engine**. It provides infrastructure; workspaces provide display.

```
┌─────────────────────────────────────────────────────┐
│ ELECTRON MAIN PROCESS                               │
│                                                     │
│  WorkspaceDiscovery                                 │
│  ├─ Scans ai/workspaces/ on startup                │
│  ├─ Reads each workspace.json                       │
│  ├─ Builds workspace registry                       │
│  ├─ Watches ui/ folders for changes (fs.watch)     │
│  └─ Sends workspace-registry-updated IPC           │
│                                                     │
│  FileServer (existing, via IPC instead of WS)      │
│  ├─ file_tree_request → readdir                     │
│  ├─ file_content_request → readFile                │
│  └─ file_write_request → writeFile                 │
│                                                     │
│  WireManager (existing, Claude API)                 │
│  └─ Per-workspace Claude sessions                   │
│                                                     │
└─────────────────────────────────────────────────────┘
          ↕ IPC
┌─────────────────────────────────────────────────────┐
│ ELECTRON RENDERER (Compiled Shell)                  │
│                                                     │
│  TabBar                                             │
│  ├─ Reads workspace registry (from discovery)      │
│  ├─ Renders buttons dynamically (no hard-coding)   │
│  └─ Applies theme from workspace.json.theme        │
│                                                     │
│  LayoutManager                                      │
│  ├─ Reads workspace.layout field                    │
│  ├─ Renders: full | chat-content | sidebar-chat-   │
│  │   content                                        │
│  └─ No if/else chains — driven by config           │
│                                                     │
│  ContentArea                                        │
│  ├─ Looks up submodule by workspace.type           │
│  ├─ Built-in submodules: index-viewer, folder-     │
│  │   browser, pipeline-runner                       │
│  ├─ If ui/ folder exists: loads runtime module     │
│  │   instead                                        │
│  └─ Provides ctx object to submodule               │
│                                                     │
│  ChatArea (existing, shared)                        │
│  Sidebar (existing, shared)                         │
│  EventBus (existing)                                │
│  State (existing workspaceStore, refactored)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5. Runtime Module Contract

Each workspace's `ui/module.js` exports a lifecycle interface:

```js
/**
 * Called when workspace becomes active.
 * @param {HTMLElement} el — The content area container (empty div)
 * @param {WorkspaceContext} ctx — Engine-provided API
 */
export function mount(el, ctx) { }

/**
 * Called when workspace is deactivated or module is reloaded.
 * Must clean up all DOM, listeners, and timers.
 * @param {HTMLElement} el
 * @param {WorkspaceContext} ctx
 */
export function unmount(el, ctx) { }

/**
 * OPTIONAL: Called when data arrives for this workspace.
 * If not defined, the engine's built-in data handler runs.
 * @param {HTMLElement} el
 * @param {WorkspaceContext} ctx
 * @param {object} msg — The incoming message (file_content_response, etc.)
 */
export function onData(el, ctx, msg) { }
```

### 6. WorkspaceContext API

The `ctx` object is the workspace's only interface to the engine:

```typescript
interface WorkspaceContext {
  // === Identity ===
  workspace: string;                    // Workspace ID (folder name)
  config: WorkspaceConfig;              // Parsed workspace.json

  // === Communication ===
  emit(type: string, data?: object): void;       // Send event to bus/server
  on(type: string, handler: Function): void;      // Listen (auto-cleanup on unmount)
  off(type: string, handler: Function): void;     // Manual unlisten

  // === Data (sugar over emit/on) ===
  request(path: string): Promise<{content: string, size: number}>;
                                        // Request file from this workspace
  requestTree(path?: string): Promise<FileNode[]>;
                                        // Request directory listing

  // === State ===
  state: {
    get(key: string): any;              // Read workspace-scoped state
    set(key: string, value: any): void; // Write workspace-scoped state
    subscribe(key: string, fn: (val: any) => void): () => void;
                                        // Watch for changes, returns unsubscribe
  };

  // === Theme ===
  theme: WorkspaceTheme;                // From workspace.json.theme
  tokens: Record<string, string>;       // Resolved CSS custom properties

  // === DOM Helpers ===
  injectStyles(css: string, id?: string): void;   // Inject scoped <style> tag (deduped by id)
  loadTemplate(html: string): DocumentFragment;    // Parse HTML string to fragment
}
```

### 7. Built-in Submodules

These are compiled into the engine and handle the common workspace patterns:

#### `index-viewer` — Replaces useWikiData, useAgentData, useTicketData

One correct implementation that all index-based workspaces share:

```
Mount:
  1. ctx.request(config.dataSource.indexPath || 'index.json')
  2. Parse response as JSON
  3. Render item list using template (or built-in default)
  4. On item click → ctx.request(itemPath) → render detail

Reconnect handling:
  Uses object identity check (lastWs !== currentWs), NOT boolean loadedRef.
  This is the pattern that works in useFileTree today.

Per-workspace customization via workspace.json:
  - dataSource.indexPath — what file to load
  - dataSource.itemPath — template for detail paths (e.g., "{id}/PAGE.md")
  - dataSource.parseAs — how to parse content
  - folders — which sections to display
  - Any workspace-specific fields
```

#### `folder-browser` — Replaces useFileTree + TileRow

```
Mount:
  1. ctx.requestTree('') → get root directory listing
  2. Render folder/file tree or tile grid
  3. On folder expand → ctx.requestTree(path)
  4. On file click → ctx.request(path) → render content

Per-workspace customization via workspace.json:
  - folders — which folders to display and their labels
  - settings — view preferences (tree vs tiles, etc.)
```

#### `pipeline-runner` — For build/validation workspaces

```
Mount:
  1. Read pipeline stages from workspace.json.settings
  2. Render stage cards
  3. On stage run → ctx.emit('pipeline:run', {stage})
  4. Listen for results → update stage status
```

### 8. Data Loading — The Unified Hook

The `loadedRef` bug is fixed by construction. The engine provides ONE data loading mechanism:

```
                     workspace.json
                         │
                    ┌────▼────┐
                    │ Engine   │
                    │ reads    │
                    │ type +   │
                    │ dataSource│
                    └────┬────┘
                         │
              ┌──────────▼──────────┐
              │  useWorkspaceData   │
              │  (single hook)      │
              │                     │
              │  - Takes workspaceId│
              │  - Object identity  │
              │    guard (not bool) │
              │  - Auto-reloads on  │
              │    WS reconnect     │
              │  - Provides ctx to  │
              │    submodule        │
              └─────────────────────┘
```

The hook:
1. Gets `ws` from store
2. Compares `ws === lastWsRef.current` (object identity — the working pattern)
3. If new `ws`: requests `dataSource.indexPath`, sets up listener
4. Passes data to submodule via `ctx.state`
5. Cleans up listener on unmount or workspace switch

### 9. Theme Application

Themes are applied dynamically from `workspace.json.theme` — no static CSS classes:

```
On workspace switch:
  1. Read workspace.config.theme
  2. Set CSS custom properties on content container:
     --theme-primary: {theme.primary}
     --ws-sidebar-bg: {theme.sidebar_bg}
     --ws-content-bg: {theme.content_bg}
     --ws-panel-border: {theme.panel_border}
  3. Submodule CSS uses these with fallback defaults:
     background: var(--ws-content-bg, #0d0d0d);
```

No `.workspace-wiki`, `.workspace-claw` CSS classes needed.

### 10. Hot Reload (Electron)

```
Main Process:
  fs.watch('ai/workspaces/{id}/ui/', { recursive: true })
    → on change: read updated file
    → send IPC: { type: 'workspace-ui-changed', workspace: id, file: name }

Renderer:
  on 'workspace-ui-changed':
    → if file is styles.css: re-inject <style> tag
    → if file is template.html: re-render content area
    → if file is module.js: call unmount() → re-import → call mount()
    → if workspace is not active: mark dirty, reload on next switch
```

### 11. CSS Scoping Strategy

Workspace styles are scoped by attribute selector:

```html
<div id="workspace-content" data-workspace="wiki">
  <style>
    [data-workspace="wiki"] .ws-topic-list { ... }
    [data-workspace="wiki"] .ws-topic-item { ... }
  </style>
  <!-- template.html contents -->
</div>
```

Rules:
- All workspace CSS classes use `ws-` prefix (replacing `rv-` for workspace-local styles)
- All values use CSS variables with fallback: `var(--token, fallback)`
- The engine wraps injected styles with the `[data-workspace="id"]` selector automatically
- Built-in submodule styles follow the same pattern

### 12. Server-Side Changes

Minimal. The server already supports everything needed:

| Change | Description |
|--------|-------------|
| Add `await` to handler calls | `handleFileContentRequest` and `handleFileTreeRequest` are async but not awaited (lines 966, 971) — errors become unhandled rejections |
| Add outgoing message logging | Currently only incoming `[WS →]` logged; no way to verify responses are sent |
| Extract enrichment to provider | Move `background-agents/index.json` enrichment (lines 351-364) to a workspace provider pattern so enrichment is extensible |

The `getWorkspacePath`, `__workspaces__` discovery, and file serving all work as-is.

### 13. Migration Path for Existing Workspaces

Existing workspaces continue to work via built-in submodules. No immediate `ui/` folder needed:

| Workspace | Current Component | Becomes | Migration |
|-----------|------------------|---------|-----------|
| capture | `CaptureTiles` → `TileRow` | Built-in `folder-browser` | Extract TileRow rendering to submodule |
| coding-agent | `FileExplorer` | Built-in `folder-browser` (tree mode) | Extract FileExplorer to submodule |
| wiki | `WikiExplorer` | Built-in `index-viewer` | Replace broken hook, extract rendering |
| issues | `TicketBoard` | Built-in `index-viewer` | Replace broken hook, extract rendering |
| background-agents | `AgentTiles` | Built-in `index-viewer` | Replace broken hook, extract rendering |
| skills | — (placeholder) | Built-in `index-viewer` | New, uses generic submodule |
| pre-flight | — (placeholder) | Built-in `pipeline-runner` | New |
| launch | — (placeholder) | Built-in `pipeline-runner` | New |
| review | — (placeholder) | Built-in `pipeline-runner` | New |

Later, any workspace can add a `ui/` folder to override the built-in submodule with custom rendering.

---

## Scope

### New Files

| File | Purpose |
|------|---------|
| `kimi-ide-client/src/engine/workspace-loader.ts` | Discovers workspaces, builds registry, manages lifecycle |
| `kimi-ide-client/src/engine/workspace-context.ts` | Creates `WorkspaceContext` (ctx) for each workspace |
| `kimi-ide-client/src/engine/runtime-module.ts` | Loads `ui/module.js` from disk, manages mount/unmount |
| `kimi-ide-client/src/engine/submodules/index-viewer.ts` | Built-in index-based workspace submodule |
| `kimi-ide-client/src/engine/submodules/folder-browser.ts` | Built-in folder/tree workspace submodule |
| `kimi-ide-client/src/engine/submodules/pipeline-runner.ts` | Built-in pipeline workspace submodule |
| `kimi-ide-client/src/engine/submodule-registry.ts` | Maps type strings → built-in submodule |
| `kimi-ide-client/src/hooks/useWorkspaceData.ts` | Single generic data loading hook (replaces 3 broken hooks) |

### Modified Files

| File | Change |
|------|--------|
| `kimi-ide-client/src/types/index.ts` | Remove `WorkspaceId` union + `WORKSPACE_CONFIGS`. Replace with dynamic types |
| `kimi-ide-client/src/state/workspaceStore.ts` | Remove hard-coded workspace init. Dynamic workspace state from registry |
| `kimi-ide-client/src/components/ContentArea.tsx` | Replace if/else with submodule registry lookup |
| `kimi-ide-client/src/components/App.tsx` | Replace layout if/else with `workspace.layout` field |
| `kimi-ide-client/src/components/ToolsPanel.tsx` | Read from workspace registry instead of `WORKSPACE_CONFIGS` |
| `kimi-ide-client/src/styles/variables.css` | Remove hard-coded `.workspace-{id}` classes |
| `kimi-ide-client/src/components/App.css` | Remove hard-coded workspace layout overrides |
| `kimi-ide-server/server.js` | Add `await` to handlers (lines 966, 971). Add outgoing logging |
| `ai/workspaces/*/workspace.json` | Add `layout` field to each |

### Removed Files

| File | Reason |
|------|--------|
| `kimi-ide-client/src/hooks/useWikiData.ts` | Replaced by `useWorkspaceData` |
| `kimi-ide-client/src/hooks/useAgentData.ts` | Replaced by `useWorkspaceData` |
| `kimi-ide-client/src/hooks/useTicketData.ts` | Replaced by `useWorkspaceData` |
| `kimi-ide-client/src/state/wikiStore.ts` | Merged into dynamic workspace state |
| `kimi-ide-client/src/state/agentStore.ts` | Merged into dynamic workspace state |
| `kimi-ide-client/src/state/ticketStore.ts` | Merged into dynamic workspace state |

---

## Verification

### Bug Fix Verified

- [ ] Wiki workspace loads topics on first visit
- [ ] Issues workspace loads tickets on first visit
- [ ] Agents workspace loads agent list on first visit
- [ ] After WebSocket disconnect/reconnect, all workspaces reload their data
- [ ] No `loadedRef` pattern exists anywhere in the codebase

### Dynamic Registration Verified

- [ ] Creating a new folder in `ai/workspaces/` with a `workspace.json` causes it to appear in the tab bar without code changes
- [ ] Removing a workspace folder causes it to disappear from the tab bar
- [ ] The `WorkspaceId` union type no longer exists (or is dynamically generated)
- [ ] `WORKSPACE_CONFIGS` no longer exists
- [ ] No if/else chains in ContentArea or App.tsx reference specific workspace IDs

### Runtime Module Verified

- [ ] A workspace with a `ui/` folder loads its custom template, styles, and module
- [ ] A workspace without a `ui/` folder falls back to the built-in submodule for its type
- [ ] Editing `ui/styles.css` while the workspace is active updates the display (hot reload)
- [ ] Editing `ui/template.html` while the workspace is active updates the display
- [ ] Editing `ui/module.js` calls unmount, reloads, calls mount
- [ ] The `ctx` object provides all documented methods (emit, on, request, state, theme)

### Layout Verified

- [ ] Workspace with `"layout": "full"` renders only ContentArea
- [ ] Workspace with `"layout": "chat-content"` renders ChatArea + ContentArea
- [ ] Workspace with `"layout": "sidebar-chat-content"` renders all three panels
- [ ] Changing the `layout` field in workspace.json and reloading changes the layout

### Theme Verified

- [ ] Each workspace applies its theme colors from workspace.json.theme
- [ ] No static `.workspace-{id}` CSS classes exist
- [ ] Workspace CSS uses `var(--token, fallback)` pattern throughout

### Backward Compatibility

- [ ] All existing workspaces (capture, coding-agent, wiki, issues, background-agents) render correctly
- [ ] Chat functionality works in all workspaces with `hasChat: true`
- [ ] Existing workspace data (index.json files, markdown content) loads without changes

---

## Phases

### Phase 0: Bug Fix (immediate)
Replace `loadedRef` with object identity check in the three broken hooks. This is a 10-line fix per file that unblocks users now, independent of the larger refactor.

### Phase 1: Generic Data Hook + Submodule Registry
Build `useWorkspaceData`, the built-in submodules (`index-viewer`, `folder-browser`), and the submodule registry. Wire `ContentArea` to use the registry. Remove the three broken hooks and their silo stores.

### Phase 2: Dynamic Discovery + Layout
Call `loadAllWorkspaces()` on startup. Remove `WorkspaceId` union, `WORKSPACE_CONFIGS`, hard-coded store init. Drive layout from `workspace.json.layout`. Remove hard-coded CSS classes.

### Phase 3: Runtime Module Loading (Electron)
Build the runtime module loader. Implement the `WorkspaceContext` API. Add `ui/` folder support with mount/unmount lifecycle. Add hot reload via `fs.watch`.

### Phase 4: Migration + Cleanup
Move existing workspace rendering into either built-in submodules or `ui/` folders. Delete dead code. Update all `workspace.json` files with new fields. Resolve naming mismatches (claw → background-agents, rocket → launch).
