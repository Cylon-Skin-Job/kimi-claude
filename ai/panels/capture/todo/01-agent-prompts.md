---
title: "Write Agent Prompts & Identity Files"
priority: critical
status: not-started
blocks: everything else — agents can't run without prompts
---

# Write Agent Prompts & Identity Files

The entire pipeline (runner, dispatch, sync, watcher) is built. No agents have real prompts yet. This unblocks everything.

## Final Agent Folder Convention

```
agents/wiki-manager/
├── IDENTITY.md         ← who you are (persona, scope, points to wiki for standards)
├── MEMORY.md           ← what you remember about the user (relationship, preferences)
├── HISTORY.md          ← what happened (run summaries, condensed nightly)
├── LESSONS.md          ← what you've learned about your work (process improvements)
├── TRIGGERS.md         ← when you wake up (declarative trigger → prompt binding)
├── PROMPT_01.md        ← wiki updater (source changes → page updates)
├── PROMPT_02.md        ← wiki auditor (freshness, staleness)
├── PROMPT_03.md        ← edge checker (propagation, consistency)
├── threads/            ← archived past conversations
└── runs/               ← full run evidence
```

### File Roles

| File | Answers | Changes when | Session role |
|------|---------|-------------|-------------|
| IDENTITY.md | "Who are you?" | Rarely — persona/scope changes | System context for fronting chat |
| MEMORY.md | "What do you remember about me?" | User interaction (preferences, instructions) | Loaded on session start; mtime triggers new session |
| HISTORY.md | "What have you done?" | Every run (one-liner appended); condensed nightly | Read on demand (progressive disclosure to runs/) |
| LESSONS.md | "What have you learned about your work?" | Agent discovers better approach | Read by runner prompts; informs future execution |
| TRIGGERS.md | "When do you activate?" | User/assistant adjusts triggers | Read by watcher/cron system |
| PROMPT_NN.md | "How do you do this specific job?" | Refined over time based on lessons/wiki standards | System context for runner sessions |

### Execution Model

- **Triggers create tickets directly** — no fronting persona in the execution loop
- **Runner loads PROMPT_NN.md** — specified in trigger's `prompt` field, recorded on ticket
- **Fronting persona is a block manager** — it never executes runs. It sets, removes, and bypasses blocks.
- **Auto-block on new tickets** — each new ticket gets a block with a 9-min cron timeout. Same-type tickets pile up, resetting the cron each time (+9 min debounce).
- **Persona wakes on two signals** — block expiry (cron) and run completion (notification). On wake, it checks state, decides: remove block, bypass stale tickets, or reset the cron.
- **Persona is self-aware** — it can introspect its own IDENTITY.md, PROMPT_NN files, TRIGGERS.md, LESSONS.md, runs/. It uses agentic tools to investigate its own domain when the user asks questions.
- **Everything is a trigger + prompt** — no special cases. Self-reflection, drift detection, prompt editing, records maintenance — all expressed as trigger blocks pointing to prompt files.
- **IDENTITY.md points to wiki** — the wiki holds the *standard* for how work should be done; prompts are the *execution* of that standard

## Tasks

### Wiki Manager (agents/wiki-manager/)
- [ ] Rename wiki-updater folder → wiki-manager
- [ ] Rename prompt.md → PROMPT_01.md (wiki updater)
- [ ] Absorb wiki-auditor prompt.md → PROMPT_02.md (wiki auditor)
- [ ] Write PROMPT_03.md — edge checker
- [ ] Write IDENTITY.md — persona, scope, lifecycle, points to Wiki-Editing-Standards wiki page
- [ ] Write TRIGGERS.md — bind file-change and cron triggers to specific PROMPT files
- [ ] Create MEMORY.md (empty — populated through user interaction)
- [ ] Create HISTORY.md (empty — populated by runner after each run)
- [ ] Create threads/ and runs/ directories
- [ ] Update registry.json: kimi-wiki → agents/wiki-manager
- [ ] Create Wiki-Editing-Standards wiki page — the living standard for how wiki updates should be done

### Code Manager (agents/code-manager/)
- [ ] Consolidate bug-fixer, code-reviewer, test-writer into single folder
- [ ] Rename/write PROMPT_01.md — bug fixer
- [ ] Rename/write PROMPT_02.md — code reviewer
- [ ] Rename/write PROMPT_03.md — test writer
- [ ] Write IDENTITY.md
- [ ] Write TRIGGERS.md
- [ ] Create MEMORY.md, HISTORY.md, threads/, runs/
- [ ] Update registry.json: kimi-code → agents/code-manager

### Ops Manager (agents/ops-manager/)
- [ ] Consolidate dependency-auditor, doc-generator into single folder
- [ ] Rename/write PROMPT_01.md — dependency auditor
- [ ] Rename/write PROMPT_02.md — doc generator
- [ ] Write IDENTITY.md
- [ ] Write TRIGGERS.md
- [ ] Create MEMORY.md, HISTORY.md, threads/, runs/
- [ ] Update registry.json

### Cleanup
- [ ] Remove old single-agent folders (bug-fixer, code-reviewer, test-writer, dependency-auditor, doc-generator, wiki-auditor)
- [ ] Rename AGENTS.md at workspace root to reflect new structure
- [ ] Populate bot_accounts in sync.json with GitLab user IDs

### End-to-End Verification
- [ ] Create a test ticket assigned to kimi-wiki with prompt: PROMPT_01.md
- [ ] Verify: trigger fires → ticket created with prompt field → runner loads correct PROMPT → evidence in runs/ → one-liner appended to HISTORY.md → ticket closes
- [ ] Verify: open wiki-manager tab → loads IDENTITY.md + MEMORY.md → ask "what happened?" → reads HISTORY.md → drills into runs/ if needed

## Why This Is First

Every other task produces value only after an agent can run. The runner, watcher, sync, blocking — all infrastructure. This is the payload.
