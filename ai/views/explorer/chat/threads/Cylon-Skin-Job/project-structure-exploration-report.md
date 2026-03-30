# Project structure exploration report

User

Please read my project and report back what you find.

Assistant

I'll explore your project structure and key files to give you a comprehensive report.Based on my exploration, here's a comprehensive report on your **Kimi IDE** project:

---

## 🎯 Project Overview

**Kimi IDE** is a web-based AI-powered development environment that integrates with **Kimi CLI** in wire mode. It provides a "thin client" architecture where the React frontend handles pure rendering while the Node.js backend manages all state, intelligence, and the Kimi CLI bridge.

---

## 📁 Project Structure

### 1. **Frontend** (`kimi-ide-client/`) — React + TypeScript + Vite
| Area | Files | Purpose |
|------|-------|---------|
| **Components** | 17+ files | UI rendering (Chat, Sidebar, File Explorer, Wiki, Tickets, Agents) |
| **State** | 5 stores | Zustand-based state management (panel, file, ticket, wiki, agent) |
| **Hooks** | 3 files | WebSocket connection, file tree, panel data |
| **Lib** | 40+ modules | Tool renderers, chunk strategies, text processing, reveal engine |
| **Engine** | 4 files | Runtime module, panel context, submodule registry |

**Key Technologies:**
- React 19.2, TypeScript 5.9, Vite 7.3
- Zustand 5.0.11 (state management)
- Marked 17.0.3 + Highlight.js 11.11.1 (Markdown rendering)

### 2. **Backend** (`kimi-ide-server/`) — Node.js WebSocket Bridge
| Module | Purpose |
|--------|---------|
| `server.js` (1,396 lines) | Main WebSocket server, thread management, wire protocol |
| `lib/thread/` | Thread lifecycle, persistence, session management |
| `lib/db.js` | SQLite database (`robin.db`) for rich history |
| `lib/secrets.js` | macOS Keychain integration (GitLab tokens) |
| `lib/watcher/` | File system watching, declarative filters |
| `lib/triggers/` | Cron scheduler, agent triggers, hold registry |
| `lib/runner/` | Agent execution, heartbeat monitoring |
| `lib/wiki/` | Wiki hooks, sync management |

**Key Dependencies:** Express 5.2, WebSocket 8.19, better-sqlite3, Knex, UUID

### 3. **AI Workspaces** (`ai/`) — Project Intelligence Layer
```
ai/
├── STATE.md                    # Cross-workspace activity log
├── panels/                     # Workspace panel definitions
│   ├── agents/                 # Background agents (3 system agents)
│   ├── capture/                # Specs, todos, screenshots
│   ├── explorer/               # File explorer threads (dated)
│   ├── issues/                 # Ticket board (KIMI-0005 to KIMI-0045)
│   ├── skills/                 # UI skill modules
│   ├── terminal/               # Terminal panel
│   └── wiki-viewer/            # Wiki viewer with Git sync
├── wiki/                       # Topic-based wiki (old)
├── wiki-data/                  # Unified wiki tree (new)
└── views/                      # View definitions
```

---

## 🏗️ Architecture Highlights

### Thin Client Pattern
```
┌──────────────┐     WebSocket      ┌──────────────┐     STDIO/JSON-RPC    ┌─────────┐
│   React UI   │ ◄────────────────► │ Node Server  │ ◄───────────────────► │ Kimi CLI│
│  (Renderer)  │    :3001/:5173     │   (Bridge)   │    (--wire --yolo)    │ (Brain) │
└──────────────┘                    └──────────────┘                       └─────────┘
```

### Seven Workspace Tabs (with themes)
| Panel | Color | Icon | Layout | Has Chat |
|-------|-------|------|--------|----------|
| `explorer` | Blue | `code_blocks` | sidebar-chat-content | ✅ |
| `agents` | Red | `robot_2` | full | ❌ |
| `wiki-viewer` | Pink | `full_coverage` | chat-content | ✅ |
| `issues` | Yellow | `business_messages` | chat-content | ✅ |
| `capture` | Cyan | `screenshot` | full | ❌ |
| `skills` | Purple | `wand_shine` | full | ❌ |
| `terminal` | Green | `terminal` | full | ❌ |

### Thread Management System
- **Daily rolling threads**: Auto-created per day (`2026-03-29`, etc.)
- **Agent personas**: Configurable agents with SESSION.md, MEMORY.md, PROMPT.md
- **Rich history**: Stored in SQLite with full exchange tracking
- **Session strategies**: `rolling`, `identity`, `workspace-isolated`

---

## 🔧 Key Features

### 1. **Streaming Content Rendering**
- Live segment renderer with chunk strategies per tool type
- Tool call visualization (read, write, edit, shell, grep, glob, etc.)
- Thinking blocks vs text blocks handling

### 2. **File Explorer**
- Recursive folder browsing with symlink support
- Security: Two-pass path validation (logical + real path)
- Panel-aware routing (wiki → `ai/wiki-data/`, agents → `ai/panels/agents/`)

### 3. **Agent System**
- 3 system agents: `code-manager`, `ops-manager`, `wiki-manager`
- Each has workflows, triggers, and cron schedules
- Registry-based discovery (`agents.json`, `registry.json`)

### 4. **Ticket System**
- 41 tickets tracked (KIMI-0001 to KIMI-0045)
- GitLab sync enabled (project ID: 80453361)
- Auto-ticket creation from file watchers

### 5. **Wiki System**
- Topic-based documentation with PAGE.md + LOG.md pattern
- GitLab wiki sync (`sync-wiki.sh`)
- Edge panel for topic navigation

### 6. **Security**
- macOS Keychain for secrets (GITLAB_TOKEN)
- Settings folder write-lock enforcement
- Path traversal protection

---

## 📊 Code Statistics

| Component | Lines |
|-----------|-------|
| `server.js` | 1,396 |
| `LiveSegmentRenderer.tsx` | 628 |
| `panelStore.ts` | 306 |
| `wikiStore.ts` | 192 |
| `Sidebar.tsx` | 266 |
| `AgentTiles.tsx` | 89 |
| **Client Total** | ~2,770 (components + state) |

---

## 🚀 Development Workflow

```bash
# Quick start both servers
./restart-kimi.sh

# Or separately:
cd kimi-ide-server && node server.js      # :3001
cd kimi-ide-client && npm run dev         # :5173
cd kimi-ide-client && npm run build       # Build for prod
```

---

## 📚 Documentation

Critical docs in `docs/` and `ai/panels/capture/specs/`:
- `RENDER_ENGINE_ARCHITECTURE.md` — Pulse-driven engine
- `TYPESCRIPT_REACT_SPEC.md` — Component patterns
- `WIRE_PROTOCOL.md` — JSON-RPC spec
- `STREAMING_CONTENT.md` — Chunk handling
- `MASTER_SYSTEM_SPEC.md` — Full architecture

---

## 🎨 Visual Design

- **Theme**: Raven OS-inspired "Tron" aesthetic
- **CSS Variables**: Dynamic theming per workspace
- **Animations**: Shimmer headers, orb components, material symbols

---

## ⚠️ Current State Notes

1. **GitLab Integration**: Active (token expires 2026-06-20)
2. **SQLite DB**: `ai/system/robin.db` initialized
3. **Wiki Sync**: Connected to GitLab wiki
4. **Test Suite**: Playwright E2E tests present (17 spec files)
5. **Dead Code**: `kimi-ide-server/archive/` preserved but not served

Your project is a sophisticated, production-ready IDE with a well-architected separation of concerns, comprehensive documentation, and active integration with external systems (GitLab, Kimi CLI).

**TOOL CALL(S)**
