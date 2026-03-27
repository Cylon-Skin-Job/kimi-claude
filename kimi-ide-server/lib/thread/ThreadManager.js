/**
 * ThreadManager - Main thread management orchestrator
 * 
 * Combines ThreadIndex and ChatFile to provide full thread lifecycle management.
 * Handles session lifecycle: active → grace-period → suspended
 */

const path = require('path');
const { ThreadIndex } = require('./ThreadIndex');
const { ChatFile } = require('./ChatFile');
const { HistoryFile } = require('./HistoryFile');

// Default configuration
const DEFAULT_CONFIG = {
  maxActiveSessions: 10,
  idleTimeoutMinutes: 9
};

class ThreadManager {
  /**
   * @param {string} workspacePath - Path to workspace directory (e.g., ai/workspaces/{id})
   * @param {Partial<import('./types').ThreadManagerConfig>} [config]
   */
  constructor(workspacePath, config = {}) {
    this.workspacePath = workspacePath;
    this.threadsDir = path.join(workspacePath, 'threads');
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    /** @type {ThreadIndex} */
    this.index = new ThreadIndex(this.threadsDir);
    
    /** @type {Map<string, import('./types').ThreadSession>} */
    this.activeSessions = new Map();
    
    /** @type {Map<string, NodeJS.Timeout>} */
    this.timeouts = new Map();
  }

  /**
   * Initialize the thread manager
   */
  async init() {
    await this.index.init();
    
    // On startup, mark all threads as suspended
    // (Kimi CLI processes would have been killed by 9min timeout)
    const threads = await this.index.list();
    for (const { threadId, entry } of threads) {
      if (entry.status === 'active') {
        await this.index.suspend(threadId);
      }
    }
  }

  /**
   * Create a new thread
   * @param {string} threadId - Thread ID (should be Kimi session ID)
   * @param {string} [name='New Chat']
   * @returns {Promise<{threadId: string, entry: import('./types').ThreadEntry}>}
   */
  async createThread(threadId, name = 'New Chat') {
    // Check for FIFO eviction
    await this._enforceSessionLimit();
    
    const threadPath = path.join(this.threadsDir, threadId);
    
    // Create thread folder and CHAT.md
    const chatFile = new ChatFile(threadPath);
    await chatFile.write(name, []);
    
    // Create history.json (rich storage)
    const historyFile = new HistoryFile(threadPath);
    await historyFile.create(threadId);
    
    // Create index entry
    const entry = await this.index.create(threadId, name);
    
    return { threadId, entry };
  }

  /**
   * Get thread info
   * @param {string} threadId
   */
  async getThread(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry) return null;
    return { threadId, entry };
  }

  /**
   * List all threads (MRU order)
   * @returns {Promise<Array<{threadId: string, entry: import('./types').ThreadEntry}>>}
   */
  async listThreads() {
    return this.index.list();
  }

  /**
   * Rename a thread
   * @param {string} threadId
   * @param {string} newName
   */
  async renameThread(threadId, newName) {
    const entry = await this.index.rename(threadId, newName);
    if (!entry) return null;
    
    // Update CHAT.md title
    const chatFile = new ChatFile(path.join(this.threadsDir, threadId));
    const parsed = await chatFile.read();
    if (parsed) {
      await chatFile.write(newName, parsed.messages);
    }
    
    return { threadId, entry };
  }

  /**
   * Delete a thread (hard delete)
   * @param {string} threadId
   */
  async deleteThread(threadId) {
    // Kill active session if any
    await this.closeSession(threadId);
    
    // Remove from index
    const deleted = await this.index.delete(threadId);
    if (!deleted) return false;
    
    // Delete thread folder
    const threadPath = path.join(this.threadsDir, threadId);
    const fs = require('fs').promises;
    try {
      await fs.rm(threadPath, { recursive: true, force: true });
    } catch (err) {
      console.error(`Failed to delete thread folder ${threadId}:`, err);
    }
    
    return true;
  }

  /**
   * Add a message to a thread
   * @param {string} threadId
   * @param {import('./types').ChatMessage} message
   */
  async addMessage(threadId, message) {
    const entry = await this.index.get(threadId);
    if (!entry) throw new Error(`Thread not found: ${threadId}`);
    
    // Append to CHAT.md
    const chatFile = new ChatFile(path.join(this.threadsDir, threadId));
    await chatFile.appendMessage(entry.name, message);
    
    // Update message count
    await this.index.incrementMessageCount(threadId);
    
    // Move to front of MRU
    await this.index.touch(threadId);
    
    return { threadId, messageCount: entry.messageCount + 1 };
  }

  /**
   * Get thread history (CHAT.md format - legacy)
   * @param {string} threadId
   * @returns {Promise<import('./types').ParsedChat|null>}
   */
  async getHistory(threadId) {
    const chatFile = new ChatFile(path.join(this.threadsDir, threadId));
    return chatFile.read();
  }

  /**
   * Get rich thread history (history.json format)
   * @param {string} threadId
   * @returns {Promise<import('./HistoryFile').HistoryData|null>}
   */
  async getRichHistory(threadId) {
    const historyFile = new HistoryFile(path.join(this.threadsDir, threadId));
    return historyFile.read();
  }

  /**
   * Register an active session
   * @param {string} threadId
   * @param {import('child_process').ChildProcess} wireProcess
   * @param {import('ws').WebSocket} [ws]
   */
  async openSession(threadId, wireProcess, ws = null) {
    // Check for FIFO eviction
    await this._enforceSessionLimit();
    
    // Mark as active in index
    await this.index.activate(threadId);
    await this.index.markResumed(threadId);
    
    // Store session
    /** @type {import('./types').ThreadSession} */
    const session = {
      threadId,
      workspaceId: path.basename(this.workspacePath),
      wireProcess,
      ws,
      lastActivity: Date.now(),
      state: 'active'
    };
    
    this.activeSessions.set(threadId, session);
    
    // Set up idle timeout
    this._setIdleTimeout(threadId);
    
    return session;
  }

  /**
   * Close a session (kill process, mark suspended)
   * @param {string} threadId
   */
  async closeSession(threadId) {
    const session = this.activeSessions.get(threadId);
    if (!session) return false;
    
    // Clear timeout
    this._clearIdleTimeout(threadId);
    
    // Kill wire process
    if (session.wireProcess && !session.wireProcess.killed) {
      session.wireProcess.kill('SIGTERM');
    }
    
    // Remove from active sessions
    this.activeSessions.delete(threadId);
    
    // Mark as suspended
    await this.index.suspend(threadId);
    
    return true;
  }

  /**
   * Get active session
   * @param {string} threadId
   * @returns {import('./types').ThreadSession|undefined}
   */
  getSession(threadId) {
    return this.activeSessions.get(threadId);
  }

  /**
   * Update session activity (reset idle timer)
   * @param {string} threadId
   */
  touchSession(threadId) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.lastActivity = Date.now();
      this._setIdleTimeout(threadId);
    }
  }

  /**
   * Update session WebSocket
   * @param {string} threadId
   * @param {import('ws').WebSocket} ws
   */
  attachWebSocket(threadId, ws) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.ws = ws;
    }
  }

  /**
   * Remove WebSocket from session
   * @param {string} threadId
   */
  detachWebSocket(threadId) {
    const session = this.activeSessions.get(threadId);
    if (session) {
      session.ws = null;
    }
  }

  /**
   * Check if thread is currently active
   * @param {string} threadId
   */
  isActive(threadId) {
    return this.activeSessions.has(threadId);
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount() {
    return this.activeSessions.size;
  }

  /**
   * Enforce max active sessions limit (FIFO eviction)
   * @private
   */
  async _enforceSessionLimit() {
    const maxSessions = this.config.maxActiveSessions;
    const activeCount = this.activeSessions.size;
    
    if (activeCount >= maxSessions) {
      // Find oldest active session (FIFO)
      const threads = await this.index.list();
      const activeThreads = threads.filter(t => this.activeSessions.has(t.threadId));
      
      // Last in list = oldest (MRU order)
      const oldest = activeThreads[activeThreads.length - 1];
      if (oldest) {
        console.log(`[ThreadManager] FIFO eviction: closing ${oldest.threadId}`);
        await this.closeSession(oldest.threadId);
      }
    }
  }

  /**
   * Set idle timeout for a session
   * @private
   * @param {string} threadId
   */
  _setIdleTimeout(threadId) {
    this._clearIdleTimeout(threadId);
    
    const timeoutMs = this.config.idleTimeoutMinutes * 60 * 1000;
    const timeout = setTimeout(async () => {
      console.log(`[ThreadManager] Idle timeout for ${threadId}`);
      await this.closeSession(threadId);
    }, timeoutMs);
    
    this.timeouts.set(threadId, timeout);
  }

  /**
   * Clear idle timeout for a session
   * @private
   * @param {string} threadId
   */
  _clearIdleTimeout(threadId) {
    const timeout = this.timeouts.get(threadId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(threadId);
    }
  }

  /**
   * Generate thread summary for auto-naming
   * Uses kimi --print --no-thinking for fast summarization
   * @param {string} threadId
   * @returns {Promise<string|null>}
   */
  async generateSummary(threadId) {
    const history = await this.getHistory(threadId);
    if (!history || history.messages.length < 2) return null;
    
    // Build conversation text for summarization
    const conversation = history.messages
      .slice(0, 4) // First 2 exchanges max
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');
    
    const prompt = `Summarize this conversation in 5 words or less for a thread title. Return ONLY the title, no quotes, no punctuation at the end.

${conversation}`;

    // Spawn kimi for summarization
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
      const proc = spawn('kimi', ['--print', '--no-thinking'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // 10 second timeout
      const timeout = setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 10000);
      
      proc.on('exit', () => {
        clearTimeout(timeout);
        console.log('[AutoRename] Raw output:', output.slice(0, 500));
        
        // Extract text from protocol output
        const lines = output.trim().split('\n');
        let summary = null;
        
        // First pass: look for TextPart with text='...'
        for (const line of lines) {
          if (line.includes("TextPart") && line.includes("text='")) {
            const textMatch = line.match(/text='([^']+)'/);
            if (textMatch && textMatch[1]) {
              summary = textMatch[1];
              console.log('[AutoRename] Found in TextPart:', summary);
              break;
            }
          }
        }
        
        // Second pass: skip protocol lines and prompt echo, take first clean line
        if (!summary) {
          for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty, protocol, and prompt echo lines
            if (!trimmed) continue;
            if (trimmed.startsWith('TurnBegin') || 
                trimmed.startsWith('StepBegin') ||
                trimmed.startsWith('StatusUpdate') ||
                trimmed.startsWith('TurnEnd') ||
                trimmed.startsWith('TextPart') ||
                prompt.includes(trimmed.slice(0, 20))) {
              continue;
            }
            summary = trimmed;
            console.log('[AutoRename] Found plain text:', summary);
            break;
          }
        }
        
        // Final fallback: last non-protocol line
        if (!summary) {
          const cleanLines = lines.filter(l => {
            const t = l.trim();
            return t && 
                   !t.startsWith('Turn') && 
                   !t.startsWith('Step') && 
                   !t.startsWith('Status') &&
                   !t.startsWith('TextPart') &&
                   !prompt.includes(t.slice(0, 20));
          });
          summary = cleanLines.pop()?.trim();
          console.log('[AutoRename] Fallback:', summary);
        }
        
        console.log('[AutoRename] Final summary:', summary?.slice(0, 50));
        resolve(summary ? summary.slice(0, 50) : null);
      });
      
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  /**
   * Auto-rename thread after first assistant response
   * @param {string} threadId
   */
  async autoRename(threadId) {
    const entry = await this.index.get(threadId);
    if (!entry || entry.name !== 'New Chat') return;
    
    const summary = await this.generateSummary(threadId);
    if (summary) {
      await this.renameThread(threadId, summary);
    }
  }
}

module.exports = { ThreadManager };
