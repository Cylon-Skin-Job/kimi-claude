# Kimi IDE Server Overview

User

Can you read this codebase and tell me about it?

Assistant

I'll explore this codebase to understand its structure and purpose. Let me start by examining the key files and directories.Let me explore the server code and the AI folder structure to get a fuller picture:Based on my exploration, here's a comprehensive overview of this codebase:

## **Kimi IDE** — A Web-Based AI-Powered Development Environment

This is a sophisticated web IDE that integrates with **Kimi CLI** (wire mode) to create an AI-powered development experience. It follows a **thin-client architecture** where the backend handles all state and intelligence, while the frontend is purely for rendering.

---

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  React 19 + TypeScript + Vite + Zustand (State Management)            │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌──────────┐  │  │
│  │  │  Components │◄──│    Store    │◄──│    Hooks    │◄──│  Engine  │  │  │
│  │  │  (Pure UI)  │   │  (Zustand)  │   │  (Bridge)   │   │ (Pulse)  │  │  │
│  │  └─────────────┘   └─────────────┘   └─────────────┘   └──────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ WebSocket (ws://localhost:3001)
┌────────────────────────────────────┼────────────────────────────────────────┐
│                           SERVER (Node.js)                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │              Express + WebSocket Server (kimi-ide-server/)            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                          stdin/stdout (JSON-RPC)                            │
│                                    │                                        │
│                           ┌────────┴────────┐                               │
│                           │  Kimi CLI Wire  │                               │
│                           │ (--wire --yolo) │                               │
│                           └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### **Project Structure**

| Directory | Purpose |
|-----------|---------|
| `kimi-ide-client/` | React + TypeScript + Vite frontend |
| `kimi-ide-server/` | Node.js WebSocket bridge server |
| `ai/` | **Project Intelligence Layer** — workspaces, agents, wiki, tickets, specs |
| `docs/` | Architecture docs, specs, wire protocol documentation |

---

### **Key Features**

#### 1. **Dynamic Multi-Panel Workspace System**
Panels are discovered dynamically from `ai/panels/`:
- **`explorer`** — File explorer + thread-based chat
- **`wiki-viewer`** — Git-backed documentation viewer
- **`issues`** — Ticket board (KIMI-0001, KIMI-0002, etc.)
- **`agents`** — AI agent management with personas
- **`skills`** — Command/prompt library
- **`capture`** — Screenshot/spec capture system
- **`terminal`** — Terminal interface

#### 2. **Thread-Based Conversations**
- Persistent, named chat conversations stored in `ai/panels/explorer/threads/`
- Each thread has `CHAT.md` (human-readable) + `history.json` (structured)
- Daily auto-threads (dated: 2026-03-25, etc.)
- SQLite-backed rich exchange history

#### 3. **Pulse-Driven Render Engine**
- **500ms pulse** drives all state transitions
- Streaming content handling for:
  - Think blocks (`<think>`...`</think>`)
  - Text streaming (typewriter effect)
  - Tool calls (shell, read, write, edit, glob, grep, web_search, fetch, subagent, todo)
- Job queue buffers render instructions
- Components are pure renderers (no `setTimeout`, no direct store writes)

#### 4. **AI Agent System** (`ai/panels/agents/`)
Background agents with structured configuration:
- `SESSION.md` — Session configuration
- `PROMPT.md` — Agent prompts
- `MEMORY.md` — Persistent context
- `HISTORY.md` — Activity logs
- `LESSONS.md` — Learned patterns
- `TRIGGERS.md` — Event-driven automations
- `workflows/` — Specific task workflows

#### 5. **Wiki System** (`ai/wiki-data/`)
- Git-backed documentation
- Each topic has `PAGE.md` + `LOG.md` + `index.json`
- Topics: project, system, providers (AI model providers)

#### 6. **Security & Enforcement**
- **Settings folder write-lock** — AI cannot write to `settings/` folders
- Two-pass path validation (logical + symlink resolution)
- Cross-workspace symlink handling

---

### **Technology Stack**

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript 5.9, Vite 7, Zustand 5 |
| **Styling** | CSS with Raven OS-inspired Tron aesthetic |
| **Backend** | Node.js, Express, WebSocket (ws) |
| **State** | Zustand (client), SQLite + JSON files (server) |
| **Protocol** | JSON-RPC 2.0 over WebSocket + STDIO |

---

### **Communication Protocols**

1. **Client ↔ Server**: WebSocket with typed messages (`turn_begin`, `content`, `thinking`, `tool_call`, `tool_result`, `turn_end`, thread management)

2. **Server ↔ Kimi CLI**: JSON-RPC 2.0 over STDIO
   - Events: `TurnBegin`, `ContentPart`, `Think`, `ToolCall`, `ToolResult`, `TurnEnd`

---

### **Development Workflow**

```bash
# Quick start (both servers)
./restart-kimi.sh

# Or manually:
cd kimi-ide-server && node server.js   # Port 3001
cd kimi-ide-client && npm run dev      # Port 5173
```

**Critical**: After any code change, you must restart both servers and rebuild the client.

---

### **What Makes This Unique**

1. **Thin Client Architecture** — Frontend has zero business logic; all intelligence lives in the backend
2. **Pulse-Driven Rendering** — Decouples data arrival from visual presentation for smooth UX
3. **Dynamic Panel Discovery** — Workspaces are folder-based, not hardcoded
4. **Agent Personas** — Structured AI agents with memory, triggers, and workflows
5. **Streaming Tool Calls** — Real-time display of AI tool execution with visual feedback

---

### **Current Status**

The project is actively developed with:
- **45 tickets** tracked (`ai/panels/issues/KIMI-0005.md` through `KIMI-0045.md`)
- **3 system agents** (code-manager, ops-manager, wiki-manager)
- **Rich documentation** in `docs/` and `ai/wiki-data/`
- **Thread persistence** with SQLite + JSON dual storage

Is there a specific part of the codebase you'd like me to dive deeper into?

**TOOL CALL(S)**
