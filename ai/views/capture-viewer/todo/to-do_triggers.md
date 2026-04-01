# TRIGGERS.md Ideas — Running List

Capturing ideas for trigger blocks as they come up in conversation. Each entry is a potential trigger that needs to be written, placed in the right TRIGGERS.md, and tested.

---

## Chat-Scoped Triggers (live in `ai/views/{view}/chat/settings/TRIGGERS.md`)

### prompt-deploy-modal
- **Match:** `**/chat/PROMPT.md` created
- **Exclude:** `**/settings/**`, `**/archive/**`
- **Action:** show-modal (drag_file)
- **Current state:** Defined in `ai/components/system/TRIGGERS.md`. May move to per-chat TRIGGERS.md.

### session-deploy-modal
- **Match:** `**/chat/SESSION.md` created
- **Exclude:** `**/settings/**`, `**/archive/**`
- **Action:** show-modal (drag_file)
- **Current state:** Defined in `ai/components/system/TRIGGERS.md`. May move to per-chat TRIGGERS.md.

### rename-collision-check
- **Match:** File rename in `**/threads/*/`
- **Action:** Diff new filename against siblings. If collision, append short hash from `thread_id` frontmatter (e.g., `fix-bug.md` → `fix-bug-a1b2.md`).
- **Current state:** Not implemented. No collision handling exists.

### thread-auto-rename
- **Match:** First assistant response in a new thread (message count == 2, name == "New Chat")
- **Action:** Fire scoped AI session to generate 5-word summary, rename thread + markdown file.
- **Current state:** Hardcoded in ThreadManager.autoRename(). Needs extraction to trigger + session.

---

## System-Level Triggers (live in `ai/components/system/TRIGGERS.md`)

### triggers-hot-reload
- **Match:** `**/TRIGGERS.md` changed
- **Action:** Re-scan and re-register all triggers without server restart.
- **Current state:** Discussed in plan. Not implemented. Bootstrap scan happens in code at startup; hot-reload would be trigger-driven after that.

---

## Ideas to Capture (add as they come up)

- No-code panel/view creation: folder creation in `ai/views/` triggers scaffolding modal
- Chat type selection: `chat/` folder created → modal asks rolling vs threaded vs persistent
- MEMORY.md nightly rollover: daily-rolling day transition triggers memory summarization
- Settings change notification: file changed in any `settings/` folder → notify Robin
