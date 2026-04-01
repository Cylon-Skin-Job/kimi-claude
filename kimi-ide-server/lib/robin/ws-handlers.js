/**
 * Robin system panel — WebSocket message handlers
 *
 * One job: handle robin:* WebSocket messages.
 * Returns a handler map keyed by message type.
 */

const robinQueries = require('./queries');

/**
 * @param {Object} deps
 * @param {Function} deps.getDb - Returns Knex instance
 * @param {Map} deps.sessions - WebSocket → session state map
 * @returns {Object<string, Function>} Message type → async handler
 */
module.exports = function createRobinHandlers({ getDb, sessions }) {
  return {
    'robin:tabs': async (ws) => {
      try {
        const tabs = await robinQueries.getTabs(getDb());
        ws.send(JSON.stringify({ type: 'robin:tabs', tabs }));
      } catch (err) {
        console.error('[Robin] tabs error:', err.message);
        ws.send(JSON.stringify({ type: 'robin:tabs', tabs: [], error: err.message }));
      }
    },

    'robin:tab-items': async (ws, msg) => {
      try {
        const items = await robinQueries.getTabItems(getDb(), msg.tab);
        ws.send(JSON.stringify({ type: 'robin:items', tab: msg.tab, items }));
      } catch (err) {
        console.error('[Robin] tab-items error:', err.message);
        ws.send(JSON.stringify({ type: 'robin:items', tab: msg.tab, items: [], error: err.message }));
      }
    },

    'robin:wiki-sections': async (ws, msg) => {
      try {
        const sections = await robinQueries.getWikiSections(getDb(), msg.tab);
        ws.send(JSON.stringify({ type: 'robin:wiki-sections', tab: msg.tab, sections }));
      } catch (err) {
        console.error('[Robin] wiki-sections error:', err.message);
        ws.send(JSON.stringify({ type: 'robin:wiki-sections', tab: msg.tab, sections: [], error: err.message }));
      }
    },

    'robin:wiki-page': async (ws, msg) => {
      try {
        const page = await robinQueries.getWikiPage(getDb(), msg.slug);
        ws.send(JSON.stringify({ type: 'robin:wiki', ...page }));
      } catch (err) {
        console.error('[Robin] wiki-page error:', err.message);
        ws.send(JSON.stringify({ type: 'robin:wiki', error: err.message }));
      }
    },

    'robin:context': async (ws, msg) => {
      // Update Robin's awareness of what the user is looking at.
      // No DB query — just tracks state for context injection into Robin's wire.
      const sess = sessions.get(ws);
      if (sess) {
        sess.robinContext = { tab: msg.tab, item: msg.item };
      }
    },
  };
};
