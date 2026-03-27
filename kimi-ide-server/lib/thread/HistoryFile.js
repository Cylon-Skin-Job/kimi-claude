/**
 * HistoryFile - Writer for history.json (structured chat storage)
 * 
 * Format mirrors the UI flow for reconstruction and AI analysis.
 * Each exchange = one user request + assistant response with parts.
 */

const fs = require('fs').promises;
const path = require('path');

const HISTORY_FILENAME = 'history.json';
const SCHEMA_VERSION = '1.0.0';

/**
 * @typedef {Object} ToolCallPart
 * @property {'tool_call'} type
 * @property {string} toolCallId - Tool call ID for matching
 * @property {string} name - Tool name (e.g., "ReadFile", "StrReplaceFile")
 * @property {object} arguments - Tool arguments
 * @property {ToolResult} result - Tool execution result
 * @property {number} [duration_ms] - Execution time
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} [output] - Text output
 * @property {DisplayItem[]} [display] - Structured display data
 * @property {string} [error] - Error message if failed
 * @property {string[]} [files] - Paths to written/modified files
 */

/**
 * @typedef {Object} DisplayItem
 * @property {'text'|'json'|'image'|'diff'|'file_tree'} type
 */

/**
 * @typedef {Object} TextPart
 * @property {'text'} type
 * @property {string} content
 */

/**
 * @typedef {Object} ThinkPart
 * @property {'think'} type
 * @property {string} content
 */

/**
 * @typedef {Object} Exchange
 * @property {number} seq - Sequence number (1, 2, 3...)
 * @property {number} ts - Timestamp when exchange completed
 * @property {string} user - User message content
 * @property {object} assistant - Assistant response
 * @property {Array<TextPart|ThinkPart|ToolCallPart>} assistant.parts - Response parts in order
 * @property {MetadataItem[]} [metadata] - Optional enrichment data
 */

/**
 * @typedef {Object} HistoryData
 * @property {string} version - Schema version
 * @property {string} threadId
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Exchange[]} exchanges
 */

class HistoryFile {
  /**
   * @param {string} threadDir - Path to thread directory
   */
  constructor(threadDir) {
    this.threadDir = threadDir;
    this.filePath = path.join(threadDir, HISTORY_FILENAME);
  }

  /**
   * Ensure the thread directory exists
   */
  async ensureDir() {
    await fs.mkdir(this.threadDir, { recursive: true });
  }

  /**
   * Create initial history.json for a new thread
   * @param {string} threadId
   * @returns {Promise<HistoryData>}
   */
  async create(threadId) {
    await this.ensureDir();
    
    const now = Date.now();
    const data = {
      version: SCHEMA_VERSION,
      threadId,
      createdAt: now,
      updatedAt: now,
      exchanges: []
    };
    
    await this._write(data);
    return data;
  }

  /**
   * Read and parse history.json
   * @returns {Promise<HistoryData|null>}
   */
  async read() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Add a complete exchange to history
   * @param {string} threadId
   * @param {string} userInput - User message
   * @param {Array<TextPart|ToolCallPart>} parts - Assistant response parts
   * @returns {Promise<Exchange>}
   */
  async addExchange(threadId, userInput, parts) {
    const data = await this.read() || await this.create(threadId);
    
    const exchange = {
      seq: data.exchanges.length + 1,
      ts: Date.now(),
      user: userInput,
      assistant: {
        parts: parts.map(p => ({ ...p })) // Clone to avoid mutations
      },
      metadata: []
    };
    
    data.exchanges.push(exchange);
    data.updatedAt = exchange.ts;
    
    await this._write(data);
    return exchange;
  }

  /**
   * Check if history.json exists
   * @returns {Promise<boolean>}
   */
  async exists() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get exchange count
   * @returns {Promise<number>}
   */
  async countExchanges() {
    const data = await this.read();
    return data?.exchanges.length || 0;
  }

  /**
   * Get the last exchange (for continuation)
   * @returns {Promise<Exchange|null>}
   */
  async getLastExchange() {
    const data = await this.read();
    if (!data || data.exchanges.length === 0) return null;
    return data.exchanges[data.exchanges.length - 1];
  }

  /**
   * Write data to file (internal)
   * @private
   * @param {HistoryData} data
   */
  async _write(data) {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(this.filePath, json, 'utf-8');
  }
}

module.exports = { HistoryFile, SCHEMA_VERSION };
