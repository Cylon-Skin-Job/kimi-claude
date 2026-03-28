# AI Workspace Thread Management Specification

## 1. Overview

This specification defines the thread management system for the AI workspace, enabling persistent, named conversations with lifecycle management (active → grace period → suspended → archived).

## 2. Directory Structure

```
{project-root}/
└── ai/
    ├── README.md                 # User-facing documentation
    ├── SPEC.md                   # This document
    ├── AGENTS.md                 # Agent behavior for thread paths
    └── workspaces/
        └── {workspace-id}/
            ├── workspace.json    # Workspace configuration
            └── threads/          # Persistent thread storage
                ├── threads.json  # Thread metadata index (id → metadata)
                └── {id}/         # Thread folder (UUID = Kimi session ID)
                    └── CHAT.md   # Conversation content only
```

**Note:** Session state is managed by Kimi CLI in `~/.kimi/sessions/{thread-id}/`. No local session storage needed.

## 3. Thread Index (threads.json)

**Purpose:** Lightweight source of truth for thread list.

**Location:** `ai/workspaces/{workspace}/threads/threads.json`

**Schema:**
```typescript
interface ThreadIndex {
  version: string;           // "1.0"
  threads: {                 // Dictionary keyed by thread ID (Kimi session ID)
    // MRU order: most recent thread = first key in object
    [id: string]: ThreadEntry;
  };
}

interface ThreadEntry {
  name: string;              // Human-readable display name (e.g., "New Chat")
  createdAt: string;         // ISO 8601 - when thread was created
  resumedAt?: string;        // ISO 8601 - last time session was resumed (if ever)
  messageCount: number;
  status: "active" | "suspended";
  // Note: Thread ID (Kimi session ID) is the dictionary key, not stored here
}
```

**Example:**
```json
{
  "version": "1.0",
  "threads": {
    "769d776f-88f6-421a-9326-cc97d6a2a604": {
      "name": "New Chat",
      "createdAt": "2026-03-12T17:54:49-07:00",
      "messageCount": 2,
      "status": "active"
    },
    "554f3782-8dc2-4cd5-082e-eb9f2852d7b9": {
      "name": "Server session disconnect issue",
      "createdAt": "2026-03-12T17:00:00-07:00",
      "resumedAt": "2026-03-12T17:30:00-07:00",
      "messageCount": 47,
      "status": "suspended"
    }
  }
}
```

**Note:** No `updatedAt` field - MRU order is implicit in the JSON object key order (JavaScript preserves insertion order for string keys).

## 4. Thread Folder Structure

**Location:** `ai/workspaces/{workspace}/threads/{id}/`

**Contents:**
- `CHAT.md` - **Pure conversation content** - No metadata, just the chat history in Markdown

**Design Note:** The folder is named by the Kimi session ID (e.g., `769d776f-88f6-421a-9326-cc97d6a2a604/`). All metadata (name, timestamps, status) lives in `threads.json`. The `CHAT.md` file contains only the conversation content—nothing else.

### 4.2 AGENTS.md (Agent Instructions)

**Purpose:** Defines agent behavior when a thread file path is provided as the first input.

**Location:** `ai/workspaces/{workspace}/AGENTS.md` (workspace level, not per-thread)

**Function:** When an agent receives a file path (e.g., `/path/to/project/ai/workspaces/coding-agent/threads/server-session/readme.md`) as the first message, this document instructs the agent:

1. **Recognize the context** - "This is a prior conversation thread"
2. **Offer to fork** - Ask user: "This appears to be a previous conversation about [topic]. Would you like to continue from this context or start fresh?"
3. **Load context if accepted** - Read the README.md and acknowledge the prior state

**Example AGENTS.md content:**
```markdown
# Thread Folder Agent Instructions

## When Given a Thread File Path

If the first message from the user is a file path pointing to a location within 
`ai/workspaces/*/threads/*/`, you are being handed a prior conversation thread.

### Detection Pattern
- Path contains `/threads/` 
- Path ends in `README.md`, `meta.json`, or folder name

### Required Behavior

1. **Acknowledge the fork**
   - Read the README.md to understand the conversation
   - Extract the thread title and message count
   - Present to user: "This appears to be a previous conversation about [TITLE] 
     with [N] messages. Would you like to continue from this context?"

2. **Offer options:**
   - "Continue conversation" - Load full context and resume
   - "Start fresh but reference this" - New thread with summary as context
   - "Start completely fresh" - Ignore, begin new conversation

3. **If continuing:**
   - Acknowledge the prior state
   - Wait for user direction on next steps
   - Do NOT automatically execute prior pending tasks
```

**Rationale:** Users may drag-and-drop or paste thread paths. The agent needs explicit instructions to recognize this pattern and behave appropriately (offer to fork, not blindly execute).

### 4.1 CHAT.md (Conversation Content)

**Purpose:** Pure conversation content. No metadata, no timestamps—everything lives in `threads.json`.

**Format:** Markdown with User/Assistant sections and tool call indicators.

```markdown
# Server session disconnect issue

User
Can you start my kimi-claude server

Assistant
I'll help you start the server.

**TOOL CALL(S)**

Assistant
Your server is running on http://localhost:3001
```

**Note:** The title (`# Server session...`) is derived from `threads.json` name field, included for readability when viewing the file directly. The folder name is the UUID, not the slug.

**Format Rules:**
1. Title = thread name from threads.json (for human readability)
2. `User` on its own line starts user message
3. `Assistant` on its own line starts assistant message
4. `**TOOL CALL(S)**` indicates tool calls were made (results redacted)
5. No timestamps in file (timestamps live in threads.json index)
6. No message IDs (order is implicit in file sequence)

**Features:**
- Editable by users directly
- Git-diffable
- Can be copied/pasted into new threads as context
- Folder never needs renaming (UUID is stable)

## 5. Slug Generation

**Algorithm:**
1. Normalize name to lowercase
2. Replace spaces with hyphens
3. Remove characters except: `a-z`, `0-9`, `-`
4. Collapse multiple hyphens: `---` → `-`
5. Trim hyphens from ends
6. Truncate to 50 characters
7. If collision exists, append `-2`, `-3`, etc.

**Examples:**
| Input | Slug |
|-------|------|
| "Server session disconnect issue" | `server-session-disconnect-issue` |
| "Implementing the Pipeline System!!!" | `implementing-the-pipeline-system` |
| "API Design: Auth & OAuth2" | `api-design-auth-oauth2` |
| "A very long thread name that exceeds fifty characters limit" | `a-very-long-thread-name-that-exceeds-fifty-char` |

## 6. Thread Lifecycle

### 6.1 Creation Flow

```
User sends first message
    ↓
Generate thread ID (Kimi CLI Session ID)
Create folder: threads/{id}/
Create CHAT.md with first message
Create threads.json entry: {id: {name: "New Chat", ...}}
Spawn wire process
    ↓
[After 2nd message sent]
Fire async summarization request
    ↓
On summary received:
    Update threads.json name field
    Update CHAT.md title (optional)
    // Folder name NEVER changes (UUID is stable)
```

### 6.2 Auto-Naming Trigger

**Condition:** After 2nd message (first assistant response).

**Process:**
1. Send summarization request to cheap/fast model
2. Prompt: "Summarize this conversation in 5 words or less for a thread title. Return ONLY the title, no quotes."
3. Timeout: 10 seconds (if timeout, keep placeholder)
4. On success: Update threads.json name field, update CHAT.md title

### 6.3 Session States

| State | Description | Transition Triggers |
|-------|-------------|---------------------|
| **Active** | WebSocket connected, wire process alive | → Grace Period on 9min idle timeout |
| **Grace Period** | Process still alive, counting down | → Active on user activity<br>→ Suspended after 9min timeout |
| **Suspended** | Process killed, session preserved in `~/.kimi/sessions/{id}/` | → Active on thread click (reconnect with `--session`) |

**Session Management via Kimi CLI:**
- **Spawn**: `kimi --wire --session {thread-id}`
- **Kill**: SIGTERM after 9min idle (graceful disconnect)
- **Resume**: `kimi --wire --session {thread-id}` (reconnects to same session)
- **FIFO Eviction**: Max 10 active sessions, oldest killed when 11th created

Session data persists in `~/.kimi/sessions/{thread-id}/` even when process killed.

### 6.4 Suspended → Active (Resume)

When user clicks a suspended thread:

1. Spawn wire process with `kimi --wire --session {thread-id}`
2. Kimi CLI automatically restores session from `~/.kimi/sessions/{thread-id}/`
3. Update status to "active" in threads.json

**Alternative: Manual Feed Mode**
If session cannot be resumed (e.g., different machine, session expired):
1. Read CHAT.md content
2. User can paste into new thread, or
3. Feed file path to subagent (triggered by AGENTS.md detection)

## 7. Session Management

### 7.1 Resource Caps

| Resource | Default | Configurable | Notes |
|----------|---------|--------------|-------|
| Max active sessions | 10 | `maxActiveSessions` | FIFO eviction when exceeded |
| Idle timeout | 9 minutes | `idleTimeoutMinutes` | Kimi CLI session timeout |
| Max threads per workspace | Unlimited | - | Suspended threads have no limit |

### 7.2 MRU Ordering & Eviction

**Display Order:** Threads object keys are ordered by **Most Recently Used** (MRU).
- First key = Most recent
- On message send: Re-insert thread as first key
- On thread open: Re-insert thread as first key

**Note:** JavaScript/TypeScript preserves string key insertion order. When updating MRU, delete and re-add the key to move it to front.

**Eviction:** When max active sessions reached and new thread opened:
1. Find least-recently-used active thread (lowest index in active threads)
2. Move to suspended state
3. Spawn new session for requested thread

## 8. API Interface

### 8.1 ThreadManager (Server-side)

```typescript
class ThreadManager {
  // Lifecycle
  create(workspaceId: string, name?: string): Thread;
  rename(threadId: string, newName: string): void;
  delete(threadId: string): void;
  
  // State transitions
  activate(threadId: string): Session;
  suspend(threadId: string): void;
  archive(threadId: string): void;
  
  // Queries
  list(): ThreadEntry[];
  get(threadId: string): Thread;
  // Note: No slug lookup - folders are UUIDs, lookup by ID only
  
  // Session management
  attachSession(threadId: string, ws: WebSocket): Session;
  detachSession(sessionId: string, gracePeriod?: number): void;
  
  // Persistence
  saveMessage(threadId: string, message: Message): void;
  loadHistory(threadId: string): Message[];
  generateSummary(threadId: string): Promise<string>;
}
```

### 8.2 WebSocket Protocol

**Client → Server:**
```json
{"type": "thread:create", "name": "Optional initial name"}
{"type": "thread:open", "threadId": "..."}
{"type": "thread:rename", "threadId": "...", "name": "New name"}
{"type": "thread:delete", "threadId": "..."}
{"type": "message:send", "threadId": "...", "content": "..."}
```

**Server → Client:**
```json
{"type": "thread:list", "threads": [...]}
{"type": "thread:created", "thread": {...}}
{"type": "thread:renamed", "threadId": "...", "name": "..."}
{"type": "message:stream", "threadId": "...", "delta": "..."}
```

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| threads.json missing | Rebuild from folder structure |
| threads.json corrupt | Rebuild from folder structure, log error |
| Folder missing but in index | Remove from index, log warning |
| Slug collision on rename | Append `-2`, `-3`, etc. |
| Summarization timeout | Keep placeholder name, retry on next message |
| Grace period reconnect fails | Create new session (edge case) |

## 10. Recovery Procedures

### 10.1 Rebuild Index

```bash
# Manual rebuild command (future)
kimi-cli thread rebuild-index --workspace coding-agent
```

**Algorithm:**
1. Scan `threads/` for folders (UUID names)
2. Parse CHAT.md to extract message count, timestamps
3. Reconstruct threads.json with placeholder names
4. Set all statuses to "suspended"

### 10.2 Session Cleanup

On server startup:
1. Mark all threads with `status: "active"` → `"suspended"` in threads.json
2. Orphaned Kimi CLI processes are cleaned up by the CLI itself (9min timeout)

## 11. Future Enhancements

- [ ] Thread search (full-text on messages.jsonl)
- [ ] Thread tags/categories
- [ ] Thread sharing (export/import)
- [ ] Collaborative threads (multi-user)
- [ ] Branching conversations
- [ ] Thread templates

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-12 | Initial specification |

---

## 13. Open Questions & Undiscussed Design Decisions

*This section documents assumptions made in the spec that require explicit agreement before implementation. Add resolved items to the discussions log below.*

### A. Identity & Naming

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 1 | **Thread ID format**: ~~UUID v4, ULID, short hash, or timestamp-based?~~ **DECIDED: Use Kimi CLI Session ID** | ✅ Resolved | Thread ID = Kimi session ID (e.g., `769d776f-88f6-421a-9326-cc97d6a2a604`) |
| 2 | **Placeholder naming format**: ~~`new-thread-{timestamp}`~~ **DECIDED: "New Chat"** | ✅ Resolved | Simple, clear, auto-renamed after 2nd message anyway. |
| 3 | **~~Slug length limit~~** | ✅ N/A | Removed - folders use UUID, no slug generation needed |
| 4 | **~~Collision handling~~** | ✅ N/A | Removed - UUID folders are unique by design |

### B. Storage Format

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 5 | **Message storage format**: ~~JSON Lines (.jsonl) vs SQLite vs one-file-per-message?~~ **DECIDED: Markdown (CHAT.md)** | ✅ Resolved | Clean format: User/Assistant labels, **TOOL CALL(S)** indicator, no metadata. See section 5. |
| 6 | **Redundant storage**: Is duplication (meta.json + threads.json) acceptable? | ⏳ Open | meta.json exists for recovery |
| 7 | **Message ID format**: ~~Sequential `msg-001` vs UUID?~~ **DECIDED: Not stored in file** | ✅ Resolved | Order is implicit in file sequence. |
| 8 | **Timestamp precision**: ~~ISO 8601 with timezone~~ **DECIDED: Not stored in file** | ✅ Resolved | Timestamps live only in `threads.json` index. |

### C. Context & Summarization

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 9 | **Summarization word count**: ~~5 words max?~~ **DECIDED: 5 words** | ✅ Resolved | Hard constraint: "Summarize in 5 words or less." |
| 10 | **Summarization model**: ~~Same vs cheaper/faster?~~ **DECIDED: `kimi --print --no-thinking`** | ✅ Resolved | Fast, cheap, no streaming overhead. Timeout: 10s. |
| 11 | **Warmup threshold**: ~~>50 messages triggers summary~~ **DECIDED: N/A** | ✅ Resolved | Resume from session ID, or user feeds markdown file to subagent for digestion. |
| 12 | **Warmup message format**: ~~Is the drafted system message acceptable?~~ **DECIDED: N/A** | ✅ Resolved | User drags markdown file, subagent summarizes and asks what to continue. |
| 13 | **Context extraction**: ~~Build `keyDecisions`, `filesReferenced`, `currentTask` now or later?~~ **DECIDED: Subagent on resume** | ✅ Resolved | Subagent digests markdown when user feeds file path. |

### D. Lifecycle & Resource Management

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 14 | **Deletion behavior**: ~~Hard delete or trash folder first?~~ **DECIDED: Hard delete** | ✅ Resolved | Match Kimi CLI behavior. |
| 15 | **Auto-archive**: ~~30 days idle → Archived~~ **DECIDED: None** | ✅ Resolved | Match Kimi CLI - sessions persist forever until deleted. |
| 16 | **Max active sessions**: ~~Unlimited~~ **DECIDED: 10 active, unlimited suspended** | ✅ Resolved | FIFO eviction at 10 active sessions. Unlimited threads overall (match CLI). |

### E. Session Model

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 17 | **WebSocket-to-Thread mapping**: ~~One WS = One Thread?~~ **DECIDED: One WS per tab, can switch** | ✅ Resolved | State managed within socket. User can switch threads without reconnecting. |
| 18 | **Multiple tabs**: ~~Can user have multiple threads open?~~ **DECIDED: Yes** | ✅ Resolved | Each tab = independent WebSocket + wire process. No cross-tab sync. |

### F. Architectural Implementation

| # | Question | Status | Notes |
|---|----------|--------|-------|
| 19 | **Grace period**: ~~How track across restarts?~~ **DECIDED: 9min timeout** | ✅ Resolved | Kimi CLI `--session` handles persistence. 9min idle → process killed, session folder preserved. |
| 20 | **LRU definition**: ~~"Last Active" vs "Last Accessed"?~~ **DECIDED: FIFO at 10 active** | ✅ Resolved | Sending message = move to top. FIFO eviction when >10 active sessions. |
| 21 | **Checkpoint system**: ~~v1 or defer?~~ **DECIDED: Defer** | ✅ Resolved | Not needed - Kimi CLI session persistence handles this. |

### Discussion Log

| Date | Item # | Decision | Rationale |
|------|--------|----------|-----------|
| 2026-03-12 | - | Initial spec created | - |
| 2026-03-12 | 1 | **Use Kimi CLI Session ID as Thread ID** | Simplifies mapping, same ID across system. Order stored in JSON array (MRU). |
| 2026-03-12 | - | **Storage format: Markdown (CHAT.md)** | Human-readable, editable, git-diffable. No timestamps/IDs in file. |
| 2026-03-12 | 2 | **Simplified structure: ID folders, JSON metadata** | Folder = UUID, CHAT.md = content only, threads.json = all metadata. No slug, no meta.json. |
| 2026-03-12 | - | **Session lifecycle: 9min timeout, FIFO eviction** | Match Kimi CLI behavior. Max 10 active sessions. |
| 2026-03-12 | - | **Placeholder name: "New Chat"** | Simple, auto-renamed after first response. |
| 2026-03-12 | - | **Summarization: `kimi --print --no-thinking`** | Fast, cheap, 5-word titles. |
