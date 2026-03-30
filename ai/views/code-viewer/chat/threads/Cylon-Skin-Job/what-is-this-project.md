# What is this project

User

What can you tell me about this project?

Assistant

This is **Kimi IDE** (codename: `kimi-claude`), a web-based IDE that integrates with Kimi CLI's wire mode to provide an AI-powered development environment.

## What It Is

A **thin-client architecture** where:
- **Frontend** (React + TypeScript + Vite) runs on port 5173 — pure rendering, no business logic
- **Backend** (Node.js + Express + WebSocket) runs on port 3001 — handles all state and intelligence
- **Kimi CLI** (wire mode) — the AI brain that processes prompts and returns structured responses

## Key Architecture

```
Browser (React) ←→ WebSocket ←→ Node Server ←→ Kimi CLI (--wire --yolo)
```

The frontend uses a **pulse-driven render engine** (500ms pulse) that decouples data arrival from visual presentation. All timing flows through the engine — components are pure renderers that never use `setTimeout` or manage their own state transitions.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `kimi-ide-client/` | React frontend — components, state (Zustand), hooks, styles |
| `kimi-ide-server/` | Node.js WebSocket bridge to Kimi CLI |
| `ai/` | Project intelligence layer — workspaces, agents, specs, state |
| `docs/` | Architecture docs, style guides, protocol specs |

## Workspaces

The IDE has 7 workspace tabs with distinct purposes:

| Tab | Color | Purpose |
|-----|-------|---------|
| Browser | Blue | Browser-based tools |
| Code | Cyan | File editor, diffs |
| Rocket | Orange | Deployments, builds |
| Issues | Yellow | Tasks, processes |
| Wiki | Pink | Documentation |
| Claw | Red | Direct Kimi chat |
| Skills | Purple | Commands, prompts |

## How to Run It

```bash
./restart-kimi.sh
```

Or manually start both servers (backend on 3001, frontend on 5173), then open http://localhost:5173.

## Unique Features

1. **No `.env` files** — secrets stored in macOS Keychain
2. **Portable `ai/` folder** — workspaces travel with the project being edited
3. **JSON-RPC 2.0 protocol** over WebSocket + STDIO
4. **Three user modes**: Riff (brainstorming), Vibe (quick edits), Plan (structured work)

Is there a specific aspect you'd like to dive deeper into — the architecture, the wire protocol, how to add features, or something else?
