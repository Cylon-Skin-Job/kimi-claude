# Chat Render Specification

## Overview
Real-time streaming chat with choreographed animations. The orb acts as an immediate loading indicator, then each chunk follows a strict timing sequence.

## Architecture
- **Backend**: Sends content as soon as it exists (WebSocket)
- **Frontend Store**: Buffers all segments immediately  
- **Orb**: Pure UI state - appears on send, disappears on first content
- **Chunks**: Each renders independently with self-managed timing

---

## Phase 1: Orb (Immediate)

**Trigger:** User sends message

**Behavior:**
- Icon: `lens_blur` (Material Symbols)
- Animation: Pulse 1500ms ease-in-out infinite
- Color: `--theme-primary`
- **No waiting** - appears instantly

**Exit:** First content arrives (thinking or text)
- Orb fades out
- First chunk begins shimmer immediately

---

## Phase 2: Shimmer (Every Chunk)

**Timing:**

| Elapsed | Opacity | State |
|-----------|---------|-------|
| 0-250ms | 0% | Invisible hold |
| 250-500ms | 0→100% | Fade in |
| 500-1000ms | 100% | Full shimmer |
| 1000ms+ | 100% | Extend if content not ready |

**Minimum shimmer: 1000ms**

If content arrives after 1000ms, shimmer continues until content is ready.

---

## Phase 3: Content Reveal

**Typing effect:**
- 0-100 chars: 5ms per char
- 100-200 chars: 2ms per char
- 200+ chars: 1ms per char

**Non-typed content:**
- Inline tool calls: Show immediately (no typing)

---

## Phase 4: End Chunk & Handoff

| Phase | Duration | Notes |
|-------|----------|-------|
| Post-typing pause | 500ms | Content fully visible |
| Collapse | 300ms | max-height + opacity transition |
| Inter-chunk pause | 250ms | Before next chunk starts |
| **Next chunk start** | 250ms | Its own initial pause |

**Collapse details:**
- max-height: 2000px → 0px
- opacity: 1 → 0 (fade starts at 150ms)

---

## Chunk Types

### Collapsible (think, shell, write)
- Expandable drawer with header
- Icon + label + chevron
- Content indented with left border (think only)
- Font: monospace for shell, italic for think

### Inline (read, write, edit, glob, grep, web_search, fetch, subagent, todo)
- Single line, no expansion
- Icon + label on subtle background
- No typing effect

### Text (markdown)
- Full width
- Markdown rendered via `marked`
- Typing effect

---

## Chunking Rules

1. **Thinking blocks** - Each `<think>...</think>` = 1 chunk
2. **Tool calls** - Each tool invocation = 1 chunk
3. **Text headers** - Split on `## ` (h2 headers)
4. **Sequential** - Text between headers = 1 chunk

---

## Complete Flow

```
[USER SENDS MESSAGE]
        │
        ▼
   [ORB APPEARS] ← Immediate, pulses
        │
        │ (first token arrives)
        ▼
   [ORB FADES OUT]
        │
        ▼
[CHUNK 1: SHIMMER]
        │
   ┌────┴────┐
   │ 250ms   │ Invisible
   │ 250ms   │ Fade in
   │ 500ms   │ Full shimmer
   └────┬────┘
        │ (content ready)
        ▼
[CHUNK 1: TYPING]
        │
        ▼
[CHUNK 1: POST-TYPING]
        │
   ┌────┴────┐
   │ 500ms   │ Pause
   │ 300ms   │ Collapse
   │ 250ms   │ Pause
   └────┬────┘
        │
        ▼
[CHUNK 2: START PAUSE]
        │
        │ 250ms
        ▼
[CHUNK 2: SHIMMER]
        │
        ... (repeat)
```

---

## Key Principles

1. **Orb = immediate feedback** - No waiting for backend
2. **Chunks self-manage timing** - No central queue controlling animations
3. **Never restart animation** - Once started, runs to completion
4. **250ms everywhere** - Start fade, end pause, all chunks
5. **1000ms minimum shimmer** - Even for one-line tool calls

---

## State Machine (Per Chunk)

```
idle ──(released & isLive)──► shimmer ──(1000ms min)──► revealing ──(typed)──► complete
```

---

## CSS Variables

- `--theme-primary` - Icons, shimmer gradient
- `--theme-primary-rgb` - Subtle backgrounds (0.03 opacity)  
- `--text-dim` - Content text color
- `--error` - Error states (#ef4444)

## Icons

- `lens_blur` - Orb
- `lightbulb` - Thinking
- `terminal` - Shell
- `description` - Read
- `edit_note` - Write
- `find_replace` - Edit
- `folder_search` - Glob
- `search` - Grep
- `travel_explore` - Web search
- `link` - Fetch
- `smart_toy` - Subagent
- `checklist` - Todo
- `arrow_drop_down` - Collapse chevron
