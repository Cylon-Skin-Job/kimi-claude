/**
 * Trigger Loader — scans agent folders for TRIGGERS.md files,
 * parses them, and produces watcher filters + cron registrations.
 *
 * Runs alongside the existing lib/watcher/filters/*.md system.
 * TRIGGERS.md adds agent-specific triggers loaded from agent folders.
 */

const fs = require('fs');
const path = require('path');
const { parseTriggerBlocks } = require('./trigger-parser');
const { runScript } = require('./script-runner');
const { buildFilter, evaluateCondition, applyTemplate } = require('../watcher/filter-loader');

/**
 * Scan agent folders for TRIGGERS.md and build filters + cron triggers.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @param {string} agentsBasePath - Absolute path to agents panel
 * @param {Object} registry - Parsed registry.json { agents: { botName: { folder } } }
 * @param {Object} actionHandlers - Action handlers from createActionHandlers()
 * @returns {{ filters: Array, cronTriggers: Array<{ trigger: Object, assignee: string }> }}
 */
function loadTriggers(projectRoot, agentsBasePath, registry, actionHandlers) {
  const filters = [];
  const cronTriggers = [];

  // Build reverse lookup: folder path → bot name
  const folderToBot = {};
  for (const [botName, agent] of Object.entries(registry.agents || {})) {
    folderToBot[agent.folder] = botName;
  }

  // Scan each agent folder for TRIGGERS.md
  for (const [botName, agent] of Object.entries(registry.agents || {})) {
    const agentPath = path.join(agentsBasePath, agent.folder);
    const triggersPath = path.join(agentPath, 'TRIGGERS.md');

    if (!fs.existsSync(triggersPath)) continue;

    const blocks = parseTriggerBlocks(triggersPath);
    console.log(`[TriggerLoader] ${botName}: parsed ${blocks.length} triggers from TRIGGERS.md`);

    for (const block of blocks) {
      if (block.type === 'cron') {
        cronTriggers.push({ trigger: block, assignee: botName });
      } else {
        // Default: file-change trigger → watcher filter
        const filter = buildTriggerFilter(block, botName, projectRoot, actionHandlers);
        if (filter) filters.push(filter);
      }
    }
  }

  return { filters, cronTriggers };
}

/**
 * Normalize the message field from a trigger block.
 * The YAML parser may return a string or an object (when | multiline is used).
 * If object, reconstruct as "key: value" lines.
 */
function normalizeMessage(msg) {
  if (!msg) return null;
  if (typeof msg === 'string') return msg;
  if (typeof msg === 'object') {
    return Object.entries(msg).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
  return String(msg);
}

/**
 * Convert a file-change trigger block into a watcher filter.
 * Injects the prompt field and assignee into ticket creation.
 */
function buildTriggerFilter(block, assignee, projectRoot, actionHandlers) {
  const message = normalizeMessage(block.message);

  // Build a filter definition compatible with buildFilter()
  const def = {
    name: block.name || 'unnamed-trigger',
    events: block.events || ['modify', 'create', 'delete'],
    match: block.match,
    exclude: block.exclude,
    condition: block.condition,
    action: 'create-ticket',
    prompt: block.prompt || null,
    script: block.script || null,
    function: block.function || null,
    _autoHold: true,
    ticket: {
      assignee,
      title: message
        ? message.split('\n')[0].trim()
        : `Trigger: ${block.name}`,
      body: message || `Trigger fired: ${block.name}`,
    },
  };

  // Wrap the action handlers to support script execution
  if (def.script) {
    const wrappedHandlers = wrapWithScript(def, actionHandlers, projectRoot);
    const filter = buildFilter(def, wrappedHandlers);
    console.log(`[TriggerLoader] Built filter: ${def.name} (with script: ${def.script})`);
    return filter;
  }

  const filter = buildFilter(def, actionHandlers);
  console.log(`[TriggerLoader] Built filter: ${def.name} → ${assignee}`);
  return filter;
}

/**
 * Wrap action handlers to run a script before the action executes.
 * The script's return value is merged into template variables as `result`.
 */
function wrapWithScript(def, originalHandlers, projectRoot) {
  const wrapped = { ...originalHandlers };

  const originalCreateTicket = wrapped['create-ticket'];
  if (originalCreateTicket) {
    wrapped['create-ticket'] = function(filterDef, vars) {
      // Run the script and merge result into vars
      const result = runScript(def.script, def.function, vars, projectRoot);
      if (result !== null) {
        vars.result = result;
      }

      // Re-evaluate condition with script result if needed
      if (def.condition && def.condition.includes('result.')) {
        if (!evaluateCondition(def.condition, vars)) {
          console.log(`[TriggerLoader] ${def.name}: script condition not met, skipping`);
          return;
        }
      }

      // Re-apply templates with script result
      if (vars.result) {
        filterDef = { ...filterDef };
        if (filterDef.ticket) {
          filterDef.ticket = { ...filterDef.ticket };
          filterDef.ticket.title = applyTemplate(filterDef.ticket.title, vars);
          filterDef.ticket.body = applyTemplate(filterDef.ticket.body, vars);
        }
      }

      originalCreateTicket(filterDef, vars);
    };
  }

  return wrapped;
}

module.exports = { loadTriggers };
