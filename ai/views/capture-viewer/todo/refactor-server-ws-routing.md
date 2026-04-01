---
title: Refactor server.js — Extract WebSocket handlers into domain modules
created: 2026-04-01
status: planned
priority: high
---

# Refactor: server.js WebSocket Handler Extraction

## Problem

`kimi-ide-server/server.js` is **1,456 lines** and growing. It handles HTTP serving, WebSocket routing, thread lifecycle, file operations, wiki hooks, watcher setup, trigger loading, and now robin system panel queries. The WebSocket message handler alone is ~370 lines of `if (clientMsg.type === ...)` chains.

Per our design spec, a file over 400 lines is almost certainly doing too many jobs. server.js is doing at least 6.

## Current structure (all in server.js)

```
ws.on('message') handler (~line 863-1230):
  ├── client_log
  ├── thread:create        ← thread lifecycle
  ├── thread:open          ← thread lifecycle
  ├── thread:open-daily    ← thread lifecycle
  ├── thread:open-agent    ← thread lifecycle
  ├── thread:rename        ← thread lifecycle
  ├── thread:delete        ← thread lifecycle
  ├── thread:list          ← thread lifecycle
  ├── file_tree_request    ← file operations
  ├── file_content_request ← file operations
  ├── set_panel            ← panel/view switching
  ├── initialize           ← wire protocol
  ├── prompt               ← wire protocol
  ├── response             ← wire protocol
  ├── file:move            ← file operations
  ├── robin:tabs           ← robin system panel (NEW)
  ├── robin:tab-items      ← robin system panel (NEW)
  ├── robin:wiki-sections  ← robin system panel (NEW)
  ├── robin:wiki-page      ← robin system panel (NEW)
  └── robin:context        ← robin system panel (NEW)
```

Every new feature adds more handlers to this monolithic switch. It violates separation of concerns — thread code, file code, robin code, and wire protocol code all live in the same function.

## Target structure

```
server.js (~300 lines)
  ├── Express setup, static serving
  ├── WebSocket connection setup
  ├── ws.on('message') → wsRouter.route(type, msg, ws, session)
  └── Server startup (DB init, watcher, triggers)

lib/ws-router.js (~50 lines)
  ├── register(prefix, handler)
  ├── route(type, msg, ws, session) → delegates to matched handler
  └── Pattern: 'robin:*' → robinHandlers, 'thread:*' → threadHandlers

lib/robin/ws-handlers.js (~80 lines)
  ├── robin:tabs → getTabs()
  ├── robin:tab-items → getTabItems()
  ├── robin:wiki-sections → getWikiSections()
  ├── robin:wiki-page → getWikiPage()
  └── robin:context → session state update

lib/robin/queries.js (existing robin-queries.js, moved)
  └── Pure data access, no WebSocket knowledge

lib/thread/ws-handlers.js (~250 lines, extracted from server.js)
  ├── thread:create, thread:open, thread:open-daily
  ├── thread:open-agent, thread:rename, thread:delete
  ├── thread:list
  └── Wire protocol: initialize, prompt, response

lib/files/ws-handlers.js (~80 lines, extracted from server.js)
  ├── file_tree_request
  ├── file_content_request
  └── file:move
```

## Handler module pattern

Each domain module exports a factory that receives dependencies and returns a handler map:

```js
// lib/robin/ws-handlers.js
const robinQueries = require('./queries');

module.exports = function createRobinHandlers({ getDb, sessions }) {
  return {
    'robin:tabs': async (ws, msg) => {
      const tabs = await robinQueries.getTabs(getDb());
      ws.send(JSON.stringify({ type: 'robin:tabs', tabs }));
    },
    'robin:tab-items': async (ws, msg) => {
      const items = await robinQueries.getTabItems(getDb(), msg.tab);
      ws.send(JSON.stringify({ type: 'robin:items', tab: msg.tab, items }));
    },
    // ...
  };
};
```

```js
// lib/ws-router.js
class WsRouter {
  constructor() { this.handlers = new Map(); }

  register(handlers) {
    for (const [type, fn] of Object.entries(handlers)) {
      this.handlers.set(type, fn);
    }
  }

  async route(type, msg, ws, session) {
    const handler = this.handlers.get(type);
    if (handler) {
      await handler(ws, msg, session);
      return true;
    }
    return false;
  }
}
```

```js
// In server.js startup:
const router = new WsRouter();
router.register(createRobinHandlers({ getDb, sessions }));
router.register(createThreadHandlers({ ... }));
router.register(createFileHandlers({ ... }));

// In ws.on('message'):
const handled = await router.route(clientMsg.type, clientMsg, ws, session);
if (!handled) console.log('[WS] Unknown message type:', clientMsg.type);
```

## Implementation phases

### Phase 1: Robin handlers (do now)
- Create `lib/robin/ws-handlers.js`
- Move robin:* handlers out of server.js into the module
- Move `robin-queries.js` → `lib/robin/queries.js`
- server.js imports and registers robin handlers
- ~55 lines removed from server.js

### Phase 2: WS router (next session)
- Create `lib/ws-router.js`
- Replace the if/else chain in server.js with router.route()
- server.js message handler drops from ~370 lines to ~20 lines

### Phase 3: Thread handlers (separate task)
- Extract thread:* and wire protocol handlers into `lib/thread/ws-handlers.js`
- This is the biggest extraction (~250 lines) and touches the most complex code
- Requires careful handling of wire registry, session state, subprocess management
- ThreadWebSocketHandler already exists but only covers part of the logic

### Phase 4: File handlers (separate task)
- Extract file_tree_request, file_content_request, file:move into `lib/files/ws-handlers.js`
- Cleanest extraction — these are self-contained

## After full refactor

server.js drops from ~1,456 lines to ~300 lines. It becomes what it should be: startup, configuration, and glue. Each domain owns its handlers, its queries, and its logic. Adding a new WebSocket feature means creating a new handler module and registering it — no touching server.js at all.

## Dependencies to watch

- Thread handlers depend on: wire registry, session state, ThreadManager, subprocess spawning
- File handlers depend on: projectRoot, moveFileWithArchive
- Robin handlers depend on: getDb, robin-queries, sessions (for context tracking)
- All handlers need: ws (WebSocket instance) for sending responses

The factory pattern with dependency injection keeps these clean — each module declares what it needs, server.js provides it at startup.
