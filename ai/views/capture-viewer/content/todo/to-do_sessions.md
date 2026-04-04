# SESSION.md Ideas — Running List

Capturing ideas for SESSION.md files as they come up in conversation. Each entry is a potential SESSION.md that needs to be created, scoped, and placed in the right `settings/` folder.

---

## Chat Auto-Rename Session

- **Location:** `ai/views/{view}/chat/settings/SESSION.md` (or a dedicated rename workflow folder)
- **Purpose:** Fires once on the first message of a new thread. AI generates a 5-word summary, renames the thread.
- **Permissions:** Write restricted to renaming one specific markdown file. No other writes allowed.
- **Trigger:** First assistant response in a new thread (message count hits 2)
- **Current state:** Hardcoded in ThreadManager.autoRename() — spawns `kimi --print` subprocess. Needs to be extracted into trigger + scoped session.

## Rename Collision Check Session

- **Location:** `ai/views/{view}/chat/settings/SESSION.md` (shared with rename trigger)
- **Purpose:** When a thread markdown file is renamed, check siblings in the same `threads/{username}/` folder for filename collisions.
- **Permissions:** Read sibling filenames, write only to append short hash suffix to the colliding file.
- **Action:** If `fix-bug.md` already exists, rename to `fix-bug-a1b2.md` using short hash from `thread_id` in frontmatter.
- **Current state:** Not implemented. Collision is currently unhandled.

## PROMPT.md / SESSION.md Deploy Session

- **Location:** `ai/views/{view}/chat/settings/SESSION.md`
- **Purpose:** Scopes the drag-to-deploy modal workflow. AI drops config files in parent folder, trigger fires modal.
- **Permissions:** Read-only. The modal and file move are handled by the server, not the AI.
- **Current state:** Trigger blocks exist in `ai/components/system/TRIGGERS.md`. Session scoping not yet applied.

---

## Ideas to Capture (add as they come up)

- Per-view SESSION.md that defines thread-model (daily-rolling, multi-thread, single-persistent)
- CLI profile resolution — SESSION.md `profile` field resolves to spawn arguments
- Tool permission scoping — allowed/restricted/denied tool lists per session
- DB access scoping — which tables/queries the agent can use
