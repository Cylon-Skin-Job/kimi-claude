# Panel Rename Spec

> "Workspace" → "Panel". One rename, everywhere, done right.

---

## Why

"Workspace" collides with VS Code's meaning (the project folder you opened). Every AI model trained on VS Code docs, Stack Overflow, and millions of repos associates "workspace" with "project." In our system, a workspace is a tabbed panel within the app — a completely different concept. This causes confusion in agent instructions and will only get worse as more AI models interact with the system.

**New terminology:**
- **Panel** — a functional tab within the app (wiki, issues, agents, explorer, capture, terminal, skills)
- **Project** — the repo/folder the app is pointed at (unchanged)

---

## Scope of Changes

### Folder Renames

| Old Path | New Path |
|----------|----------|
| `ai/workspaces/` | `ai/panels/` |
| `ai/workspaces/coding-agent/` | `ai/panels/explorer/` |
| `ai/workspaces/background-agents/` | `ai/panels/agents/` |
| `ai/workspaces/capture/` | `ai/panels/capture/` |
| `ai/workspaces/issues/` | `ai/panels/issues/` |
| `ai/workspaces/wiki/` | `ai/panels/wiki/` |
| `ai/workspaces/terminal/` | `ai/panels/terminal/` |
| `ai/workspaces/skills/` | `ai/panels/skills/` |

Also rename within the agents folder:
| Old Path | New Path |
|----------|----------|
| `ai/panels/agents/System/wiki-manager/` | (unchanged internally) |

### File Content Updates

#### Server (`kimi-ide-server/`)

| File | Changes |
|------|---------|
| `server.js` | `AI_WORKSPACES_PATH` → `AI_PANELS_PATH`. `getWorkspacePath()` → `getPanelPath()`. All string references to "workspaces" in path construction. The `__workspaces__` pseudo-panel → `__panels__`. All `workspace` keys in WebSocket messages stay as-is for now OR rename to `panel` (see Protocol section below). |
| `lib/wiki/hooks.js` | No changes needed (already points to `ai/wiki/`) |
| `lib/tickets/dispatch.js` | Path references from `ai/workspaces/` → `ai/panels/` |
| `lib/sync/pull.js` | Path references |
| `lib/watcher/actions.js` | Path references |
| `lib/watcher/filter-loader.js` | Path references |
| `lib/triggers/hold-registry.js` | Path references |
| `config.js` | If it stores workspace paths |

#### Client (`kimi-ide-client/src/`)

| File | Changes |
|------|---------|
| `lib/workspaces.ts` | Rename to `lib/panels.ts`. `WorkspaceConfig` → `PanelConfig`. `WorkspaceTheme` → `PanelTheme`. `WorkspaceLayout` → `PanelLayout`. `loadWorkspaceConfig` → `loadPanelConfig`. `loadAllWorkspaces` → `loadAllPanels`. `discoverWorkspaces` → `discoverPanels`. `applyWorkspaceTheme` → `applyPanelTheme`. `__workspaces__` → `__panels__`. |
| `state/workspaceStore.ts` | Rename to `state/panelStore.ts`. `useWorkspaceStore` → `usePanelStore`. All state fields rename accordingly. |
| `hooks/useWorkspaceData.ts` | Rename to `hooks/usePanelData.ts`. `useWorkspaceData` → `usePanelData`. Interface `UseWorkspaceDataOptions` → `UsePanelDataOptions`. |
| `engine/workspace-context.ts` | Rename to `engine/panel-context.ts`. All types and functions rename. |
| `engine/submodule-registry.ts` | Update references. |
| `components/wiki/WikiExplorer.tsx` | `workspace: 'wiki'` stays in the data request (or changes to `panel: 'wiki'` — see Protocol). Import updates. |
| `components/wiki/PageViewer.tsx` | Import updates, `workspace: 'wiki'` in WS messages. |
| `components/wiki/TopicList.tsx` | Import updates. |
| `components/agents/AgentTiles.tsx` | Import updates, `workspace` → `panel` in data requests. |
| `components/tickets/TicketBoard.tsx` | Import updates. |
| `components/FloatingChat.tsx` | `workspace` prop → `panel` prop. |
| `components/App.tsx` | Import updates. |
| `components/App.css` | Class names: `.workspace-*` → `.panel-*` if any. Comment updates. |
| `state/wikiStore.ts` | Comment updates only (no workspace references in logic). |
| `state/agentStore.ts` | Comment updates. |
| `state/ticketStore.ts` | Comment updates. |

#### AI Folder (`ai/`)

| File | Changes |
|------|---------|
| `ai/panels/index.json` | `id: "panels"` (was "workspaces") |
| `ai/panels/*/index.json` | Update any self-referential paths |
| `ai/panels/explorer/index.json` | `id: "explorer"`, `label: "Explorer"` (was coding-agent/Code) |
| `ai/panels/agents/index.json` | `id: "agents"`, `label: "Agents"` (was background-agents/Agents) |
| `ai/panels/wiki/PROMPT.md` | Path references |
| `ai/panels/wiki/TOOLS.md` | Path references |
| `ai/panels/wiki/WORKFLOW.md` | Path references |
| `ai/panels/agents/System/wiki-manager/IDENTITY.md` | Path references |
| `ai/panels/agents/System/wiki-manager/TRIGGERS.md` | Path references |
| `ai/panels/agents/System/wiki-manager/workflows/*/PROMPT.md` | Path references |
| `ai/panels/agents/registry.json` | Folder paths (`System/wiki-manager` unchanged, but verify) |
| `ai/panels/issues/scripts/create-ticket.js` | Path references |
| `ai/panels/issues/scripts/sync-tickets.js` | Path references if any |

#### System Wiki Pages (`ai/wiki/system/`)

Every system wiki page references "workspace" extensively. Each needs a pass:

| Page | Scope |
|------|-------|
| `system-overview/PAGE.md` | "Workspaces" section → "Panels", all path references |
| `agent-folder-structure/PAGE.md` | `ai/workspaces/background-agents/` → `ai/panels/agents/`, workspace-level agent files section |
| `workflow-design/PAGE.md` | Write scope paths |
| `validation-subagent/PAGE.md` | Minor references |
| `evidence-gated-execution/PAGE.md` | Minor references |
| `universal-index/PAGE.md` | Types table, examples, migration status |
| `setup/PAGE.md` | Template paths, workspace table → panel table |
| `template-fallback/PAGE.md` | All path examples |

#### Specs (`ai/panels/capture/specs/`)

These reference "workspace" heavily but are historical documents. Update only the actively-referenced ones:

| Spec | Update? |
|------|---------|
| `WORKSPACE-AGENT-SPEC.md` | Rename to `PANEL-AGENT-SPEC.md`, update content |
| `TICKETING-SPEC.md` | Update paths |
| `RUN-FOLDER-SPEC.md` | Update paths |
| Others | Leave as-is (historical) |

---

## WebSocket Protocol Decision

The WebSocket messages currently use `workspace` as a field name:

```json
{"type": "file_content_request", "workspace": "wiki", "path": "topics.json"}
```

**Option A: Rename to `panel`**
```json
{"type": "file_content_request", "panel": "wiki", "path": "topics.json"}
```
Clean, consistent. But every message handler on both server and client needs updating.

**Option B: Keep `workspace` in the protocol, rename everywhere else**
Less churn. The wire protocol is an internal API — the word doesn't leak to users or agents. But it's a lie in the code.

**Recommendation: Option A.** We're doing a foundation-level refactor. Do it once, do it right. The protocol field should match the terminology.

---

## Template Path Updates

```
ai/templates/
├── panels/                       (was workspaces/)
│   ├── index.json
│   ├── explorer/                 (was coding-agent/)
│   ├── capture/
│   ├── issues/
│   ├── terminal/
│   ├── wiki/
│   ├── agents/                   (was background-agents/)
│   └── skills/
└── wiki/
    └── (unchanged)
```

[Templates folder doesn't exist yet — this is the target structure when it's created]

---

## Execution Order

This rename touches every layer. Recommended order to minimize broken state:

### Phase 1: Folder moves (ai/)
1. `mv ai/workspaces ai/panels`
2. `mv ai/panels/coding-agent ai/panels/explorer`
3. `mv ai/panels/background-agents ai/panels/agents`
4. Update all `index.json` files (IDs, labels, paths)
5. Update all agent files (IDENTITY.md, TRIGGERS.md, workflow PROMPT.md files)
6. Update wiki agent files (PROMPT.md, TOOLS.md, WORKFLOW.md)
7. Verify: `ls ai/panels/` shows the expected folders

### Phase 2: Server code
1. Rename `AI_WORKSPACES_PATH` → `AI_PANELS_PATH`
2. Rename `getWorkspacePath()` → `getPanelPath()`
3. Update `__workspaces__` pseudo-panel → `__panels__`
4. Update all path construction from `'workspaces'` → `'panels'`
5. Update WebSocket message handling: `msg.workspace` → `msg.panel`
6. Update all lib/ files with path references
7. Verify: server starts, no crashes

### Phase 3: Client code
1. Rename files: `workspaceStore.ts` → `panelStore.ts`, etc.
2. Rename all exports, hooks, types, interfaces
3. Update all imports across components
4. Update WebSocket message construction: `workspace:` → `panel:`
5. Update CSS class names if any use `workspace-`
6. Verify: `npm run build` passes with no TS errors

### Phase 4: System wiki pages
1. Find-and-replace across all 8 system wiki pages
2. Update LOG.md entries
3. Verify: no stale "workspace" references remain

### Phase 5: Verify
1. Server starts cleanly
2. Client builds cleanly
3. All panels load in the browser
4. Wiki displays with collection headers
5. File explorer works
6. Agent tiles load
7. Ticket board loads

---

## Search Patterns for Verification

After the rename, grep for orphaned references:

```bash
# Should return zero results in code (comments OK):
grep -r "workspaces\/" ai/panels/ --include="*.json" --include="*.md"
grep -r "workspace" kimi-ide-server/ --include="*.js" -l
grep -r "workspace" kimi-ide-client/src/ --include="*.ts" --include="*.tsx" -l
grep -r "AI_WORKSPACES" kimi-ide-server/
grep -r "getWorkspacePath" kimi-ide-server/
grep -r "useWorkspaceStore" kimi-ide-client/src/
grep -r "coding-agent" ai/ kimi-ide-server/ kimi-ide-client/src/
grep -r "background-agents" ai/panels/ kimi-ide-server/ kimi-ide-client/src/
```

---

## What Does NOT Change

- `ai/wiki/` — the wiki tree is not a panel, it's the knowledge graph. No rename.
- `ai/STATE.md` — unchanged.
- `ai/scripts/` — unchanged.
- Git history — we don't rewrite history. Old commits reference "workspaces" and that's fine.
- External GitLab issues — they reference old paths. They'll be stale. That's OK.
- The word "workspace" in comments explaining the rename — that's context, not a reference.
