# Architecture Compliance Audit

**Date:** 2026-03-20
**Audited against:** Universal Design Spec (Seven-Layer Architecture) in `~/.claude/CLAUDE.md`
**Scope:** All files in `kimi-ide-client/src/`

---

## Summary

The project has **no event bus**, **no controller layer**, **no service layer**, and **no event log**. Of the seven layers specified, only Layer 0 (localStorage), Layer 1 (View), and Layer 5 (State) exist. Views directly call services, write state, and orchestrate business logic. The entire middle of the architecture is missing.

---

## Missing Layers

### LAYER 2: Event Bus + Event Log — DOES NOT EXIST

No event bus. No event schema (`{id, type, data, timestamp, source}`). No event naming convention (`user.*`, `system.*`, `state.*`). Components communicate by:
- Directly importing and calling Zustand store actions
- Passing callbacks as props
- Hooks that directly mutate state

**Impact:** Views are tightly coupled to state implementation. No audit trail. No way to replay or debug event flow. No decoupling between "something happened" and "what should happen in response."

### LAYER 3: Controller — DOES NOT EXIST

No `src/controllers/` directory. No controller files. Controller-tier logic is scattered across:

| File | Controller logic it contains |
|------|------------------------------|
| `useWebSocket.ts` | Message routing, segment grouping, history conversion, thread management, engine orchestration, turn lifecycle |
| `useEngineBridge.ts` | Engine lifecycle management, state sync |
| `useFileTree.ts` | File tree loading, WebSocket message handling, cache management |
| `ChatArea.tsx` | Engine reset/start on send, scroll orchestration |
| `Sidebar.tsx` | Thread create/rename/delete via WebSocket, date formatting |

Per the spec: *"CONTROLLER: Handles events, orchestrates services, emits results. NEVER touches DOM directly. NEVER imports view modules or components."*

All three hooks are React hooks that run inside view components. `useWebSocket` directly imports `showToast` (a view component). `Sidebar.tsx` directly sends WebSocket messages and parses responses.

### LAYER 4: Service — DOES NOT EXIST

No `src/services/` directory. No service files. Network access is done by:

| File | Network access it performs |
|------|---------------------------|
| `useWebSocket.ts` | Creates WebSocket, sends/receives messages |
| `useFileTree.ts` | Sends WebSocket messages for file operations |
| `Sidebar.tsx` | Sends WebSocket messages for thread operations |
| `logger.ts` | Sends console logs to backend via WebSocket |

Per the spec: *"SERVICE: Pure data access, returns data only. Called by controllers only. NEVER emits events or touches DOM. Only module that talks to network."*

No file in the project is a pure data access layer. Network calls are made directly from hooks (which are controller logic inside view components) and from view components themselves.

### LAYER 6: Event Log — DOES NOT EXIST

No immutable append-only log. No `append(event)`, `query(filters)`, `replay(fromId)` methods. No IndexedDB storage.

---

## Layer Violations (Dependency Rules)

### VIEW violations

Per spec: *"VIEW may: Import event-bus, app-state (read-only), components. NEVER: controllers, services, API calls, write state."*

| File | Violation | Rule broken |
|------|-----------|-------------|
| `ChatArea.tsx` | Calls `engine.reset()`, `engine.startTurn()` — orchestration logic | View doing controller work |
| `ChatArea.tsx` | Calls `addMessage()` (writes state directly) | View writing state |
| `ChatArea.tsx` | Imports `useEngineBridge` (controller-tier hook) | View importing controller |
| `ChatArea.tsx` | Imports `useWebSocket` (controller-tier hook) | View importing controller |
| `Sidebar.tsx` | Sends WebSocket messages directly (`socket.send(...)`) | View making network calls |
| `Sidebar.tsx` | Parses WebSocket message responses | View doing controller work |
| `Sidebar.tsx` | Calls store actions (`setCurrentThreadId`, `clearWorkspace`) | View writing state |
| `LiveSegmentRenderer.tsx` | Reads `engineState` from store (crosses into engine orchestration awareness) | View aware of controller-tier system |
| `ToolContentRenderer.tsx` | Runs `setInterval` for progressive reveal polling | View running polling logic |
| `ToolCallBlock.tsx` | Contains full animation state machine with timing | Borderline — animation is view, but orchestration timing is controller |
| `Toast.tsx` | Global callback pattern (`showToast()` called from anywhere) | Bypasses event bus pattern |

### CONTROLLER violations (hooks acting as controllers)

Per spec: *"CONTROLLER may: Import event-bus, app-state, services. NEVER: view modules, components, DOM."*

| File | Violation | Rule broken |
|------|-----------|-------------|
| `useWebSocket.ts` | Imports `showToast` from `../components/Toast` | Controller importing view component |
| `useWebSocket.ts` | Imports `loadRootTree` from `useFileTree` (another hook) | Controller-to-controller direct call (should go through event bus) |
| `useFileTree.ts` | Directly accesses `workspaceStore` to read WebSocket reference | Reaches into state for network handle |

### STATE violations

Per spec: *"STATE: Read-only from View, written only by controllers."*

| File | Violation | Rule broken |
|------|-----------|-------------|
| `workspaceStore.ts` | Exposes setter actions (`addMessage`, `pushSegment`, etc.) that views call directly | State written by views, not controllers |
| `workspaceStore.ts` | No `state.changed` events emitted on writes | Missing event emission per spec |

---

## Structural Violations

### No component isolation pattern

Per spec: Components should be `components/[name]/index.js + [name].styles.js + [name].template.js`. Current structure is flat `.tsx` files with inline styles. No component has separated styles or templates.

| Expected | Actual |
|----------|--------|
| `components/ToolCallBlock/index.tsx` | `components/ToolCallBlock.tsx` |
| `components/ToolCallBlock/ToolCallBlock.styles.ts` | Inline `style={{}}` objects |
| `components/ToolCallBlock/ToolCallBlock.template.tsx` | JSX mixed into main file |

### Hardcoded values in styles

Per spec: *"NEVER hardcode colors, spacing, or z-index."*

| File | Hardcoded values |
|------|-----------------|
| `ChatArea.tsx` | `bottom: '80px'`, `padding: '4px 10px'`, `borderRadius: '6px'`, `zIndex: 10` |
| `LiveSegmentRenderer.tsx` | `marginBottom: '12px'`, `padding: '4px 0'`, `padding: '6px 12px'`, `borderRadius: '6px'`, `fontSize: '13px'`, `fontSize: '16px'`, `marginLeft: '24px'` |
| `InstantSegmentRenderer.tsx` | Same hardcoded values as LiveSegmentRenderer |
| `ToolCallBlock.tsx` | `marginBottom: '12px'`, `padding: '4px 0'`, `marginLeft: '24px'`, `fontSize: '13px'` |
| `CodeView.tsx` | `fontSize: '13px'`, `paddingRight: '12px'` |
| `Toast.tsx` | `bottom: 24px`, `right: 24px`, `padding: 12px 20px`, `borderRadius: 8px`, `zIndex: 10000`, hardcoded `#222`, `#fff`, `#666` |
| `Sidebar.tsx` | Multiple hardcoded colors, spacing, z-index values |

### No CSS class name prefixing

Per spec: *"All class names prefixed: `.rv-toast`, `.rv-modal`, `.rv-drawer`."*

No component uses the `rv-` prefix. Current class names: `.chat-area`, `.message`, `.message-assistant`, `.code-editor`, `.shimmer-text`, `.binary-placeholder`, etc.

### Component styles in CSS files

Per spec: *"NEVER put component styles in CSS files. Component styles live inside JS component modules."*

`src/index.css` contains component styles (`.chat-area`, `.message`, `.code-editor`, `.context-usage`, `.thread-list`, etc.) that should be injected by their respective components.

---

## Missing Infrastructure

| Required by spec | Status |
|-----------------|--------|
| Event Bus | Does not exist |
| Event Log | Does not exist |
| Controller layer (`src/controllers/`) | Does not exist |
| Service layer (`src/services/`) | Does not exist |
| SSE Whisper Line | Uses WebSocket instead (acceptable alternative, but not per spec) |
| Component style injection pattern | Not implemented — using inline styles and CSS file |
| `rv-` class name prefix | Not implemented |
| `state.changed` events on state writes | Not implemented |

---

## Files That Need No Changes

These files comply with their layer responsibilities:

| File | Layer | Compliant |
|------|-------|-----------|
| `chunkParser.ts` | Utility | Yes — pure functions, no imports, no side effects |
| `engineRegistry.ts` | Utility | Yes — pure data structure |
| `file-utils.ts` | Utility | Yes — pure functions |
| `hljs-register.ts` | Utility | Yes — setup + pure functions |
| `instructions.ts` | Utility | Yes — pure data + mapping |
| `markdownBlocks.ts` | Utility | Yes — pure functions |
| `renderEngine.ts` | Utility | Yes — pure class, no React, no DOM |
| `segmentCatalog.ts` | Utility | Yes — pure data + queries |
| `types/index.ts` | Types | Yes |
| `types/file-explorer.ts` | Types | Yes |

---

## Severity Assessment

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 3 | Missing event bus, missing controller layer, missing service layer |
| **High** | 6 | Views writing state, views making network calls, views doing orchestration, controller importing views |
| **Medium** | 8 | Hardcoded style values, no component isolation pattern, no class prefixing, styles in CSS file |
| **Low** | 3 | Missing event log, no state.changed events, Toast global pattern |
