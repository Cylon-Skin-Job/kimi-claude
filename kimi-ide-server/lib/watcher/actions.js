/**
 * Built-in action handlers for declarative filters.
 *
 * Each action is a function: (filterDef, vars) => void
 * where vars contains the template variables from the event context.
 */

const { applyTemplate } = require('./filter-loader');

/**
 * Create the default action handlers.
 *
 * @param {Object} deps - Dependencies injected at setup time
 * @param {Function} deps.createTicket - ({ title, assignee, body }) => void
 * @returns {Object} Map of action name → handler function
 */
function createActionHandlers(deps = {}) {
  return {
    /**
     * Create a ticket from the filter's ticket template.
     */
    'create-ticket'(def, vars) {
      if (!deps.createTicket) {
        console.error(`[Action:create-ticket] No createTicket function provided`);
        return;
      }

      const ticketDef = def.ticket || {};
      const title = applyTemplate(ticketDef.title || `${vars.event}: ${vars.basename}`, vars);
      const assignee = ticketDef.assignee || 'unassigned';
      const body = applyTemplate(ticketDef.body || `File \`${vars.filePath}\` was ${vars.event}d.`, vars);

      const ticket = { title, assignee, body };
      if (def.prompt) ticket.prompt = def.prompt;
      if (def.name) ticket.triggerName = def.name;
      if (def._autoHold) ticket.autoHold = true;

      deps.createTicket(ticket);
      console.log(`[Action:create-ticket] ${title}`);
    },

    /**
     * Log the event (no side effects).
     */
    'log'(def, vars) {
      const message = def.message
        ? applyTemplate(def.message, vars)
        : `[${vars.event}] ${vars.filePath} (${vars.parentStats.files} files in ${vars.parentDir})`;
      console.log(`[Action:log:${def.name}] ${message}`);
    },

    /**
     * Notify via WebSocket (future: wire up to server broadcast).
     * For now, logs a structured event that the server can pick up.
     */
    'notify'(def, vars) {
      const payload = {
        type: 'file_change',
        filter: def.name,
        event: vars.event,
        filePath: vars.filePath,
        parentDir: vars.parentDir,
        parentStats: vars.parentStats,
        delta: vars.delta,
      };
      console.log(`[Action:notify] ${JSON.stringify(payload)}`);
    },
  };
}

module.exports = { createActionHandlers };
