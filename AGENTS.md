# AGENTS.md - kimi-claude

> Agent-focused documentation for the Kimi IDE project — a web-based IDE using Kimi CLI in wire mode as the agent backend.

## ⚠️ CRITICAL PREREQUISITE: Two Servers Required

**The Kimi IDE requires BOTH servers running simultaneously:**

| Server | Port | Command | Purpose |
|--------|------|---------|---------|
| **Backend** | 3001 | `cd kimi-ide-server && node server.js` | WebSocket bridge to Kimi CLI |
| **Frontend** | 5173 | `cd kimi-ide-client && npm run dev` | React development server |

**The connection indicator stays RED until both are running.**

### Quick Start (Both Servers)
```bash
# From project root
./restart-kimi.sh
```

### Or Start Separately
```bash
# Terminal 1 - Backend
cd kimi-ide-server
node server.js

# Terminal 2 - Frontend  
cd kimi-ide-client
npm run dev
```

---

---

## Project Overview

This is a **web-based IDE** that integrates with Kimi CLI's wire mode (`kimi --wire --yolo`) to provide an AI-powered development environment. It uses a thin-client architecture where the backend handles all state and intelligence, and the frontend is purely for rendering.

### Key Technologies
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Node.js + Express + WebSocket
- **State Management:** Zustand
- **Styling:** CSS with Raven OS-inspired Tron aesthetic
- **Protocol:** JSON-RPC 2.0 over WebSocket

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     React + TypeScript (Vite)                         │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌──────────┐  │  │
│  │  │  Components │   │   Store     │   │   Hooks     │   │  Engine  │  │  │
│  │  │  (Pure UI)  │◄──│  (Zustand)  │◄──│  (Bridge)   │◄──│  (Pulse) │  │  │
│  │  └─────────────┘   └─────────────┘   └─────────────┘   └──────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                              WebSocket (ws://localhost:3001)               │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           SERVER (Node.js)                                   │
│                                    │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Express + WebSocket Server                       │  │
│  │                         (kimi-ide-server/)                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                          stdin/stdout (JSON-RPC)                            │
│                                    │                                        │
│                           ┌────────┴────────┐                               │
│                           │  Kimi CLI Wire  │                               │
│                           │  (--wire --yolo) │                               │
│                           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
kimi-claude/
├── kimi-ide-client/          # React + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/       # UI components (pure renderers)
│   │   │   ├── App.tsx
│   │   │   ├── ChatArea.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ToolsPanel.tsx
│   │   │   ├── ContentArea.tsx
│   │   │   ├── file-explorer/
│   │   │   └── Ribbon/
│   │   ├── state/            # Zustand store
│   │   │   └── workspaceStore.ts
│   │   ├── hooks/            # React hooks
│   │   │   └── useWebSocket.ts
│   │   ├── lib/              # Utility libraries
│   │   │   ├── simpleQueue.ts
│   │   │   ├── contentAccumulator.ts
│   │   │   ├── instructions.ts
│   │   │   └── markdownBlocks.ts
│   │   ├── types/            # TypeScript types
│   │   │   └── index.ts
│   │   ├── styles/           # CSS files
│   │   │   ├── variables.css
│   │   │   └── animations.css
│   │   ├── main.tsx          # Entry point
│   │   └── index.css         # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── kimi-ide-server/          # Node.js WebSocket bridge server
│   ├── server.js             # Main server entry
│   ├── config.js             # Configuration manager
│   ├── components/           # Reusable UI components
│   ├── data/                 # Runtime data (gitignored)
│   ├── pipeline/             # Job pipeline folders
│   └── archive/              # Legacy code (NOT served)
│
├── docs/                     # Documentation
│   ├── RENDER_ENGINE_ARCHITECTURE.md  # Pulse-driven render engine
│   ├── TYPESCRIPT_REACT_SPEC.md       # Code spec & patterns
│   ├── STYLE_GUIDE.md                 # Visual patterns
│   ├── WIRE_PROTOCOL.md               # JSON-RPC protocol
│   ├── STREAMING_CONTENT.md           # Streaming content handling
│   └── ...
│
├── scripts/                  # Utility scripts
│   └── capture-wire-output.js
│
├── README.md                 # Human-focused overview
├── ROADMAP.md                # Architecture roadmap
└── AGENTS.md                 # This file
```

---

## ⚠️ CRITICAL: Which Code Is Active?

**ONLY edit files in `kimi-ide-client/` for UI changes.**

The server no longer serves files from `public/` — it serves the React client from `kimi-ide-client/dist/` after you build it.

### Code Status:
| Location | Status | Notes |
|----------|--------|-------|
| `kimi-ide-client/src/` | ✅ **ACTIVE** | React + TypeScript implementation |
| `kimi-ide-server/` | ✅ **ACTIVE** | WebSocket bridge server |
| `kimi-ide-server/archive/` | ❌ **DEAD CODE** | Preserved for reference only |

---

## Core Concepts

### 1. Thin Client Architecture

- **Frontend**: Pure rendering layer, no business logic
- **Backend**: All state, intelligence, and persistence
- **Communication**: WebSocket with JSON-RPC protocol

### 2. Pulse-Driven Render Engine

The render engine decouples data arrival from visual presentation:

- **500ms pulse** drives all state transitions
- **Job queue** buffers render instructions
- **Engine owns all timing** — components are pure renderers
- **One bridge, one direction**: Engine → Bridge → Store → Components

See `docs/RENDER_ENGINE_ARCHITECTURE.md` for complete specification.

### 3. Workspaces

Seven workspace tabs with distinct colors:

| Workspace | Color | Icon | Purpose |
|-----------|-------|------|---------|
| `browser` | Blue | `captive_portal` | Browser-based tools |
| `code` | Cyan | `code_blocks` | File editor, diffs |
| `rocket` | Orange | `rocket` | Deployments, builds |
| `issues` | Yellow | `business_messages` | Tasks, processes |
| `wiki` | Pink | `full_coverage` | Documentation |
| `claw` | Red | `robot_2` | Direct Kimi chat |
| `skills` | Purple | `wand_shine` | Commands, prompts |

### 4. User Modes

Three interaction modes:
- **Riff Mode**: Fast brainstorming, no tools
- **Vibe Mode**: Quick edits with file tools
- **Plan Mode**: Structured, step-by-step with validation

---

## Development Guidelines

### Where to Edit Code

| Task | Location |
|------|----------|
| UI Components | `kimi-ide-client/src/components/` |
| Styling | `kimi-ide-client/src/styles/` |
| State Management | `kimi-ide-client/src/state/` |
| WebSocket Logic | `kimi-ide-client/src/hooks/` |
| Type Definitions | `kimi-ide-client/src/types/` |
| Server Bridge | `kimi-ide-server/server.js` |

### Forbidden Patterns (from `docs/TYPESCRIPT_REACT_SPEC.md`)

Components MUST NOT:
- Use `setTimeout` / `setInterval` (engine's job)
- Use `useEffect` for orchestration (engine state machine)
- Call `store.setState()` directly (use `engine.enqueue()`)
- Manage timing logic (belongs in engine)

### Allowed Patterns

- `useStore(selector)` for reading state
- `useState` for local UI only (hover, input values)
- `useRef` for DOM references
- `onClick={() => engine.enqueue(...)}` for user actions
- CSS transitions via `className`

### File Header Convention

```typescript
/**
 * @module ComponentName
 * @role Pure renderer for [purpose]
 * @reads workspaceStore: [fields read]
 * @emits engine.enqueue (user interactions)
 */
```

---

## Development Workflow

### 1. Start the Server

```bash
cd kimi-ide-server
node server.js
# Server runs on http://localhost:3001
```

### 2. Start the Client (Development)

```bash
cd kimi-ide-client
npm install
npm run dev
# Dev server runs on http://localhost:5173
```

### 3. Build for Production

```bash
cd kimi-ide-client
npm run build
# Output goes to dist/, served by server
```

### 4. Testing & Restart Workflow (CRITICAL)

**For development testing, you MUST restart both servers after every code change.**

**Quick Restart Script:**
```bash
# From project root
./restart-kimi.sh
```

**Manual Steps:**
```bash
# 1. Kill existing servers
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# 2. Rebuild frontend
cd kimi-ide-client && npm run build

# 3. Start backend
cd ../kimi-ide-server && node server-with-threads.js &

# 4. Start frontend
cd ../kimi-ide-client/dist && python3 -m http.server 5173 &

# 5. Tell user to refresh browser
```

**⚠️ AGENT RULE: After making ANY code changes:**
1. Run the restart script (or manual steps)
2. Wait for "✅ READY" message
3. **THEN** tell user to refresh browser
4. Never tell user to refresh before restarting

**Why:** The frontend serves static files from `dist/` which only update after `npm run build`. The backend Node.js process doesn't hot-reload. Both must restart to see changes.

---

## Key Technologies & Dependencies

### Client (`kimi-ide-client/package.json`)

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zustand": "^5.0.11",
    "marked": "^17.0.3",
    "highlight.js": "^11.11.1"
  },
  "devDependencies": {
    "vite": "^7.3.1",
    "typescript": "~5.9.3"
  }
}
```

### Server (`kimi-ide-server/package.json`)

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "ws": "^8.19.0",
    "uuid": "^13.0.0"
  }
}
```

---

## Wire Protocol (Server ↔ Kimi CLI)

JSON-RPC 2.0 over STDIO (newline-delimited):

**Server → Kimi:**
```json
{"jsonrpc":"2.0","method":"prompt","id":"uuid","params":{"user_input":"Hello"}}
```

**Kimi → Server (Event):**
```json
{"jsonrpc":"2.0","method":"event","params":{"type":"ContentPart","payload":{"type":"text","text":"Hello"}}}
```

See `docs/WIRE_PROTOCOL.md` for complete specification.

---

## WebSocket Protocol (Client ↔ Server)

Message types:
- `initialize` — Handshake on connection
- `prompt` — Send user input to Kimi
- `turn_begin` / `turn_end` — Turn lifecycle
- `content` / `thinking` — Streaming content
- `tool_call` / `tool_result` — Tool execution
- `file_tree_request` / `file_content_request` — File explorer

---

## Documentation Reference

| Document | Purpose | Read Before... |
|----------|---------|----------------|
| `docs/RENDER_ENGINE_ARCHITECTURE.md` | Pulse, queue, state machine | Touching orchestration code |
| `docs/TYPESCRIPT_REACT_SPEC.md` | Code spec, forbidden patterns | Writing components |
| `docs/STYLE_GUIDE.md` | Visual patterns, theming | Styling components |
| `docs/WIRE_PROTOCOL.md` | JSON-RPC protocol | Protocol changes |
| `docs/STREAMING_CONTENT.md` | Streaming content handling | Content rendering |
| `docs/VISION_CLONE_PIPELINE.md` | Future: multi-agent pipeline | Architecture planning |
| `docs/VISION_RESEARCH_ASSISTANT.md` | Future: research pipeline | Feature planning |

---

## Secrets

All credentials are stored in **macOS Keychain** (account: `kimi-ide`). No `.env` files, no GCP secrets, no config objects, no plain text anywhere.

| Secret | Service Name | Purpose |
|--------|-------------|---------|
| GitLab Token | `GITLAB_TOKEN` | Wiki sync, API calls, git credentials |

**Access from shell / Claude skills:**
```bash
TOKEN=$(security find-generic-password -a "kimi-ide" -s "GITLAB_TOKEN" -w 2>/dev/null)
```

**Access from Node.js:**
```js
const secrets = require('./kimi-ide-server/lib/secrets');
const token = await secrets.get('GITLAB_TOKEN');
```

**Never use** `gcloud secrets` or `.env` files. See `ai/workspaces/wiki/secrets/PAGE.md` for the full API reference (`get`, `set`, `del`, `has`, `getMany`).

---

## The `ai/` Folder — Project Intelligence Layer

Every project that uses Kimi IDE has an `ai/` folder at its root. This is the project's intelligence layer — where workspaces, agents, specs, and state live. It is not application code; it is the AI coordination surface.

```
{projectRoot}/ai/
├── STATE.md                  ← Cross-workspace activity log
├── TICKETING-SPEC.md         ← Ticketing system specification
├── WORKSPACE-AGENT-SPEC.md   ← Agent execution specification
└── workspaces/               ← All workspace folders
    ├── workspaces.json       ← Tab ordering for the client UI
    ├── coding-agent/         ← type: file-explorer
    ├── pre-flight/           ← type: checklist
    ├── launch/               ← type: pipeline
    ├── review/               ← type: review
    ├── issues/               ← type: ticket-board
    ├── wiki/                 ← type: wiki-viewer
    ├── background-agents/    ← type: agent-tiles
    └── skills/               ← type: skill-library
```

### How Workspaces Work

Each workspace folder contains a `workspace.json` that declares its identity, type, theme, and settings. The `type` field drives how the client renders it — `wiki-viewer` renders topic pages, `ticket-board` renders an issue board, `agent-tiles` renders agent status cards, etc.

```json
{
  "id": "wiki",
  "name": "Wiki",
  "type": "wiki-viewer",
  "icon": "full_coverage",
  "hasChat": true,
  "theme": { "primary": "#ec4899", ... }
}
```

**The folder IS the workspace.** The client reads `workspaces.json` for tab ordering, then reads each folder's `workspace.json` to build the UI. Adding a workspace = adding a folder with a `workspace.json` + registering it in `workspaces.json`.

### Workspace Types and Their Internal Structure

Different workspace types expect different folder contents:

| Type | Internal Structure | Example |
|------|-------------------|---------|
| `wiki-viewer` | Subfolders per topic, each with `PAGE.md` + `LOG.md` | `wiki/secrets/PAGE.md` |
| `ticket-board` | Ticket markdown files at root, `done/` subfolder for closed | `issues/KIMI-0001.md` |
| `agent-tiles` | Agent subfolders with `AGENT.md`, `agent.json`, `prompts/` | `background-agents/agents/wiki-updater/` |
| `file-explorer` | Thread storage in `threads/` | `coding-agent/threads/` |
| `pipeline` | Pipeline step definitions | `launch/` |

### Key Principle

The `ai/` folder is portable. When Kimi IDE opens a different project, it reads that project's `ai/workspaces/` — not this repo's. All paths must be relative to the project root.

---

## Environment Variables

### Server

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTP server port |
| `KIMI_PATH` | `kimi` | Path to Kimi CLI executable |

---

## Project Root & File Storage

### Critical: Always Use Project Root Relative Paths

The Kimi IDE is designed to work with ANY project. All file storage must be relative to the **current project root**, not hardcoded to `kimi-claude/`.

### Project Root Detection

**Use `getDefaultProjectRoot()`** (defined in `kimi-ide-server/server-with-threads.js`):

```javascript
function getDefaultProjectRoot() {
  const cfg = config.getConfig();
  if (cfg.lastProject && fs.existsSync(cfg.lastProject)) {
    return path.resolve(cfg.lastProject);
  }
  return path.resolve(path.join(__dirname, '..'));
}
```

This function:
1. Returns `config.lastProject` if set and exists
2. Falls back to parent directory of server (for development)

### AI Workspaces Path Pattern

**CORRECT:**
```javascript
const projectRoot = getDefaultProjectRoot();
const aiWorkspacesPath = path.join(projectRoot, 'ai', 'workspaces');
```

**INCORRECT:**
```javascript
// ❌ Hardcoded - breaks when used as IDE for other projects
const AI_WORKSPACES_PATH = path.join(__dirname, '..', 'ai', 'workspaces');
```

### Per-Workspace Thread Storage

Each workspace gets its own thread storage:
```
{projectRoot}/ai/workspaces/{workspaceId}/
├── threads/
│   ├── {threadId}/
│   │   └── CHAT.md
│   └── threads.json (index)
```

### Key Rule

When the IDE is used on another project (e.g., `~/projects/my-app/`), threads should be stored at:
- `~/projects/my-app/ai/workspaces/code/threads/`

NOT at:
- `~/projects/kimi-claude/ai/workspaces/code/threads/`

---

## Common Tasks

### Adding a New Component

1. Create file in `kimi-ide-client/src/components/`
2. Add header comment with @module, @role, @reads
3. Use `useWorkspaceStore()` to read state
4. No timers, no direct store writes
5. Import and use in parent component
6. Update styles in `src/styles/` if needed

### Adding a New Workspace

1. Add to `WorkspaceId` type in `src/types/index.ts`
2. Add config to `WORKSPACE_CONFIGS` object
3. Component renders automatically (mapped in App.tsx)

### Modifying the Wire Protocol

1. Update parsing in `server.js`
2. Add message type to `WebSocketMessage` in `src/types/index.ts`
3. Add handler in `useWebSocket.ts`
4. Document in `docs/WIRE_PROTOCOL.md`

---

## Notes for AI Agents

1. **This is a BRIDGE architecture.** The server translates between WebSocket and Kimi CLI wire protocol. The client is a pure renderer.

2. **The engine owns timing.** Components never use `setTimeout` or `setInterval`. All timing flows through the pulse-driven engine.

3. **One bridge, one direction.** Engine → Bridge → Store → Components. Never bypass the bridge.

4. **Tokens are tokens.** Think, text, and tool calls all go into ONE ordered queue. They MUST stay in order.

5. **Buffering buys time.** The ribbon, shimmer holds, and typing effects are NOT decorative — they stall the UI so content buffers ahead of display.

6. **Archive folder is dead.** Do not edit files in `kimi-ide-server/archive/` — they are preserved for reference only.

7. **Build required.** Client changes require `npm run build` to be served by the server.

8. **Type safety matters.** TypeScript catches many errors at compile time. Run `npm run build` to check.

---

*Last Updated: 2026-03-21*
*Applies to: kimi-claude project (kimi-ide-client + kimi-ide-server)*
