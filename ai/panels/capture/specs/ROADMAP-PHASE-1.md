---
title: Phase 1 — SQLite Foundation
created: 2026-03-28
status: active
parent: ROADMAP.md
---

# Phase 1: SQLite Foundation

Introduce SQLite as the machine layer. Redirect existing JSON writers to SQLite. Keep markdown writers in the repo. Same interfaces, different backend.

---

## 1.1 SQLite Setup

### Add Dependency

```bash
cd kimi-ide-server && npm install better-sqlite3
```

`better-sqlite3` is synchronous, which matches the existing codebase pattern (ThreadIndex uses sync-style cached reads). No need for async wrappers.

### Create Database Module

New file: `kimi-ide-server/lib/db/index.js`

```javascript
const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDb(systemDir) {
  if (db) return db;
  const dbPath = path.join(systemDir, 'robin.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');  // Write-Ahead Logging for concurrent reads
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  // Create tables if not exist — see schema below
}

function close() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDb, close };
```

### Schema

```sql
-- Thread metadata (replaces threads.json)
CREATE TABLE IF NOT EXISTS threads (
  thread_id    TEXT PRIMARY KEY,
  panel_id     TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'New Chat',
  created_at   TEXT NOT NULL,
  resumed_at   TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'suspended',
  date         TEXT,
  updated_at   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_threads_panel ON threads(panel_id);
CREATE INDEX IF NOT EXISTS idx_threads_date ON threads(date);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);

-- Exchanges (replaces history.json)
CREATE TABLE IF NOT EXISTS exchanges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id    TEXT NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  ts           INTEGER NOT NULL,
  user_input   TEXT NOT NULL,
  assistant    TEXT NOT NULL,  -- JSON string of { parts: [...] }
  metadata     TEXT DEFAULT '[]',
  UNIQUE(thread_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_exchanges_thread ON exchanges(thread_id, seq);

-- System config (for Robin's virtual markdown configs)
CREATE TABLE IF NOT EXISTS system_config (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  updated_at   INTEGER NOT NULL DEFAULT 0
);

-- System wiki (contextual content, tooltips, inline help)
CREATE TABLE IF NOT EXISTS system_wiki (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  context      TEXT,  -- where this surfaces (tab name, setting name, etc.)
  updated_at   INTEGER NOT NULL DEFAULT 0
);
```

### Database Location

`/system/robin.db` — ships with the app, not in the repo. Created on first run if missing.

### Steps
- [ ] `npm install better-sqlite3`
- [ ] Create `lib/db/index.js` with getDb(), migrate(), close()
- [ ] Create schema with threads, exchanges, system_config, system_wiki tables
- [ ] Add `db.close()` to server shutdown handler
- [ ] Verify: server starts, creates robin.db, tables exist

---

## 1.2 Redirect ThreadIndex.js → SQLite

ThreadIndex currently reads/writes `threads.json`. Replace the file backend with SQLite queries while keeping the exact same method signatures.

### Current Interface (preserve exactly)

```
async init()                          → void
async load()                          → ThreadIndexFile
async list()                          → Array<{threadId, entry}>  (MRU order)
async get(threadId)                   → ThreadEntry | null
async create(threadId, name?)         → ThreadEntry
async update(threadId, updates)       → ThreadEntry | null
async rename(threadId, newName)       → ThreadEntry | null
async activate(threadId)              → ThreadEntry | null
async setDate(threadId, dateString)   → ThreadEntry | null
async suspend(threadId)               → ThreadEntry | null
async incrementMessageCount(threadId) → ThreadEntry | null
async markResumed(threadId)           → ThreadEntry | null
async delete(threadId)                → boolean
async touch(threadId)                 → ThreadEntry | null
async rebuild()                       → number
```

### Migration Strategy

**Option A: Replace in-place** — Rewrite ThreadIndex.js internals to use SQLite. Same file, same exports. ThreadManager doesn't change at all.

**Option B: Adapter pattern** — Create `ThreadIndexSqlite.js` with same interface. Swap the `require` in ThreadManager.

Recommend **Option A** — less indirection, ThreadIndex is the only consumer of threads.json.

### Key Changes

| Method | Currently | SQLite |
|--------|-----------|--------|
| `load()` | Read JSON file, cache | `SELECT * FROM threads WHERE panel_id = ?` |
| `list()` | Object.entries, insertion order = MRU | `SELECT * FROM threads WHERE panel_id = ? ORDER BY updated_at DESC` |
| `create()` | Write to JSON object, save file | `INSERT INTO threads` |
| `update()` | Modify object property, save file | `UPDATE threads SET ... WHERE thread_id = ?` |
| `touch()` | Delete+reinsert for MRU ordering | `UPDATE threads SET updated_at = ? WHERE thread_id = ?` |
| `activate()` | Set status, touch for MRU | `UPDATE threads SET status = 'active', updated_at = ?` |
| `rebuild()` | Scan filesystem for CHAT.md | Scan filesystem, INSERT OR IGNORE into threads |

### MRU Ordering

Currently MRU is achieved by JS object insertion order (delete key, re-add = moves to end). In SQLite, use `updated_at DESC` ordering. `touch()` updates `updated_at` to `Date.now()`.

### Migration on First Run

```javascript
// In init(), check if threads.json exists alongside new SQLite
if (fs.existsSync(threadsJsonPath)) {
  const old = JSON.parse(fs.readFileSync(threadsJsonPath, 'utf8'));
  for (const [threadId, entry] of Object.entries(old.threads)) {
    db.prepare('INSERT OR IGNORE INTO threads ...').run(threadId, panelId, ...entry);
  }
  // Rename old file to threads.json.migrated (don't delete)
  fs.renameSync(threadsJsonPath, threadsJsonPath + '.migrated');
}
```

### Steps
- [ ] Add `panelId` parameter to ThreadIndex constructor (needed for scoped queries)
- [ ] Replace file read/write with `better-sqlite3` prepared statements
- [ ] `touch()` uses `UPDATE updated_at` instead of delete+reinsert
- [ ] `list()` uses `ORDER BY updated_at DESC` instead of insertion order
- [ ] Migration: import threads.json on first run, rename to .migrated
- [ ] Verify: create thread, list threads, rename, delete, MRU ordering all work
- [ ] Verify: ThreadManager works unchanged (same interface)

---

## 1.3 Redirect HistoryFile.js → SQLite

HistoryFile currently reads/writes `history.json` per thread. Replace with SQLite exchanges table.

### Current Interface (preserve exactly)

```
async create(threadId)         → HistoryData
async read()                   → HistoryData | null
async addExchange(threadId, userInput, parts) → Exchange
async exists()                 → boolean
async countExchanges()         → number
async getLastExchange()        → Exchange | null
```

### Key Changes

| Method | Currently | SQLite |
|--------|-----------|--------|
| `create()` | Write new JSON file with empty exchanges | No-op (thread row in threads table is sufficient) |
| `read()` | Read entire JSON file | `SELECT * FROM exchanges WHERE thread_id = ? ORDER BY seq` → reconstruct HistoryData object |
| `addExchange()` | Read file, append to array, write file | `INSERT INTO exchanges (thread_id, seq, ts, user_input, assistant, metadata)` |
| `exists()` | `fs.existsSync(historyPath)` | `SELECT 1 FROM exchanges WHERE thread_id = ? LIMIT 1` |
| `countExchanges()` | Read file, return array length | `SELECT COUNT(*) FROM exchanges WHERE thread_id = ?` |
| `getLastExchange()` | Read file, return last element | `SELECT * FROM exchanges WHERE thread_id = ? ORDER BY seq DESC LIMIT 1` |

### Assistant Parts Storage

The `assistant` field is a JSON object `{ parts: [...] }` with heterogeneous part types (text, think, tool_call). Store as JSON text in the `assistant` column. Parse on read.

This keeps the schema simple. If we need to query individual tool calls later, we can add a denormalized `parts` table — but not now.

### Migration on First Run

```javascript
// For each thread directory containing history.json
const historyPath = path.join(threadDir, 'history.json');
if (fs.existsSync(historyPath)) {
  const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  for (const exchange of data.exchanges) {
    db.prepare('INSERT OR IGNORE INTO exchanges ...').run(
      data.threadId, exchange.seq, exchange.ts,
      exchange.user, JSON.stringify(exchange.assistant),
      JSON.stringify(exchange.metadata || [])
    );
  }
  fs.renameSync(historyPath, historyPath + '.migrated');
}
```

### Steps
- [ ] Replace file read/write with SQLite queries
- [ ] `read()` reconstructs the full HistoryData shape from rows (for backward compatibility)
- [ ] `addExchange()` does a single INSERT (much faster than read-modify-write entire file)
- [ ] Migration: import existing history.json files on first run
- [ ] Verify: addExchange, read, countExchanges, getLastExchange all work
- [ ] Verify: ThreadManager.getRichHistory() works unchanged

---

## 1.4 ChatFile.js → Per-User Thread Folders

ChatFile.js continues writing markdown (stays in repo). But the output path changes from thread UUID folders to per-user named folders.

### Current Path
```
ai/panels/{workspace}/threads/{threadId}/CHAT.md
```

### New Path
```
ai/views/{workspace}/chat/threads/{username}/THREAD_NAME.md
```

### Username Detection

```javascript
function getUsername() {
  // 1. Check Robin profile (future — return null for now)
  // 2. Check git config
  try {
    return execSync('git config user.name').toString().trim();
  } catch {
    return 'local';
  }
}
```

### Thread Name → Filename

Thread name from ThreadIndex → sanitize to filesystem-safe slug → `.md` extension.

```javascript
function threadNameToFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) + '.md';
}
```

### threads/index.json

Sort configuration for the thread list:

```json
{
  "sort": "last-active",
  "order": "desc"
}
```

Supported sort values: `last-active`, `created`, `name`, `custom`.

### Steps
- [ ] Add `getUsername()` utility
- [ ] Add `threadNameToFilename()` utility
- [ ] Modify ChatFile constructor to accept per-user path
- [ ] Create `threads/index.json` on first write
- [ ] Create user subfolder on first write
- [ ] On thread rename: rename the .md file too
- [ ] Verify: markdown files land in `threads/{username}/thread-name.md`

---

## Issues / Discussion Points

### better-sqlite3 Native Compilation
`better-sqlite3` requires a C++ compiler. On macOS with Xcode Command Line Tools this is fine. For distribution (Electron), prebuilt binaries are available. No issue for development, but note for packaging.

### SQLite WAL Mode
WAL (Write-Ahead Logging) allows concurrent reads while one writer is active. Important because the server reads threads from multiple WebSocket connections while the runner may be writing. Default SQLite mode (rollback journal) would block reads during writes.

### Thread Directory Cleanup
After migrating threads.json and history.json to SQLite, the old thread UUID folders still contain CHAT.md files. These become orphaned once ChatFile writes to per-user folders instead. Options:
- Leave them (no harm, git ignores them)
- Migration script moves CHAT.md content to per-user folders
- Let them age out naturally

Recommend: migration script that copies CHAT.md to per-user path, then leaves old folders. No deletion.

### Panel ID Scoping
ThreadIndex currently operates per-directory (one threads.json per panel). In SQLite, all threads are in one table, scoped by `panel_id`. The ThreadIndex constructor needs a `panelId` parameter. ThreadManager already knows which panel it manages — just pass it through.

### Atomic Writes
Currently `_save()` writes the entire JSON file on every change. In SQLite, each operation is an atomic INSERT/UPDATE. This is strictly better — no risk of corrupted JSON from interrupted writes. One less failure mode.

---

## Completion Criteria

- [ ] `better-sqlite3` installed, robin.db created on server start
- [ ] ThreadIndex reads/writes SQLite instead of threads.json
- [ ] HistoryFile reads/writes SQLite instead of history.json
- [ ] Existing threads.json and history.json migrated on first run
- [ ] ChatFile writes to `threads/{username}/thread-name.md`
- [ ] threads/index.json created with sort config
- [ ] All existing ThreadManager operations work unchanged
- [ ] Server starts cleanly with no JSON files (pure SQLite)
