---
title: "Phase 1: Folder Restructure"
priority: critical
status: not-started
implements: 01-agent-prompts
blocks: impl-phase-2, impl-phase-3, impl-phase-4
---

# Phase 1: Folder Restructure

Consolidate 7 individual agents into 3 managed workspaces under a reserved `System/` folder.

## Current State

```
ai/workspaces/background-agents/
├── workspace.json          (type: "agent-tiles")
├── registry.json           (7 bot names → 7 folders)
├── index.json              (UI metadata: icon, color, status per agent)
└── agents/
    ├── bug-fixer/          prompt.md + LESSONS.md
    ├── code-reviewer/      prompt.md + LESSONS.md
    ├── dependency-auditor/ prompt.md + LESSONS.md
    ├── doc-generator/      prompt.md + LESSONS.md
    ├── test-writer/        prompt.md + LESSONS.md
    ├── wiki-auditor/       prompt.md + LESSONS.md
    └── wiki-updater/       prompt.md + LESSONS.md
```

Registry maps 7 bot names to 7 folders. index.json carries display metadata (icon, color, description, schedule). Server enriches index.json with cron labels before serving to client.

## Target State

```
ai/workspaces/background-agents/
├── workspace.json          (updated — folders field added)
├── registry.json           (3 bot names → 3 folders under System/)
├── System/                 (reserved — default agents that ship with the app)
│   ├── wiki-manager/
│   │   ├── IDENTITY.md     (stub — content in Phase 7)
│   │   ├── MEMORY.md       (empty — populated by user interaction)
│   │   ├── HISTORY.md      (empty — populated by runner)
│   │   ├── LESSONS.md      (merged from wiki-updater + wiki-auditor)
│   │   ├── TRIGGERS.md     (stub — content in Phase 4)
│   │   ├── styles.css      (agent display: icon via ::before content, color)
│   │   ├── PROMPT_01.md    (from wiki-updater/prompt.md)
│   │   ├── PROMPT_02.md    (from wiki-auditor/prompt.md)
│   │   ├── PROMPT_03.md    (new — edge checker, stub)
│   │   ├── threads/
│   │   └── runs/
│   ├── code-manager/
│   │   ├── IDENTITY.md
│   │   ├── MEMORY.md
│   │   ├── HISTORY.md
│   │   ├── LESSONS.md      (merged from bug-fixer + code-reviewer + test-writer)
│   │   ├── TRIGGERS.md
│   │   ├── styles.css
│   │   ├── PROMPT_01.md    (from bug-fixer/prompt.md)
│   │   ├── PROMPT_02.md    (from code-reviewer/prompt.md)
│   │   ├── PROMPT_03.md    (from test-writer/prompt.md)
│   │   ├── threads/
│   │   └── runs/
│   └── ops-manager/
│       ├── IDENTITY.md
│       ├── MEMORY.md
│       ├── HISTORY.md
│       ├── LESSONS.md      (merged from dependency-auditor + doc-generator)
│       ├── TRIGGERS.md
│       ├── styles.css
│       ├── PROMPT_01.md    (from dependency-auditor/prompt.md)
│       ├── PROMPT_02.md    (from doc-generator/prompt.md)
│       ├── threads/
│       └── runs/
└── [user-created-folders]/ (future — not built in Phase 1)
```

## Key Design Decisions

### styles.css (not STYLES.css)
Display metadata lives in `styles.css` per agent — lowercase because it's not agent context (not fed into the agent's mind). Only files that are agent context are ALL CAPS.

Icon is set via CSS `::before` pseudo-element with Material Symbols `content` property. Color defined as CSS custom properties. No index.json needed for display metadata — each agent is self-describing from its folder.

### System/ is Reserved
- Ships with default agents (wiki-manager, code-manager, ops-manager)
- Cannot be deleted or renamed by user
- Future: user-created folders sit alongside System/

### index.json → Deprecated
Display metadata (icon, color, description) moves into each agent's `styles.css` and `IDENTITY.md`. The server-side cron label enrichment moves to... wherever schedule display needs it (Phase 4 handles triggers/cron).

## Steps

### 1. Create System/ and Agent Folders
- [ ] `mkdir -p System/wiki-manager/{threads,runs}`
- [ ] `mkdir -p System/code-manager/{threads,runs}`
- [ ] `mkdir -p System/ops-manager/{threads,runs}`

### 2. Move and Rename Prompts

**wiki-manager:**
- [ ] `agents/wiki-updater/prompt.md` → `System/wiki-manager/PROMPT_01.md`
- [ ] `agents/wiki-auditor/prompt.md` → `System/wiki-manager/PROMPT_02.md`
- [ ] Create `System/wiki-manager/PROMPT_03.md` (edge checker — stub with TODO)

**code-manager:**
- [ ] `agents/bug-fixer/prompt.md` → `System/code-manager/PROMPT_01.md`
- [ ] `agents/code-reviewer/prompt.md` → `System/code-manager/PROMPT_02.md`
- [ ] `agents/test-writer/prompt.md` → `System/code-manager/PROMPT_03.md`

**ops-manager:**
- [ ] `agents/dependency-auditor/prompt.md` → `System/ops-manager/PROMPT_01.md`
- [ ] `agents/doc-generator/prompt.md` → `System/ops-manager/PROMPT_02.md`

### 3. Merge LESSONS.md
- [ ] Merge `wiki-updater/LESSONS.md` + `wiki-auditor/LESSONS.md` → `wiki-manager/LESSONS.md`
- [ ] Merge `bug-fixer/LESSONS.md` + `code-reviewer/LESSONS.md` + `test-writer/LESSONS.md` → `code-manager/LESSONS.md`
- [ ] Merge `dependency-auditor/LESSONS.md` + `doc-generator/LESSONS.md` → `ops-manager/LESSONS.md`

### 4. Create styles.css Per Agent
- [ ] `wiki-manager/styles.css` — icon: `edit_note`, color: `#e91e8a` (from current index.json)
- [ ] `code-manager/styles.css` — icon: `bug_report`, color: `#f97316`
- [ ] `ops-manager/styles.css` — icon: `shield`, color: `#eab308`

Example styles.css:
```css
/* wiki-manager agent display */
.agent-tile--wiki-manager::before {
  font-family: 'Material Symbols Outlined';
  content: 'edit_note';
}

.agent-tile--wiki-manager {
  --agent-color: #e91e8a;
}
```

### 5. Create Empty Infrastructure Files
- [ ] `IDENTITY.md` in each (header + stub, content in Phase 7)
- [ ] `MEMORY.md` in each (empty — populated through user interaction)
- [ ] `HISTORY.md` in each (with `## Recent` and `## Daily Summaries` sections)
- [ ] `TRIGGERS.md` in each (header + stub, content in Phase 4)

### 6. Update Registry
- [ ] Rewrite `registry.json` with 3 entries:
  - `kimi-wiki` → `System/wiki-manager`
  - `kimi-code` → `System/code-manager`
  - `kimi-ops` → `System/ops-manager`

### 7. Update workspace.json
- [ ] Add `folders` field with System as reserved
- [ ] Keep `type: "agent-tiles"` for now (ContentArea routing unchanged)

### 8. Remove Old Structure
- [ ] Remove `agents/` directory entirely (all 7 old folders)
- [ ] Remove or archive `index.json` (deprecated — metadata now in styles.css + IDENTITY.md)

### 9. Update Server/Runner References
- [ ] `prompt-builder.js` — default prompt filename: `PROMPT_01.md` instead of `prompt.md`
- [ ] `dispatch.js` — registry path still works (reads from registry.json, folder field changed)
- [ ] `run-folder.js` — base path changes from `background-agents/agents/` to `background-agents/System/` (driven by registry)
- [ ] `agent-prompt-change.md` filter — update match pattern to `**/PROMPT_*.md`

## Files Modified
- `ai/workspaces/background-agents/registry.json` — 3 entries with System/ prefix
- `ai/workspaces/background-agents/workspace.json` — folders field
- `ai/workspaces/background-agents/index.json` — removed/archived
- `ai/workspaces/background-agents/System/` — new folder structure
- `ai/workspaces/background-agents/agents/` — removed
- `kimi-ide-server/lib/runner/prompt-builder.js` — PROMPT_01.md default
- `kimi-ide-server/lib/watcher/filters/agent-prompt-change.md` — updated match pattern
- `kimi-ide-server/server.js` — remove index.json enrichment block (lines 314-327)

## Verification
- [ ] Runner can load PROMPT_01.md from `System/wiki-manager/`
- [ ] Dispatch resolves `kimi-wiki` → `System/wiki-manager` via registry
- [ ] Existing LESSONS.md content preserved in merged files
- [ ] styles.css contains correct icon and color per agent
- [ ] Old agents/ directory and index.json removed cleanly
- [ ] Server starts without errors

## Risk
Low. Registry-driven architecture means code follows the data. The only code changes are default filename (`PROMPT_01.md`) and removing the index.json enrichment. Everything else is file moves.
