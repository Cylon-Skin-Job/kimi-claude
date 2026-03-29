/**
 * ThreadWebSocketHandler - Manages WebSocket connections with thread switching
 *
 * Each WebSocket connection:
 * - Has a current panel
 * - Can switch between threads within that panel
 * - Manages one wire process at a time (per active thread)
 *
 * Multiple tabs = multiple WebSockets = independent sessions
 */

const path = require('path');
const { ThreadManager } = require('./ThreadManager');
const { v4: uuidv4 } = require('uuid');

// Global registry: panelId -> ThreadManager
const threadManagers = new Map();

// Per-WS state: ws -> { panelId, threadId, threadManager }
const wsState = new Map();

/**
 * Get or create ThreadManager for a panel.
 * If the manager already exists but panelPath changed, replace it.
 * @param {string} panelId
 * @param {object} [config] - Config including panelPath for ChatFile
 * @returns {ThreadManager}
 */
function getThreadManager(panelId, config = {}) {
  const existing = threadManagers.get(panelId);
  if (existing && existing.panelPath === (config.panelPath || null)) {
    return existing;
  }

  const manager = new ThreadManager(panelId, config);
  threadManagers.set(panelId, manager);
  // Initialize async (don't block)
  manager.init().catch(err => {
    console.error(`[ThreadManager] Failed to init ${panelId}:`, err);
  });
  return manager;
}

/**
 * Set panel for a WebSocket connection
 * @param {import('ws').WebSocket} ws
 * @param {string} panelId
 * @param {object} [config] - Config including panelPath for ChatFile
 */
function setPanel(ws, panelId, config = {}) {
  const existing = wsState.get(ws);

  // Close current thread if switching panels
  if (existing && existing.threadId) {
    closeCurrentThread(ws);
  }

  const manager = getThreadManager(panelId, config);

  wsState.set(ws, {
    panelId,
    threadId: null,
    threadManager: manager,
  });
}

/**
 * Get current state for a WebSocket
 * @param {import('ws').WebSocket} ws
 */
function getState(ws) {
  return wsState.get(ws);
}

/**
 * Clean up when WebSocket closes
 * @param {import('ws').WebSocket} ws
 */
function cleanup(ws) {
  const state = wsState.get(ws);
  if (state && state.threadId) {
    closeCurrentThread(ws);
  }
  wsState.delete(ws);
}

/**
 * Close current thread session for a WebSocket
 * @param {import('ws').WebSocket} ws
 */
async function closeCurrentThread(ws) {
  const state = wsState.get(ws);
  if (!state || !state.threadId) return;
  
  const { threadManager, threadId } = state;
  
  // Close the wire session (suspends the thread)
  await threadManager.closeSession(threadId);
  
  state.threadId = null;
  console.log(`[ThreadWS] Closed thread ${threadId}`);
}

/**
 * Send thread list to client
 * @param {import('ws').WebSocket} ws
 */
async function sendThreadList(ws) {
  console.log('[ThreadWS] sendThreadList called');
  const state = wsState.get(ws);
  if (!state) {
    console.log('[ThreadWS] No state for ws, skipping');
    return;
  }
  
  console.log('[ThreadWS] Getting threads from manager for panel:', state.panelId);
  const threads = await state.threadManager.listThreads();
  console.log('[ThreadWS] Sending', threads.length, 'threads');
  
  ws.send(JSON.stringify({
    type: 'thread:list',
    threads: threads.map(t => ({
      threadId: t.threadId,
      entry: t.entry
    }))
  }));
}

/**
 * Check if a 'New Chat' already exists
 * @param {import('ws').WebSocket} ws
 * @returns {Promise<{threadId: string, entry: object}|null>}
 */
async function findExistingNewChat(ws) {
  const state = wsState.get(ws);
  if (!state) return null;
  
  const threads = await state.threadManager.listThreads();
  // Find first thread named exactly 'New Chat'
  return threads.find(t => t.entry?.name === 'New Chat') || null;
}

/**
 * Handle thread:create message
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {string} [msg.name]
 * @param {boolean} [msg.confirmed] - True if user confirmed duplicate
 */
async function handleThreadCreate(ws, msg) {
  const state = wsState.get(ws);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
    return;
  }
  
  // Check for existing 'New Chat' if not already confirmed
  if (!msg.confirmed) {
    const existing = await findExistingNewChat(ws);
    if (existing) {
      ws.send(JSON.stringify({
        type: 'thread:create:confirm',
        message: `A chat named "New Chat" already exists. Create anyway?`,
        existingThreadId: existing.threadId,
        existingThreadName: existing.entry?.name
      }));
      return;
    }
  }
  
  // Generate thread ID (will be Kimi session ID)
  const threadId = uuidv4();
  const name = msg.name || 'New Chat';
  
  try {
    const { threadId: createdId, entry } = await state.threadManager.createThread(threadId, name);
    
    ws.send(JSON.stringify({
      type: 'thread:created',
      threadId: createdId,
      panel: state.panelId,
      thread: entry
    }));
    
    // Send updated list
    await sendThreadList(ws);
    
    // Automatically open the new thread
    await handleThreadOpen(ws, { threadId: createdId });
    
  } catch (err) {
    console.error('[ThreadWS] Create failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  }
}

/**
 * Handle thread:open message
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {string} msg.threadId
 */
async function handleThreadOpen(ws, msg) {
  const state = wsState.get(ws);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
    return;
  }
  
  const { threadId } = msg;
  const { threadManager } = state;
  
  // Check if thread exists
  const thread = await threadManager.getThread(threadId);
  if (!thread) {
    ws.send(JSON.stringify({ type: 'error', message: `Thread not found: ${threadId}` }));
    return;
  }
  
  // Close current thread if any
  if (state.threadId && state.threadId !== threadId) {
    await closeCurrentThread(ws);
  }
  
  // If this thread is already active elsewhere, that's fine (multiple tabs can view same thread)
  // But only one wire process per thread (managed by ThreadManager)
  
  state.threadId = threadId;
  
  // Mark as resumed in index
  await threadManager.index.markResumed(threadId);
  
  // Send thread history (both formats during transition)
  const history = await threadManager.getHistory(threadId);
  const richHistory = await threadManager.getRichHistory(threadId);
  
  ws.send(JSON.stringify({
    type: 'thread:opened',
    threadId,
    panel: state.panelId,
    thread: thread.entry,
    history: history?.messages || [],  // Legacy format
    exchanges: richHistory?.exchanges || []  // Rich format with tool calls
  }));

  // Update MRU order
  await threadManager.index.touch(threadId);
  await sendThreadList(ws);

  console.log(`[ThreadWS] Opened thread ${threadId} (panel: ${state.panelId})`);
}

/**
 * Handle thread:open-daily message
 *
 * Date-based session model: one thread per day, auto-selected.
 * - Computes today's date string (YYYY-MM-DD)
 * - If a thread exists for today, opens it (resumes Kimi session)
 * - If not, creates a new thread with the date as the threadId
 *
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 */
async function handleThreadOpenDaily(ws, msg) {
  const state = wsState.get(ws);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
    return;
  }

  const { threadManager } = state;
  // Preserve the requesting panel so thread:opened is routed correctly.
  // If the message includes a panel (e.g., 'issues'), temporarily override
  // the wsState panelId so handleThreadOpen includes the right panel.
  const originalPanelId = state.panelId;
  if (msg.panel) {
    state.panelId = msg.panel;
  }

  // Today's date in local time as the thread ID
  const now = new Date();
  const todayId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const existing = await threadManager.getThread(todayId);

  if (existing) {
    // Resume today's session
    console.log(`[ThreadWS] Daily thread exists: ${todayId}, resuming`);
    await handleThreadOpen(ws, { threadId: todayId });
  } else {
    // Create today's session
    console.log(`[ThreadWS] No daily thread for ${todayId}, creating`);
    try {
      await threadManager.createThread(todayId, todayId);

      ws.send(JSON.stringify({
        type: 'thread:created',
        threadId: todayId,
        panel: state.panelId,
        thread: { name: todayId, createdAt: now.toISOString(), messageCount: 0, status: 'active' }
      }));

      await handleThreadOpen(ws, { threadId: todayId });
    } catch (err) {
      console.error('[ThreadWS] Daily create failed:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  }

  // Restore original panel context
  if (msg.panel) {
    state.panelId = originalPanelId;
  }
}

/**
 * Handle thread:rename message
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {string} msg.threadId
 * @param {string} msg.name
 */
async function handleThreadRename(ws, msg) {
  const state = wsState.get(ws);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
    return;
  }
  
  const { threadId, name } = msg;
  
  try {
    const result = await state.threadManager.renameThread(threadId, name);
    if (!result) {
      ws.send(JSON.stringify({ type: 'error', message: `Thread not found: ${threadId}` }));
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'thread:renamed',
      threadId,
      name
    }));
    
    await sendThreadList(ws);
    
  } catch (err) {
    console.error('[ThreadWS] Rename failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  }
}

/**
 * Handle thread:delete message
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {string} msg.threadId
 */
async function handleThreadDelete(ws, msg) {
  const state = wsState.get(ws);
  if (!state) {
    ws.send(JSON.stringify({ type: 'error', message: 'No panel set' }));
    return;
  }
  
  const { threadId } = msg;
  const { threadManager } = state;
  
  // If deleting current thread, close it first
  if (state.threadId === threadId) {
    await closeCurrentThread(ws);
    state.threadId = null;
  }
  
  try {
    const deleted = await threadManager.deleteThread(threadId);
    if (!deleted) {
      ws.send(JSON.stringify({ type: 'error', message: `Thread not found: ${threadId}` }));
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'thread:deleted',
      threadId
    }));
    
    await sendThreadList(ws);
    
  } catch (err) {
    console.error('[ThreadWS] Delete failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  }
}

/**
 * Handle message:send - add user message to thread
 * @param {import('ws').WebSocket} ws
 * @param {object} msg
 * @param {string} msg.content
 */
async function handleMessageSend(ws, msg) {
  const state = wsState.get(ws);
  if (!state || !state.threadId) {
    ws.send(JSON.stringify({ type: 'error', message: 'No thread open' }));
    return;
  }
  
  const { threadManager, threadId } = state;
  const { content } = msg;
  
  try {
    // Add message to thread
    await threadManager.addMessage(threadId, {
      role: 'user',
      content,
      hasToolCalls: false
    });
    
    // Update MRU
    await threadManager.index.touch(threadId);
    
    ws.send(JSON.stringify({
      type: 'message:sent',
      threadId,
      content
    }));
    
  } catch (err) {
    console.error('[ThreadWS] Send message failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: err.message }));
  }
}

/**
 * Add assistant message to thread (called after streaming completes)
 * @param {import('ws').WebSocket} ws
 * @param {string} content
 * @param {boolean} hasToolCalls
 */
async function addAssistantMessage(ws, content, hasToolCalls = false) {
  const state = wsState.get(ws);
  if (!state || !state.threadId) return;
  
  const { threadManager, threadId } = state;
  
  await threadManager.addMessage(threadId, {
    role: 'assistant',
    content,
    hasToolCalls
  });
  
  // Trigger auto-naming after first assistant response
  const entry = await threadManager.index.get(threadId);
  if (entry && entry.name === 'New Chat' && entry.messageCount >= 2) {
    // Fire and forget
    threadManager.autoRename(threadId).catch(err => {
      console.error('[ThreadWS] Auto-rename failed:', err);
    });
  }
}

/**
 * Get current thread ID for WebSocket
 * @param {import('ws').WebSocket} ws
 * @returns {string|null}
 */
function getCurrentThreadId(ws) {
  return wsState.get(ws)?.threadId || null;
}

/**
 * Get current ThreadManager for WebSocket
 * @param {import('ws').WebSocket} ws
 * @returns {ThreadManager|null}
 */
function getCurrentThreadManager(ws) {
  return wsState.get(ws)?.threadManager || null;
}

module.exports = {
  // Setup
  setPanel,
  getState,
  cleanup,
  
  // Thread operations
  sendThreadList,
  handleThreadCreate,
  handleThreadOpen,
  handleThreadOpenDaily,
  handleThreadRename,
  handleThreadDelete,
  handleMessageSend,
  
  // Assistant message handling
  addAssistantMessage,
  
  // Accessors
  getCurrentThreadId,
  getCurrentThreadManager,
  
  // For testing
  _getThreadManagers: () => threadManagers,
  _getWsState: () => wsState
};
