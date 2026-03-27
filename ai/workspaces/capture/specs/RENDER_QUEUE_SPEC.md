# Render Queue System

## Block Lifecycle

Each block runs through these phases:

```
┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
│  FADE   │ → │ SHIMMER  │ → │  PAUSE  │ → │ CONTENT  │ → │  PAUSE  │ → │  CLOSE   │
│   IN    │   │ (cycles) │   │  500ms  │   │ (typing) │   │  500ms  │   │ (drawer) │
│ 250ms   │   │ 500ms ea │   │         │   │ 5-2-1    │   │         │   │  300ms   │
└─────────┘   └──────────┘   └─────────┘   └──────────┘   └─────────┘   └──────────┘
                                                         ↑                    │
                                                         │                    ↓
                                                    Check hasNext         ┌──────────┐
                                                    If true → loop        │  SHIMMER │
                                                    If false → next       │ (cycles) │
                                                                          │ 500ms ea │
                                                                          └──────────┘
                                                                                │
                                                                                ↓
                                                                          Check hasNext
                                                                          If true → EXIT
                                                                          If false → loop
```

## State Machine

```
                         ┌─────────────────────────────────────────┐
                         ↓                                         │
BLOCK_START → FADE_IN → SHIMMER ──(after 500ms)──→ check hasNext ──┤
                         ↑          │                              │
                         │          false                         │
                         │          ↓                              │
                         │       loop shimmer                      │
                         │                                         │
                         │       true                              │
                         │          ↓                              │
                         │       PAUSE_1 (500ms)                   │
                         │          ↓                              │
                         │       CONTENT (type with 5-2-1)         │
                         │          ↓                              │
                         │       PAUSE_2 (500ms)                   │
                         │          ↓                              │
                         │       COLLAPSE (300ms)                  │
                         │          ↓                              │
                         │       POST_CLOSE_SHIMMER                │
                         │          │                              │
                         │          ↓                              │
                         └────── check hasNext ──(false)──→ loop───┘
                                          │
                                          true
                                          ↓
                                       EXIT → next block
```

## hasNext Flag

- **Set to true**: When next block's content is fully received (end tag seen)
- **Set to false**: At start of each block, when streaming continues
- **Checked**: At end of each 500ms shimmer cycle

## Block Types

### 1. Think Block
- **Visual**: Lightbulb icon (dark cyan) + "Thinking" text
- **Default state**: Gray shimmer
- **Content**: Italic text, left border accent
- **Drawer**: Collapsible, starts open

### 2. Tool Block (inline)
- **Visual**: Tool icon + tool name
- **Behavior**: Shimmer only, no drawer
- **Fast path**: If complete before render, single shimmer → next

### 3. Text Block
- **Visual**: Markdown content
- **Typing**: 5-2-1 cadence
- **No drawer**: Direct content

### 4. Code Block
- **Visual**: Code icon + filename
- **Drawer**: Syntax highlighted, collapsible

## Timing Constants

```typescript
const TIMING = {
  FADE_IN: 250,           // ms to fade in header
  SHIMMER_CYCLE: 500,     // ms per shimmer cycle
  PRE_CONTENT_PAUSE: 500, // ms pause before typing
  POST_CONTENT_PAUSE: 500,// ms pause after typing
  COLLAPSE_DURATION: 300, // ms for drawer close
  TYPING_FAST: 1,         // ms/char after 200 chars
  TYPING_MEDIUM: 2,       // ms/char for chars 101-200
  TYPING_SLOW: 5,         // ms/char for first 100 chars
};
```

## Queue State

```typescript
interface QueueState {
  blocks: Block[];
  currentIndex: number;
  currentPhase: BlockPhase;
  hasNext: boolean;      // flag set when next block ready
  isStreaming: boolean;  // true while WebSocket open
}

type BlockPhase = 
  | 'idle'
  | 'fade_in'
  | 'shimmer'           // cycles until hasNext or !isStreaming
  | 'pre_content_pause'
  | 'content'           // typing phase
  | 'post_content_pause'
  | 'collapse'
  | 'post_close_shimmer' // cycles until hasNext
  | 'complete';
```
