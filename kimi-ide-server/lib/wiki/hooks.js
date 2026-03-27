/**
 * Wiki lifecycle hooks — watches for topic creation and page edits.
 *
 * on_create: new topic folder with PAGE.md → rebuild index, log entry
 * on_edit:   existing PAGE.md modified → update index, log entry
 *
 * Pure data-access + filesystem module (Layer 4).
 * Does not emit events or touch DOM.
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const DEBOUNCE_MS = 500;
const pending = new Map();
let watcher = null;
let knownTopics = new Set();
let onIndexRebuilt = null;

/**
 * Rebuild index.json from the current state of topic folders.
 * Idempotent — running twice produces the same result.
 */
async function rebuildIndex(wikiPath) {
  const indexPath = path.join(wikiPath, 'index.json');

  // Read existing index to preserve edges
  let existing = { version: '1.0', last_updated: null, topics: {} };
  try {
    existing = JSON.parse(await fsPromises.readFile(indexPath, 'utf8'));
  } catch {}

  const entries = await fsPromises.readdir(wikiPath, { withFileTypes: true });
  const topics = {};

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pagePath = path.join(wikiPath, entry.name, 'PAGE.md');
    try {
      await fsPromises.access(pagePath);
    } catch {
      continue; // No PAGE.md, not a topic
    }

    // Preserve existing edges, default to empty
    const prev = existing.topics[entry.name] || {};
    topics[entry.name] = {
      slug: formatSlug(entry.name),
      edges_out: prev.edges_out || [],
      edges_in: prev.edges_in || [],
      sources: prev.sources || [],
    };
  }

  const index = {
    version: '1.0',
    last_updated: new Date().toISOString(),
    topics,
  };

  await fsPromises.writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`[WikiHooks] Rebuilt index.json — ${Object.keys(topics).length} topics`);

  if (typeof onIndexRebuilt === 'function') {
    try { onIndexRebuilt(indexPath); } catch (err) {
      console.error('[WikiHooks] onIndexRebuilt callback error:', err);
    }
  }

  return index;
}

/**
 * Append a dated entry to a topic's LOG.md.
 */
async function appendLog(topicPath, message) {
  const logPath = path.join(topicPath, 'LOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n## ${date} — ${message}\n`;

  try {
    await fsPromises.access(logPath);
    await fsPromises.appendFile(logPath, entry, 'utf8');
  } catch {
    // LOG.md doesn't exist, create it
    const topicName = path.basename(topicPath);
    const header = `# ${formatSlug(topicName)} — Log\n${entry}`;
    await fsPromises.writeFile(logPath, header, 'utf8');
  }
  console.log(`[WikiHooks] Logged: ${path.basename(topicPath)} — ${message}`);
}

/**
 * Format a folder name into a display slug.
 * "workspace-index" → "Workspace-Index"
 */
function formatSlug(name) {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

/**
 * Handle on_create — new topic folder detected.
 */
async function onCreate(wikiPath, topicName) {
  console.log(`[WikiHooks] on_create: ${topicName}`);

  const topicPath = path.join(wikiPath, topicName);

  // Rebuild index (adds the new topic)
  await rebuildIndex(wikiPath);

  // Log creation
  await appendLog(topicPath, 'Created');

  // TODO: create ticket for kimi-wiki to evaluate edges against all existing topics
  console.log(`[WikiHooks] on_create complete: ${topicName}`);
}

/**
 * Handle on_edit — existing PAGE.md modified.
 */
async function onEdit(wikiPath, topicName) {
  console.log(`[WikiHooks] on_edit: ${topicName}`);

  const topicPath = path.join(wikiPath, topicName);

  // Rebuild index (updates last_updated)
  await rebuildIndex(wikiPath);

  // Log edit
  await appendLog(topicPath, 'Updated');

  console.log(`[WikiHooks] on_edit complete: ${topicName}`);
}

/** Track watchers for cleanup */
const topicWatcherMap = new Map();

/**
 * Watch a new topic folder for PAGE.md creation.
 * Once PAGE.md appears, fire on_create and convert to an edit watcher.
 */
function watchNewFolder(wikiPath, folderName) {
  if (topicWatcherMap.has(folderName)) return;

  const folderPath = path.join(wikiPath, folderName);
  try {
    const tw = fs.watch(folderPath, (event, filename) => {
      if (filename !== 'PAGE.md') return;

      const key = `${folderName}/PAGE.md`;
      if (pending.has(key)) clearTimeout(pending.get(key));

      pending.set(key, setTimeout(async () => {
        pending.delete(key);

        if (!knownTopics.has(folderName)) {
          // First time PAGE.md appeared — on_create
          const pagePath = path.join(folderPath, 'PAGE.md');
          try {
            await fsPromises.access(pagePath);
            knownTopics.add(folderName);
            await onCreate(wikiPath, folderName);
          } catch {}
        } else {
          // Already known — on_edit
          await onEdit(wikiPath, folderName);
        }
      }, DEBOUNCE_MS));
    });
    topicWatcherMap.set(folderName, tw);
  } catch (err) {
    console.error(`[WikiHooks] Failed to watch new folder ${folderName}:`, err.message);
  }
}

/**
 * Process a root-level filesystem event — detects new topic folders.
 */
function handleRootEvent(wikiPath, filename) {
  if (!filename) return;

  const fullPath = path.join(wikiPath, filename);

  const key = `root:${filename}`;
  if (pending.has(key)) clearTimeout(pending.get(key));

  pending.set(key, setTimeout(async () => {
    pending.delete(key);

    try {
      const stat = await fsPromises.stat(fullPath).catch(() => null);
      if (stat && stat.isDirectory() && !topicWatcherMap.has(filename)) {
        console.log(`[WikiHooks] New folder detected: ${filename}`);
        watchNewFolder(wikiPath, filename);

        // Check if PAGE.md already exists (folder + file created together)
        const pagePath = path.join(fullPath, 'PAGE.md');
        try {
          await fsPromises.access(pagePath);
          if (!knownTopics.has(filename)) {
            knownTopics.add(filename);
            await onCreate(wikiPath, filename);
          }
        } catch {}
      }
    } catch (err) {
      console.error(`[WikiHooks] Error handling root event ${filename}:`, err.message);
    }
  }, DEBOUNCE_MS));
}

/**
 * Start watching the wiki directory for changes.
 * Sets up watchers on the wiki root (for new folders) and
 * on each topic folder (for PAGE.md edits).
 */
function start(wikiPath) {
  if (!fs.existsSync(wikiPath)) {
    console.error(`[WikiHooks] Wiki path not found: ${wikiPath}`);
    return null;
  }

  // Snapshot known topics
  const entries = fs.readdirSync(wikiPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pagePath = path.join(wikiPath, entry.name, 'PAGE.md');
      if (fs.existsSync(pagePath)) {
        knownTopics.add(entry.name);
      }
    }
  }

  console.log(`[WikiHooks] Watching ${wikiPath} — ${knownTopics.size} known topics`);

  // Watch root for new folders
  watcher = fs.watch(wikiPath, (event, filename) => {
    handleRootEvent(wikiPath, filename);
  });

  // Watch each known topic folder for PAGE.md edits
  for (const topicName of knownTopics) {
    watchNewFolder(wikiPath, topicName);
  }

  // Return cleanup function
  return {
    close() {
      if (watcher) { watcher.close(); watcher = null; }
      for (const [name, tw] of topicWatcherMap) { tw.close(); }
      topicWatcherMap.clear();
      pending.clear();
      console.log('[WikiHooks] Stopped watching');
    }
  };
}

/**
 * Register a callback to be called after every index rebuild.
 * @param {Function} fn - Receives the indexPath as argument
 */
function setOnIndexRebuilt(fn) { onIndexRebuilt = fn; }

module.exports = { start, rebuildIndex, onCreate, onEdit, setOnIndexRebuilt };
