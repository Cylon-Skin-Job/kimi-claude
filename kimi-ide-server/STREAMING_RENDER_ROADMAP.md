# Kimi IDE Streaming Render System - Roadmap

## Overview
Complete rewrite of the streaming render system with visual pacing, proper buffering, and terminal-style code block rendering.

---

## Phase 1: Ribbon Animation

### Implementation
- Send button triggers ribbon dart animation
- Ribbon "gets caught" momentarily
- Completes within 200ms of first token arrival
- Ribbon completely disappears before thinking phase

### Sanity Check
- [ ] Ribbon visible immediately on send
- [ ] First token arrival triggers completion animation
- [ ] Ribbon completely gone before thinking appears
- [ ] Timing verified: ~200ms from first token to ribbon gone

### Test
```
Click send → watch ribbon → verify timing with stopwatch
```

---

## Phase 2: Thinking Timing

### Implementation
- After ribbon disappears: wait 200ms
- Show lightbulb + "Thinking" header
- Minimum 0.8s visible duration (from first token)
- Shimmer animation on "Thinking" text

### Sanity Check
- [ ] Lightbulb does NOT appear before 200ms delay
- [ ] Lightbulb visible at least 0.8s even if thinking content is short
- [ ] Shimmer animation active on "Thinking" text
- [ ] Shimmer stops when thinking content starts typing

### Test
```
Short thinking response (< 100 chars) → verify 0.8s minimum duration
```

---

## Phase 3: Text Burst Rendering

### Implementation
- Accumulate content until complete paragraph (\n\n) or ~50 chars
- Parse markdown/HTML completely in RAM before displaying
- Type out character-by-character at 5ms interval
- HTML tags pre-rendered, user sees formatted text appearing

### Sanity Check
- [ ] Raw markdown NEVER visible (no "## Header" flashes)
- [ ] Buffer accumulates until complete unit before typing starts
- [ ] 5ms interval consistent (not variable)
- [ ] Bold, italic, headers render correctly during type

### Test
```
Ask for "## Test Header with **bold** text" → 
verify no raw markdown ever flashes
```

---

## Phase 4: Lens Blur Pulse Symbol

### Implementation
- Material Icon: `lens_blur`
- Color: Lighter cyan (var(--theme-primary) with higher brightness)
- Animation cycle: Full size → Small → Full size
- Always rest on FULL size

### Sanity Check
- [ ] Icon is `lens_blur` (not `lightbulb` or other)
- [ ] Color is lighter cyan variant
- [ ] Animation smooth: big → small → big
- [ ] Rest state is ALWAYS full size (never stops small)

### Test
```
Trigger pulse → verify one complete cycle ends on big size
```

---

## Phase 5: Code Block Rendering

### Implementation
- Buffer until complete code block: ```lang\ncode\n```
- Pulse symbol appears (pulses until code block ready in RAM)
- Type at 2ms/character (faster than text)
- Fill from BOTTOM-UP (like terminal)
- Content pushes up and scrolls out of view
- Syntax highlighting + borders render properly

### Sanity Check
- [ ] New characters appear at BOTTOM of container
- [ ] Previous content pushed UP (terminal scroll effect)
- [ ] 2ms interval (faster than 5ms text)
- [ ] Syntax highlighting active
- [ ] Borders render (left, right, bottom)
- [ ] Header shows language

### Test
```
Request 20-line code block → watch it rise from bottom
```

---

## Phase 6: Transition System

### Implementation
**Text → Code Block:**
1. Text finishes typing
2. Pulse symbol appears (pulses continuously)
3. When code block ready in RAM: pulse completes current cycle
4. Pulse ends on FULL size
5. Code block starts typing from bottom

**Code Block → Text:**
1. Code block finishes
2. Pulse symbol pulses ONCE (big→small→big)
3. Text burst resumes

### Sanity Check
- [ ] Pulse appears BEFORE code block (not overlapping)
- [ ] Pulse after code block is exactly ONE cycle
- [ ] No transitions skipped or doubled
- [ ] No visual glitches between states

### Test
```
"Show me a function then explain it" → 
verify Text → Pulse → Code → Pulse → Text sequence
```

---

## Phase 7: Cursor Removal

### Implementation
- Remove blinking cursor entirely
- Pulse symbol is the only "working" indicator
- No cursor in text, code, or between transitions

### Sanity Check
- [ ] NO cursor visible anywhere in the UI
- [ ] Pulse symbol clearly indicates "working" state
- [ ] User can distinguish between idle and working

### Test
```
Full conversation flow → confirm no cursor ever appears
```

---

## Phase 8: Integration Test

### Full Flow Verification
1. Send message
2. Ribbon animation (200ms to completion)
3. 200ms pause
4. Thinking appears (0.8s minimum)
5. Text burst (5ms/char)
6. Pulse until code block ready
7. Code block (2ms/char, bottom-up)
8. Pulse once
9. Return to text burst
10. Repeat as needed

### Sanity Check
- [ ] Each phase triggers next correctly
- [ ] Timing feels consistent, not random
- [ ] No visual glitches between transitions
- [ ] Performance: no dropped frames

### Final Test
```
"Show me a JavaScript function with comments, 
then explain what each part does"
→ Verify complete flow: ribbon → thinking → text → 
pulse → code → pulse → text
```

---

## Build Order

1. Phase 1 (Ribbon) - standalone
2. Phase 4 (Pulse symbol) - needed for transitions
3. Phase 3 (Text burst) - core rendering
4. Phase 5 (Code block) - specialized rendering
5. Phase 6 (Transitions) - connect text ↔ code
6. Phase 2 (Thinking timing) - polish
7. Phase 7 (Cursor removal) - cleanup
8. Phase 8 (Integration) - final verification

---

## Success Criteria

- [ ] All individual phase sanity checks pass
- [ ] Integration test smooth end-to-end
- [ ] No raw markdown visible EVER
- [ ] Code blocks have borders AND syntax highlighting
- [ ] Pulse symbol animates correctly (big→small→big)
- [ ] Terminal-style code rendering (bottom-up)
- [ ] 60fps performance throughout

---

**Status:** Completed
**Last Updated:** 2026-03-02
