---
title: "Phase 2: Prompt Field on Tickets"
priority: high
status: not-started
implements: 01-agent-prompts, 07-agent-chat-and-hooks
depends-on: impl-phase-1
blocks: impl-phase-5, impl-phase-6
---

# Phase 2: Prompt Field on Tickets

Tickets carry a `prompt` field in frontmatter. Runner loads that specific PROMPT_NN.md instead of hardcoded `prompt.md`.

## Current State

**prompt-builder.js** `buildContext()`:
- Reads `path.join(agentFolder, 'prompt.md')` — always the same file
- Reads `path.join(agentFolder, 'LESSONS.md')`
- Reads `AGENTS.md` from workspace root

**Ticket schema** (frontmatter):
```yaml
id: KIMI-0006
title: Rotate GitLab deploy token
assignee: rccurtrightjr
created: 2026-03-21T21:56:23.506Z
author: local
state: open
blocks: null
blocked_by: null
```

No `prompt` field exists.

## Target State

**Ticket schema** gains `prompt` field:
```yaml
id: KIMI-0007
title: Source file changed: pull.js
assignee: kimi-wiki
prompt: PROMPT_01.md
created: 2026-03-24T14:30:00.000Z
author: trigger:source-file-change
state: open
```

**prompt-builder.js** reads the prompt field:
```
ticket.frontmatter.prompt → load that file from agent folder
fallback → PROMPT_01.md (not prompt.md)
```

## Steps

### 1. Update Ticket Creation (actions.js)
- [ ] `create-ticket` action handler accepts `prompt` field from filter definition
- [ ] Writes `prompt` into ticket frontmatter when creating KIMI-*.md files
- [ ] Template variable `{{prompt}}` available if needed

### 2. Update Ticket Loader (loader.js)
- [ ] `loadTicket()` parses `prompt` field from frontmatter (already handled by generic parser, just document it)

### 3. Update Prompt Builder (prompt-builder.js)
- [ ] `buildContext()` accepts optional `promptFile` parameter
- [ ] Resolves to `path.join(agentFolder, promptFile)` instead of hardcoded `prompt.md`
- [ ] Fallback: if no `prompt` field, use `PROMPT_01.md`

### 4. Thread Through Dispatch (dispatch.js)
- [ ] `executeRun()` reads `ticket.frontmatter.prompt`
- [ ] Passes it to `buildContext()` / run setup

### 5. Update Run Manifest (runner/index.js)
- [ ] `manifest.json` records which prompt was used: `"prompt": "PROMPT_02.md"`
- [ ] Frozen copy in run folder uses actual filename (not always `prompt.md`)

## Files Modified
- `kimi-ide-server/lib/watcher/actions.js` — prompt field in ticket creation
- `kimi-ide-server/lib/tickets/loader.js` — documentation only (parser already generic)
- `kimi-ide-server/lib/runner/prompt-builder.js` — dynamic prompt path
- `kimi-ide-server/lib/tickets/dispatch.js` — thread prompt field to runner
- `kimi-ide-server/lib/runner/index.js` — manifest + frozen copy naming

## Verification
- [ ] Create a test ticket with `prompt: PROMPT_02.md` assigned to `kimi-wiki`
- [ ] Runner loads PROMPT_02.md (not PROMPT_01.md)
- [ ] Manifest records `"prompt": "PROMPT_02.md"`
- [ ] Run folder contains frozen copy named `PROMPT_02.md`
- [ ] Ticket without prompt field falls back to PROMPT_01.md
