# Debug Audit - Hardcoded Values & Path References

**Created:** 2026-03-13
**Purpose:** Identify all hardcoded paths, file references, names, and function names that may cause mismatches

---

## 1. PATH REFERENCES

### 1.1 AI Workspaces Path (CRITICAL)

| File | Line | Current Value | Issue |
|------|------|---------------|-------|
| `kimi-ide-server/server-with-threads.js` | 71 | `path.join(__dirname, '..', 'ai', 'workspaces')` | ❌ Hardcoded relative to server, not project root |
| `kimi-ide-server/lib/thread/ThreadWebSocketHandler.js` | 30 | Uses `aiWorkspacesPath` param | ⚠️ Depends on caller |
| `kimi-ide-server/lib/thread/ThreadManager.js` | 25 | `path.join(workspacePath, 'threads')` | ✅ Correct - uses passed workspacePath |

### 1.2 Thread Storage Paths

| File | Line | Path Pattern | Notes |
|------|------|--------------|-------|
| `kimi-ide-server/lib/thread/ChatFile.js` | 32 | `path.join(threadDir, 'CHAT.md')` | ✅ Relative to threadDir |
| `kimi-ide-server/lib/thread/ThreadIndex.js` | 25 | `path.join(threadsDir, 'threads.json')` | ✅ Relative to threadsDir |
| `kimi-ide-server/lib/thread/ThreadManager.js` | 65 | `path.join(this.threadsDir, threadId)` | ✅ Relative to threadsDir |

### 1.3 Config/Log Files

| File | Line | Path | Issue |
|------|------|------|-------|
| `kimi-ide-server/server-with-threads.js` | 26 | `path.join(__dirname, 'wire-debug.log')` | ✅ Server-local is fine |
| `kimi-ide-server/server-with-threads.js` | 27 | `path.join(__dirname, 'server-live.log')` | ✅ Server-local is fine |

---

## 2. WORKSPACE ID MISMATCHES

### 2.1 Frontend Workspace IDs

| Location | Value | Usage |
|----------|-------|-------|
| `kimi-ide-client/src/state/workspaceStore.ts` | `'code'` | Default currentWorkspace |
| `kimi-ide-client/src/hooks/useFileTree.ts` | `'code'` | File tree requests |
| `kimi-ide-client/src/types/index.ts` | `WorkspaceId` type | `'code'`, `'rocket'`, etc. |

### 2.2 Backend Workspace IDs

| Location | Value | Issue |
|----------|-------|-------|
| `kimi-ide-server/server-with-threads.js:367` | `'coding-agent'` | ❌ CHANGED from `'code'` - mismatch! |
| Folder name | `ai/workspaces/coding-agent/` | Physical folder exists |
| Expected by frontend | `ai/workspaces/code/` | Frontend requests with `'code'` |

### 2.3 The Mismatch Problem

```
Frontend sends:  { type: 'set_workspace', workspace: 'code' }
Backend creates: ai/workspaces/coding-agent/threads/  ← WRONG
Should create:   ai/workspaces/code/threads/         ← CORRECT
```

**Root Cause:** The folder on disk is `coding-agent` but frontend uses `code`.

---

## 3. FUNCTION NAME REFERENCES

### 3.1 Thread Management Functions

| Function Name | Defined In | Used In | Notes |
|---------------|------------|---------|-------|
| `getThreadManager()` | `ThreadWebSocketHandler.js:28` | `ThreadWebSocketHandler.js:55` | Gets/creates ThreadManager |
| `setWorkspace()` | `ThreadWebSocketHandler.js:47` | `server-with-threads.js:367` | Sets up workspace for WS |
| `handleThreadCreate()` | `ThreadWebSocketHandler.js:126` | `server-with-threads.js:567` | Creates new thread |
| `handleThreadOpen()` | `ThreadWebSocketHandler.js:193` | `server-with-threads.js:582` | Opens existing thread |
| `sendThreadList()` | `ThreadWebSocketHandler.js:106` | `server-with-threads.js:620` | Sends thread list to client |

### 3.2 Project Root Functions

| Function Name | Defined In | Returns | Used For |
|---------------|------------|---------|----------|
| `getDefaultProjectRoot()` | `server-with-threads.js:77` | Project root path | Wire spawn, file tree |
| `getSessionRoot()` | `server-with-threads.js:92` | Session-specific root | File operations |

---

## 4. FILE NAME REFERENCES

### 4.1 Thread Storage Files

| Filename | Purpose | Location |
|----------|---------|----------|
| `CHAT.md` | Thread conversation content | `{threadDir}/CHAT.md` |
| `threads.json` | Thread index/metadata | `{threadsDir}/threads.json` |

### 4.2 Log Files

| Filename | Purpose |
|----------|---------|
| `wire-debug.log` | Wire protocol debugging |
| `server-live.log` | Server runtime logs |

---

## 5. MESSAGE TYPE STRINGS

### 5.1 Thread Messages (Client → Server)

| Message Type | Handler | Purpose |
|--------------|---------|---------|
| `'thread:create'` | `handleThreadCreate()` | Create new thread |
| `'thread:open'` | `handleThreadOpen()` | Open existing thread |
| `'thread:rename'` | `handleThreadRename()` | Rename thread |
| `'thread:delete'` | `handleThreadDelete()` | Delete thread |
| `'thread:list'` | `sendThreadList()` | Request thread list |

### 5.2 Thread Messages (Server → Client)

| Message Type | Sent From | Purpose |
|--------------|-----------|---------|
| `'thread:created'` | `handleThreadCreate()` | Confirm creation |
| `'thread:opened'` | `handleThreadOpen()` | Confirm open |
| `'thread:list'` | `sendThreadList()` | Thread list data |
| `'thread:renamed'` | `handleThreadRename()` | Confirm rename |
| `'thread:deleted'` | `handleThreadDelete()` | Confirm delete |

---

## 6. HARDCODED DEFAULT VALUES

### 6.1 Thread Defaults

| Value | Location | Meaning |
|-------|----------|---------|
| `'New Chat'` | `ThreadManager.js:60`, `ThreadWebSocketHandler.js:135` | Default thread name |
| `'suspended'` | Thread entry status | Thread not active |
| `'active'` | Thread entry status | Thread has active wire |

### 6.2 Config Defaults

| Value | Location | Purpose |
|-------|----------|---------|
| `maxActiveSessions: 10` | `ThreadManager.js:14` | Max concurrent threads |
| `idleTimeoutMinutes: 9` | `ThreadManager.js:15` | Timeout for inactive threads |

---

## 7. IDENTIFIED BUGS - STATUS

### Bug #1: AI_WORKSPACES_PATH Hardcoded ✅ FIXED

**Location:** `kimi-ide-server/server-with-threads.js`

**Problem:** Used `__dirname` (server location), not project root.

**Fix Applied:**
```javascript
const AI_WORKSPACES_PATH = path.join(getDefaultProjectRoot(), 'ai', 'workspaces');
```

**Verification:** Server log shows correct path:
```
[Server] AI workspaces path: /Users/rccurtrightjr./projects/kimi-claude/ai/workspaces
```

### Bug #2: Workspace ID Mismatch ✅ FIXED

**Location:** `kimi-ide-server/server-with-threads.js`

**Problem:** Backend used `'coding-agent'` but frontend uses `'code'`.

**Fix Applied:** Changed to use `'code'` to match frontend:
```javascript
ThreadWebSocketHandler.setWorkspace(ws, 'code', AI_WORKSPACES_PATH);
```

**Result:** Thread folder created at `ai/workspaces/code/threads/`

### Bug #3: Temporal Dead Zone ✅ FIXED

**Problem:** `AI_WORKSPACES_PATH` called `getDefaultProjectRoot()` before it was defined.

**Fix Applied:** Moved `getDefaultProjectRoot()` function definition before `AI_WORKSPACES_PATH`.

---

## 8. VERIFICATION RESULTS

| Check | Status | Evidence |
|-------|--------|----------|
| AI_WORKSPACES_PATH uses project root | ✅ | Log shows `/Users/rccurtrightjr./projects/kimi-claude/ai/workspaces` |
| Frontend `'code'` matches backend | ✅ | Server uses `'code'` workspace |
| Thread folder created | ✅ | `ai/workspaces/code/threads/{uuid}/` exists |
| CHAT.md created | ✅ | File exists with `# New Chat` content |
| threads.json updated | ✅ | Index contains thread metadata |

---

## 9. REMAINING WORK

- [ ] Send a message in the thread and verify it appends to CHAT.md
- [ ] Verify thread list loads from disk on page refresh
- [ ] Test with multiple threads
- [ ] Rename thread functionality
- [ ] Delete thread functionality

---

## 8. VERIFICATION CHECKLIST

- [ ] `AI_WORKSPACES_PATH` uses `getDefaultProjectRoot()`
- [ ] Frontend `'code'` matches backend workspace ID
- [ ] Physical folder name matches workspace ID
- [ ] Thread creation creates folder at correct path
- [ ] Thread files (CHAT.md, threads.json) write successfully
- [ ] Thread list reads from correct location

---

## 9. TESTING PROCEDURE

1. Clear all test threads: `rm -rf ai/workspaces/*/threads/*`
2. Click "New Thread" button
3. Verify folder created: `ls ai/workspaces/{workspace}/threads/`
4. Verify CHAT.md exists: `ls ai/workspaces/{workspace}/threads/{id}/`
5. Verify threads.json updated: `cat ai/workspaces/{workspace}/threads/threads.json`
6. Refresh page - verify threads load from disk

---

*Last Updated: 2026-03-13*
