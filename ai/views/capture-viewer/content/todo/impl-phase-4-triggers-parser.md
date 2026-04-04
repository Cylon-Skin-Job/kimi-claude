---
title: "Phase 4: TRIGGERS.md Parser"
priority: high
status: not-started
implements: 07-agent-chat-and-hooks
depends-on: impl-phase-1
blocks: impl-phase-5
---

# Phase 4: TRIGGERS.md Parser

Parse TRIGGERS.md files from agent folders. Each file contains multiple YAML frontmatter blocks, each defining a trigger that creates tickets.

## Current State

**Declarative filters** live in `lib/watcher/filters/*.md`:
- One filter per file
- Single YAML frontmatter block
- Loaded by `filter-loader.js` → `loadFilters(filterDir, actionHandlers)`
- Supports: name, events, match, exclude, condition, action, ticket template

**No cron support.** Only file-change events.

**No TRIGGERS.md format.** Each trigger is a separate .md file.

**No programmatic JS filters needed.** The wiki-sources.js filter was removed — its reverse-lookup logic is now handled by PROMPT_01.md's gather step (reads index.json to find affected topics). All triggers are pure declarative YAML.

## Target State

Each agent folder has a `TRIGGERS.md` with multiple blocks:

```yaml
---
name: source-file-change
type: file-change
events: [modify, create, delete]
match: "kimi-ide-server/lib/**/*.js"
exclude: ["ai/workspaces/capture/**"]
gate: debounce
delay: 20m
prompt: PROMPT_01.md
message: |
  Source file changed: {{filePath}} ({{event}})
  Delta: {{delta}}
---

---
name: daily-freshness
type: cron
schedule: "daily 09:00"
prompt: PROMPT_02.md
message: |
  Scheduled freshness check.
---

---
name: nightly-audit
type: cron
schedule: "daily 02:00"
condition: "lastChatMessage.age > 30m"
retry: "30m"
prompt: PROMPT_AUDIT.md
message: |
  Nightly audit. Consolidate HISTORY.md and review LESSONS.md.
---
```

## Architecture Decision: Alongside, Not Replace

TRIGGERS.md loader runs **alongside** the existing filter system. Existing `.md` filters in `lib/watcher/filters/` keep working. TRIGGERS.md adds a second source of filters loaded from agent folders.

## Steps

### 1. Multi-Block Parser
- [ ] New function: `parseTriggerBlocks(filePath)` → array of trigger definitions
- [ ] Split file on `---` boundaries (same as frontmatter, but multiple blocks)
- [ ] Each block parsed with existing `parseFrontmatter()` logic
- [ ] Return array of `{ name, type, events, match, exclude, condition, gate, delay, prompt, message, schedule, retry, script, function }`

### 2. Trigger Loader
- [ ] New function: `loadTriggers(agentFoldersPath, actionHandlers)`
- [ ] Scan each agent folder for `TRIGGERS.md`
- [ ] Parse blocks → split by `type`:
  - `file-change` → convert to watcher filter (same shape as existing)
  - `cron` → register with cron scheduler (Step 4)
- [ ] File-change triggers get `prompt` and agent `assignee` injected into ticket creation

### 3. File-Change Trigger → Filter Conversion
- [ ] Convert each `type: file-change` block into a filter object compatible with `watcher.addFilter()`
- [ ] The `prompt` field is carried through to ticket frontmatter via the action handler
- [ ] `gate` and `delay` fields: initially ignored (Phase 5 handles this via auto-block)
- [ ] Assignee derived from registry (agent folder → bot name reverse lookup)

### 3b. Script Field Support
- [ ] If trigger has `script` field: resolve path relative to project root (e.g. `ai/scripts/check-sources.js`)
- [ ] If trigger has `function` field: call that exported function, otherwise call default export
- [ ] Script receives event context `{ filePath, event, basename, parentDir, parentStats, fileStats, projectRoot }`
- [ ] Script return value available as `result` in condition expressions and message templates
- [ ] Timeout: kill script execution after 5 seconds
- [ ] Scripts are pure functions — no side effects, no ticket creation
- [ ] Scripts live in `ai/scripts/` (shared across agents)

### 4. Cron Scheduler
- [ ] New module: `lib/scheduler/index.js` or extend existing
- [ ] Reads `type: cron` blocks from parsed TRIGGERS.md
- [ ] `schedule: "daily 09:00"` → setInterval or node-cron
- [ ] On fire: creates ticket with `prompt` field and `message` as body
- [ ] `condition` evaluation: extend existing condition evaluator with new variables
  - `lastChatMessage.age` — requires reading thread state
- [ ] `retry` field: if condition fails, try again after specified interval

### 5. Integration Point (server.js)
- [ ] After existing filter loading, call `loadTriggers()` for each agent folder
- [ ] Add file-change triggers to watcher
- [ ] Register cron triggers with scheduler
- [ ] On TRIGGERS.md change → reload that agent's triggers (hot reload)

## New Files
- `kimi-ide-server/lib/triggers/trigger-parser.js` — multi-block YAML parser
- `kimi-ide-server/lib/triggers/trigger-loader.js` — scan agent folders, build filters + crons
- `kimi-ide-server/lib/triggers/cron-scheduler.js` — cron trigger execution

## Files Modified
- `kimi-ide-server/server.js` — integration: load triggers on startup, wire to watcher + scheduler
- `kimi-ide-server/lib/watcher/actions.js` — `create-ticket` action accepts `prompt` field

## Verification
- [ ] File-change trigger in TRIGGERS.md creates ticket with correct `prompt` field
- [ ] Cron trigger fires on schedule and creates ticket
- [ ] Condition gate prevents cron from firing when condition is false
- [ ] Retry re-checks after specified interval
- [ ] Hot reload: edit TRIGGERS.md → new triggers take effect without restart
- [ ] Existing filter .md files still work unchanged
