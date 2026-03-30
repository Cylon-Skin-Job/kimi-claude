# Active Bug Report

## Bug 1: File System Doesn't Auto-Refresh on New Thread

**Status:** FIXED ✓  
**Priority:** Medium

### Description
When creating a new thread, a new folder and CHAT.md file are created in `ai/workspaces/coding-agent/threads/{threadId}/`. However, the file explorer does not show the new folder/file until the user manually refreshes the browser.

### Root Cause
The client was not refreshing the file tree after receiving `thread:created`. The file tree only loaded on initial WebSocket connect.

### Fix
Added `loadRootTree()` call in `useWebSocket.ts` after `thread:created` is received:

```typescript
case 'thread:created':
  // ... add thread to store ...
  loadRootTree();  // Added: Refresh file explorer
  break;
```

### Files Modified
- `kimi-ide-client/src/hooks/useWebSocket.ts`

---

*Add new bugs below this line*

---

*Add new bugs below this line*
