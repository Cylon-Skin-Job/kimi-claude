# Kimi IDE - Architecture Roadmap

## Overview

A web-based IDE that uses Kimi CLI in wire mode (`--wire --yolo`) as the agent backend. Built with a thin-client philosophy: all state and intelligence lives on the backend, frontend is purely for rendering.

---

## Core Philosophy

### Thin Client Architecture
- **Frontend**: React app running on Firebase Hosting (or localhost for dev)
  - Renders what backend tells it to
  - Sends user inputs to backend
  - No business logic, minimal state
  
- **Backend**: Node.js server on local MacBook (closet server)
  - Spawns/manages Kimi CLI wire processes
  - Handles all JSON-RPC protocol logic
  - Persists full state (survives frontend refresh)
  - Logs everything to Firestore in real-time
  - Triggers Launchpad extraction pipeline

### Communication
- WebSocket between frontend and backend
- Backend persists to Firestore for durability
- Cloudflare Tunnel exposes backend to internet (for remote access)

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [≡]  Project Name                           [icons]           │  ← 60px header, cyan border
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

---

## User Modes

Three interaction modes, one interface:

### Riff Mode
- Fast, loose, brainstorming
- No tools, just chat
- Take notes, iterate ideas
- Like talking to yourself but Kimi captures it

### Vibe Mode
- Quick edits, experiments
- File tools active
- Try things, undo, try again
- Disposable, no persistence pressure

### Plan Mode
- Structured, step-by-step
- Kimi writes plan → you validate → executes
- Spawns sub-wires for parallel work
- Hands off to autonomous pipeline

**Mode switching:** Badge in header shows current mode. Kimi can suggest mode shifts ("This feels like a plan").

---

## Autonomous Pipeline

After Plan mode approval, runs hands-off but visible:

```
User approves plan
       ↓
┌──────┴──────┐
│   BUILD     │ ← sub-wires execute plan steps
└──────┬──────┘
       ↓
┌──────┴──────┐
│   REVIEW    │ ← self-checks, tests, lint
└──────┬──────┘
       ↓
┌──────┴──────┐
│  VALIDATE   │ ← verifies against requirements
└──────┬──────┘
       ↓
┌──────┴──────┐
│    MERGE    │ ← commits to branch
└──────┬──────┘
       ↓
┌──────┴──────┐
│  DOCUMENT   │ ← updates wiki, DECISIONS.md
└─────────────┘
```

**UI:** Pipeline visualized in content area. Each stage expandable. Abort button always available.

---

## Session Management

### Thread = Wire Session
- Each thread = one `kimi --wire --yolo` process
- Multiple threads can run simultaneously
- Visual indicator: 🟢 alive / ⚫ dead

### Thread Lifecycle
1. **New Chat**: Spawn new wire process, fresh context
2. **Continue**: Reconnect to existing wire (if alive)
3. **Background**: Start new thread, old keeps running
4. **Kill**: Explicitly stop wire process (ellipsis menu)

### Ellipsis Menu per Thread
- **Add to chat**: Prefills input with context reference request
- **Kill session**: Stop the wire process
- **Rename**: Change thread title
- **Delete**: Remove from Firestore

### Context Reference ("Add to chat")
When clicked, input prefills:
```
Please reference this chat history for anything relevant to what we are discussing, use sub agents to avoid flooding your context
```
User adds their actual question and sends.

---

## Content Area Tabs

**Per-thread tab system:**
- Newest tab = leftmost
- Tabs persist per thread (stored in Firestore)
- Switch threads → restore that thread's tabs

**Tab types:**
- `file.tsx` - code editor
- `diff` - file changes
- `pipeline` - autonomous stage visualization
- `preview` - rendered output
- `logs` - raw wire events

**Persistence:**
```javascript
thread.metadata.open_tabs: [
  { type: "file", path: "src/auth.ts", cursor_line: 45 },
  { type: "pipeline", stage: "build" }
]
```

---

## Firestore Schema

**Aligned with Raven OS for cross-product compatibility**

**Collection path:** `users/{userId}/threads/{threadId}/messages`

**Document structure:**
```javascript
{
  // Core fields (same as Raven OS)
  user: "string",                    // User message content
  assistant: "string",               // Assistant response content
  created_at: Timestamp,             // Server timestamp
  app_slug: "kimi-ide",              // App identifier
  
  // Metadata map (flexible storage for everything else)
  metadata: {
    // Wire protocol events
    wire_events: [...],
    
    // Tool calls and results
    tool_calls: [...],
    
    // File operations
    file_edits: [...],
    
    // Session info
    session_id: "string",
    mode: "riff" | "vibe" | "plan",
    
    // Metrics
    tokens_used: number,
    duration_ms: number,
  },
  
  // Optional top-level fields
  display_ts: "string",
  metrics: {...},
}
```

**Thread document:**
```javascript
{
  title: "string",
  created_at: Timestamp,
  last_modified: Timestamp,
  session_alive: boolean,
  mode: "riff" | "vibe" | "plan",
  metadata: {
    open_tabs: [...],
    active_tab_index: number,
    pipeline_state: {...}  // If autonomous pipeline running
  }
}
```

---

## Wire Protocol Handling

### Backend Responsibilities
1. Spawn `kimi --wire --yolo` process per thread
2. Maintain JSON-RPC over stdio connection
3. Parse wire events (TurnBegin, StepBegin, ContentPart, ToolCall, etc.)
4. Forward relevant events to frontend via WebSocket
5. Log ALL events to Firestore in real-time
6. Handle mode-specific behavior (Riff=no tools, Vibe=tools, Plan=structured)

### Frontend Responsibilities
1. Receive wire events from backend WebSocket
2. Render streaming tokens (character-by-character animation)
3. Display tool calls in real-time
4. Show pipeline visualization in content area
5. Manage per-thread tabs
6. Send user inputs to backend

---

## Visual Components

### Chat Bubbles (adapted from Raven OS)
- User: Right-aligned, cyan-tinted glassmorphism
- Assistant: Left-aligned, transparent background
- Markdown rendering with syntax highlighting
- Copy buttons on code blocks
- Timestamps with "Today"/"Yesterday" logic

### Mode Indicator
- Badge in header: [RIFF] | [VIBE] | [PLAN]
- Color-coded (Riff=blue, Vibe=green, Plan=purple)
- Click to manually switch (with confirmation)

### Pipeline Visualization
- Progress bar per stage
- Sub-wire cards showing parallel tasks
- Expandable logs per stage
- Abort button (prominent, red)

### 5-Line Scrolling Code Edit Box
- Fixed height (5 lines)
- Shows file edits in real-time as they stream
- Scrolls automatically to show latest changes

---

## Development Phases

### Phase 1: Foundation
- [ ] Basic Node server with WebSocket
- [ ] Spawn Kimi CLI wire process
- [ ] Basic HTML/CSS layout (header, sidebar, chat, content)
- [ ] Connect frontend to backend WebSocket
- [ ] Display raw wire events in chat

### Phase 2: Chat Experience
- [ ] Raven OS-style chat bubbles
- [ ] Character-by-character streaming
- [ ] Thread list with alive/dead indicators
- [ ] New chat button
- [ ] "Add to chat" functionality

### Phase 3: Modes
- [ ] Riff mode (chat only)
- [ ] Vibe mode (tools enabled)
- [ ] Plan mode (structured output)
- [ ] Mode indicator in header
- [ ] Mode switching

### Phase 4: Session Management
- [ ] Multiple concurrent threads
- [ ] Kill session (ellipsis menu)
- [ ] Session alive/dead heartbeat
- [ ] Context reference via "Add to chat"

### Phase 5: Content Area Tabs
- [ ] Per-thread tab system
- [ ] Tab persistence in Firestore
- [ ] File editor tab
- [ ] Diff view tab

### Phase 6: Autonomous Pipeline
- [ ] Build stage with sub-wires
- [ ] Review stage
- [ ] Pipeline visualization
- [ ] Abort functionality

### Phase 7: Firestore Integration
- [ ] Real-time logging
- [ ] Thread persistence
- [ ] Tab state persistence

### Phase 8: Deployment
- [ ] Cloudflare Tunnel
- [ ] Firebase Hosting
- [ ] Documentation

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| Frontend Hosting | Firebase Hosting |
| Backend | Node.js + Express |
| WebSocket | ws library |
| Process Management | node:child_process |
| Persistence | Firestore |
| Tunnel | Cloudflare Tunnel |
| Styling | CSS (Raven OS-inspired) |

---

## Key Decisions

1. **Local Backend**: MacBook in closet runs Node server for persistent processes
2. **Thin Client**: Frontend is dumb, all intelligence on backend
3. **Wire Protocol**: Use Kimi CLI's native `--wire` mode
4. **YOLO Mode**: Auto-approve all actions (`--yolo`)
5. **Concurrent Sessions**: Multiple threads can run simultaneously
6. **Per-Thread Tabs**: Each thread has its own tab stack
7. **Three Modes**: Riff (brainstorm), Vibe (edit), Plan (structured)
8. **Autonomous Pipeline**: Build/Review/Validate/Merge/Document runs hands-off

---

## References

- **Raven OS**: Chat UI inspiration (private repo)
- **Kimi CLI Wire Mode**: `kimi --wire --yolo`
- **Launchpad**: Firestore project for extraction pipeline

---

## Current Status

- ✅ Basic Node server with WebSocket
- ✅ HTML/CSS layout prototype (localhost:3001)
- ✅ Cyan Tron-style theming
- ⏳ Wire protocol integration
- ⏳ Chat bubble streaming
- ⏳ Thread management
- ⏳ Modes (Riff/Vibe/Plan)
- ⏳ Per-thread tabs
- ⏳ Autonomous pipeline
- ⏳ Firestore integration

---

*Last Updated: 2026-03-01*
