# Kimi IDE Server - JavaScript Architecture Analysis

**Source File:** `kimi-ide-server/public/index.html`  
**JavaScript Section:** Lines 1430-2346  
**Date Generated:** March 2026

---

## 1. State Structure

### 1.1 Global State Object (`state`)

```javascript
const state = {
  currentWorkspace: 'code',           // Active workspace identifier
  workspaces: {},                     // Map of workspace states (keyed by workspace ID)
  ws: null,                           // WebSocket connection reference
  isStreaming: false,                 // Global streaming flag (legacy)
  currentTurnElement: null,           // Currently active turn element (legacy)
  wireLog: []                         // Raw wire traffic for debugging
};
```

### 1.2 Workspace Configuration (`workspaceConfig`)

Static configuration for all 7 workspaces:

| Workspace | Name | Color | Chat Support |
|-----------|------|-------|--------------|
| `code` | Code | `#00d4ff` | Yes |
| `rocket` | Launchpad | `#f97316` | Yes |
| `issues` | Issues | `#facc15` | Yes |
| `scheduler` | Scheduler | `#22c55e` | Yes |
| `skills` | Skills | `#a855f7` | Yes |
| `wiki` | Wiki | `#ec4899` | Yes |
| `claw` | OpenClaw | `#ef4444` | Yes |

### 1.3 Per-Workspace State (`state.workspaces[workspace]`)

Each workspace maintains isolated state:

```javascript
{
  // Message History
  messages: [],                       // Array of {type, text} message objects
  
  // Streaming State
  isStreaming: false,                 // Whether currently receiving stream
  currentTurn: null,                  // Current assistant turn element
  hasThinking: false,                 // Whether thinking content exists
  
  // Content Buffers
  contentBuffer: '',                  // Buffered main content
  thinkingBuffer: '',                 // Buffered thinking content
  thinkingRevealed: 0,                // Characters revealed in thinking
  thinkingStarted: false,             // Whether thinking typewriter started
  thinkingTimer: null,                // Thinking typewriter interval ID
  
  // Render State Machine (Phase 1 & 2)
  renderPhase: 'idle',                // Current render phase
  messageQueue: [],                   // Queued messages during non-streaming phases
  pendingTurnEnd: false,              // Flag for graceful turn end
  thinkingVisible: false,             // Whether thinking UI is visible
  thinkingMinDurationTimer: null,     // Timer for 0.8s minimum thinking visibility
  
  // Per-Workspace Typewriter State (isolated)
  typewriter: {
    active: false,                    // Typewriter currently running
    buffer: '',                       // Content buffer for typewriter
    revealedLength: 0,                // Characters revealed
    timer: null,                      // Typewriter interval ID
    textContainer: null,              // Current text container element
    processedIndex: 0                 // Index of processed content
  }
}
```

---

## 2. Functions by Category

### 2.1 UI Management Functions

| Function | Purpose |
|----------|---------|
| `getWorkspaceElements(workspace)` | Returns DOM elements for a workspace (container, chatMessages, textarea, sendBtn) |
| `switchWorkspace(workspace)` | Switches active workspace, updates theme CSS variables |
| `addUserMessage(text, workspace)` | Creates and displays user message bubble |
| `createAssistantTurn(workspace)` | Creates assistant message container with bubble |
| `addSystemMessage(text, workspace)` | Displays system/info messages |
| `setInputEnabled(enabled, workspace)` | Enables/disables textarea and send button |
| `startNewChat(workspace)` | Clears chat, resets all timers and state |
| `updateTheme(workspace)` | Sets CSS custom properties for theming (color, rgb, border opacities) |

### 2.2 Ribbon Animation Functions

| Function | Purpose |
|----------|---------|
| `showRibbon(workspace, phase)` | Displays ribbon with optional phase CSS class |
| `hideRibbon(workspace)` | Hides ribbon by removing visibility classes |
| `startRibbonSequence(workspace)` | Initiates ribbon_entering phase (150ms minimum) |
| `completeRibbonAnimation(workspace)` | Completes ribbon animation, triggers pre-thinking pause |

### 2.3 Render State Machine Functions

| Function | Purpose |
|----------|---------|
| `startPreThinkingPause(workspace)` | 200ms pause before entering streaming phase |
| `flushMessageQueue(workspace)` | Processes all queued messages once in streaming phase |

### 2.4 Content Rendering Functions

| Function | Purpose |
|----------|---------|
| `renderCodeBlock(bubble, language, content, cursor, onComplete)` | Renders syntax-highlighted code blocks with character-by-character reveal (2ms/char) |
| `showThinkingUI(workspace, turn, chatMessages)` | Creates collapsible thinking section with shimmer effect |
| `startThinkingTypewriter(workspace, contentContainer, chatMessages)` | Types out thinking content (5ms/char) |

### 2.5 Typewriter System Functions

| Function | Purpose |
|----------|---------|
| `startTypewriter(workspace, turn, chatMessages)` | Main typewriter orchestrator - processes code blocks and text chunks |
| `typeTextChunk(markdown, onComplete)` | Renders markdown text with character-by-character animation (5ms/char) |
| `finishTurnEnd(workspace)` | Cleanup after turn ends - removes pulse, flushes remaining content, resets state |

### 2.6 Pulse Symbol Functions

| Function | Purpose |
|----------|---------|
| `showPulseSymbol(bubble, cursor, continuous)` | Displays lens_blur Material Icon (continuous pulse or single pulse) |
| `removePulseSymbol(bubble)` | Removes pulse symbol from bubble |
| `createPulseSymbol()` | Factory function returning pulse controller object with start/stop methods |

### 2.7 WebSocket Functions

| Function | Purpose |
|----------|---------|
| `connect()` | Establishes WebSocket connection, sets up event handlers |
| `sendMessage(workspace)` | Sends user prompt to server via WebSocket |
| `handleStreamMessage(msg, workspace, chatMessages)` | Routes streaming messages (turn_begin, content, thinking, turn_end) |

### 2.8 Utility Functions

| Function | Purpose |
|----------|---------|
| `window.downloadWireLog()` | Exports raw wire log as JSON file |

---

## 3. Render State Machine

### 3.1 State Phases

```
┌─────────┐     ribbon_entering     ┌─────────────┐
│  idle   │ ───────────────────────▶│             │
└─────────┘                         │   ribbon    │
   ▲                                │  entering   │
   │                                │  (150ms)    │
   │                                └──────┬──────┘
   │                                       │
   │          ┌─────────────┐              │
   └──────────│  streaming  │◀─────────────┘
      reset   │   phase     │    ribbon_completing
              └─────────────┘        (200ms)
                   ▲  │
                   │  │ pre_thinking_pause
                   │  │    (200ms)
                   │  ▼
              ┌─────────────┐
              │   ribbon    │
              │   caught    │
              └─────────────┘
```

### 3.2 Phase Transitions

| Phase | Duration | Trigger | Next Phase |
|-------|----------|---------|------------|
| `idle` | - | User sends message | `ribbon_entering` |
| `ribbon_entering` | 150ms minimum | `startRibbonSequence()` | `ribbon_caught` |
| `ribbon_caught` | Variable | `turn_begin` received | `ribbon_completing` |
| `ribbon_completing` | 200ms | `completeRibbonAnimation()` | `pre_thinking_pause` |
| `pre_thinking_pause` | 200ms | `startPreThinkingPause()` | `streaming` |
| `streaming` | Variable | Content processing | `idle` (via `finishTurnEnd`) |

### 3.3 Message Queuing Behavior

Messages received while NOT in `streaming` phase are queued:
- `turn_begin`, `content`, `thinking`, `turn_end` all get buffered
- Early `turn_begin` triggers assistant turn creation and ribbon completion
- Once `streaming` phase entered, `flushMessageQueue()` processes all queued messages

---

## 4. Key Event Handlers

### 4.1 DOM Event Listeners (Registered on page load)

```javascript
// Tool button clicks - Workspace switching
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const workspace = btn.dataset.workspace;
    if (workspace) switchWorkspace(workspace);
  });
});

// Textarea auto-resize for all workspaces
document.querySelectorAll('.chat-input').forEach(textarea => {
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });
});
```

### 4.2 WebSocket Event Handlers

| Event | Handler |
|-------|---------|
| `onopen` | Updates connection status to "Connected", adds CSS class |
| `onmessage` | Parses JSON, logs to wireLog, routes by `msg.type` |
| `onclose` | Updates status to "Disconnected", notifies all workspaces |
| `onerror` | Logs error, displays system message |

### 4.3 Message Type Handlers (in `onmessage`)

| Message Type | Action |
|--------------|--------|
| `connected` | Logs session ID |
| `turn_begin` | Queued if not streaming; creates turn element |
| `content` | Queued if not streaming; added to buffer, triggers typewriter |
| `thinking` | Queued if not streaming; added to thinking buffer, shows UI |
| `turn_end` | Queued if not streaming; sets `pendingTurnEnd` flag |
| `step_begin` | Logs step number |
| `status_update` | Updates context usage indicator with percentage and color coding |
| `request` | Displays system message with request type |
| `response` | Logs response result |
| `error` | Displays error message, re-enables input |
| `event` | Logs event type and payload |

### 4.4 Thinking Header Click Handler

```javascript
thinkingHeader.addEventListener('click', () => {
  // Toggle collapse of thinking content
  // Toggle arrow icon between arrow_drop_down and arrow_right
});
```

### 4.5 Copy Button Handler (in code blocks)

```javascript
copyBtn.onclick = () => {
  navigator.clipboard.writeText(content);
  // Updates button text to "Copied!" for 2 seconds
};
```

---

## 5. Global Variables and Timers

### 5.1 Global Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `state` | Object | Central application state |
| `workspaceConfig` | Object | Static workspace definitions |
| `connectionStatus` | Element | DOM reference to connection status indicator |

### 5.2 Timer Types and Durations

| Timer | Type | Duration | Purpose |
|-------|------|----------|---------|
| Ribbon entrance | `setTimeout` | 150ms | Minimum time before transitioning to `ribbon_caught` |
| Ribbon exit | `setTimeout` | 200ms | Exit animation duration |
| Pre-thinking pause | `setTimeout` | 200ms | Delay before entering streaming phase |
| Thinking fade-in | `setTimeout` | 200ms | Delay before showing thinking UI |
| Thinking minimum visibility | `setTimeout` | 800ms | Minimum time thinking section must be visible |
| Copy button reset | `setTimeout` | 2000ms | Reverts "Copied!" back to "Copy" |
| Code typewriter | `setInterval` | 2ms/char | Code block character reveal |
| Thinking typewriter | `setInterval` | 5ms/char | Thinking content character reveal |
| Text typewriter | `setInterval` | 5ms/char | Main content character reveal |
| Pulse removal | `setTimeout` | 800ms | Single pulse animation duration |
| Process next (code block) | `setTimeout` | 400ms | Delay before code block render |
| Process next (after code) | `setTimeout` | 300ms | Delay after code block completion |
| Wait for more content | `setTimeout` | 50ms | Polling interval when buffer empty |

### 5.3 Timer Storage Locations

| Timer | Stored In |
|-------|-----------|
| `thinkingTimer` | `state.workspaces[ws].thinkingTimer` |
| `thinkingMinDurationTimer` | `state.workspaces[ws].thinkingMinDurationTimer` |
| `typewriter.timer` | `state.workspaces[ws].typewriter.timer` |
| Code block timer | Local variable `codeTimer` in `renderCodeBlock()` |
| Text typewriter timer | Local variable `timer` in `typeTextChunk()` |

### 5.4 Timer Cleanup Locations

All timers are cleared in `startNewChat()`:
```javascript
if (wsState.thinkingTimer) clearInterval(wsState.thinkingTimer);
if (wsState.thinkingMinDurationTimer) clearTimeout(wsState.thinkingMinDurationTimer);
if (wsState.typewriter.timer) clearInterval(wsState.typewriter.timer);
```

Additional cleanup in `finishTurnEnd()`:
```javascript
if (wsState.thinkingTimer) clearInterval(wsState.thinkingTimer);
if (wsState.thinkingMinDurationTimer) clearTimeout(wsState.thinkingMinDurationTimer);
```

---

## 6. Key Implementation Patterns

### 6.1 Workspace Isolation
- Each workspace maintains completely independent state
- Typewriter state is per-workspace (prevents interference between active chats)
- Message queuing is per-workspace

### 6.2 Buffer-Based Content Management
- Content accumulates in `contentBuffer` before typewriter processes it
- Typewriter uses `processedIndex` to track what has been rendered
- Allows typewriter to start only when sufficient content exists (50 chars or paragraph break)

### 6.3 Code Block Handling
- Code blocks are detected via regex: `/^```(\w*)\n([\s\S]*?)\n```($|\n)/`
- Code blocks render with pulse indicator (400ms) before reveal
- Syntax highlighting applied via `hljs.highlightElement()` before character animation
- Code blocks render faster (2ms/char) than regular text (5ms/char)

### 6.4 Thinking Content Flow
1. Thinking text accumulates in `thinkingBuffer`
2. After 200ms delay, thinking UI fades in
3. Typewriter reveals characters at 5ms intervals
4. Minimum 800ms visibility enforced by timer

### 6.5 Turn Lifecycle
1. `sendMessage()` initiates request, starts ribbon sequence
2. `turn_begin` creates assistant turn element
3. `content` messages accumulate in buffer, trigger typewriter
4. `thinking` messages show thinking UI, type out separately
5. `turn_end` sets pending flag, typewriter completes then calls `finishTurnEnd()`
6. `finishTurnEnd()` resets all state, re-enables input

---

## 7. Dependencies

### 7.1 External Libraries (loaded in HTML)
- **marked.js** - Markdown parsing for content rendering
- **highlight.js** - Syntax highlighting for code blocks
- **Material Symbols** - Google Material Icons font

### 7.2 Browser APIs Used
- `WebSocket` - Real-time server communication
- `document.querySelector/querySelectorAll` - DOM selection
- `navigator.clipboard.writeText()` - Copy functionality
- `URL.createObjectURL()` / `URL.revokeObjectURL()` - Wire log download

---

## 8. File Summary

| Metric | Value |
|--------|-------|
| Total Lines | ~916 lines of JavaScript |
| Functions | 32 named functions |
| State Objects | 2 global + 7 per-workspace |
| Timer Types | 4 interval types, 6 timeout types |
| Event Handlers | 3 DOM + 4 WebSocket |
| WebSocket Message Types | 10 handled types |

