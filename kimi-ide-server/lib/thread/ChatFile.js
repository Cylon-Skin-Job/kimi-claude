/**
 * ChatFile - Parser and writer for CHAT.md files
 * 
 * Format:
 * ```
 * # Thread Title (from threads.json name)
 * 
 * User
 * Message content here
 * 
 * Assistant
 * Response content here
 * 
 * **TOOL CALL(S)**
 * 
 * Assistant
 * Follow-up after tool calls
 * ```
 */

const fs = require('fs').promises;
const path = require('path');

const TOOL_CALL_MARKER = '**TOOL CALL(S)**';

class ChatFile {
  /**
   * @param {string} threadDir - Path to thread directory
   */
  constructor(threadDir) {
    this.threadDir = threadDir;
    this.filePath = path.join(threadDir, 'CHAT.md');
  }

  /**
   * Ensure the thread directory exists
   */
  async ensureDir() {
    await fs.mkdir(this.threadDir, { recursive: true });
  }

  /**
   * Parse CHAT.md content
   * @param {string} content - File content
   * @returns {import('./types').ParsedChat}
   */
  parse(content) {
    const lines = content.split('\n');
    
    // First line is the title (starts with #)
    let title = 'New Chat';
    let startIdx = 0;
    
    if (lines[0]?.startsWith('# ')) {
      title = lines[0].slice(2).trim();
      startIdx = 1;
    }

    /** @type {import('./types').ChatMessage[]} */
    const messages = [];
    let currentRole = null;
    let currentContent = [];
    let currentHasToolCalls = false;

    const flushMessage = () => {
      if (currentRole && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim(),
          hasToolCalls: currentHasToolCalls
        });
      }
      currentContent = [];
      currentHasToolCalls = false;
    };

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for role markers
      if (line === 'User') {
        flushMessage();
        currentRole = 'user';
      } else if (line === 'Assistant') {
        flushMessage();
        currentRole = 'assistant';
      } else if (line === TOOL_CALL_MARKER) {
        // Mark current assistant message as having tool calls
        currentHasToolCalls = true;
      } else if (currentRole) {
        currentContent.push(line);
      }
    }

    // Flush final message
    flushMessage();

    return { title, messages };
  }

  /**
   * Serialize messages to CHAT.md format
   * @param {string} title - Thread title
   * @param {import('./types').ChatMessage[]} messages
   * @returns {string}
   */
  serialize(title, messages) {
    const lines = [`# ${title}`, ''];

    for (const msg of messages) {
      lines.push(msg.role === 'user' ? 'User' : 'Assistant');
      lines.push('');
      lines.push(msg.content);
      lines.push('');
      
      if (msg.hasToolCalls) {
        lines.push(TOOL_CALL_MARKER);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Read and parse the CHAT.md file
   * @returns {Promise<import('./types').ParsedChat|null>}
   */
  async read() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return this.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Write messages to CHAT.md
   * @param {string} title - Thread title
   * @param {import('./types').ChatMessage[]} messages
   */
  async write(title, messages) {
    await this.ensureDir();
    const content = this.serialize(title, messages);
    await fs.writeFile(this.filePath, content);
  }

  /**
   * Append a single message to the file
   * @param {string} title - Current thread title (for rewriting)
   * @param {import('./types').ChatMessage} message - Message to append
   */
  async appendMessage(title, message) {
    await this.ensureDir();
    
    // Read existing or start fresh
    let messages = [];
    const existing = await this.read();
    if (existing) {
      messages = existing.messages;
    }
    
    messages.push(message);
    await this.write(title, messages);
  }

  /**
   * Check if CHAT.md exists
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
   * Get message count from file
   * @returns {Promise<number>}
   */
  async countMessages() {
    const parsed = await this.read();
    return parsed?.messages.length || 0;
  }
}

module.exports = { ChatFile, TOOL_CALL_MARKER };
