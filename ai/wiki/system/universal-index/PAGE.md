# Universal Index

> Every folder has an index.json that describes its children and itself. Same schema, every level.

---

## What This Is

A recursive self-description pattern used throughout the system. Every folder that participates in discovery — wikis, workspaces, agent folders — contains an `index.json` that declares what it is, what it contains, and how it should be presented.

The parent's index manages its children. The child's index manages itself. No folder reaches into another folder's index to understand it — it reads the child's own `index.json`.

---

## The Schema

One schema, every level. Fields are nullable — use what applies, omit what doesn't.

```json
{
  "version": "1.0",

  "id": "project",
  "label": "Project",
  "description": "Per-project living documentation maintained by agents",
  "type": "collection",
  "rank": 1,
  "icon": "folder_open",
  "color": null,

  "created": "2026-03-27T00:00:00Z",
  "updated": "2026-03-27T20:00:00Z",

  "frozen": false,

  "children": ["secrets", "gitlab", "home"],

  "edges_out": null,
  "edges_in": null,
  "sources": null,

  "settings": {}
}
```

### Field Reference

| Field | Type | Description | Used At |
|-------|------|-------------|---------|
| `version` | string | Schema version, always `"1.0"` | All levels |
| `id` | string | Machine identifier, matches folder name | All levels |
| `label` | string | Human-readable display name | All levels |
| `description` | string \| null | One-line summary | All levels |
| `type` | string | What this folder is (see Types below) | All levels |
| `rank` | number | Sort order among siblings. Lower = higher. | All levels |
| `icon` | string \| null | Material icon name | All levels |
| `color` | string \| null | Hex accent color | All levels |
| `created` | string | ISO 8601 creation timestamp | All levels |
| `updated` | string | ISO 8601 last modification timestamp | All levels |
| `frozen` | boolean | If true, agents cannot write to this folder | Collections, pages |
| `children` | string[] \| null | Ordered list of child folder IDs | Roots, collections |
| `edges_out` | string[] \| null | Topics this page links to (by slug) | Pages only |
| `edges_in` | string[] \| null | Topics that link to this page (by slug) | Pages only |
| `sources` | string[] \| null | File paths this page references | Pages only |
| `settings` | object | Arbitrary key-value pairs for type-specific config | All levels |

### Types

| Type | Meaning | Has Children | Has Edges | Example |
|------|---------|-------------|-----------|---------|
| `root` | Top-level container of collections | Yes | No | `ai/wiki/index.json` |
| `collection` | A group of related pages | Yes | No | `ai/wiki/project/index.json` |
| `page` | A single wiki topic | No | Yes | `ai/wiki/project/secrets/index.json` |
| `workspace` | An agent workspace | Yes | No | `ai/workspaces/issues/index.json` |
| `agent` | A background agent folder | Yes | No | `ai/workspaces/background-agents/System/wiki-manager/index.json` |

New types can be added. The server doesn't hardcode types — it reads the index and follows the schema.

---

## The Recursive Pattern

```
ai/wiki/
├── index.json                    type: "root"
│                                 children: ["project", "system"]
│                                 (manages collections)
│
├── project/
│   ├── index.json                type: "collection"
│   │                             children: ["secrets", "gitlab", "home", ...]
│   │                             rank: 1
│   │                             frozen: false
│   │                             (manages topics)
│   │
│   ├── secrets/
│   │   ├── index.json            type: "page"
│   │   │                         edges_out: ["gitlab"]
│   │   │                         edges_in: ["home"]
│   │   │                         sources: ["kimi-ide-server/lib/secrets.js"]
│   │   │                         rank: 10
│   │   │                         (manages itself)
│   │   ├── PAGE.md
│   │   └── LOG.md
│   │
│   └── home/
│       ├── index.json            type: "page", rank: 1
│       ├── PAGE.md
│       └── LOG.md
│
└── system/
    ├── index.json                type: "collection"
    │                             children: ["system-overview", "evidence-gated-execution", ...]
    │                             rank: 99
    │                             frozen: true
    │
    └── evidence-gated-execution/
        ├── index.json            type: "page", rank: 2
        ├── PAGE.md
        └── LOG.md
```

**Reading order:** The server reads `ai/wiki/index.json` to discover collections. For each collection, it reads `{collection}/index.json` to discover topics. For each topic, it reads `{topic}/index.json` for metadata. PAGE.md is loaded on demand when the user clicks.

**The rule:** A parent's `children` array lists folder names. The child's own `index.json` provides all details. The parent never stores metadata about the child — the child is self-describing.

---

## Rank Conventions

| Rank | Meaning |
|------|---------|
| 1 | First / primary (e.g., "Home" page, "Project" collection) |
| 10-89 | Normal range for user content |
| 90-98 | Reserved for late-order items |
| 99 | Always last (e.g., "System" collection) |

**Defaults:**
- New collection added by the system → rank 99 (bottom)
- New collection added by the user → rank 50 (middle)
- New page added to a collection → rank one higher than the current highest (appends to bottom)
- "Home" page in any collection → rank 1 (always first)

**Collision handling:** If two siblings share a rank, sort alphabetically by `id` as tiebreak. No error — ranks are advisory, not unique keys.

---

## Programmatic Generation

When creating a new folder that participates in the index system, generate its `index.json` with sensible defaults:

### New Collection

```javascript
function createCollectionIndex(id, label, options = {}) {
  return {
    version: "1.0",
    id,
    label,
    description: options.description || null,
    type: "collection",
    rank: options.rank || 99,
    icon: options.icon || "folder_open",
    color: options.color || null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    frozen: options.frozen || false,
    children: [],
    edges_out: null,
    edges_in: null,
    sources: null,
    settings: options.settings || {}
  };
}
```

### New Page

```javascript
function createPageIndex(id, label, options = {}) {
  return {
    version: "1.0",
    id,
    label,
    description: options.description || null,
    type: "page",
    rank: options.rank || 50,
    icon: options.icon || "article",
    color: options.color || null,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    frozen: options.frozen || false,
    children: null,
    edges_out: options.edges_out || [],
    edges_in: options.edges_in || [],
    sources: options.sources || [],
    settings: options.settings || {}
  };
}
```

### Adding a Child

When a new folder is created inside a collection:
1. Generate the child's `index.json` with defaults
2. Append the child's `id` to the parent's `children` array
3. Update the parent's `updated` timestamp

[Programmatic index generation helpers not yet implemented — above is the reference design]

---

## Server Discovery

At startup, the server:

1. Reads `ai/wiki/index.json` (or any root index it's configured to watch)
2. For each child in `children`, reads `{child}/index.json`
3. Sorts collections by `rank`
4. For each collection, reads topic-level indexes on demand (or eagerly for small wikis)
5. Watches all directories for changes, rebuilds affected indexes

The server does not hardcode paths. It follows the index chain. Adding a new collection = creating a folder with an `index.json` and adding its `id` to the parent's `children` array.

---

## The `frozen` Field

When `frozen: true`:
- Agents cannot write to any file in this folder or its descendants
- The server enforces this at the tool-call level (same as TOOLS.md restrictions)
- Only app updates or manual human edits can modify frozen content
- The UI can indicate frozen status (e.g., lock icon)

System wiki collections are frozen. Project wiki collections are not. Individual pages can be frozen regardless of their parent's status.

[Server-side frozen enforcement not yet implemented]

---

## The `settings` Field

An escape hatch for type-specific configuration. Examples:

**Wiki collection:**
```json
{
  "settings": {
    "syncTarget": "gitlab",
    "gitlabProjectId": 80453361
  }
}
```

**Agent workspace:**
```json
{
  "settings": {
    "sessionType": "persistent",
    "maxIdleMinutes": 30
  }
}
```

**Page:**
```json
{
  "settings": {
    "autoSummarize": true,
    "summaryModel": "fast"
  }
}
```

The schema doesn't validate `settings` — it's a namespace for each type to use as needed.

---

## Applying Beyond Wiki

This same pattern applies everywhere folders need discovery and ordering:

| Location | Root Index | Children |
|----------|-----------|----------|
| `ai/wiki/` | Wiki collections | Topic pages |
| `ai/workspaces/` | Workspace list | Individual workspaces |
| `ai/workspaces/background-agents/` | Agent registry | Agent folders |
| `ai/workspaces/issues/` | Ticket index | Ticket files |

The schema is the same. The `type` field differentiates. A workspace `index.json` has `type: "workspace"`. An agent has `type: "agent"`. The server reads the type and applies the appropriate behavior.

[Unified index pattern across workspaces and agents not yet implemented — currently these use workspace.json, registry.json, and other formats. Migration planned.]

---

## Migration Path

Current state: wiki topics use a flat `index.json` at the collection root with all topic metadata inline. Workspaces use `workspaces.json`. Agents use `registry.json`.

Target state: every folder has its own `index.json`. Parent indexes list children. Child indexes describe themselves.

Migration steps:
1. Wiki: split flat `index.json` into per-topic `index.json` files, parent lists children only
2. Workspaces: convert `workspaces.json` entries into per-workspace `index.json` files
3. Agents: convert `registry.json` entries into per-agent `index.json` files
4. Server: update discovery to follow the recursive pattern

[Migration not yet started]
