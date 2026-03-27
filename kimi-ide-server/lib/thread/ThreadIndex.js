/**
 * ThreadIndex - Manages the threads.json index file
 * 
 * Responsibilities:
 * - CRUD operations on thread metadata
 * - MRU (Most Recently Used) ordering
 * - Persistence to threads.json
 */

const fs = require('fs').promises;
const path = require('path');

// Default empty index
const DEFAULT_INDEX = {
  version: '1.0',
  threads: {}
};

class ThreadIndex {
  /**
   * @param {string} threadsDir - Path to threads directory
   */
  constructor(threadsDir) {
    this.threadsDir = threadsDir;
    this.indexPath = path.join(threadsDir, 'threads.json');
    /** @type {import('./types').ThreadIndex|null} */
    this.cache = null;
    this.cacheValid = false;
  }

  /**
   * Initialize the index file if it doesn't exist
   */
  async init() {
    try {
      await fs.access(this.indexPath);
    } catch {
      // File doesn't exist, create it
      await fs.mkdir(this.threadsDir, { recursive: true });
      await this._save(DEFAULT_INDEX);
    }
    this.cacheValid = false;
  }

  /**
   * Load the index from disk
   * @returns {Promise<import('./types').ThreadIndex>}
   */
  async load() {
    if (this.cacheValid && this.cache) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const index = JSON.parse(data);
      this.cache = index;
      this.cacheValid = true;
      return index;
    } catch (err) {
      if (err.code === 'ENOENT') {
        await this.init();
        return DEFAULT_INDEX;
      }
      throw new Error(`Failed to load threads.json: ${err.message}`);
    }
  }

  /**
   * Save the index to disk
   * @param {import('./types').ThreadIndex} index
   */
  async _save(index) {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
    this.cache = index;
    this.cacheValid = true;
  }

  /**
   * Get all threads ordered by MRU (most recent first)
   * @returns {Promise<Array<{threadId: string, entry: import('./types').ThreadEntry}>>}
   */
  async list() {
    const index = await this.load();
    // Object.keys preserves insertion order in JavaScript
    return Object.keys(index.threads).map(threadId => ({
      threadId,
      entry: index.threads[threadId]
    }));
  }

  /**
   * Get a single thread by ID
   * @param {string} threadId
   * @returns {Promise<import('./types').ThreadEntry|null>}
   */
  async get(threadId) {
    const index = await this.load();
    return index.threads[threadId] || null;
  }

  /**
   * Create a new thread entry
   * @param {string} threadId - Thread ID (Kimi session ID)
   * @param {string} [name='New Chat'] - Initial name
   * @returns {Promise<import('./types').ThreadEntry>}
   */
  async create(threadId, name = 'New Chat') {
    const index = await this.load();
    
    const entry = {
      name,
      createdAt: new Date().toISOString(),
      messageCount: 0,
      status: 'suspended' // Will be set to active when session starts
    };

    // Insert at front (MRU order)
    const newThreads = { [threadId]: entry, ...index.threads };
    await this._save({ ...index, threads: newThreads });
    
    return entry;
  }

  /**
   * Update a thread entry
   * @param {string} threadId
   * @param {Partial<import('./types').ThreadEntry>} updates
   * @returns {Promise<import('./types').ThreadEntry|null>}
   */
  async update(threadId, updates) {
    const index = await this.load();
    const entry = index.threads[threadId];
    if (!entry) return null;

    const updated = { ...entry, ...updates };
    const newThreads = { ...index.threads, [threadId]: updated };
    await this._save({ ...index, threads: newThreads });
    
    return updated;
  }

  /**
   * Rename a thread
   * @param {string} threadId
   * @param {string} newName
   */
  async rename(threadId, newName) {
    return this.update(threadId, { name: newName });
  }

  /**
   * Mark thread as active and move to front (MRU)
   * @param {string} threadId
   */
  async activate(threadId) {
    const index = await this.load();
    const entry = index.threads[threadId];
    if (!entry) return null;

    // Remove from current position and add to front
    const { [threadId]: _, ...rest } = index.threads;
    const updated = { ...entry, status: 'active' };
    const newThreads = { [threadId]: updated, ...rest };
    
    await this._save({ ...index, threads: newThreads });
    return updated;
  }

  /**
   * Set the date field on a thread (used by daily-rolling strategy)
   * @param {string} threadId
   * @param {string} dateString - YYYY-MM-DD
   */
  async setDate(threadId, dateString) {
    return this.update(threadId, { date: dateString });
  }

  /**
   * Mark thread as suspended
   * @param {string} threadId
   */
  async suspend(threadId) {
    return this.update(threadId, { status: 'suspended' });
  }

  /**
   * Increment message count
   * @param {string} threadId
   */
  async incrementMessageCount(threadId) {
    const entry = await this.get(threadId);
    if (!entry) return null;
    return this.update(threadId, { messageCount: entry.messageCount + 1 });
  }

  /**
   * Update resumed timestamp
   * @param {string} threadId
   */
  async markResumed(threadId) {
    return this.update(threadId, { resumedAt: new Date().toISOString() });
  }

  /**
   * Delete a thread entry
   * @param {string} threadId
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async delete(threadId) {
    const index = await this.load();
    if (!(threadId in index.threads)) {
      return false;
    }

    const { [threadId]: _, ...rest } = index.threads;
    await this._save({ ...index, threads: rest });
    return true;
  }

  /**
   * Move thread to front of MRU list (on activity)
   * @param {string} threadId
   */
  async touch(threadId) {
    const index = await this.load();
    const entry = index.threads[threadId];
    if (!entry) return null;

    // Re-insert to move to front
    const { [threadId]: _, ...rest } = index.threads;
    const newThreads = { [threadId]: entry, ...rest };
    
    await this._save({ ...index, threads: newThreads });
    return entry;
  }

  /**
   * Rebuild index from filesystem (recovery)
   * Scans threads/ for CHAT.md files and rebuilds threads.json
   */
  async rebuild() {
    const threads = {};
    
    try {
      const entries = await fs.readdir(this.threadsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const threadId = entry.name;
          const chatPath = path.join(this.threadsDir, threadId, 'CHAT.md');
          
          try {
            await fs.access(chatPath);
            // CHAT.md exists, add to index with placeholder
            threads[threadId] = {
              name: 'New Chat', // Will be updated from CHAT.md title
              createdAt: new Date().toISOString(),
              messageCount: 0, // Will be counted from CHAT.md
              status: 'suspended'
            };
          } catch {
            // No CHAT.md, skip this folder
          }
        }
      }
    } catch (err) {
      console.error('Failed to rebuild index:', err);
    }

    await this._save({ version: '1.0', threads });
    return Object.keys(threads).length;
  }
}

module.exports = { ThreadIndex };
