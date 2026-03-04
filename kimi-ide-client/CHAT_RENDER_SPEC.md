# Chat Render Specification

## Overview
Real-time streaming chat with choreographed animations. Token-level WebSocket messages flow through a **content accumulator** that buffers them into logical blocks, then each block self-manages its animation lifecycle.

## Architecture

```
WebSocket tokens → ContentAccumulator (state machine) → SimpleQueue (blocks) → SimpleBlockRenderer (React)
```

- **Backend**: Sends token-level content via WebSocket (1-5 chars each)
- **ContentAccumulator**: Buffers tokens into logical blocks, detects boundaries (fences, headers, type changes)
- **SimpleQueue**: Holds blocks with mutable content, batches notifications via rAF
- **SimpleBlockRenderer**: Each block component self-manages timing, removes itself when done
- **Segment Store**: Parallel path for MessageList (past messages) — unchanged

---

## Block Types & Lifecycles

All blocks are agnostic — no inter-block tracking. Each runs its own timeline.

### Orb
**Trigger:** User sends message (immediate, before server responds)

1. 500ms pause (invisible)
2. Fade in (200ms)
3. Expand to 1.2x + blur (500ms)
4. Pause open at 1x (500ms)
5. Contract to 0.8x (500ms)
6. Fade out (200ms)
7. 500ms pause → remove

### Collapsible (think, shell, write) — IDENTICAL paradigm
1. First token arrives → create block (empty content, `complete: false`)
2. Fade in (300ms): icon + label + content container ALL AT ONCE
3. Shimmer loop while `complete === false` (content accumulates behind shimmer)
4. Content complete (`complete = true`) → stop shimmer → 500ms pause
5. Type content with 5-2-1 cadence
6. 500ms pause → collapse (500ms) → 500ms pause → remove

### Text
1. First token → create block, render container immediately
2. Chase-type content with 5-2-1 as tokens arrive (cursor chases growing content)
3. Markdown rendered via `marked.parse()` as typing progresses
4. Boundary hit (backtick fence, type change, ## header) → mark complete
5. Finish typing remaining content → remove

### Code
1. Opening ``` detected → create code block with language meta
2. Chase-type raw code with 5-2-1 as tokens arrive
3. Closing ``` detected → mark complete → apply `hljs` syntax highlighting
4. Brief pause (300ms) → remove

### Inline Tool (read, edit, glob, grep, web_search, fetch, subagent, todo)
1. Fade in (250ms) → show icon + label → shimmer (500ms) → fade out → done
2. No 500ms gap between consecutive inline tools
3. Created with `complete: true` immediately

---

## Typing Cadence (5-2-1)

| Characters | Delay per char |
|------------|---------------|
| 0-100      | 5ms           |
| 100-200    | 2ms           |
| 200+       | 1ms           |

---

## Content Accumulator State Machine

```
States: idle | text | thinking | code | tool
Transitions on: content msg, thinking msg, tool_call, tool_result, turn_end
```

**Boundary detection:**
- **Type change** (think↔text): complete current block, start new one
- **Code fence** (triple backtick): complete text block, start code block (and vice versa)
- **Header** (`## ` at line start): complete current text block, start new one
- **Tool call**: complete any active block, create tool block
- **Turn end**: complete all active blocks

**Token buffering:**
- Backtick counter tracks partial fence detection across token boundaries
- Line buffer tracks partial header detection
- Content accumulates character by character for precise boundary detection

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/simpleQueue.ts` | Block queue with mutable ops, rAF batching |
| `src/lib/contentAccumulator.ts` | State machine: tokens → blocks |
| `src/hooks/useWebSocket.ts` | Routes WS messages through accumulator |
| `src/components/SimpleBlockRenderer.tsx` | All block components (Orb, Collapsible, Text, Code, InlineTool) |
| `src/components/ChatArea.tsx` | Mounts SimpleBlockRenderer (always, not gated) |
| `src/lib/instructions.ts` | Tool categorization, icons, labels |

---

## CSS Variables

- `--theme-primary` — Icons, shimmer gradient
- `--theme-primary-rgb` — Subtle backgrounds (0.03 opacity)
- `--text-dim` — Dim text color
- `--text-white` — Content text color
- `--bg-code` — Code block background
- `--theme-border` — Border color
- `--font-mono` — Monospace font family

## Icons

- `lens_blur` — Orb
- `lightbulb` — Thinking
- `terminal` — Shell
- `description` — Read
- `edit_note` — Write
- `find_replace` — Edit
- `folder_search` — Glob
- `search` — Grep
- `travel_explore` — Web search
- `link` — Fetch
- `smart_toy` — Subagent
- `checklist` — Todo

## Key Principles

1. **Orb = immediate feedback** — No waiting for backend
2. **Blocks self-manage timing** — No central queue controlling animations
3. **Content accumulator buffers tokens** — Prevents hundreds of micro-blocks
4. **Mutable blocks** — Content grows in-place, components chase it
5. **rAF batching** — Coalesces rapid token updates into single re-renders
6. **Boundary detection** — Code fences, headers, type changes split blocks correctly
