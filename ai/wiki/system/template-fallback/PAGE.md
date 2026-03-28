# Template Fallback

> Real file wins. No real file? Read the template. No template? Error.

---

## What This Is

A resolution pattern where every file request checks the project's real files first, then falls back to the shipped templates. This means:

- New projects work immediately (templates provide defaults)
- Customizations persist (real files override templates)
- App updates improve defaults without overwriting customizations
- No merge logic — just a two-step lookup

---

## The Resolution Chain

```
Request for: ai/workspaces/wiki/workspace.json

  1. Check: ai/workspaces/wiki/workspace.json
     → Exists? Return it. Done.

  2. Check: ai/templates/workspaces/wiki/workspace.json
     → Exists? Return it. Done.

  3. Neither exists? → Error (ENOENT)
```

The same pattern applies to every file the server reads from the workspace or wiki tree:

| Real Path | Fallback Path |
|-----------|---------------|
| `ai/workspaces/{ws}/{file}` | `ai/templates/workspaces/{ws}/{file}` |
| `ai/wiki/{collection}/{topic}/{file}` | `ai/templates/wiki/{collection}/{topic}/{file}` |
| `ai/workspaces/workspaces.json` | `ai/templates/workspaces/workspaces.json` |

### Path Mapping

The mapping is 1:1. Strip `ai/` from the real path, prepend `ai/templates/`:

```
ai/workspaces/wiki/PROMPT.md
→ ai/templates/workspaces/wiki/PROMPT.md

ai/wiki/system/evidence-gated-execution/PAGE.md
→ ai/templates/wiki/system/evidence-gated-execution/PAGE.md

ai/workspaces/background-agents/System/wiki-manager/styles.css
→ ai/templates/workspaces/background-agents/System/wiki-manager/styles.css
```

---

## Server Implementation

A single resolver function used everywhere the server reads files:

```javascript
function resolveWithFallback(requestedPath, projectRoot) {
  const realPath = path.join(projectRoot, requestedPath);
  if (fs.existsSync(realPath)) return realPath;

  // Map ai/workspaces/... → ai/templates/workspaces/...
  // Map ai/wiki/... → ai/templates/wiki/...
  const templatePath = requestedPath.replace(/^ai\//, 'ai/templates/');
  const fallback = path.join(projectRoot, templatePath);
  if (fs.existsSync(fallback)) return fallback;

  return null; // Not found in either location
}
```

[Not yet implemented — currently the server reads from real paths only]

### Where It Applies

The fallback resolver wraps these server functions:

| Function | Currently | With Fallback |
|----------|-----------|---------------|
| `getWorkspacePath()` | Returns `ai/workspaces/{id}/` | Checks real, falls back to template |
| `handleFileContentRequest()` | Reads from workspace path | Resolves through fallback chain |
| `wikiHooks.start()` | Watches one path | Watches real path, reads templates for missing files |
| `rebuildIndex()` | Reads one directory | Merges real + template topic lists |

### Where It Does NOT Apply

- **Writes always go to real paths.** Never write to `ai/templates/`. If a file doesn't exist yet, create it at the real path.
- **STATE.md** — project-specific, no template. Created empty on setup.
- **LESSONS.md, HISTORY.md, MEMORY.md** — agent runtime files, no template fallback. Created empty on setup.
- **runs/** — execution history, no template. Created as agents work.
- **threads/** — conversation history, no template.

The rule: **templates provide structure and defaults. Runtime data has no template.**

---

## File Watchers and Fallback

The hooks system watches real paths for changes. It does NOT watch templates (they're frozen). But when the watcher needs to read a file that doesn't exist locally (e.g., reading index.json to know what to watch), it falls back to the template.

```
Server startup:
  1. Read ai/wiki/index.json (real) → found? Use it.
     Not found? → Read ai/templates/wiki/index.json → Use it as seed.
  2. For each collection in index:
     Read ai/wiki/{collection}/index.json (real) → found? Use it.
     Not found? → Read ai/templates/wiki/{collection}/index.json
  3. Set up watchers on real paths only
  4. On first write, the real file is created — future reads hit the real path
```

---

## Override Lifecycle

```
First boot:
  templates/workspaces/wiki/workspace.json  ← only copy
  (setup copies to real location)
  workspaces/wiki/workspace.json            ← now exists, identical to template

User customizes:
  workspaces/wiki/workspace.json            ← modified
  templates/workspaces/wiki/workspace.json  ← unchanged (ignored)

App update:
  templates/workspaces/wiki/workspace.json  ← updated by app
  workspaces/wiki/workspace.json            ← untouched (user's version wins)
```

The user never loses customizations. New template features only apply to projects that haven't overridden that file yet. This is the same model as VS Code's `defaultSettings.json` vs `settings.json`.

---

## When to Copy vs When to Fallback

**Copy on setup:** Files that agents will modify (LESSONS.md, HISTORY.md, MEMORY.md, index.json for collections that agents populate). These need to exist as real files so agents can write to them.

**Fallback at runtime:** Files that are usually left at defaults (workspace.json, styles.css, SESSION.md, api.json). These don't need to be copied unless the user customizes them.

**Always copy:** The wiki system collection (so app updates can patch it). The workspaces.json master list (so workspace discovery works without template resolution).

---

## Related

- [Setup](../setup/PAGE.md) — first boot process
- [Universal Index](../universal-index/PAGE.md) — the index.json schema at every level
- [Agent Folder Structure](../agent-folder-structure/PAGE.md) — what files go where
