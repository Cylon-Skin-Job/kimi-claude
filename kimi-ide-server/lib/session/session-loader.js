/**
 * Session Loader — reads SESSION.md and builds system context for agent personas.
 *
 * SESSION.md defines:
 *   - thread-model: how threads are managed (multi-thread, daily-rolling, single-persistent)
 *   - session-invalidation: when to start a fresh session (memory-mtime, none)
 *   - idle-timeout: how long before wire is killed
 *   - system-context: ordered list of files to load into the wire system field
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../watcher/filter-loader');

/**
 * Parse SESSION.md from a folder.
 *
 * @param {string} folderPath - Absolute path to the folder containing SESSION.md
 * @returns {{ threadModel: string, sessionInvalidation: string, idleTimeout: string, systemContext: string[] } | null}
 */
function parseSessionConfig(folderPath) {
  const sessionPath = path.join(folderPath, 'SESSION.md');

  try {
    const content = fs.readFileSync(sessionPath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    return {
      threadModel: frontmatter['thread-model'] || 'multi-thread',
      sessionInvalidation: frontmatter['session-invalidation'] || 'none',
      idleTimeout: frontmatter['idle-timeout'] || '9m',
      systemContext: frontmatter['system-context'] || [],
    };
  } catch (err) {
    console.error(`[SessionLoader] Failed to read ${sessionPath}: ${err.message}`);
    return null;
  }
}

/**
 * Build system context string from a list of files.
 *
 * Reads each file relative to folderPath, concatenates with separator.
 *
 * @param {string} folderPath - Absolute path to the agent folder
 * @param {string[]} fileList - Array of filenames (e.g., ['IDENTITY.md', 'MEMORY.md'])
 * @returns {string} Concatenated content
 */
function buildSystemContext(folderPath, fileList) {
  if (!fileList || fileList.length === 0) return '';

  const parts = [];

  for (const filename of fileList) {
    const filePath = path.join(folderPath, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content) parts.push(content);
    } catch (err) {
      console.warn(`[SessionLoader] Could not read ${filename}: ${err.message}`);
    }
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Check whether a session should be invalidated based on MEMORY.md mtime.
 *
 * @param {string} folderPath - Absolute path to the agent folder
 * @param {number} lastMessageTimestamp - Unix timestamp (ms) of the last chat message
 * @returns {boolean} True if session should be invalidated (MEMORY.md is newer)
 */
function checkSessionInvalidation(folderPath, lastMessageTimestamp) {
  const memoryPath = path.join(folderPath, 'MEMORY.md');

  try {
    const stat = fs.statSync(memoryPath);
    return stat.mtimeMs > lastMessageTimestamp;
  } catch {
    // MEMORY.md doesn't exist or can't be read — no invalidation
    return false;
  }
}

/**
 * Get the thread strategy module for a given thread model.
 *
 * @param {string} threadModel - 'multi-thread', 'daily-rolling', or 'single-persistent'
 * @returns {Object} Strategy module with resolveThread(), canBrowseOld, canCreateNew
 */
function getStrategy(threadModel) {
  const strategies = {
    'multi-thread': '../thread/strategies/multi-thread',
    'daily-rolling': '../thread/strategies/daily-rolling',
    'single-persistent': '../thread/strategies/single-persistent',
  };

  const modulePath = strategies[threadModel];
  if (!modulePath) {
    console.warn(`[SessionLoader] Unknown thread model: ${threadModel}, falling back to multi-thread`);
    return require('../thread/strategies/multi-thread');
  }

  return require(modulePath);
}

module.exports = { parseSessionConfig, buildSystemContext, checkSessionInvalidation, getStrategy };
