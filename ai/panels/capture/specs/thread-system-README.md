# Thread Management Module

Persistent, named conversations with lifecycle management for Kimi IDE.

## Overview

This module provides:
- **Thread persistence**: Conversations stored in `ai/workspaces/{workspace}/threads/`
- **Named threads**: Auto-generated 5-word titles after first response
- **Session lifecycle**: Active → Suspended with 9min idle timeout
- **Thread switching**: One WebSocket can switch between threads
- **FIFO eviction**: Max 10 active sessions per tab

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Connection                      │
│  (One per browser tab - can switch threads within socket)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              ThreadWebSocketHandler                          │
│  - Manages per-WS state (current workspace/thread)          │
│  - Routes messages to ThreadManager                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  ThreadManager                               │
│  - Session lifecycle (active/suspended)                     │
│  - FIFO eviction at 10 active sessions                      │
│  - Idle timeout (9min) → auto-suspend                       │
├───────────────────────┬─────────────────────────────────────┤
│      ThreadIndex      │           ChatFile                  │
│   (threads.json)      │          (CHAT.md)                  │
│  - Metadata index     │   - Conversation content            │
│  - MRU ordering       │   - Tool call indicators            │
└───────────────────────┴─────────────────────────────────────┘
```

## File Structure

```
ai/workspaces/{workspace}/
└── threads/
    ├── threads.json          # Thread metadata index
    └── {thread-id}/          # UUID folder (Kimi session ID)
        └── CHAT.md           # Conversation content
```

### threads.json

```json
{
  "version": "1.0",
  "threads": {
    "769d776f-88f6-421a-9326-cc97d6a2a604": {
      "name": "Server status check",
      "createdAt": "2026-03-12T17:54:49-07:00",
      "resumedAt": "2026-03-12T18:00:00-07:00",
      "messageCount": 5,
      "status": "suspended"
    }
  }
}
```

### CHAT.md Format

```markdown
# Server status check

User
Can you check my server?

Assistant
I'll check your server status.

**TOOL CALL(S)**

Assistant
Server is running on port 3001.
```

**Design principles:**
- No timestamps in CHAT.md (they're in threads.json)
- No message IDs (order is implicit)
- Tool call results are redacted (prevents token bloat)
- Human-readable and git-diffable

## WebSocket Protocol

### Client → Server

```json
// Create new thread
{"type": "thread:create", "name": "Optional name"}

// Open existing thread
{"type": "thread:open", "threadId": "..."}

// Rename thread
{"type": "thread:rename", "threadId": "...", "name": "New name"}

// Delete thread
{"type": "thread:delete", "threadId": "..."}

// Send message (requires open thread)
{"type": "prompt", "user_input": "Hello!"}

// Get thread list
{"type": "thread:list"}
```

### Server → Client

```json
// Thread created (auto-opens)
{"type": "thread:created", "threadId": "...", "thread": {...}}

// Thread opened (includes history)
{"type": "thread:opened", "threadId": "...", "thread": {...}, "history": [...]}

// Thread renamed
{"type": "thread:renamed", "threadId": "...", "name": "..."}

// Thread deleted
{"type": "thread:deleted", "threadId": "..."}

// Thread list (MRU order)
{"type": "thread:list", "threads": [...]}

// Message acknowledged
{"type": "message:sent", "threadId": "...", "content": "..."}
```

## Session Lifecycle

```
User creates thread
        │
        ▼
┌───────────────┐    ┌──────────────────┐
│ ThreadManager │───▶│ threads.json     │
│  .create()    │    │ (status: active) │
└───────────────┘    └──────────────────┘
        │
        ▼
┌───────────────┐    ┌──────────────────┐
│  Kimi CLI     │◄───│ ~/.kimi/sessions/│
│ --wire --session    │ (session data)   │
└───────────────┘    └──────────────────┘
        │
   9min idle
        │
        ▼
┌───────────────┐    ┌──────────────────┐
│   SIGTERM     │───▶│ threads.json     │
│  (graceful)   │    │ (status: suspended)
└───────────────┘    └──────────────────┘
        │
        ▼
User clicks thread
        │
        ▼
┌───────────────┐    ┌──────────────────┐
│  Kimi CLI     │◄───│ ~/.kimi/sessions/│
│ --wire --session    │ (restored)       │
└───────────────┘    └──────────────────┘
```

## Configuration

Default settings (in workspace.json):

```json
{
  "maxActiveSessions": 10,
  "idleTimeoutMinutes": 9
}
```

## Usage

### Basic Operations

```javascript
const { ThreadWebSocketHandler } = require('./lib/thread');

// Set workspace for a WebSocket
ThreadWebSocketHandler.setWorkspace(ws, 'my-workspace', aiWorkspacesPath);

// Handle client messages
ws.on('message', async (data) => {
  const msg = JSON.parse(data);
  
  switch (msg.type) {
    case 'thread:create':
      await ThreadWebSocketHandler.handleThreadCreate(ws, msg);
      break;
    case 'thread:open':
      await ThreadWebSocketHandler.handleThreadOpen(ws, msg);
      break;
    // ... etc
  }
});

// Cleanup on disconnect
ws.on('close', () => {
  ThreadWebSocketHandler.cleanup(ws);
});
```

### Direct ThreadManager Access

```javascript
const { ThreadManager } = require('./lib/thread');

const manager = new ThreadManager(workspacePath, {
  maxActiveSessions: 10,
  idleTimeoutMinutes: 9
});

await manager.init();

// Create thread
const { threadId } = await manager.createThread(uuidv4(), 'New Chat');

// Add messages
await manager.addMessage(threadId, { role: 'user', content: 'Hello' });

// Get history
const { messages } = await manager.getHistory(threadId);

// Open session (spawns wire process)
await manager.openSession(threadId, wireProcess, ws);
```

## Testing

```bash
# Run all thread tests
node lib/thread/test.js

# Run WebSocket handler tests
node lib/thread/ws-test.js
```

## Integration with server.js

See `server-integration.js` for the drop-in replacement WebSocket handler that adds thread support to the existing server.

Key changes:
1. WebSocket connections start without a wire process
2. Wire process spawned on `thread:open` with `--session {threadId}`
3. Thread switching closes current wire, opens new one
4. All messages logged to CHAT.md
5. Thread list maintained in threads.json

## Future Enhancements

- [ ] Thread search (full-text on CHAT.md)
- [ ] Thread tags/categories
- [ ] Export/import threads
- [ ] Collaborative threads
- [ ] Branching conversations
