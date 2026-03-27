# Engine Signal Fix — Two Options

**Problem:** When a segment's animation completes, nothing calls `engine.segmentComplete()`. The engine never releases the next segment. Only the first segment ever renders.

---

## Option A: LiveSegmentRenderer calls engine directly

LiveSegmentRenderer imports `getEngine` and calls `segmentComplete()` inside `onSegmentDone`.

```
┌─────────────────────────────────────────────────────────┐
│                      ChatArea                           │
│                                                         │
│  useEngineBridge(workspace)                             │
│    → creates RenderEngine                               │
│    → registers in engineRegistry                        │
│    → subscribes: engine state → Zustand store           │
│                                                         │
│  handleSend()                                           │
│    → engine.reset()                                     │
│    → engine.startTurn()                                 │
│    → addMessage (user)                                  │
│    → sendMessage (WebSocket)                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    MessageList                          │
│                                                         │
│  Routes:                                                │
│    history messages → InstantSegmentRenderer             │
│    currentTurn      → LiveSegmentRenderer                │
│                                                         │
│  Passes onRevealComplete (only when pendingTurnEnd)     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               LiveSegmentRenderer                       │
│                                                         │
│  Reads: engineState.releasedSegmentCount from store     │
│  Imports: getEngine from engineRegistry          ← NEW  │
│                                                         │
│  Gate: only renders segments where i < releasedCount    │
│                                                         │
│  For each released segment:                             │
│    isLastReleased = (i === releasedCount - 1)           │
│    passes onComplete callback to chunk component        │
│                                                         │
│  onSegmentDone(index):                                  │
│    1. getEngine(workspace).segmentComplete()     ← NEW  │
│    2. track done segments                               │
│    3. if all done AND onRevealComplete exists            │
│       → call onRevealComplete (finalizeTurn)            │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        Collapsible   Inline    LiveText
         Chunk        Chunk      Chunk
              │          │          │
              │  (animation runs)   │
              │          │          │
              ▼          ▼          ▼
         onComplete() fires when animation sequence ends
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                    RenderEngine                          │
│                                                         │
│  segmentComplete()                                      │
│    → sets pendingRelease = true                          │
│                                                         │
│  500ms beat interval:                                   │
│    → if pendingRelease: releaseNext()                   │
│      → releasedSegmentCount++                           │
│      → notify() → Zustand store updates                 │
│      → LiveSegmentRenderer re-renders                   │
│      → next segment passes gate                         │
│      → next chunk mounts with isLive=true               │
│      → animation starts                                 │
└─────────────────────────────────────────────────────────┘

FULL CYCLE:
  engine releases segment N
    → chunk N mounts, isLive=true
    → shimmer (1000ms) → typewriter → pause → collapse → pause
    → onComplete()
    → onSegmentDone(N)
    → engine.segmentComplete()
    → engine sets pendingRelease=true
    → next beat (≤500ms): engine.releaseNext()
    → releasedCount increments
    → chunk N+1 mounts, isLive=true
    → cycle repeats
```

**Pros:**
- Self-contained — only LiveSegmentRenderer changes
- No prop drilling
- Engine access is one import

**Cons:**
- LiveSegmentRenderer directly imports from engineRegistry (tight coupling to engine implementation)
- Two systems read the engine: store reads state, renderer calls methods

---

## Option B: ChatArea passes callback down

ChatArea creates a `onSegmentAnimationDone` callback that calls `engine.segmentComplete()`, passes it through MessageList to LiveSegmentRenderer.

```
┌─────────────────────────────────────────────────────────┐
│                      ChatArea                           │
│                                                         │
│  useEngineBridge(workspace)                             │
│    → creates RenderEngine                               │
│    → registers in engineRegistry                        │
│    → subscribes: engine state → Zustand store           │
│                                                         │
│  onSegmentAnimationDone = () => {                ← NEW  │
│    engine.segmentComplete()                             │
│  }                                                      │
│                                                         │
│  Passes to MessageList:                                 │
│    onSegmentAnimationDone={onSegmentAnimationDone}      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    MessageList                          │
│                                                         │
│  Receives: onSegmentAnimationDone                ← NEW  │
│  Passes through to LiveSegmentRenderer                  │
│                                                         │
│  Routes:                                                │
│    history messages → InstantSegmentRenderer             │
│    currentTurn      → LiveSegmentRenderer                │
│      + onSegmentAnimationDone                           │
│      + onRevealComplete                                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               LiveSegmentRenderer                       │
│                                                         │
│  Reads: engineState.releasedSegmentCount from store     │
│  Receives: onSegmentAnimationDone prop           ← NEW  │
│                                                         │
│  Gate: only renders segments where i < releasedCount    │
│                                                         │
│  onSegmentDone(index):                                  │
│    1. onSegmentAnimationDone()                   ← NEW  │
│    2. track done segments                               │
│    3. if all done AND onRevealComplete exists            │
│       → call onRevealComplete (finalizeTurn)            │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        Collapsible   Inline    LiveText
         Chunk        Chunk      Chunk
              │          │          │
              │  (animation runs)   │
              │          │          │
              ▼          ▼          ▼
         onComplete() fires when animation sequence ends
              │
              ▼
         onSegmentDone(N)
              │
              ▼
         onSegmentAnimationDone()   (passed from ChatArea)
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│                    RenderEngine                          │
│                                                         │
│  segmentComplete()                                      │
│    → sets pendingRelease = true                          │
│                                                         │
│  500ms beat interval:                                   │
│    → if pendingRelease: releaseNext()                   │
│      → releasedSegmentCount++                           │
│      → notify() → Zustand store updates                 │
│      → LiveSegmentRenderer re-renders                   │
│      → next segment passes gate                         │
│      → next chunk mounts with isLive=true               │
│      → animation starts                                 │
└─────────────────────────────────────────────────────────┘

FULL CYCLE:
  engine releases segment N
    → chunk N mounts, isLive=true
    → shimmer (1000ms) → typewriter → pause → collapse → pause
    → onComplete()
    → onSegmentDone(N)
    → onSegmentAnimationDone() → engine.segmentComplete()
    → engine sets pendingRelease=true
    → next beat (≤500ms): engine.releaseNext()
    → releasedCount increments
    → chunk N+1 mounts, isLive=true
    → cycle repeats
```

**Pros:**
- LiveSegmentRenderer has no direct engine dependency — it just calls a callback
- Engine access stays in ChatArea (where it's created)
- Clean separation: ChatArea owns engine, LiveSegmentRenderer owns animation
- MessageList stays dumb (just passes props through)

**Cons:**
- One extra prop threaded through MessageList
- Slightly more wiring

---

## Recommendation

Option B is cleaner. The engine is created in ChatArea, and the signal to advance it should come from ChatArea. LiveSegmentRenderer shouldn't need to know how the engine works — it just calls a callback when animation finishes.

But this is your call.
