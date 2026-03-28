---
title: Workspaces stuck on "Loading" (wiki, agents, issues, skills)
type: bug
priority: high
status: open
created: 2026-03-25
---

# Workspaces stuck on "Loading"

## Symptom

All workspaces except **Capture** and **Code Agent** are permanently stuck showing "Loading..." when navigated to. Wiki shows "Loading wiki...", agents/issues/skills similar.

## What works

- **Capture** — tile rows load, file content renders, screenshots render
- **Code Agent** — chat, file explorer, threads all functional

## What doesn't

- **Wiki** — "Loading wiki..." forever
- **Agents** — stuck loading
- **Issues** — stuck loading
- **Skills** — stuck loading

## User context

This is a **recurring issue** that has appeared multiple times. The user reports it has "always been related to dual server use" — previous instances were caused by a second server.js file or a redundant Python file server on port 5173. Both were deleted in prior sessions. As of 2026-03-25, there is confirmed only ONE server process (node server.js on port 3001) and no duplicate server files.

## Investigation so far

### Server side (confirmed working)
- `file_content_request` for `workspace: 'wiki'`, `path: 'index.json'` reaches the server (visible in server-live.log)
- `getWorkspacePath('wiki', ws)` resolves correctly to `ai/workspaces/wiki/`
- `ai/workspaces/wiki/index.json` exists and is readable
- `handleFileContentRequest` should be sending `file_content_response` back
- No errors logged server-side for these requests

### Client side (suspected issue)
- `useWikiListener` in `useWikiData.ts` sets up a WebSocket message handler filtered by `msg.type === 'file_content_response' && msg.workspace === WORKSPACE`
- Uses a `loadedRef` that sets to `true` on first load attempt and never resets — may prevent reload on WS reconnect
- The `ws` object from the store changes on reconnect; the `useEffect([ws])` dependency should re-fire, but `loadedRef.current` stays `true`
- Similar patterns likely exist in `useAgentData.ts`, `useTicketData.ts`, `useWikiData.ts`

### Key question
Is the server actually sending the `file_content_response` back? The server logs only capture incoming messages (`[WS →]`), not outgoing responses. Need to add outgoing response logging or check browser Network/WS frames tab.

## Reproduction
1. Start server (`bash restart-kimi.sh`)
2. Open `http://localhost:3001`
3. Navigate to Wiki workspace — stuck on "Loading wiki..."
4. Navigate to Code Agent — works fine
5. Navigate back to Wiki — still stuck

## Likely causes (ranked)

1. **WebSocket message handler not receiving response** — the response may be going out on a different WS connection than the one the client is listening on (the Playwright logs showed many rapid reconnections and multiple WS connections)
2. **`loadedRef` stale after reconnect** — if WS drops and reconnects, `loadedRef.current` is still `true`, so `loadIndex()` never fires again
3. **`useCallback` closure capturing stale `currentWorkspace`** in `useWebSocket.ts` — the `handleMessage` callback depends on `currentWorkspace` but may be stale when workspace switches

## Next steps
- [ ] Add browser console logging for `file_content_response` messages to confirm they arrive
- [ ] Check if the WS frames tab in DevTools shows the response
- [ ] If response arrives: debug the message handler filter logic
- [ ] If response doesn't arrive: add server-side outgoing message logging for file_content_response
- [ ] Check if `loadedRef` pattern is the cause — try removing it and see if wiki loads
- [ ] Audit all workspace data hooks (useWikiData, useAgentData, useTicketData) for the same pattern
