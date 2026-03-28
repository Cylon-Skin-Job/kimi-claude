---
title: "Phase 3: Runtime Module Loading for Workspace Plugins"
type: todo
priority: medium
status: open
created: 2026-03-25
relates-to: WORKSPACE_PLUGIN_ARCHITECTURE
---

# Phase 3: Runtime Module Loading

## Context

Phases 0-2 are complete (2026-03-25):
- Bug fixed: `loadedRef` replaced with object identity check in all hooks
- Generic `useWorkspaceData` hook replaces three broken duplicates
- Dynamic workspace discovery wired up (`loadAllWorkspaces()` on connect)
- Layout and theme driven by `workspace.json` — no hard-coded configs
- Submodule registry created (`engine/submodule-registry.ts`)

## What Phase 3 Delivers

Each workspace folder can include a `ui/` subfolder with custom display:

```
ai/workspaces/{name}/
├── workspace.json
├── ui/
│   ├── template.html     ← content area markup
│   ├── styles.css         ← scoped CSS with design tokens
│   └── module.js          ← vanilla JS lifecycle
```

If `ui/` exists, the engine loads it at runtime instead of the built-in submodule. Users can create or edit these files after build — no recompile needed.

## Tasks

### Can build now (no Electron needed)

- [ ] Build `WorkspaceContext` (`engine/workspace-context.ts`)
  - `ctx.emit(type, data)` — send event to bus/server
  - `ctx.on(type, handler)` — listen with auto-cleanup on unmount
  - `ctx.request(path)` — sugar for `file_content_request`
  - `ctx.state.get/set/subscribe` — workspace-scoped state
  - `ctx.theme` — from workspace.json
  - `ctx.injectStyles(css, id)` — scoped style injection

- [ ] Build runtime module loader (`engine/runtime-module.ts`)
  - Fetch `ui/module.js` via existing `fetchWorkspaceFile()`
  - Load as Blob URL + dynamic `import()`
  - Call `module.mount(el, ctx)` on activation
  - Call `module.unmount(el, ctx)` on deactivation or reload

- [ ] Build template/styles loader
  - Fetch `ui/template.html` via `fetchWorkspaceFile()`
  - Inject into content area container
  - Fetch `ui/styles.css`, wrap with `[data-workspace="id"]` scope, inject `<style>` tag

- [ ] Create `RuntimeModule` React component
  - Renders container div with `data-workspace` attribute
  - On mount: loads template, styles, module.js → calls `mount()`
  - On unmount: calls `unmount()`, cleans up styles
  - On workspace switch: unmount old, mount new

- [ ] Update `ContentArea.tsx`
  - Before checking built-in submodule registry, check if workspace has `ui/` folder
  - If yes: render `RuntimeModule` instead
  - Discovery: add `hasUiFolder` flag to `WorkspaceConfig` (check for `ui/module.js` during discovery)

- [ ] Create example `ui/` folder for testing
  - Pick a simple workspace (e.g., `skills` which is currently a placeholder)
  - Create `ui/template.html`, `ui/styles.css`, `ui/module.js`
  - Verify it loads and renders via the runtime loader

### Needs Electron (do later)

- [ ] Hot reload via `fs.watch`
  - Main process watches `ai/workspaces/*/ui/` directories
  - On file change: send IPC `workspace-ui-changed` to renderer
  - Renderer: re-inject styles, re-render template, or unmount+remount module
  - Debounce 300ms to avoid rapid-fire reloads

- [ ] Direct `fs` reads (performance optimization)
  - Replace WebSocket file fetching with `fs.readFileSync` in Electron main process
  - IPC bridge for renderer to request files
  - Faster module loading, no serialization overhead

### Phase 4: Migration + Cleanup (after Phase 3)

- [ ] Delete old hook files (`useWikiData.ts`, `useAgentData.ts`, `useTicketData.ts`)
  - `loadLog` in `useWikiData.ts` is still imported by `PageViewer.tsx` — migrate first
- [ ] Resolve naming: `claw` → `background-agents`, `rocket` → `launch` everywhere
- [ ] Consider merging silo stores (`wikiStore`, `ticketStore`, `agentStore`) into generic workspace state
- [ ] Move existing workspace components into `ui/` folders (optional — built-in submodules work fine)

## Module Contract

```js
// ai/workspaces/{name}/ui/module.js
export function mount(el, ctx) {
  // el = empty container div
  // ctx = WorkspaceContext API
}

export function unmount(el, ctx) {
  // cleanup DOM, listeners, timers
}

export function onData(el, ctx, msg) {
  // optional: handle incoming data
}
```

## Key Files

| File | Role |
|------|------|
| `engine/submodule-registry.ts` | Maps type → built-in component (exists) |
| `engine/workspace-context.ts` | Creates ctx object (to build) |
| `engine/runtime-module.ts` | Loads ui/module.js at runtime (to build) |
| `lib/workspaces.ts` | Discovery + config loading (exists, may need `hasUiFolder`) |
| `hooks/useWorkspaceData.ts` | Generic data hook (exists) |
| `components/ContentArea.tsx` | Routing — needs runtime module check |

## Spec

Full architecture spec: `ai/workspaces/capture/specs/WORKSPACE_PLUGIN_ARCHITECTURE.md`
