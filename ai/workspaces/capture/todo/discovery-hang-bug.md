---
title: "Workspace discovery hangs — app stuck on 'Discovering workspaces...'"
type: bug
priority: critical
status: open
created: 2026-03-26
relates-to: workspace-loading-bug, WORKSPACE_PLUGIN_ARCHITECTURE
---

# Workspace Discovery Hangs

## Symptom

App loads, shows "Discovering workspaces..." and never progresses. No workspace icons appear in the tab bar, no content renders.

## Timeline — What Worked and What Broke

### Before this session
- Hard-coded `WORKSPACE_CONFIGS` and `WorkspaceId` union type
- All workspaces except Wiki/Issues/Agents rendered (those had the `loadedRef` bug)

### Phase 0-2 changes (worked for a while)
- Replaced `WORKSPACE_CONFIGS` with dynamic discovery via `loadAllWorkspaces()`
- Discovery called from `socket.onopen` in useWebSocket.ts
- **All workspaces loaded EXCEPT coding-agent** (which was missing from the tab bar)

### The coding-agent fix (when things broke)
- **Root cause of missing coding-agent**: `getWorkspacePath('coding-agent')` in server.js returns the PROJECT ROOT, not `ai/workspaces/coding-agent/`. So `fetchWorkspaceFile(ws, 'coding-agent', 'workspace.json')` looked for workspace.json in the project root — doesn't exist — config returns null — coding-agent filtered out.
- **Fix applied**: Changed `loadWorkspaceConfig` to use `fetchWorkspaceFile(ws, '__workspaces__', `${workspaceId}/workspace.json`)` so the server always resolves to `ai/workspaces/{id}/workspace.json`
- **Also changed `hasUiFolder` check** to use `__workspaces__` path
- **This fix was verified working** from Node.js WebSocket test — all 9 workspace configs load, coding-agent included

### The unnecessary move (made things worse)
- Moved `loadAllWorkspaces()` call from `socket.onopen` to App.tsx `useEffect([ws])`
- This broke discovery for ALL workspaces (timing issue — discovery promises hung)
- **Reverted** back to `socket.onopen`
- But the app still shows "Discovering workspaces..."

## Current State of Code

### Discovery flow
1. `useWebSocket.ts` line 130: `socket.onopen` fires
2. Line 138: `loadAllWorkspaces(socket)` called
3. `discoverWorkspaces()` sends `file_tree_request` to `__workspaces__`, listens via `addEventListener`
4. Server responds with 9 workspace folders
5. For each folder: `loadWorkspaceConfig()` sends `file_content_request` to `__workspaces__/{id}/workspace.json`
6. Also sends `file_content_request` to `__workspaces__/{id}/ui/module.js` for `hasUiFolder` check
7. That's **1 + 9 + 9 = 19 WebSocket requests** fired in rapid succession

### The `fetchWorkspaceFile` pattern
Each call does:
```js
ws.addEventListener('message', handler)  // handler filters on workspace + path
ws.send(JSON.stringify({...}))
setTimeout(() => { ws.removeEventListener(handler); reject(...) }, 5000)
```

### Store state
- `workspaceConfigs` starts as `[]`
- `workspaces` starts as `{}`
- App.tsx renders "Discovering workspaces..." when `configs.length === 0`
- `setWorkspaceConfigs(configs)` called only when discovery resolves

## Theories (ranked by likelihood)

### 1. Multiple concurrent `addEventListener` handlers on `__workspaces__` interfere
All 18 `fetchWorkspaceFile` calls (9 workspace.json + 9 ui/module.js) use `workspace: '__workspaces__'`. Each registers an `addEventListener('message', handler)` that filters on `msg.workspace === '__workspaces__' && msg.path === filePath`. The path filtering SHOULD differentiate them, but:
- If the server batches or reorders responses, a handler might miss its response
- If any handler throws, it could affect subsequent handlers in the same event
- The `catch {}` inside each handler silently swallows errors

**Test**: Verified working from Node.js `ws` library — all 18 responses arrive correctly. But browser WebSocket behavior may differ (event loop, microtask timing).

### 2. `handleMessage` in `socket.onmessage` interferes with `addEventListener` handlers
Line 146-152: `socket.onmessage` calls `handleMessage(msg)` for EVERY message. For `file_content_response` and `file_tree_response` messages, `handleMessage` hits the `default: break` case — harmless. But:
- Line 182-185: The guard `if (!store.workspaces[workspace]) { store.setCurrentWorkspace(workspace) }` runs for EVERY message, calling `setCurrentWorkspace('coding-agent')` which triggers a Zustand state update
- This state update causes React to re-render, which may cause `useWebSocket` hook to re-run
- If the `useEffect([], [])` cleanup runs and closes the socket during discovery, all pending `addEventListener` handlers become orphaned
- The promises never resolve, `loadAllWorkspaces` never completes

### 3. Socket gets closed and reconnected during discovery
Server logs from earlier showed TWO `[WS] Client connected` entries. If the first socket is closed (server reset, timeout, or React cleanup), the discovery promises are attached to the dead socket. The reconnect creates a new socket, but `loadAllWorkspaces` is only called on the first connect (inside the `onopen` closure).

**Evidence**: The reconnect handler (line 158) does `setTimeout(connect, 3000)` but the new socket's `onopen` calls `loadAllWorkspaces` again — so discovery SHOULD retry. Unless the promises from the first attempt are still pending and blocking something.

### 4. Timeout cascade from `hasUiFolder` checks
For 8 of 9 workspaces, `ui/module.js` doesn't exist. The server returns error immediately (3ms), so `fetchWorkspaceFile` rejects immediately, `.catch(() => false)` handles it. BUT:
- The 5-second `setTimeout` is still pending
- When it fires, it calls `reject()` on an already-settled promise (no-op) AND calls `ws.removeEventListener(handleMessage)` — but the handler was already removed
- If `removeEventListener` is called with a handler that's already been removed, it's a no-op. But in edge cases with garbage collection, the handler reference might not match.

### 5. `loadAllWorkspaces` uses `Promise.all` — one failure kills all
Line 153: `Promise.all(ids.map((id) => loadWorkspaceConfig(ws, id)))`. If ANY config fails (throws instead of returning null), the entire discovery fails. `loadWorkspaceConfig` has a try/catch returning null, but:
- The `hasUiFolder` check inside it is `await fetchWorkspaceFile(...)` which can reject
- `.catch(() => false)` should handle it, but if there's an uncaught error in the `await` chain, the whole function throws
- `Promise.all` short-circuits on first rejection

### 6. `handleMessage` guard causes infinite re-render loop
Line 183-184: If `store.workspaces[workspace]` is empty (which it is — `workspaces` starts as `{}`), `store.setCurrentWorkspace(workspace)` is called. This modifies the store, triggering a React re-render. `handleMessage` depends on `[currentWorkspace]` (line 430), so the `useCallback` recreates. But `socket.onmessage` captures the OLD `handleMessage` (set once in the `useEffect([], [])`). So the guard should only fire once. Unless the state update causes the component to unmount and remount...

## What We Know Works (from Node.js testing)

```
PASS: Discovery — 9 workspaces
PASS: coding-agent config loaded via __workspaces__
PASS: Wiki — 17 topics
PASS: Issues — 11 tickets
PASS: Agents — 3 agents
PASS: Skills plugin — 5728 bytes
```

All 19 WebSocket requests/responses work correctly from Node.js. The bug is browser-specific, likely related to React lifecycle, event loop timing, or the interaction between `onmessage` and `addEventListener`.

## Key Files

| File | Lines | Role |
|------|-------|------|
| `hooks/useWebSocket.ts:130-143` | Discovery call in socket.onopen |
| `hooks/useWebSocket.ts:146-152` | onmessage handler (processes ALL messages) |
| `hooks/useWebSocket.ts:178-185` | handleMessage guard (auto-inits workspace state) |
| `lib/workspaces.ts:41-68` | fetchWorkspaceFile (addEventListener + timeout pattern) |
| `lib/workspaces.ts:74-108` | loadWorkspaceConfig (uses __workspaces__ path) |
| `lib/workspaces.ts:114-145` | discoverWorkspaces |
| `lib/workspaces.ts:151-160` | loadAllWorkspaces (Promise.all) |
| `state/workspaceStore.ts:77-101` | Store init (empty configs, empty workspaces) |
| `components/App.tsx:20,45-72` | Loading gate (blocks render until configs arrive) |
| `server.js:170-184` | getWorkspacePath (coding-agent → project root) |

## Suggested Debugging Steps

1. **Open browser console** — check for errors, look for `[WS] Discovered` log (if it never appears, `loadAllWorkspaces` promise is hanging)
2. **Check browser Network → WS tab** — verify all 19 request/response frames are present
3. **Add logging to `fetchWorkspaceFile`** — log when handler matches, when timeout fires, when resolve/reject is called
4. **Try sequential loading** instead of `Promise.all` — load configs one at a time to isolate which one hangs
5. **Remove `hasUiFolder` check temporarily** — reduces from 19 to 10 requests, eliminates the error-response path
6. **Remove the `handleMessage` guard** (lines 181-185) — test if the auto-init is causing the re-render issue
7. **Check if removing the loading gate** in App.tsx (lines 45-72) changes behavior — maybe the component tree unmount/remount is the issue

## Previous State (what to revert to if needed)

The old working code used `WORKSPACE_CONFIGS` hard-coded in `types/index.ts` and `WorkspaceId` union type. Git history has the pre-refactor state. The Phase 0 bug fix (loadedRef → lastWsRef) is independent and should be kept regardless.
