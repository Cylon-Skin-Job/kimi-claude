# Project Overview and Architecture Report

User

Please do an overall read of my project and report back to me.

Assistant

I'll do a comprehensive read of your project and report back. Let me explore the structure and key files.Let me read more key files to understand the architecture:I now have a comprehensive understanding of your project. Here's my overall report:

---

## Project Overview: **Kimi IDE** (kimi-claude)

### What It Is
A **web-based IDE** that integrates with Kimi CLI's wire mode (`kimi --wire --yolo`) to provide an AI-powered development environment. It's a "thin-client" architecture where the backend handles all state and intelligence, and the frontend is purely for rendering.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (React + TypeScript + Vite)                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Components │◄─│   Store    │◄─│   Hooks    │◄─│  ws-client │    │
│  │  (Pure UI) │  │ (Zustand)  │  │  (Bridge)  │  │ (WebSocket)│    │
│  └────────────┘  └────────────┘  └────────────┘  └─────┬──────┘    │
└────────────────────────────────────────────────────────│───────────┘
                                                         │
                                    WebSocket (ws://localhost:3001)
                                                         │
┌────────────────────────────────────────────────────────│───────────┐
│  SERVER (Node.js + Express + WebSocket)                │           │
│  ┌─────────────────────────────────────────────────────┘           │
│  │  Main: server.js (1,400 lines)                                   │
│  │  - Thread management (SQLite-backed)                             │
│  │  - File explorer API                                             │
│  │  - Wire protocol bridge (JSON-RPC over stdio)                    │
│  │  - Agent persona system                                          │
│  │  - File watcher with TRIGGERS.md automations                     │
│  │  - Wiki hooks                                                    │
│  └──────────────────────────────────────────────────────────────────┘
│                              │
│                              ▼
│                    ┌─────────────────┐
│                    │  Kimi CLI Wire  │
│                    │ (--wire --yolo) │
│                    └─────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Stats

| Component | Files | Lines (appx) |
|-----------|-------|--------------|
| **Client** (`kimi-ide-client/src/`) | 60+ | ~8,000 |
| **Server** (`kimi-ide-server/`) | 15+ libs | ~3,000 |
| **AI System** (`ai/`) | 750+ files | Extensive |
| **Docs** (`docs/`) | 9 specs | ~2,000 |

---

## Client Structure (`kimi-ide-client/`)

### Tech Stack
- **React 19** + **TypeScript 5.9**
- **Vite 7** for build/dev
- **Zustand** for state management
- **Marked** + **highlight.js** for Markdown

### Key Directories
| Directory | Purpose |
|-----------|---------|
| `src/components/` | UI components (App, ChatArea, Sidebar, ToolsPanel, file-explorer, wiki, tickets, agents, modals, Robin overlay) |
| `src/state/` | Zustand stores (panelStore, fileStore, agentStore, ticketStore, wikiStore) |
| `src/lib/` | Core libraries (ws-client, panels, file-tree, segment renderers, tool renderers, text transforms) |
| `src/types/` | TypeScript definitions |
| `src/hooks/` | React hooks (useWebSocket, useFileTree, usePanelData) |

### Dynamic Panel System
Panels are discovered at runtime from `ai/panels/` folders. Each panel has:
- `index.json` — config (type, icon, theme, layout)
- Optional `ui/` folder — runtime-loaded plugin modules

---

## Server Structure (`kimi-ide-server/`)

### Key Libraries (`lib/`)
| Module | Purpose |
|--------|---------|
| `thread/` | Thread management (SQLite-backed persistent conversations) |
| `db.js` | SQLite database wrapper |
| `watcher/` | File system watcher with declarative filters |
| `triggers/` | TRIGGERS.md parser, cron scheduler, hold registry |
| `runner/` | Agent execution monitoring |
| `session/` | Agent persona session loader |
| `wiki/` | Wiki sync hooks |
| `secrets.js` | macOS Keychain secrets manager |
| `file-ops.js` | File operations with archive support |
| `event-bus.js` | Internal event system |

### Features
- **Thread Management**: Named, persistent conversations with lifecycle (active/suspended)
- **Agent Personas**: Session-based agents with MEMORY.md, PROMPT.md, WORKFLOW.md
- **File Watcher**: Declarative filters in `filters/` folder, TRIGGERS.md support
- **Cron Scheduler**: Time-based agent triggers
- **Wiki Sync**: Bi-directional sync with GitLab wiki

---

## AI System (`ai/`)

### Panels (8 active)
| Panel | Type | Purpose |
|-------|------|---------|
| `explorer` | file-explorer | Main coding workspace |
| `agents` | agent-tiles | Background agent dashboard |
| `issues` | ticket-board | KIMI-XXXX ticket tracking (45 tickets) |
| `wiki-viewer` | wiki-viewer | Documentation browser |
| `skills` | skill-library | Command/prompt library |
| `terminal` | terminal | Terminal interface |
| `capture` | capture | Screenshot/spec capture system |

### Wiki System (`ai/wiki-data/`)
- **Project docs**: home, gitlab, hooks, model-config, etc.
- **System docs**: setup, system-overview, workflow-design, etc.
- **Providers**: anthropic, openai, google, deepseek, etc.

### Agent System (`ai/panels/agents/`)
3 System agents with workflows:
- **code-manager**: Bug Fix, Code Review, Test Generation
- **ops-manager**: Dependency Audit, Documentation
- **wiki-manager**: Edge Consistency, Wiki Audit, Wiki Update

---

## Current Status

### What's Working
✅ WebSocket bridge to Kimi CLI  
✅ Streaming content rendering (think, text, tool calls)  
✅ Thread management (create, open, rename, delete)  
✅ File explorer with tree view  
✅ Dynamic panel discovery  
✅ Agent persona sessions  
✅ SQLite-backed rich history  
✅ File watcher with TRIGGERS.md  
✅ Wiki sync to GitLab  
✅ Ticket system (KIMI-0005 through KIMI-0045)  
✅ Secrets manager (Keychain)  

### Active Development Areas
- Chat rendering pipeline (segment-based streaming)
- Tool call grouping and summarization
- Agent workflow execution
- Modal/Toast component system
- Robin overlay (quick actions)

### File Counts by Type
```
TypeScript/React:  ~60 files
CSS:               ~15 files
Documentation:     ~100+ markdown files
Specs:             ~40 files in ai/panels/capture/specs/
Tickets:           45 tickets (41 open, 4 done)
Wiki Pages:        50+ pages
```

---

## Notable Design Patterns

1. **Pulse-Driven Rendering**: 500ms heartbeat for UI transitions (documented but not yet fully implemented)
2. **Segment-Based Streaming**: Content arrives as typed segments (think, text, tool_call, tool_result)
3. **Thin Client**: All state in backend, React is pure rendering
4. **Dynamic Discovery**: Panels loaded from filesystem at runtime
5. **Event Bus**: Internal server events for cross-cutting concerns
6. **Hardwired Enforcement**: `settings/` folders are write-locked for AI

---

## Security & Secrets
- All credentials stored in **macOS Keychain** (account: `kimi-ide`)
- No `.env` files, no plain text secrets
- Two-pass path security for symlink resolution

---

Would you like me to dive deeper into any specific area?

**TOOL CALL(S)**
