# Capability Services

> Views are layout. Capabilities are function. Any view can use any capability.

---

## The Problem

The server has hardcoded panel IDs. `getPanelPath()` has special cases for `explorer` (resolves to project root), `wiki-viewer` (resolves to `ai/wiki-data/`), and `__panels__` (discovery). Every new view that needs file browsing or wiki rendering requires a code change.

This makes the system brittle and blocks user customization. You can't put a wiki sidebar in the agents view without writing new component code. You can't add a file browser to capture without a server change.

---

## The Idea

**Capabilities are services.** File browsing, wiki rendering, JSON viewing — these are functions that any view can declare it uses. The declaration lives in `index.json`, not in server or client code.

The server becomes fully generic: resolve paths, serve files, relay messages. The client reads capability declarations and mounts the right components into layout slots.

---

## Capability Model

### Declaration in index.json

Each view's `index.json` gains a `capabilities` array:

```json
{
  "id": "wiki-viewer",
  "label": "Wiki",
  "type": "view",
  "capabilities": [
    {
      "type": "wiki",
      "source": "ai/wiki-data/project",
      "placement": "main",
      "options": {
        "showEdges": true,
        "showCollections": true
      }
    },
    {
      "type": "file-explorer",
      "source": "ai/wiki-data/",
      "placement": "sidebar",
      "options": {
        "readOnly": true
      }
    }
  ]
}
```

```json
{
  "id": "explorer",
  "label": "Explorer",
  "type": "view",
  "capabilities": [
    {
      "type": "file-explorer",
      "source": "/",
      "placement": "main",
      "options": {
        "readOnly": false,
        "showHidden": false
      }
    }
  ]
}
```

```json
{
  "id": "agents",
  "label": "Agents",
  "type": "view",
  "capabilities": [
    {
      "type": "agent-tiles",
      "source": "ai/panels/agents/",
      "placement": "main"
    },
    {
      "type": "wiki",
      "source": "ai/wiki-data/project",
      "placement": "drawer",
      "options": {
        "showEdges": false,
        "filter": ["workspace-agent-model", "background-agents"]
      }
    }
  ]
}
```

### Capability Schema

```
capability:
  type: string          # "file-explorer" | "wiki" | "json-viewer" | "agent-tiles" | "ticket-board" | "chat" | "terminal"
  source: string        # Root path this capability reads from (resolved by server)
  placement: string     # Where in the layout: "main" | "sidebar" | "drawer" | "floating" | "overlay"
  options: object       # Capability-specific configuration (optional)
```

### Built-in Capability Types

| Type | What it does | Source resolves to | Key options |
|------|-------------|-------------------|-------------|
| `file-explorer` | Browse and edit files | Any directory path | `readOnly`, `showHidden`, `fileTypes` |
| `wiki` | Render wiki pages with edges | A wiki data directory | `showEdges`, `showCollections`, `filter` |
| `json-viewer` | Structured JSON display | A JSON file or directory | `schema`, `editable` |
| `agent-tiles` | Agent card grid | Agents folder | `folders`, `showStatus` |
| `ticket-board` | Kanban ticket board | Issues folder | `columns`, `assignees` |
| `chat` | Chat input + message list | Thread storage | `model`, `systemPrompt` |
| `terminal` | Terminal emulator | Shell | `shell`, `cwd` |

New capability types can be added without touching existing code. A capability is just: a component that knows how to render a data source, mounted into a layout slot.

---

## Server Changes

### Remove hardcoded panel routing

Current `getPanelPath()`:
```js
// CURRENT — hardcoded special cases
if (panel === 'explorer') return getSessionRoot(ws, panel);
if (panel === '__panels__') return path.join(root, 'ai', 'panels');
if (panel === 'wiki-viewer') return path.join(root, 'ai', 'wiki-data');
return path.join(root, 'ai', 'panels', panel);
```

Proposed — generic, source-based:
```js
// PROPOSED — read source from capability, or default to panel folder
function resolveSource(source, projectRoot) {
  if (source === '/') return projectRoot;
  return path.join(projectRoot, source);
}
```

The server doesn't decide where a panel's data lives. The client tells the server which `source` path to resolve, based on the capability declaration it read from `index.json`.

### Message routing stays the same

WS messages already include `panel` and `path`. The only change is that `panel` might be replaced by or augmented with `source` in some messages:

```json
{"type": "file_tree_request", "source": "ai/wiki-data/project", "path": "home"}
```

Or the client maps capability source → a panel-like ID and the server resolves it. Either works.

### __panels__ discovery stays

The discovery pseudo-panel (`__panels__`) still works — it lists available views. Each view's `index.json` now includes `capabilities`, which the client reads to know what to mount.

---

## Client Changes

### Capability registry

A registry maps capability types to React components:

```ts
const CAPABILITY_REGISTRY: Record<string, React.ComponentType<CapabilityProps>> = {
  'file-explorer': FileExplorer,
  'wiki': WikiRenderer,
  'json-viewer': JsonViewer,
  'agent-tiles': AgentTiles,
  'ticket-board': TicketBoard,
  'chat': ChatArea,
  'terminal': TerminalEmulator,
};
```

### Layout compositor

When a view loads, the client reads its `capabilities` array and mounts each one into its declared `placement` slot:

```
┌─────────────────────────────────────────┐
│ sidebar │        main           │ drawer │
│         │                       │        │
│  wiki   │    agent-tiles        │  file  │
│ (filter │                       │ explorer│
│  2 topics)                      │        │
└─────────────────────────────────────────┘
```

The layout grid is fixed (sidebar | main | drawer). What goes in each slot is driven entirely by index.json.

### Pub/Sub for data

Each mounted capability subscribes to WS messages relevant to its source:

- File explorer subscribes to `file_tree_response` where the path starts with its `source`
- Wiki subscribes to `file_content_response` for its topics
- Each capability manages its own data independently

Capabilities don't talk to each other directly. If one needs to signal another (e.g., clicking a wiki link that should open in the file explorer), it goes through the event bus or store.

---

## Migration Path

### Phase 1: Add capabilities to index.json (non-breaking)

Add `capabilities` array to each view's `index.json`. The client ignores it for now. Existing hardcoded routing continues to work.

### Phase 2: Client reads capabilities

The layout compositor reads `capabilities` and mounts components. Hardcoded component routing in `ContentArea.tsx` is replaced by the registry lookup.

### Phase 3: Server becomes source-based

`getPanelPath()` reads from a source parameter instead of hardcoded panel IDs. The special cases go away.

### Phase 4: New capabilities

Add `json-viewer` as a new capability type. Any view can declare it. No server change needed.

---

## What This Enables

- **Wiki sidebar in agents view** — just add a wiki capability to agents/index.json
- **File browser in any view** — declare it, done
- **New capability types** — add a component, register it, views can use it immediately
- **User customization** — edit index.json to add/remove/rearrange capabilities per view
- **No server changes** for new views or capability combinations
- **Side wikis** — multiple wiki capabilities pointing at different source directories
- **The server is a file server with WebSocket relay.** All intelligence is in index.json + client.

---

## What This Does NOT Change

- `ai/panels/` folder structure — views still live here
- `ai/wiki-data/` — wiki data still lives here
- WebSocket protocol — same message types, maybe add `source` field
- Thread management — still per-view
- Agent runner — still reads from `ai/panels/agents/`

---

## Open Questions

1. **Source resolution** — should the client send `source` paths directly, or should the server cache each view's capabilities and resolve internally?
2. **Placement slots** — is `main | sidebar | drawer | floating | overlay` enough? Or should it be fully CSS-grid-based?
3. **Capability options** — how deep should options go? Just display hints, or full behavioral config?
4. **Cross-capability communication** — event bus? Shared store slice? Direct prop passing?
5. **Runtime modules** — the terminal and skills views use `ui/module.js` runtime loading. Are those just another capability type, or a separate mechanism?
