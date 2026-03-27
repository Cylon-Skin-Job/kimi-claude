# Kimi IDE - Master Roadmap

## Executive Summary

This document reconciles the original architecture vision (React/TypeScript) with the current implementation reality (Vanilla JS monolith) and the streaming render roadmap. It serves as the single source of truth for understanding:

1. What was originally planned
2. What was actually built
3. What the streaming render system requires
4. The path forward to a proper React/TypeScript architecture

**Last Updated:** March 1, 2026  
**Status:** Architecture analysis complete, implementation misaligned

---

## Part 1: Original Architecture Vision (ROADMAP.md)

### Technology Stack (Planned)

| Layer | Technology |
|-------|------------|
| Frontend | **React + TypeScript** |
| Frontend Hosting | Firebase Hosting |
| Backend | Node.js + Express |
| WebSocket | ws library |
| Process Management | node:child_process |
| Persistence | Firestore |
| Tunnel | Cloudflare Tunnel |
| Styling | CSS (Raven OS-inspired) |

### Core Philosophy

**Thin Client Architecture:**
- Frontend: Dumb React app that renders what backend tells it
- Backend: Node.js on local MacBook, spawns Kimi CLI wire processes
- Communication: WebSocket between frontend and backend

### User Modes

Three interaction modes:
1. **Riff Mode** - Fast brainstorming, no tools
2. **Vibe Mode** - Quick edits with file tools
3. **Plan Mode** - Structured execution with autonomous pipeline

### Layout (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡]  Project Name                           [icons]           │
├──────────┬─────────────────────────┬────────────────────────────┤
│          │                         │  [tab][tab][tab]          │
│  THREAD  │       CHAT AREA         │────────────────────────────┤
│  LIST    │       (400px)           │                            │
│ (250px)  │                         │      CONTENT AREA          │
│          │  ┌─────────────────┐    │      (flexible)            │
│ [+ New   │  │ User message    │    │                            │
│  Chat]   │  │ (right bubble)  │    │  - File diffs              │
│          │  └─────────────────┘    │  - Pipeline visualization  │
│ ───────  │                         │  - Code previews           │
│ 🟢 Auth  │  ┌─────────────────┐    │  - 5-line scroll box       │
│ ⚫ API   │  │ Kimi response   │    │                            │
│ ⚫ CSS   │  │ (left bubble)   │    │                            │
│ ...      │  └─────────────────┘    │                            │
│          │                         │                            │
│          │  [Message input...] [↑] │                            │
│          │                         │                            │
└──────────┴─────────────────────────┴────────────────────────────┘
```

### 8 Development Phases (Original)

1. **Foundation** - Basic Node server, WebSocket, HTML/CSS layout
2. **Chat Experience** - Chat bubbles, streaming, thread management
3. **Modes** - Riff/Vibe/Plan modes
4. **Session Management** - Multiple concurrent threads
5. **Content Area Tabs** - Per-thread tabs with persistence
6. **Autonomous Pipeline** - Build/Review/Validate/Merge/Document
7. **Firestore Integration** - Real-time logging, thread persistence
8. **Deployment** - Cloudflare Tunnel, Firebase Hosting

---

## Part 2: Current Implementation Reality

### What Was Actually Built

**Technology Stack (Actual):**
- Single HTML file: `public/index.html` (2,346 lines)
- Vanilla JavaScript (916 lines of inline JS)
- No React, No TypeScript
- No build system, no bundler
- Express serving static files

### Architecture Mismatch

| Aspect | Planned | Actual | Impact |
|--------|---------|--------|--------|
| Frontend Framework | React + TypeScript | Vanilla JS | No component isolation |
| File Structure | Modular components | Single 2,300-line file | Unmaintainable |
| State Management | React hooks/context | Global `state` object | Race conditions |
| Type Safety | TypeScript | None | Runtime errors |
| Build System | Vite/Webpack | None | No optimization |

### Current CSS Architecture (Documented)

**File:** `kimi-ide-server/docs/analysis/css-inventory.md` (711 lines)

**CSS Inventory Summary:**
- **11 :root variables** - Colors, layout dimensions
- **4 theme variables** - Dynamic workspace colors
- **7 keyframe animations** - Ribbon, pulse, shimmer, blink
- **9 component class groups** - Layout, header, tools, sidebar, chat, messages, markdown, workspace, animations
- **75+ individual classes**
- **7 workspace color themes** (Code, Rocket, Issues, Scheduler, Skills, Wiki, Claw)

**Layout System:**
- CSS Grid: 60px header + 60px tools + 250px sidebar + 400px chat + 1fr content
- Flexbox patterns throughout
- Theme-based dynamic coloring via CSS custom properties

### Current JavaScript Architecture (Documented)

**File:** `kimi-ide-server/docs/analysis/js-architecture.md` (378 lines)

**State Structure:**
```javascript
// Global state object
state = {
  currentWorkspace: 'code',
  workspaces: {},  // 7 isolated workspace states
  ws: null,        // WebSocket reference
  wireLog: []      // Debug log
}

// Per-workspace state includes:
// - contentBuffer, thinkingBuffer
// - renderPhase (idle/ribbon_entering/ribbon_caught/ribbon_completing/pre_thinking_pause/streaming)
// - messageQueue for non-streaming phases
// - typewriter state (active, buffer, timer, processedIndex)
```

**Function Count by Category:**
- UI Management: 8 functions
- Ribbon Animation: 4 functions
- Render State Machine: 2 functions
- Content Rendering: 3 functions
- Typewriter System: 3 functions
- Pulse Symbol: 3 functions
- WebSocket: 3 functions
- Utilities: 1 function
- **Total: 32 named functions**

---

## Part 3: Streaming Render System (STREAMING_RENDER_ROADMAP.md)

### 8 Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Ribbon Animation - 150ms enter, variable caught, 200ms exit |
| 2 | ✅ | Thinking Timing - 200ms pause, 0.8s minimum visibility |
| 3 | ⚠️ | Text Burst Rendering - Markdown parsed, 5ms/char |
| 4 | ✅ | Lens Blur Pulse Symbol - `lens_blur` icon, big→small→big |
| 5 | ⚠️ | Code Block Rendering - 2ms/char, bottom-up, syntax highlighting |
| 6 | ⚠️ | Transition System - Text ↔ Code with pulse |
| 7 | ✅ | Cursor Removal - No blinking cursor |
| 8 | ⏳ | Integration Test - Full flow verification |

### Phase 3 Implementation Notes

**Current Issues:**
- Markdown parsing happens on arbitrary chunks (breaks formatting)
- DOM traversal for character reveal is complex
- Text nodes out of sync with raw buffer positions

**Requirements:**
- Parse markdown/HTML completely in RAM before displaying
- Type out character-by-character at 5ms interval
- HTML tags pre-rendered, user sees formatted text appearing
- Raw markdown NEVER visible (no "## Header" flashes)

### Phase 5 Implementation Notes

**Current Issues:**
- Syntax highlighting applied progressively causes flashing
- DOM manipulation inside highlighted code blocks is complex
- Scroll hijacking (forcing scroll to bottom every 2ms)

**Requirements:**
- Buffer until complete code block: ```lang\ncode\n```
- Type at 2ms/character (faster than text)
- Fill from BOTTOM-UP (like terminal)
- Syntax highlighting + borders render properly

### Build Order (From Roadmap)

1. Phase 1 (Ribbon) - standalone
2. Phase 4 (Pulse symbol) - needed for transitions
3. Phase 3 (Text burst) - core rendering
4. Phase 5 (Code block) - specialized rendering
5. Phase 6 (Transitions) - connect text ↔ code
6. Phase 2 (Thinking timing) - polish
7. Phase 7 (Cursor removal) - cleanup
8. Phase 8 (Integration) - final verification

---

## Part 4: The Reconciliation

### Critical Gap Analysis

**Gap 1: Architecture Mismatch**
- The streaming render system was built for a Vanilla JS architecture
- Original roadmap called for React/TypeScript
- Current implementation is a monolithic single file
- This makes parallel development impossible and debugging difficult

**Gap 2: Markdown Parsing in Chunks**
- Phase 3 requires parsing markdown in complete units
- Current implementation parses arbitrary chunks
- This causes broken HTML structure when chunks cut through markdown syntax

**Gap 3: Syntax Highlighting + Animation**
- Phase 5 requires terminal-style bottom-up fill with syntax highlighting
- highlight.js replaces text with HTML spans
- Animating character reveal inside syntax-highlighted spans is extremely complex
- Current approach causes visual flashing

**Gap 4: State Machine Complexity**
- The render state machine (idle → ribbon → caught → completing → pause → streaming)
- Combined with message queuing and typewriter state
- Creates a complex state synchronization problem

### What Works Well

1. **CSS Architecture** - The theme system, glass morphism, and animations are solid
2. **Render State Machine Concept** - Phases and transitions are well-defined
3. **Workspace Isolation** - Per-workspace state prevents interference
4. **WebSocket Integration** - Message routing and buffering work

### What Needs Complete Rewrite

1. **Typewriter System** - Both text and code typewriters need architectural overhaul
2. **Markdown Parsing Strategy** - Need to buffer until complete parseable units
3. **Syntax Highlighting Integration** - Need approach that doesn't conflict with animation
4. **File Structure** - Must modularize before any further development

---

## Part 5: Path Forward - Two Options

### Option A: Fix Vanilla JS (Short Term)

**Approach:** Fix the current implementation while keeping it Vanilla JS

**Pros:**
- Faster to get working
- No build system needed
- Can be done immediately

**Cons:**
- Still a maintenance nightmare
- No type safety
- No component reusability
- Eventually needs rewrite anyway

**Implementation Plan:**
1. Extract all CSS into modular CSS files (css/ folder)
2. Extract all JS into ES modules (js/ folder)
3. Rewrite typewriter system with proper chunking
4. Fix markdown parsing to respect boundaries
5. Implement better syntax highlighting integration

### Option B: Migrate to React/TypeScript (Proper Solution)

**Approach:** Scaffold React + TypeScript project and migrate functionality

**Pros:**
- Aligns with original architecture roadmap
- Component-based, maintainable
- Type safety
- Can use React streaming patterns

**Cons:**
- More upfront work
- Need build system (Vite)
- Migration takes time

**Implementation Plan:**
1. Create `kimi-ide-client/` with Vite + React + TypeScript
2. Port CSS to CSS Modules or styled-components
3. Create React components:
   - `Workspace` - Layout component
   - `ChatArea` - Message display
   - `TypewriterText` - Animated text rendering
   - `CodeBlock` - Syntax highlighted code
   - `Ribbon` - Animation component
   - `PulseSymbol` - Status indicator
4. Implement streaming render with React patterns
5. Port WebSocket logic to custom hook

### Recommendation

**Go with Option B (React/TypeScript).**

The Vanilla JS codebase has become too complex to safely extend. The streaming render system requires precise state management that React's declarative model handles much better. The current single-file approach is blocking parallel development.

---

## Part 6: Detailed CSS Migration Guide

### CSS Variables to Preserve

**Core Variables (:root):**
```css
--bg-solid: #000000;
--color-primary: #00d4ff;
--color-secondary: #00a8cc;
--border-primary: rgba(0, 212, 255, 0.3);
--border-glow: rgba(0, 212, 255, 0.6);
--glass-bg: rgba(0, 212, 255, 0.05);
--text-white: #ffffff;
--text-dim: rgba(255, 255, 255, 0.6);
--header-height: 60px;
--tools-width: 60px;
--sidebar-width: 250px;
--chat-width: 400px;
```

**Theme Variables (Dynamic):**
```css
--theme-primary: <workspace-color>;
--theme-primary-rgb: <workspace-rgb>;
--theme-border: rgba(<rgb>, 0.3);
--theme-border-glow: rgba(<rgb>, 0.6);
```

### Animations to Preserve

All 7 keyframe animations must be preserved:
- `ribbon-enter` (150ms)
- `ribbon-pulse` (800ms)
- `ribbon-exit` (200ms)
- `shimmer` (1500ms)
- `lens-pulse-continuous` (1200ms)
- `lens-pulse-once` (800ms)
- `blink` (1000ms) - legacy, can remove

### Component Classes Mapping

| Current Class | React Component | Notes |
|--------------|-----------------|-------|
| `.app-container` | `App` | Main layout grid |
| `.workspace` | `Workspace` | 7 workspace instances |
| `.workspace-sidebar` | `Sidebar` | Thread list |
| `.workspace-chat` | `ChatArea` | Messages + input |
| `.workspace-content` | `ContentArea` | Tabs, diffs, etc. |
| `.chat-messages` | `MessageList` | Message container |
| `.message-user` | `UserMessage` | User bubble |
| `.message-assistant` | `AssistantMessage` | Assistant bubble |
| `.typewriter-text` | `Typewriter` | Animated text |
| `.code-block-wrapper` | `CodeBlock` | Syntax highlighted code |
| `.ribbon-container` | `Ribbon` | Animation overlay |
| `.pulse-symbol` | `PulseSymbol` | Status indicator |
| `.thinking-section` | `ThinkingSection` | Collapsible thinking |

---

## Part 7: Streaming Render Requirements for React

### State Machine (React Implementation)

```typescript
// Render phase state
type RenderPhase = 
  | 'idle'
  | 'ribbon_entering'    // 150ms minimum
  | 'ribbon_caught'       // Waiting for turn_begin
  | 'ribbon_completing'   // 200ms exit
  | 'pre_thinking_pause'  // 200ms delay
  | 'streaming';          // Active content rendering

// Per-workspace state
type WorkspaceState = {
  renderPhase: RenderPhase;
  messageQueue: WireMessage[];
  contentBuffer: string;
  processedIndex: number;
  pendingTurnEnd: boolean;
  // ... other fields
};
```

### Typewriter Component Interface

```typescript
interface TypewriterProps {
  content: string;           // Raw markdown content
  speed: number;             // ms per character (5 for text, 2 for code)
  onComplete: () => void;    // Called when done
  isCodeBlock: boolean;      // Use terminal-style bottom-up
  syntaxHighlight: boolean; // Apply highlight.js
}
```

### Animation Timing Constants

```typescript
const TIMING = {
  RIBBON_ENTER: 150,
  RIBBON_EXIT: 200,
  PRE_THINKING_PAUSE: 200,
  THINKING_MIN_DURATION: 800,
  TEXT_TYPEWRITER: 5,
  CODE_TYPEWRITER: 2,
  PULSE_SINGLE: 800,
  CODE_TRANSITION_DELAY: 400,
  CODE_RESUME_DELAY: 300,
} as const;
```

---

## Part 8: Success Criteria (From Original Roadmaps)

### Individual Phase Checks

- [ ] Ribbon visible immediately on send
- [ ] Ribbon completely gone before thinking appears
- [ ] Lightbulb does NOT appear before 200ms delay
- [ ] Lightbulb visible at least 0.8s
- [ ] Raw markdown NEVER visible
- [ ] Buffer accumulates until complete unit
- [ ] Bold, italic, headers render correctly
- [ ] Icon is `lens_blur`
- [ ] Animation: big → small → big
- [ ] New characters appear at BOTTOM of code block
- [ ] 2ms interval for code, 5ms for text
- [ ] Syntax highlighting active
- [ ] NO cursor visible anywhere
- [ ] Pulse appears BEFORE code block
- [ ] Text → Code → Text transitions work

### Integration Test Flow

```
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
```

---

## Appendix A: File Structure Comparison

### Current (Vanilla JS)

```
kimi-ide-server/
├── public/
│   └── index.html          (2,346 lines - EVERYTHING)
├── server.js
└── package.json
```

### Target (React + Modular)

```
kimi-ide-client/          (NEW React app)
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── Workspace/
│   │   ├── Sidebar/
│   │   ├── ChatArea/
│   │   ├── ContentArea/
│   │   ├── Typewriter/
│   │   ├── CodeBlock/
│   │   ├── Ribbon/
│   │   ├── PulseSymbol/
│   │   └── ThinkingSection/
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useTypewriter.ts
│   │   └── useWorkspace.ts
│   ├── state/
│   │   └── workspaceStore.ts
│   ├── styles/
│   │   ├── variables.css
│   │   ├── animations.css
│   │   └── components/
│   └── types/
│       └── index.ts
├── index.html
├── vite.config.ts
└── package.json

kimi-ide-server/          (Existing backend)
├── src/
│   ├── server.ts
│   ├── wire/
│   └── firestore/
├── public/               (serves built client)
└── package.json
```

---

## Appendix B: Known Issues from Current Implementation

1. **Race Conditions** - Multiple workspaces can interfere if they update global state
2. **Timer Cleanup** - Some timers not properly cleaned up on rapid workspace switches
3. **Memory Leaks** - DOM nodes may accumulate if not properly removed
4. **Scroll Hijacking** - Forced scrolling makes user scrolling impossible
5. **Syntax Highlight Flashing** - Re-highlighting every 20 chars causes visual artifacts
6. **Markdown Boundary Issues** - Chunks can cut through markdown syntax
7. **No Type Safety** - All state is loosely typed, prone to runtime errors

---

*This document serves as the single source of truth. Any changes to architecture or implementation must update this document.*
