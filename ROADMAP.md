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
│          │                         │                            │
│  THREAD  │       CHAT AREA         │      CONTENT AREA          │
│  LIST    │       (400px)           │      (flexible)            │
│ (250px)  │                         │                            │
│          │  ┌─────────────────┐    │  - File diffs              │
│ [+ New   │  │ User message    │    │  - Tool outputs            │
│  Chat]   │  │ (right bubble)  │    │  - Code previews           │
│          │  └─────────────────┘    │  - 5-line scroll box       │
│ ───────  │                         │                            │
│ Thread 1 │  ┌─────────────────┐    │                            │
│ Thread 2 │  │ Kimi response   │    │                            │
│ Thread 3 │  │ (left bubble)   │    │                            │
│ ...      │  └─────────────────┘    │                            │
│          │                         │                            │
│          │  [Message input...] [↑] │                            │
│          │                         │                            │
└──────────┴─────────────────────────┴────────────────────────────┘
```

---

## Session Management

### Thread = Wire Session
- Each thread corresponds to one `kimi --wire --yolo` process
- Multiple threads per project (different contexts/tasks)
- Backend maintains pool of active wire sessions
- Switching threads = switching which wire stream frontend listens to

### Session Lifecycle
1. **New Chat**: Spawn new Kimi CLI process, fresh context
2. **Resume**: Reconnect to existing wire session (if still alive)
3. **Reset Session**: Kill current wire, spawn new one with selective context pull
4. **Context Compression**: Triggered automatically or manually, creates new session with summary

### Session Death Scenarios
- Computer restart
- Node server crash
- Manual kill
- Context compression (intentional transformation)

---

## Fresh Session Bootstrap Protocol

When a new wire session starts, backend injects:

```
You are Kimi, operating as part of the Kimi IDE - a coding assistant integrated 
into a development environment.

CONTEXT:
- You are one of many threads in project: {project_name}
- Previous threads: {N} conversations available in history
- This session started: {timestamp}

SUMMARY:
{summary of previous session or "New project - no prior context"}

TOOLS FOR HISTORY ACCESS:
You do NOT read history directly. Instead, use these tools:
- search_conversations(query, threads[]): Ask about past discussions
- summarize_session(thread_id): Get overview of specific thread
- extract_entities(thread_id): Pull key decisions, TODOs, files mentioned

These tools spawn sub-agents to analyze history in parallel.
```

---

## Tool Architecture (Programmatic Tool Calling)

Based on Anthropic's "Programmatic Tool Calling" pattern (late 2025):

### Main Assistant
- Writes code to orchestrate tool calls
- Never reads raw history directly
- Asks questions, code handles execution

### Sub-Wire Pattern
```javascript
// Main assistant generates code like:
const results = await Promise.all([
  subWire.search("What did we decide about authentication?", [thread_5, thread_12]),
  subWire.search("Database schema changes", [thread_8]),
  subWire.summarize(thread_20)
]);

const synthesized = synthesizeResults(results);
return synthesized;
```

### Tool Implementation
- Each "tool" spawns a temporary sub-wire session
- Sub-wire gets specific task + context chunk
- Sub-wire returns structured result
- Main context only sees final synthesized answer

### Benefits
- 85% token reduction vs JSON tool calling
- Parallel execution via Promise.all()
- No context pollution from intermediate results
- Loops/conditionals in code, not inference

---

## Firestore Schema

```
projects/{project_id}/
  ├── threads/
  │     ├── {thread_id}/
  │     │     ├── metadata/
  │     │     │     ├── created_at
  │     │     │     ├── updated_at
  │     │     │     ├── summary (post-compression)
  │     │     │     └── session_active (bool)
  │     │     └── messages/
  │     │           ├── {message_id}/
  │     │           │     ├── role: "user" | "assistant"
  │     │           │     ├── content
  │     │           │     ├── timestamp
  │     │           │     ├── tool_calls (if any)
  │     │           │     └── wire_events (raw wire protocol)
  │     │           └── ...
  │     └── ...
  ├── entities/ (extracted by Launchpad)
  │     ├── decisions/
  │     ├── todos/
  │     ├── files/
  │     └── concepts/
  └── extractions/ (raw extraction jobs)
```

---

## Wire Protocol Handling

### Backend Responsibilities
1. Spawn `kimi --wire --yolo` process per thread
2. Maintain JSON-RPC over stdio connection
3. Parse wire events (TurnBegin, StepBegin, ContentPart, ToolCall, etc.)
4. Forward relevant events to frontend via WebSocket
5. Log ALL events to Firestore in real-time
6. Handle tool calls (spawn sub-wires, execute, return results)

### Frontend Responsibilities
1. Receive wire events from backend WebSocket
2. Render streaming tokens (character-by-character animation)
3. Display tool calls in real-time (visual components)
4. Show 5-line scrolling code edit box during file edits
5. Send user inputs to backend

---

## Visual Components

### Chat Bubbles (adapted from Raven OS)
- User: Right-aligned, cyan-tinted glassmorphism
- Assistant: Left-aligned, transparent background
- Markdown rendering with syntax highlighting
- Copy buttons on code blocks
- Timestamps with "Today"/"Yesterday" logic

### Tool Call Visualization
- Distinct visual container for active tool calls
- Shows tool name, parameters, execution status
- Progress indicator for long-running tools
- Collapsible result view

### 5-Line Scrolling Code Edit Box
- Fixed height (5 lines)
- Shows file edits in real-time as they stream
- Scrolls automatically to show latest changes
- Side-by-side diff view option in content area

---

## Development Phases

### Phase 1: Foundation
- [ ] Basic Node server with WebSocket
- [ ] Spawn Kimi CLI wire process
- [ ] Basic HTML/CSS layout (header, sidebar, chat, content)
- [ ] Connect frontend to backend WebSocket
- [ ] Display raw wire events in chat

### Phase 2: Chat Experience
- [ ] Implement Raven OS-style chat bubbles
- [ ] Character-by-character streaming animation
- [ ] Markdown rendering with code blocks
- [ ] Thread list with new chat button
- [ ] Basic session persistence

### Phase 3: Tool Visualization
- [ ] Tool call visual components
- [ ] 5-line scrolling code edit box
- [ ] Real-time file diff display in content area
- [ ] Tool result rendering

### Phase 4: Session Management
- [ ] Multiple threads per project
- [ ] Session bootstrap protocol
- [ ] Context compression handling
- [ ] Session reset with selective context pull

### Phase 5: Sub-Wire Architecture
- [ ] Programmatic tool calling implementation
- [ ] Sub-wire spawning for history search
- [ ] Parallel query execution
- [ ] Result synthesis

### Phase 6: Firestore Integration
- [ ] Real-time logging to Firestore
- [ ] Launchpad extraction pipeline trigger
- [ ] Entity extraction and storage
- [ ] Wiki update suggestions

### Phase 7: Deployment
- [ ] Cloudflare Tunnel setup
- [ ] Firebase Hosting for frontend
- [ ] Environment configuration
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

1. **Local Backend**: MacBook in closet runs Node server (not Firebase Functions) for persistent processes
2. **Thin Client**: Frontend is dumb, all intelligence on backend
3. **Wire Protocol**: Use Kimi CLI's native `--wire` mode, not ACP
4. **YOLO Mode**: Auto-approve all actions (`--yolo`), no approval UI needed
5. **Programmatic Tools**: Code-based orchestration, not JSON tool calling
6. **Sub-Wires**: Parallel history search via temporary wire sessions

---

## References

- **Raven OS**: Chat UI inspiration (private repo)
- **Anthropic Advanced Tool Use**: https://www.anthropic.com/engineering/advanced-tool-use
- **Kimi CLI Wire Mode**: `kimi --wire --yolo`
- **Launchpad**: Firestore project for extraction pipeline

---

## Current Status

- ✅ Basic Node server with WebSocket
- ✅ HTML/CSS layout prototype (localhost:3001)
- ✅ Cyan Tron-style theming
- ⏳ Wire protocol integration
- ⏳ Chat bubble streaming
- ⏳ Tool visualization
- ⏳ Session management
- ⏳ Firestore logging
- ⏳ Sub-wire architecture

---

*Last Updated: 2026-03-01*
