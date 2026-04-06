# ACP (Agent Client Protocol) & Zed IDE Research Report

**Date:** 2026-04-05  
**Researcher:** AI Agent Analysis  
**Subject:** Google Gemini CLI integration via ACP protocol

---

## Executive Summary

**ACP (Agent Client Protocol)** is an open JSON-RPC protocol created by **Zed** (the Rust-based IDE) to standardize communication between code editors and AI coding agents. It is described as "LSP for AI agents."

- **Website:** https://agentclientprotocol.com/
- **GitHub:** https://github.com/zed-industries/agent-client-protocol
- **Protocol:** JSON-RPC 2.0 over stdio (local) or WebSocket/HTTP (remote)
- **License:** Apache 2.0

---

## Why ACP Exists

| Problem | ACP Solution |
|---------|--------------|
| Every IDE needs custom integration for each agent | One protocol → works with any ACP-compliant editor |
| Agents need editor-specific APIs | Agents implement ACP once → works everywhere |
| Fragmented ecosystem | Standardized like LSP (Language Server Protocol) |

---

## ACP vs stream-json (Gemini CLI)

| Feature | `--output-format stream-json` | `--acp` |
|---------|------------------------------|---------|
| **Protocol** | NDJSON (line-delimited JSON) | JSON-RPC 2.0 |
| **Transport** | One-way streaming | Bidirectional (requests + responses) |
| **Session Management** | Stateless per invocation | Full session lifecycle |
| **Tool Metadata** | Basic `tool_use`/`tool_result` | Rich: titles, locations, kinds, raw input |
| **Thinking Events** | ❌ No | ✅ Protocol supports (Gemini doesn't emit yet) |
| **Permission Handling** | None (assumes yolo) | Interactive permission requests |
| **Multi-turn** | ❌ No | ✅ Yes |
| **What Zed Uses** | ❌ No | ✅ Yes |

---

## ACP Event Types

From Zed source code (`crates/acp_thread/src/acp_thread.rs`):

```rust
pub enum SessionUpdate {
    UserMessageChunk,         // User input streaming
    AgentMessageChunk,        // Assistant response streaming  
    AgentThoughtChunk,        // Thinking/reasoning (future)
    ToolCall,                 // Tool started
    ToolCallUpdate,           // Tool completed/failed
    Plan,                     // Agent's execution plan
    CurrentModeUpdate,        // Mode changes (yolo/plan/etc)
    SessionInfoUpdate,        // Session metadata
    AvailableCommandsUpdate,  // Slash commands
    ConfigOptionUpdate,       // Configuration changes
}
```

---

## Zed's Implementation

### Key Files in Zed (Rust)

| File | Purpose | Size |
|------|---------|------|
| `crates/agent_servers/src/acp.rs` | Main ACP connection implementation | 62KB |
| `crates/acp_thread/src/acp_thread.rs` | Thread management, event handling | - |
| `crates/acp_thread/src/connection.rs` | Connection management | - |

### How Zed Handles Gemini

```rust
pub const GEMINI_ID: &str = "gemini";

// Special auth handling for Gemini
if agent_id.0.as_ref() == GEMINI_ID {
    // Custom terminal-based auth flow
    let mut args = command.args.clone();
    args.retain(|a| a != "--experimental-acp" && a != "--acp");
    // ... auth method setup
}
```

### Zed's Thinking Block Handling

```rust
acp::SessionUpdate::AgentThoughtChunk(acp::ContentChunk { content, .. }) => {
    // Wraps thinking in <thinking> tags for markdown display
    format!("<thinking>\n{}\n</thinking>", block.to_markdown(cx))
}
```

---

## ACP Integration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Initialize │────▶│  Authenticate│
│  (IDE/CLI)  │◀────│  Handshake  │◀────│   (if needed)│
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Session/New │────▶│Session/Prompt│────▶│ Session/Update│
│  (create)   │◀────│ (send msg)  │◀────│ (streaming) │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                       ┌────────┴────────┐
                                       ▼                 ▼
                              ┌─────────────────┐  ┌─────────────┐
                              │ AgentMessageChunk│  │  ToolCall   │
                              └─────────────────┘  └─────────────┘
```

### Example ACP Messages

#### 1. Initialize Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientInfo": {
      "name": "kimi-ide",
      "version": "1.0.0"
    }
  }
}
```

#### 2. Initialize Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "authMethods": [
      {"id": "oauth-personal", "name": "Log in with Google"},
      {"id": "gemini-api-key", "name": "Gemini API key"}
    ],
    "agentInfo": {
      "name": "gemini-cli",
      "version": "0.37.0-preview.1"
    },
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {"image": true, "audio": true},
      "mcpCapabilities": {"http": true, "sse": true}
    }
  }
}
```

#### 3. Session/New Request
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/new",
  "params": {
    "cwd": "/project",
    "mcpServers": []
  }
}
```

#### 4. Session/New Response
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessionId": "uuid-here",
    "modes": {
      "availableModes": ["default", "autoEdit", "yolo", "plan"],
      "currentModeId": "yolo"
    },
    "models": {
      "availableModels": ["gemini-2.5-pro", "gemini-3.1-pro-preview"],
      "currentModelId": "auto-gemini-3"
    }
  }
}
```

#### 5. Session/Prompt Request
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session/prompt",
  "params": {
    "sessionId": "uuid-here",
    "prompt": [{"type": "text", "text": "List all files"}]
  }
}
```

#### 6. Session/Update Notification (Agent Message)
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "uuid-here",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {"type": "text", "text": "I'll list the files..."}
    }
  }
}
```

#### 7. Session/Update Notification (Tool Call)
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "uuid-here",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "list_directory-123-0",
      "toolName": "list_directory",
      "title": ".",
      "kind": "search",
      "rawInput": "{\"dir_path\":\".\"}"
    }
  }
}
```

#### 8. Session/Prompt Response (Turn End)
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "stopReason": "end_turn",
    "_meta": {
      "quota": {
        "input_tokens": 100,
        "output_tokens": 50,
        "model_usage": [
          {"model": "gemini-2.5-pro", "input_tokens": 100, "output_tokens": 50}
        ]
      }
    }
  }
}
```

---

## Key Insight

**Zed doesn't use `stream-json` at all.** They exclusively use `--acp` mode because:

1. **Richer metadata** - Tool calls have titles, locations, kinds
2. **True multi-turn** - Session persistence across messages
3. **Permission handling** - Interactive approval flows
4. **Future standard** - Supported by JetBrains, Neovim, etc.

---

## ACP Adopters

| IDE/Editor | Status |
|------------|--------|
| Zed | ✅ Native support |
| JetBrains (IntelliJ, PyCharm, etc.) | ✅ Supported |
| Neovim | ✅ Community plugin |
| Emacs | ✅ Community plugin |
| VS Code | ✅ Via extensions |
| Obsidian | ✅ ACP plugin available |

---

## References

- **ACP Website:** https://agentclientprotocol.com/
- **ACP Protocol Docs:** https://agentclientprotocol.com/protocol/overview
- **Zed Blog (ACP Announcement):** https://zed.dev/blog/bring-your-own-agent-to-zed
- **Gemini CLI ACP Docs:** https://geminicli.com/docs/cli/acp-mode/
- **Gemini CLI IDE Integration:** https://github.com/google-gemini/gemini-cli/blob/main/docs/ide-integration/index.md

---

*This research informed the implementation of the Gemini CLI Harness using ACP protocol instead of stream-json format.*
