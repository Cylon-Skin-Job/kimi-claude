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
  ├─ Each workspace gets default index.json, agent files
  ├─ Wiki gets default root index, project collection (empty), system collection (populated)
  │
  └─ Done. All agents functional. Wiki browsable. Tickets dispatchable.
```

No wizard. No prompts. The app copies files and starts. The user sees a working system with system wiki pages explaining how everything works.

### What Gets Copied

**Workspaces** (from `ai/templates/workspaces/`):

| Workspace | Contents |
|-----------|----------|
| `index.json` | Root workspace index with children and sort order |
| `capture/` | index.json, specs folder |
| `coding-agent/` | index.json, api.json, sessions folder |
| `issues/` | index.json, tickets.json, sync.json, scripts/ |
| `terminal/` | index.json |
| `wiki/` | index.json, api.json, PROMPT.md, TOOLS.md, WORKFLOW.md |
| `background-agents/` | index.json, agents.json, registry.json, System/ agents with PROMPT.md, SESSION.md, styles.css, workflows/, TRIGGERS.md |

**Wiki** (from `ai/templates/wiki/`):

| Collection | Contents |
|------------|----------|
| `system/` | All system wiki pages (frozen, rank 99) |
| `project/` | Empty collection (rank 1), ready for agent population |
| `index.json` | Root index with children: [project, system] |

### After Setup

The copied files are now the project's own. They can be modified freely:
- Agents evolve their PROMPT.md and LESSONS.md
- Workspace configs get customized
- Project wiki pages are created by agents and users
- System wiki pages remain frozen until the next app update

---

## Project Types

On first launch, the user chooses a project type. Each type ships a different set of default workspaces and templates tailored to that domain. When creating additional projects later, the user picks from the same list.

[Planned for future production — currently only the Coding project type exists.]

| Type | Description | Default Workspaces |
|------|-------------|-------------------|
| **Coding** | Software development — write, edit, test, deploy code | capture, coding-agent, terminal, issues, wiki, background-agents, skills |
| **Research Vault** | Download, store, and enrich scientific papers and documents in structured JSON for RAG use. Background scrapers gather material on configured topics, enrichment agents extract metadata and build citation graphs. | capture, research-ingest, enrichment-agent, wiki, issues, background-agents |
| **Office Suite** | Document creation, spreadsheets, presentations, and collaboration tools — all local-first with AI assistance | capture, documents, wiki, issues, background-agents |
| **Bookkeeper** | Accounting, invoicing, expense tracking, and financial reporting — local-first with optional cloud sync | capture, ledger, reports, wiki, issues, background-agents |
| **Studio** | Creative production — image, video, and music creation using CLI tools, headless open source projects, and custom pipelines. Integrates with Research Vault for content sourcing. | capture, media-pipeline, canvas, timeline, wiki, issues, background-agents |

### How Project Types Work

Each project type is a folder in `ai/templates/project-types/`:

```
ai/templates/project-types/
├── coding/
│   └── workspaces/        ← workspace templates for coding projects
├── research-vault/
│   └── workspaces/
├── office-suite/
│   └── workspaces/
├── bookkeeper/
│   └── workspaces/
└── studio/
    └── workspaces/
```

On setup, the selected project type's workspaces are copied into `ai/workspaces/`. The system wiki and wiki tree are the same for all project types — only the workspace set differs.

### Cross-Project Pipelines

Projects can feed into each other:

```
Research Vault (scrapers gather medical research)
  → enrichment agents produce structured packets
  → packets feed into Studio
  → Studio produces short-form content about the research
```

Each project is its own repo with its own `ai/` folder. The connection between projects is through shared file paths, APIs, or agent-to-agent ticket creation.

[Cross-project pipelines not yet implemented]

---

## The Template Folder

```
ai/templates/
├── workspaces/
│   ├── index.json                ← root workspace index with children
│   ├── capture/
│   │   └── index.json
│   ├── coding-agent/
│   │   ├── index.json
│   │   └── api.json
│   ├── issues/
│   │   ├── index.json
│   │   ├── tickets.json
│   │   ├── sync.json
│   │   └── scripts/
│   │       ├── create-ticket.js
│   │       └── sync-tickets.js
│   ├── terminal/
│   │   └── index.json
│   ├── wiki/
│   │   ├── index.json
│   │   ├── api.json
│   │   ├── PROMPT.md
│   │   ├── TOOLS.md
│   │   └── WORKFLOW.md
│   └── background-agents/
│       ├── index.json
│       ├── agents.json
│       ├── registry.json
│       └── System/
│           ├── wiki-manager/
│           │   ├── PROMPT.md
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
3. Add workspace-specific files (api.json, PROMPT.md, etc.)
4. Add the workspace ID to `ai/workspaces/index.json` children array

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
