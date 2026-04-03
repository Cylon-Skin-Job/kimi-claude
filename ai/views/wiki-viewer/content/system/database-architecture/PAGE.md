# Database Architecture

How the app stores and manages data. SQLite locally via Knex.js, with Postgres/Supabase as the future cloud path.

---

## Query Builder: Knex.js

All database access goes through [Knex.js](http://knexjs.org/). Knex provides:
- Dialect-neutral query building (same queries for SQLite and Postgres)
- Built-in migration system (`knex.migrate.latest()`)
- Connection pooling and lifecycle management

The Supabase/Postgres swap is a config change:

```javascript
// Local (current):
knex({ client: 'better-sqlite3', connection: { filename: 'robin.db' } })

// Cloud (future):
knex({ client: 'pg', connection: process.env.SUPABASE_DB_URL })
```

Same queries, different driver. Schema migrations work for both.

---

## Database Files

### System Database (`ai/system/robin.db`)

One per install. System-level state. **Invisible to agents.**

| Table | Purpose |
|-------|---------|
| `system_config` | Key-value store for system settings (profiles, policies, Robin's config) |
| `system_wiki` | System wiki content (surfaces as tooltips, contextual help in Robin's panel) |

Robin's chat history will also live here (future).

### Project Database (`ai/system/project.db`)

One per project. Thread and conversation data. **Invisible to agents.**

| Table | Purpose |
|-------|---------|
| `threads` | Thread metadata — name, status, message count, MRU ordering via `updated_at` |
| `exchanges` | Full conversation history — user input + assistant parts (text, think, tool_call with arguments + results) |

Previously this data was in `threads.json` and `history.json` files. Now it's SQLite. The ChatFile still writes human-readable markdown to per-user thread folders in the repo.

### Per-View App Databases (`ai/views/{workspace}/*.db`)

User-created. One per table panel workspace. **Accessible to agents via skills only.**

| Example | Purpose |
|---------|---------|
| `ai/views/invoices/invoices.db` | Invoice data for a bookkeeping app |
| `ai/views/customers/customers.db` | Customer records |

Created by Robin when scaffolding table panel workspaces. Managed via Knex migrations in the workspace's `migrations/` folder. Develop/production mode toggle controls write access.

---

## Schema (project.db)

```sql
-- Thread metadata (replaces threads.json)
threads (
  thread_id    TEXT PRIMARY KEY,
  panel_id     TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'New Chat',
  created_at   TEXT NOT NULL,
  resumed_at   TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'suspended',
  date         TEXT,              -- YYYY-MM-DD for daily-rolling strategy
  updated_at   INTEGER NOT NULL   -- ms timestamp, ORDER BY DESC = MRU
)

-- Conversation exchanges (replaces history.json)
exchanges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id    TEXT NOT NULL REFERENCES threads ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  ts           INTEGER NOT NULL,
  user_input   TEXT NOT NULL,
  assistant    TEXT NOT NULL,      -- JSON: { parts: [...] }
  metadata     TEXT DEFAULT '[]',
  UNIQUE(thread_id, seq)
)
```

### The Sacred JSON Shape

The `assistant` column stores a JSON string. Its shape **must survive the round-trip exactly** because the client's `convertPartToSegment()` depends on it:

```json
{
  "parts": [
    { "type": "text", "content": "..." },
    { "type": "think", "content": "..." },
    {
      "type": "tool_call",
      "toolCallId": "id-123",
      "name": "ReadFile",
      "arguments": { "filepath": "..." },
      "result": {
        "output": "file contents",
        "display": [],
        "error": null,
        "files": ["modified.js"]
      },
      "duration_ms": 150
    }
  ]
}
```

`JSON.stringify` on write, `JSON.parse` on read. The parts array is heterogeneous (text, think, tool_call). Tool results contain nested display items. This is the wire-to-render contract.

---

## Data Flow

```
Wire event (ContentPart, ToolCall, ToolResult, TurnEnd)
    ↓
server.js accumulates session.assistantParts[] during turn
    ↓
TurnEnd → HistoryFile.addExchange(threadId, userInput, parts)
    ↓
INSERT INTO exchanges (thread_id, seq, ts, user_input, assistant)
    ↓
On thread:open → HistoryFile.read() → SELECT * FROM exchanges ORDER BY seq
    ↓
Server sends: { type: 'thread:opened', exchanges: [...] }
    ↓
Client: convertExchangesToMessages() → convertPartToSegment()
    ↓
InstantSegmentRenderer renders (collapsed, no animation)
```

### Parallel: Markdown Layer

ChatFile.js continues writing to `ai/views/{workspace}/chat/threads/{username}/thread-name.md`. This is the human-readable collaboration layer. It lives in the repo. The SQLite data does not.

---

## Agent Access Model

**Agents never query the database directly.**

- `robin.db` and `project.db` are invisible to agents
- Per-view `.db` files are accessible only through skills (node scripts in tools.json)
- Skills receive a `ctx` object from the server harness with the DB path injected
- The agent calls a tool, the server executes the script, returns the result

See SPEC-SKILLS.md for the full skill/harness model.

---

## Implementation

### Module: `kimi-ide-server/lib/db.js`

Singleton. Exports `initDb(projectRoot)`, `getDb()`, `closeDb()`.

- Creates `ai/system/` directory if needed
- Initializes Knex with `better-sqlite3` driver
- Runs migrations on startup (`knex.migrate.latest()`)
- Foreign keys enabled via pragma
- Server calls `initDb()` before `listen()`, `closeDb()` on shutdown

### Migration: `kimi-ide-server/lib/db/migrations/001_initial.js`

Creates 4 tables (threads, exchanges, system_config, system_wiki). Dialect-neutral — works with both SQLite and Postgres.

### Redirected Modules

| Module | Before | After |
|--------|--------|-------|
| `HistoryFile.js` | Read/write `history.json` per thread | INSERT/SELECT on `exchanges` table |
| `ThreadIndex.js` | Read/write `threads.json` per panel | INSERT/SELECT/UPDATE on `threads` table |
| `ChatFile.js` | Write to `threads/{uuid}/CHAT.md` | Write to `threads/{username}/thread-name.md` |

Same interfaces. Different backends. ThreadManager calls them the same way.

---

## Supabase Future Path

When Supabase is configured:
1. Change Knex client from `better-sqlite3` to `pg`
2. Point connection at `SUPABASE_DB_URL`
3. Same migrations, same queries, same interfaces
4. Supabase Realtime can push live updates (future)
5. Supabase Storage for file assets like screenshots (future)
6. Supabase Auth for multi-user cloud mode (future)

---

## .gitignore

```
ai/system/robin.db
ai/system/robin.db-wal
ai/system/robin.db-shm
```

The database is local state, not repo content. Per-view `.db` files are in the repo by default (they ARE the app data). Users can gitignore them if private.
