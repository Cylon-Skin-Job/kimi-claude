---
title: "Phase 6: Chat Integration (Fronting Persona)"
priority: medium
status: not-started
implements: 07-agent-chat-and-hooks
depends-on: impl-phase-2, impl-phase-4, impl-phase-5
---

# Phase 6: Chat Integration (Fronting Persona)

Agent workspaces get chat capability. The fronting persona loads PROMPT.md + MEMORY.md, manages blocks, introspects its own domain, and interacts with the user.

## Current State

**Thread system is mature.** ThreadManager, ChatFile, HistoryFile, ThreadIndex, ThreadWebSocketHandler — all working for the coding-agent workspace.

**Agent workspaces don't have chat.** `hasChat: false` (or not set) on background-agents workspace.

**No session invalidation** based on file mtime.

**No per-agent system context.** All sessions use generic AGENTS.md.

## Target State

Each managed agent workspace (wiki-manager, code-manager, ops-manager) has:
- `hasChat: true` in workspace.json
- Single chat thread (no multi-thread UI, no thread list)
- Session invalidation via MEMORY.md mtime
- System context from PROMPT.md + MEMORY.md (not generic AGENTS.md)
- Wake notifications from block expiry and run completion (Phase 5)

## Architecture Decision: SESSION.md + Container Scoping

Agents stay under `background-agents/System/`. Each agent gets a `SESSION.md` that defines its chat behavior. No separate workspace.json per agent — the session file is the config.

**SESSION.md** defines:
- `thread-model`: daily-rolling (one thread per day, auto-open today's)
- `session-invalidation`: memory-mtime (archive thread when MEMORY.md changes)
- `idle-timeout`: 9m
- `system-context`: ordered list of files to load into the wire `system` field

**Folder depth determines display mode** (from spec: `scope-and-chat-architecture.md`):
- Container depth (2 levels deep) → tile row, click to open panel

See `capture/specs/scope-and-chat-architecture.md` for the full taxonomy.

## Steps

### 1. SESSION.md Parser
- [ ] New module: `lib/session/session-loader.js`
- [ ] Parse SESSION.md frontmatter from any folder
- [ ] Read `system-context` array → resolve file paths relative to SESSION.md's folder
- [ ] Read and concatenate listed files into a single system context string
- [ ] Export: `loadSessionConfig(folderPath)` → `{ threadModel, invalidation, timeout, systemContext }`

### 2. Session Invalidation via MEMORY.md
- [ ] On `thread:open-agent` (new message type):
  - Parse SESSION.md for `session-invalidation: memory-mtime`
  - Stat MEMORY.md for mtime
  - Compare to last message timestamp in current daily thread
  - If MEMORY.md is newer: archive current thread to `threads/`, start fresh daily thread
  - If session still valid: reattach to today's thread
- [ ] Add to ThreadWebSocketHandler or as new handler in server.js

### 3. System Context via Wire Protocol
- [ ] On first prompt for an agent session, include `system` field:
  - Read files listed in SESSION.md `system-context` (PROMPT.md + MEMORY.md)
  - Concatenate into system context string
  - Send via wire: `{ system: systemContext, user_input: message }`
- [ ] Subsequent prompts in same session: `{ user_input: message }` (no system field — CLI retains it)
- [ ] Track per-session whether system context has been sent (boolean flag)

### 4. New Message Type: `thread:open-agent`
- [ ] Client sends: `{ type: 'thread:open-agent', agentPath: 'System/wiki-manager' }`
- [ ] Server resolves agent folder from `background-agents/{agentPath}`
- [ ] Creates ThreadManager scoped to that agent folder (finds `threads/` there)
- [ ] Opens daily thread (daily-rolling model)
- [ ] Spawns wire, holds system context for first prompt injection
- [ ] Sends thread history to client

### 5. Wake Notifications (from Phase 5)
- [ ] Block expiry → if persona session active, send message via wire
- [ ] Run completion → if persona session active, send message via wire
- [ ] Messages appear in chat as system/assistant messages
- [ ] If persona session is NOT active (tab closed), skip — persona catches up via HISTORY.md

### 6. Self-Awareness (Already Done)
- [ ] PROMPT.md already tells the persona about its own files
- [ ] The CLI's file access tools let it read/edit its own configuration
- [ ] No special API needed — loaded via system-context in SESSION.md

## Files to Create
- `kimi-ide-server/lib/session/session-loader.js` — SESSION.md parser + system context builder

## Files Modified
- `kimi-ide-server/server.js` — new `thread:open-agent` handler, system context injection on first prompt
- `kimi-ide-server/lib/thread/ThreadWebSocketHandler.js` — agent container ThreadManager support

## Open Questions
- [ ] Should wake notifications be queued if persona is inactive, or is HISTORY.md sufficient?
- [ ] Client UI for agent chat panel (deferred — needs tile row click handler)

## Verification
- [ ] Open agent tab → chat appears (single thread, no thread list)
- [ ] Type a message → persona responds with awareness of PROMPT.md
- [ ] Close tab → reopen → session reattaches (same thread)
- [ ] Edit MEMORY.md externally → reopen tab → fresh session (old thread archived)
- [ ] Trigger fires → run completes → persona tab shows notification (if open)
- [ ] Ask persona "what happened?" → it reads HISTORY.md and responds
- [ ] Ask persona "show me PROMPT_02" → it reads its own file and explains
