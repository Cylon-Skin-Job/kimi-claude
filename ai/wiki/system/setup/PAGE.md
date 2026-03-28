# Setup

> First boot copies templates. After that, the project owns its files.

---

## What Happens on First Boot

When a user opens the app on a new project for the first time, the setup process creates the entire AI folder structure from templates. After setup, every workspace, agent, and wiki collection is immediately functional with sensible defaults.

### The Setup Flow

```
User opens app → project has no ai/ folder
  │
  ├─ Create ai/
  ├─ Copy ai/templates/workspaces/* → ai/workspaces/*
  ├─ Copy ai/templates/wiki/* → ai/wiki/*
  ├─ Create ai/STATE.md (empty)
  ├─ Each workspace gets default index.json, workspace.json, agent files
  ├─ Wiki gets default root index, project collection (empty), system collection (populated)
  │
  └─ Done. All agents functional. Wiki browsable. Tickets dispatchable.
```

No wizard. No prompts. The app copies files and starts. The user sees a working system with system wiki pages explaining how everything works.

### What Gets Copied

**Workspaces** (from `ai/templates/workspaces/`):

| Workspace | Contents |
|-----------|----------|
| `capture/` | workspace.json, specs folder |
| `coding-agent/` | workspace.json, api.json, sessions folder |
| `issues/` | workspace.json, index.json, sync.json, scripts/ |
| `terminal/` | workspace.json |
| `wiki/` | workspace.json, api.json, PROMPT.md, TOOLS.md, WORKFLOW.md |
| `background-agents/` | workspace.json, registry.json, index.json, System/ agents with IDENTITY.md, SESSION.md, styles.css, workflows/, TRIGGERS.md |
| `workspaces.json` | Master workspace list with ranks and UI config |

**Wiki** (from `ai/templates/wiki/`):

| Collection | Contents |
|------------|----------|
| `system/` | All system wiki pages (frozen, rank 99) |
| `project/` | Empty collection (rank 1), ready for agent population |
| `index.json` | Root index with children: [project, system] |

### After Setup

The copied files are now the project's own. They can be modified freely:
- Agents evolve their IDENTITY.md and LESSONS.md
- Workspace configs get customized
- Project wiki pages are created by agents and users
- System wiki pages remain frozen until the next app update

---

## The Template Folder

```
ai/templates/
├── workspaces/
│   ├── workspaces.json           ← master workspace list
│   ├── capture/
│   │   └── workspace.json
│   ├── coding-agent/
│   │   ├── workspace.json
│   │   └── api.json
│   ├── issues/
│   │   ├── workspace.json
│   │   ├── index.json
│   │   ├── sync.json
│   │   └── scripts/
│   │       ├── create-ticket.js
│   │       └── sync-tickets.js
│   ├── terminal/
│   │   └── workspace.json
│   ├── wiki/
│   │   ├── workspace.json
│   │   ├── api.json
│   │   ├── PROMPT.md
│   │   ├── TOOLS.md
│   │   └── WORKFLOW.md
│   └── background-agents/
│       ├── workspace.json
│       ├── registry.json
│       ├── index.json
│       └── System/
│           ├── wiki-manager/
│           │   ├── IDENTITY.md
│           │   ├── SESSION.md
│           │   ├── TRIGGERS.md
│           │   ├── styles.css
│           │   └── workflows/
│           ├── code-manager/
│           │   └── ...
│           └── ops-manager/
│               └── ...
│
└── wiki/
    ├── index.json                ← root: children [project, system]
    ├── project/
    │   └── index.json            ← empty collection, rank 1
    └── system/
        ├── index.json            ← frozen collection, rank 99
        ├── system-overview/
        │   ├── index.json
        │   ├── PAGE.md
        │   └── LOG.md
        ├── evidence-gated-execution/
        ├── workflow-design/
        ├── agent-folder-structure/
        ├── validation-subagent/
        ├── universal-index/
        ├── setup/
        └── template-fallback/
```

Templates ship with the app. They are frozen — only app updates modify them. See [Template Fallback](../template-fallback/PAGE.md) for how the runtime uses templates as defaults.

[Template folder not yet created — currently the real files are the only copies]

---

## App Updates

When the app updates:

1. **Templates are replaced** — `ai/templates/` is overwritten with the new version
2. **System wiki is patched** — `ai/wiki/system/` pages are updated to match the new templates (since they're frozen, the app owns them)
3. **Project files are NOT touched** — `ai/workspaces/`, `ai/wiki/project/`, `ai/STATE.md` belong to the project
4. **New workspaces** — if the update introduces a new workspace template, it appears in templates but is not auto-copied. The user or an agent can add it.

[App update mechanism not yet implemented]

### What "Frozen" Means for Updates

System wiki pages are frozen: agents can't write them. But the app can. On update:

```
For each page in templates/wiki/system/:
  → Overwrite ai/wiki/system/{topic}/PAGE.md
  → Append to LOG.md: "Updated by app version X.Y.Z"
  → Update index.json
```

This ensures all agents immediately understand new system concepts introduced by the update.

---

## Adding a New Workspace

After setup, the user or an agent can add new workspaces:

1. Create folder in `ai/workspaces/{new-workspace}/`
2. Add `index.json` following the [Universal Index](../universal-index/PAGE.md) schema
3. Add workspace-specific files (workspace.json, api.json, etc.)
4. Add the workspace ID to `ai/workspaces/workspaces.json`

Or, if a template exists:

1. Copy from `ai/templates/workspaces/{workspace}/` to `ai/workspaces/{workspace}/`
2. Customize as needed

The server discovers new workspaces by scanning `ai/workspaces/` — no restart required.

[Auto-discovery on folder creation not yet implemented — currently requires server restart]

---

## Adding a New Wiki Collection

1. Create folder `ai/wiki/{collection-name}/`
2. Add `index.json` with `type: "collection"` and a rank
3. Add the collection ID to `ai/wiki/index.json` children array
4. Create topic folders inside with PAGE.md + LOG.md + index.json

The server picks up the new collection on next index scan. The sidebar gets a new header at the declared rank position.

[Dynamic collection discovery not yet implemented]

---

## Related

- [Template Fallback](../template-fallback/PAGE.md) — how the runtime resolves files through the template chain
- [Universal Index](../universal-index/PAGE.md) — the index.json schema used everywhere
- [Agent Folder Structure](../agent-folder-structure/PAGE.md) — what goes in each workspace
- [System Overview](../system-overview/PAGE.md) — the big picture
