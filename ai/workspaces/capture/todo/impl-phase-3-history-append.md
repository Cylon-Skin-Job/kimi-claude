---
title: "Phase 3: HISTORY.md Append"
priority: medium
status: not-started
implements: 07-agent-chat-and-hooks
depends-on: impl-phase-1
---

# Phase 3: HISTORY.md Append

Runner appends a one-liner to the agent's HISTORY.md after each completed run.

## Current State

Runner completes → updates `manifest.json` with status/outcome → syncs to GitLab → done.

No record is written to the agent folder itself. The only way to see run history is to scan `runs/` directories.

## Target State

After each run, a one-liner is appended to `HISTORY.md`:

```markdown
## Recent (since last audit)
- **2026-03-24 14:32** — PROMPT_01: Updated Ticket-Sync. 2 sections changed. [run: 2026-03-24T14-30]
- **2026-03-24 09:02** — PROMPT_02: Freshness audit. 2 stale topics flagged. [run: 2026-03-24T09-00]

## Daily Summaries
(populated by nightly audit — Phase 4 cron trigger)
```

## Steps

### 1. Format the One-Liner
- [ ] Read manifest after run completes: timestamp, prompt used, ticket title, outcome
- [ ] Format: `- **YYYY-MM-DD HH:MM** — PROMPT_NN: {summary}. [run: {runId}]`
- [ ] Summary comes from ticket title (or manifest outcome if available)

### 2. Append to HISTORY.md
- [ ] Read current HISTORY.md
- [ ] Find `## Recent` section (or create if missing)
- [ ] Prepend new entry (newest first) under `## Recent`
- [ ] Write back

### 3. Handle Edge Cases
- [ ] HISTORY.md doesn't exist → create with sections
- [ ] Run failed → still append, mark with outcome: `[FAILED]`
- [ ] No `## Recent` header → add it

## Files Modified
- `kimi-ide-server/lib/runner/index.js` — append after run completion

## Verification
- [ ] Run completes → HISTORY.md has new entry
- [ ] Entry contains correct timestamp, prompt name, summary, run path
- [ ] Failed runs are also recorded
- [ ] Multiple runs append correctly (no overwrites)
