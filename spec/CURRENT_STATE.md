# Current State — Renderer Refactor

**Date:** 2026-03-20
**Branch:** `feature/chunk-rendering`
**Last committed:** `b129728` — "Phase 1: Kill double rendering, clean catalog, single paradigm"
**Status:** BROKEN — live streaming does not work. History rendering works.

---

## What was done

### Phase 1 (committed as `b129728`)

Removed the duplicate rendering pipeline that caused tool calls to render twice:
- Deleted: `SimpleBlockRenderer.tsx`, `simpleQueue.ts`, `contentAccumulator.ts`, `Ribbon/`
- Removed `RenderPhase` type and `renderPhase`/`messageQueue` from workspace state
- Cleaned `segmentCatalog.ts`: removed collapsible/inline category split, fixed labels to raw type names, added `groupable` field
- Cleaned `instructions.ts`: removed `toolLabel()`, `getSegmentCategory()`, `SegmentCategory`
- Cleaned `useWebSocket.ts`: removed accumulator/queue calls, removed icon/label maps
- Unified `MessageList.tsx`: removed `InlineChunk`, routed all non-text to `CollapsibleChunk`

### Phase 2 (uncommitted — on disk now)

New files created:
- `src/lib/hljs-register.ts` — shared syntax highlighting registration
- `src/lib/renderEngine.ts` — restored from commit `6173587` (the beat-driven segment release engine)
- `src/lib/engineRegistry.ts` — restored from commit `6173587` (workspace → engine Map)
- `src/hooks/useEngineBridge.ts` — restored from commit `6173587` (creates engine, syncs to Zustand)
- `src/components/CodeView.tsx` — universal code display (line numbers, hljs highlighting)
- `src/components/ToolContentRenderer.tsx` — content display routing (code/diff/plain, live progressive reveal)
- `src/components/ToolCallBlock.tsx` — unified tool call shell (header + collapsible + animation lifecycle)
- `src/components/LiveSegmentRenderer.tsx` — extracted animation code from original MessageList
- `src/components/InstantSegmentRenderer.tsx` — history/thread rendering, no animation

Modified files:
- `src/components/MessageList.tsx` — slimmed to ~67 lines, routes to Live/Instant renderers
- `src/components/ChatArea.tsx` — restored `useEngineBridge`, `engine.reset()`/`engine.startTurn()` in handleSend
- `src/hooks/useWebSocket.ts` — added engine calls (`startTurn`, `start`, `setTotalSegments`, `endTurn`), added grouping state machine
- `src/state/workspaceStore.ts` — added `appendSegmentContentByIndex` action
- `src/components/file-explorer/FileContentRenderer.tsx` — now uses `CodeView`

---

## What is broken and why

### Primary break: Engine segment release signal is not connected

The `RenderEngine` gates segments behind `releasedSegmentCount`. It releases the first segment automatically when `setTotalSegments` goes from 0 to >0. For subsequent segments, it waits for `engine.segmentComplete()` to be called, then releases the next segment on the next 500ms beat.

**Nobody calls `engine.segmentComplete()`.** The animation components (CollapsibleChunk, InlineChunk, LiveTextChunk) call `onComplete()` when their animation finishes. This reaches `onSegmentDone()` in LiveSegmentRenderer. But `onSegmentDone` only calls `onRevealComplete()` — which is `undefined` during streaming (it's only set when `pendingTurnEnd` is true at turn end).

The result: the first segment renders and animates. When it completes, nothing tells the engine. The engine never releases segment 2. Everything after the first segment is invisible.

**Fix documented in:** `spec/ENGINE_SIGNAL_FIX_OPTIONS.md` — two options. User hasn't chosen yet.

### Secondary break: Double engine start

`ChatArea.handleSend` calls `engine.reset()` + `engine.startTurn()`. Then when `turn_begin` arrives from the server, `useWebSocket` calls `eng.startTurn()` + `eng.start()` again. The second `startTurn()` resets `releasedSegmentCount` back to 0, potentially racing with segments that arrived between send and turn_begin. The beat interval (`eng.start()`) is only called in the WS handler, not in handleSend.

### Architecture violations

Documented in `spec/ARCHITECTURE_COMPLIANCE_AUDIT.md`. The project is missing 4 of 7 layers from the user's seven-layer architecture spec (event bus, controllers, services, event log). Views directly write state, make network calls, and orchestrate business logic.

---

## Key git references

| Commit | Branch | What it is |
|--------|--------|-----------|
| `6173587` | `feature/chunk-rendering` | Last known-good state before any refactoring. Original MessageList with full animation (493 lines), original engine files, original ChatArea. **This is the reference for "how it should work."** |
| `b129728` | `feature/chunk-rendering` | Phase 1 commit. Deleted duplicate pipeline. Animation was stripped as "stopgap." |
| `f79e459` | `phase2-snapshot` | WIP snapshot of all Phase 2 work + specs. Broken — engine signal not wired. Safe to reference without risk of loss. |

### Recovering original files

Any original file can be recovered from commit `6173587`:
```bash
git show 6173587:kimi-ide-client/src/components/MessageList.tsx
git show 6173587:kimi-ide-client/src/lib/renderEngine.ts
git show 6173587:kimi-ide-client/src/lib/engineRegistry.ts
git show 6173587:kimi-ide-client/src/hooks/useEngineBridge.ts
git show 6173587:kimi-ide-client/src/components/ChatArea.tsx
git show 6173587:kimi-ide-client/src/hooks/useWebSocket.ts
```

The original `MessageList.tsx` at that commit contains the complete animation system:
- `CollapsibleChunk` — shimmer → typewriter → collapse → onComplete
- `InlineChunk` — shimmer → pause → onComplete
- `TextChunk` — shimmer → typewriter → pause → onComplete
- `typeContent()` — character-by-character reveal
- `TIMING` constants
- `getSegmentCategory()` routing (collapsible vs inline vs text)
- `getIconForType()` local icon map
- `releasedCount` gating from engine state
- `onSegmentDone` / `onRevealComplete` completion chain

---

## What to do next

### Immediate (unblock rendering)

1. Fix the engine signal: when a segment's animation completes, `engine.segmentComplete()` must be called so the engine releases the next segment. See `spec/ENGINE_SIGNAL_FIX_OPTIONS.md` for two approaches.

2. Fix the double engine start: either remove the `engine.reset()`/`engine.startTurn()` from `ChatArea.handleSend`, or remove it from the `turn_begin` handler in useWebSocket. Not both places.

### After rendering works

3. Address architecture violations per `spec/ARCHITECTURE_COMPLIANCE_AUDIT.md`:
   - Create controller layer (move orchestration out of hooks/views)
   - Create service layer (move network access out of hooks/views)
   - Create event bus (decouple views from state mutations)
   - Stop views from writing state directly

---

## Spec index

| Spec | What it defines |
|------|----------------|
| `spec/TOOL_CALL_UNIFICATION_SPEC.md` | Master spec: single rendering paradigm, raw labels, grouping, CodeView |
| `spec/RENDERER_MODULE_SPLIT_SPEC.md` | LiveSegmentRenderer / InstantSegmentRenderer split |
| `spec/ENGINE_SIGNAL_FIX_OPTIONS.md` | Two options for fixing the engine release signal |
| `spec/ARCHITECTURE_COMPLIANCE_AUDIT.md` | Every violation against the seven-layer architecture |
| `spec/SEGMENT_DEFINITIONS_SPEC.md` | Segment visual/behavior definitions |
| `docs/RENDER_ENGINE_ARCHITECTURE.md` | How the RenderEngine works (beat-driven release) |
| `docs/WIRE_PROTOCOL.md` | WebSocket message format |
| `docs/STREAMING_CONTENT.md` | How content streams from server to client |
| `kimi-ide-client/CHAT_RENDER_SPEC.md` | Chat rendering spec |
| `kimi-ide-client/CHUNK_RENDERING_FIX_SPEC.md` | Chunk rendering fix spec |
| `kimi-ide-client/RENDER_QUEUE_SPEC.md` | Render queue spec |
| `~/.claude/CLAUDE.md` | User's seven-layer architecture standard (global) |

---

## Thread history data

Thread history is stored at:
```
ai/workspaces/coding-agent/threads/{threadId}/history.json
```

Each `history.json` contains exchanges with `assistant.parts[]` where each part has a `name` field matching the wire tool name (`ReadFile`, `Shell`, `Glob`, `Grep`, etc.) which maps through `toolNameToSegmentType()` in `instructions.ts`.
