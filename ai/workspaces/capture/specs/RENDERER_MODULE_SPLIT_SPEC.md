# Renderer Module Split Spec

**Status:** DRAFT — Awaiting approval
**Date:** 2026-03-19
**Context:** The rendering code (animation lifecycle, content display, segment routing) is currently combined in MessageList.tsx. Every edit risks breaking the animation system. This spec separates live animation and instant rendering into independent modules that share the same visual definitions.

---

## 1. Problem

MessageList.tsx contains:
- The message loop (mapping messages to components)
- Segment routing (text vs tool calls)
- The full live animation lifecycle (shimmer, typewriter, collapse, timing)
- The instant/history rendering path
- Helper functions (typeContent, sleep)

When any of these concerns is edited, all others are at risk. The animation code — which took hours to build and tune — has been broken multiple times by changes to routing or rendering logic.

## 2. Design Principle

**One job per file. Animation and instant rendering never share a file.**

Both renderers consume the same shared definitions. Neither defines its own icons, labels, colors, or tool metadata. All visual identity lives in the catalog and shared components.

## 3. Shared Dependencies (owned elsewhere, never duplicated)

| Module | What it provides | Who owns it |
|--------|-----------------|-------------|
| `segmentCatalog.ts` | Icons, colors, labels, visual styles, behavior, groupable | Catalog |
| `instructions.ts` | `SEGMENT_ICONS`, `toolNameToSegmentType` | Catalog |
| `ToolCallBlock.tsx` | Tool call shell (header + collapsible wrapper + animation lifecycle for live, instant collapse for history) | Component |
| `ToolContentRenderer.tsx` | Content display routing (plain/code/diff → CodeView or text) | Component |
| `CodeView.tsx` | Universal syntax-highlighted code display | Component |
| `hljs-register.ts` | Shared hljs language registration | Lib |
| `chunkParser.ts` | Boundary detection for progressive reveal | Lib |
| `types/index.ts` | `SegmentType`, `StreamSegment`, etc. | Types |

**Rule:** If a renderer needs an icon, label, color, or behavior flag, it imports from the catalog. It does not define its own.

## 4. Module Split

### 4a. `MessageList.tsx` — Message loop and routing only

**Responsibility:** Map messages and segments to renderer components. Nothing else.

**Contains:**
- `MessageList` component — the message loop
- Props: workspace, messages, currentTurn, segments, lastUserMsgRef
- For history messages (`isLive=false`): renders `<InstantSegmentRenderer>`
- For live streaming (`isLive=true`): renders `<LiveSegmentRenderer>`
- Turn-end finalization wiring (`pendingTurnEnd` → `finalizeTurn`)

**Does NOT contain:**
- Animation code
- Timing constants
- typeContent or sleep helpers
- Any component that renders content directly
- Any import from segmentCatalog (that's the renderers' job)

**Approximate size:** ~60 lines

```typescript
// Pseudocode
export function MessageList({ workspace, messages, currentTurn, segments, lastUserMsgRef }) {
  const pendingTurnEnd = ...;
  const finalizeTurn = ...;
  const onRevealComplete = pendingTurnEnd ? () => finalizeTurn(workspace) : undefined;

  return (
    <>
      {messages.map((msg, i) => (
        <div key={msg.id} className={`message message-${msg.type}`}>
          {msg.type === 'user' ? (
            <div className="message-user-content">{msg.content}</div>
          ) : (
            <InstantSegmentRenderer segments={msg.segments} />
          )}
        </div>
      ))}

      {currentTurn && (
        <div className="message message-assistant">
          <LiveSegmentRenderer
            segments={segments}
            onRevealComplete={onRevealComplete}
          />
        </div>
      )}
    </>
  );
}
```

### 4b. `LiveSegmentRenderer.tsx` — Full animation lifecycle

**Responsibility:** Render segments during live streaming with the complete animation sequence.

**Contains:**
- `LiveSegmentRenderer` component (exported)
- `LiveCollapsibleChunk` — shimmer → typewriter reveal → post-typing pause → collapse → inter-chunk pause → onComplete
- `LiveInlineChunk` — shimmer → pause → onComplete (if inline paradigm is kept, otherwise all go through LiveCollapsibleChunk)
- `LiveTextChunk` — shimmer → typewriter reveal → pause → onComplete
- Timing constants (`TIMING` object: FADE_IN_START, FADE_IN_END, SHIMMER_MINIMUM, POST_TYPING_PAUSE, COLLAPSE_DURATION, INTER_CHUNK_PAUSE, TYPING_FAST, TYPING_MEDIUM, TYPING_SLOW)
- `typeContent()` helper — character-by-character reveal with variable speed
- `sleep()` helper
- Shimmer opacity calculation

**Imports from shared:**
- `segmentCatalog` — for icons, colors, labels, visual styles
- `ToolContentRenderer` — for content display inside collapsible area (optional, can also render content directly if preferred)
- `chunkParser` — for boundary detection during progressive reveal
- Types from `types/index.ts`

**Does NOT contain:**
- Tool definitions, icon maps, label maps
- Instant/history rendering logic
- Message loop logic

**This file is the animation system. It does not get edited unless animation behavior is intentionally changing.**

### 4c. `InstantSegmentRenderer.tsx` — History/thread-switching renderer

**Responsibility:** Render segments immediately with no animation. Used for history messages and thread switching.

**Contains:**
- `InstantSegmentRenderer` component (exported)
- Simple segment mapping — routes each segment to its visual component
- All segments render complete and collapsed immediately
- No timing, no shimmer, no typewriter, no async sequences

**Imports from shared:**
- `segmentCatalog` — for icons, colors, labels, visual styles
- `ToolCallBlock` or `ToolContentRenderer` — for content display
- `CodeView` — for code content
- Types from `types/index.ts`

**Does NOT contain:**
- Animation code
- Timing constants
- typeContent, sleep, or any async helpers
- Live streaming logic

**Approximate size:** ~80-120 lines (much simpler than live)

### 4d. `ToolCallBlock.tsx` — Tool call shell (shared by both renderers)

**Responsibility:** The visual wrapper for a tool call. Header (icon + label + chevron) and collapsible content area.

**Two modes:**
- `mode: 'live'` — Starts expanded, animation lifecycle is driven by the LiveSegmentRenderer that mounts it. ToolCallBlock itself may own the shimmer/collapse animation, OR LiveSegmentRenderer may own it and ToolCallBlock is pure presentation. **This decision should be made during implementation based on what keeps the animation code cleanest.**
- `mode: 'instant'` — Renders collapsed with full content immediately.

**Imports from shared:**
- `segmentCatalog` — icons, colors, labels, visual styles
- `ToolContentRenderer` — content display

**Does NOT contain:**
- Segment routing logic
- Message loop logic
- typeContent helper (that lives in LiveSegmentRenderer)

## 5. Data Flow

```
WebSocket messages
    ↓
useWebSocket.ts (pushSegment, appendSegment, updateSegment, grouping)
    ↓
Zustand store (segments[])
    ↓
MessageList.tsx (routes to correct renderer)
    ↓
┌─────────────────────────┬──────────────────────────────┐
│ History messages         │ Live streaming (currentTurn)  │
│                         │                              │
│ InstantSegmentRenderer  │ LiveSegmentRenderer           │
│   ↓                     │   ↓                          │
│ ToolCallBlock           │ LiveCollapsibleChunk          │
│   (mode: instant)       │ LiveTextChunk                 │
│   ↓                     │   ↓                          │
│ ToolContentRenderer     │ typeContent() + shimmer       │
│   ↓                     │   ↓                          │
│ CodeView                │ ToolContentRenderer → CodeView│
└─────────────────────────┴──────────────────────────────┘
```

Both paths read visual definitions from the same catalog. Neither path defines its own.

## 6. Migration Path

1. Extract `LiveSegmentRenderer.tsx` — move CollapsibleChunk, InlineChunk (if kept), TextChunk, typeContent, sleep, TIMING from the original MessageList.tsx (commit `6173587`) into this new file. **Use the original code as-is.** Update imports to use catalog for icons/colors instead of the local `getIconForType` helper that was in the old file.

2. Extract `InstantSegmentRenderer.tsx` — create the instant renderer that shows segments collapsed with no animation. Uses ToolCallBlock (mode: instant) or direct rendering.

3. Slim down `MessageList.tsx` — reduce to just the message loop and routing between the two renderers.

4. Verify both paths work independently.

## 7. Files Touched

| File | Action |
|------|--------|
| `src/components/LiveSegmentRenderer.tsx` | **NEW** — animation lifecycle extracted from original MessageList |
| `src/components/InstantSegmentRenderer.tsx` | **NEW** — instant/history renderer |
| `src/components/MessageList.tsx` | **SLIM DOWN** — message loop and routing only |
| `src/components/ToolCallBlock.tsx` | **EXISTS** — may need mode adjustment |
| `src/components/ToolContentRenderer.tsx` | **EXISTS** — no changes |
| `src/components/CodeView.tsx` | **EXISTS** — no changes |

## 8. What This Spec Does NOT Change

- Animation timing values
- The typewriter effect behavior
- The shimmer/fade-in behavior
- The collapse behavior
- The segment catalog or any visual definitions
- useWebSocket.ts
- The wire protocol
- CodeView, ToolContentRenderer, hljs-register

## 9. Verification

After implementation:
1. **Live streaming** — shimmer → typewriter reveal → collapse works exactly as it did in commit `6173587`
2. **History/thread switching** — all segments render instantly, collapsed, no animation
3. **Editing InstantSegmentRenderer** — cannot break live animation
4. **Editing LiveSegmentRenderer** — cannot break history rendering
5. **Editing MessageList.tsx** — cannot break either renderer (it's just routing)
6. **Both renderers** — use the same icons, labels, colors from the catalog
7. **npm run build** — passes clean
