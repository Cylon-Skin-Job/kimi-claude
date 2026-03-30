# General project read report

User

Please do a general read of my project and report back to me.

Assistant

Based on my comprehensive read of your project, here's the report:

---

## Project Overview: **Kimi IDE**

A web-based IDE that integrates Kimi CLI (`kimi --wire --yolo`) to provide an AI-powered development environment. It uses a thin-client architecture with a React frontend and Node.js WebSocket bridge server.

---

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (Browser) — React 19 + TypeScript + Vite           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │Components│◄──│ Zustand  │◄──│  Hooks   │◄──│ WS Client│ │
│  │(Pure UI) │   │  Store   │   │(Bridge)  │   │          │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket :3001
┌───────────────────────────┼─────────────────────────────────┐
│  SERVER (Node.js)         │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Express + WebSocket Server (kimi-ide-server/)       │  │
│  │  • Thread management (SQLite-backed)                 │  │
│  │  • File explorer with path security                  │  │
│  │  • Wire protocol translation (JSON-RPC)              │  │
│  │  • Agent/persona support with SESSION.md             │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                     stdin/stdout (JSON-RPC)                  │
│                            │                                 │
│                   ┌────────┴────────┐                        │
│                   │  Kimi CLI Wire  │                        │
│                   │ (--wire --yolo) │                        │
│                   └─────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Directory Structure

| Directory | Purpose |
|-----------|---------|
| `kimi-ide-client/` | React + TypeScript + Vite frontend |
| `kimi-ide-server/` | Node.js WebSocket bridge server |
| `ai/` | Project intelligence layer (panels, wiki, agents, state) |
| `docs/` | Architecture specs and documentation |
| `.cursor/rules/` | AI coding rules |

---

### Key Technologies

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, Zustand 5 |
| **Backend** | Node.js, Express 5, WebSocket (ws), SQLite (better-sqlite3) |
| **Styling** | CSS with Tron/Raven OS aesthetic |
| **Protocol** | JSON-RPC 2.0 over WebSocket + stdio |

---

### Current State

**Build Status:** ✅ Clean build (no errors)
```
dist/index.html                   0.80 kB │ gzip:   0.48 kB
dist/assets/index-ByiQtOO9.css   58.49 kB │ gzip:  10.08 kB
dist/assets/index-BuExYEkW.js   347.27 kB │ gzip: 104.64 kB
```

**Git Status:** 24 modified files, 21 untracked files  
**Recent Commits:** Working on Orb component, wiki updates, workflow skills, database architecture

---

### Panels System (Dynamic Discovery)

The IDE uses dynamic panel discovery from `ai/panels/`:

| Panel | Type | Purpose |
|-------|------|---------|
| `explorer` | file-explorer | Main coding workspace with threads |
| `agents` | agent-tiles | Background agent dashboard |
| `capture` | capture | Screen capture & annotations |
| `issues` | ticket-board | KIMI-XXXX ticket tracking |
| `skills` | skill-library | Reusable capability registry |
| `terminal` | terminal | Shell access |
| `wiki-viewer` | wiki-viewer | Documentation browser |

Each panel has its own:
- `panel.json` configuration
- Thread storage in `threads/`
- Theming (primary color, CSS variables)

---

### Thread Management

- **Storage:** SQLite (`ai/system/robin.db`) + CHAT.md files
- **Format:** Rich exchange format with tool calls, arguments, results
- **Lifecycle:** Create → Open → Message → (Resume/Suspend/Delete)
- **Daily Threads:** Auto-created per-date threads (`YYYY-MM-DD`)
- **Agent Personas:** SESSION.md-driven with system context injection

---

### Key Client Components

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Root component, panel routing, theme application |
| `ChatArea.tsx` | Chat UI with context usage, message list, input |
| `MessageList.tsx` | Routes history→InstantRenderer, current→LiveRenderer |
| `LiveSegmentRenderer.tsx` | Animated typing, orb gatekeeper, turn finalization |
| `InstantSegmentRenderer.tsx` | Collapsed history rendering (no animation) |
| `Sidebar.tsx` | File explorer, thread list |
| `RobinOverlay.tsx` | AI assistant overlay (raven icon) |
| `ToolCallBlock.tsx` | Tool execution visualization |

---

### State Management (Zustand)

**`panelStore.ts`** — Central store with:
- Per-panel state (messages, segments, current turn)
- Thread management (list, current, CRUD)
- WebSocket reference
- Segment streaming with grouping logic

---

### Render System Architecture

The project has a sophisticated **reveal-based rendering system**:

1. **Streaming tokens** arrive from wire (text, think, tool calls)
2. **Segments** are built in arrival order (grouped by type)
3. **LiveSegmentRenderer** gates display with an "orb" animation
4. **Typewriter effect** reveals content character-by-character
5. **Turn finalization** happens when both stream ends AND reveal completes

**Timing Constants:**
```typescript
RIBBON_ENTER: 150ms
THINKING_MIN_DURATION: 800ms
TEXT_TYPEWRITER: 5ms/char
CODE_TYPEWRITER: 2ms/char
```

---

### Server Capabilities

- **WebSocket** client connections with reconnection
- **Wire process** spawning (`kimi --wire --yolo --session`)
- **File explorer** with two-pass path security (symlink-safe)
- **Thread management** with SQLite persistence
- **Agent triggers** (TRIGGERS.md + cron scheduler)
- **File watcher** with declarative filters
- **Modal system** for UI prompts from server
- **Wiki hooks** for topic tree watching

---

### Security Features

- Path traversal protection (two-pass validation)
- Settings folder write-lock (hardwired enforcement)
- macOS Keychain for secrets (no `.env` files)
- Symlink resolution checks

---

### Development Workflow

```bash
# Quick start both servers
./restart-kimi.sh

# Or separately:
cd kimi-ide-server && node server.js      # :3001
cd kimi-ide-client && npm run dev         # :5173

# Build for production
cd kimi-ide-client && npm run build       # → dist/
```

---

### Notable Design Patterns

1. **Thin Client:** Frontend is pure rendering, all intelligence in backend
2. **Pulse-Driven Rendering:** 500ms heartbeat orchestrates visual transitions
3. **Segment-Based Streaming:** Ordered queue preserves token arrival sequence
4. **One Bridge:** All engine→React flows through single hook
5. **Dynamic Discovery:** Panels self-register via `panel.json` files

---

### Documentation Quality

Excellent documentation coverage:
- `AGENTS.md` — Comprehensive agent guide (584 lines)
- `docs/RENDER_ENGINE_ARCHITECTURE.md` — Pulse engine spec
- `docs/TYPESCRIPT_REACT_SPEC.md` — Coding patterns & forbidden patterns
- `docs/STREAMING_CONTENT.md` — Wire streaming handling
- `docs/WIRE_PROTOCOL.md` — JSON-RPC reference
- `docs/STYLE_GUIDE.md` — Visual patterns

---

### Potential Areas of Interest

1. **Active Development:** Recent commits show work on Orb component, Robin overlay, tool renderers
2. **Test Suite:** Playwright E2E tests in `e2e/` directory
3. **Issue Tracking:** 45+ KIMI tickets in `ai/panels/issues/`
4. **Wiki System:** Topic-based documentation in `ai/wiki-data/`
5. **Agent System:** Background agents with cron scheduling

---

Is there a specific area you'd like me to dive deeper into?

**TOOL CALL(S)**
