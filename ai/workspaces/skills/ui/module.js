/**
 * Skills Workspace — Runtime Module
 *
 * Loads skill data from the three sources and renders into the 3-column layout.
 * Currently uses fake data for Kimi and Claude columns.
 * Local column will be populated from index.json when available.
 */

// Fake skill data — will be replaced by real sources
const LOCAL_SKILLS = [
  { name: 'curiosity', desc: 'Exploration engine. Riff on ideas, surface threads, mirror back.', type: 'mode', icon: 'psychology', sync: 'ok' },
  { name: 'flow', desc: 'Stream of consciousness, ideation, capture mode.', type: 'mode', icon: 'psychology', sync: 'ok' },
  { name: 'slow-down', desc: 'Methodical collaborative mode — stop rushing, trace systematically.', type: 'mode', icon: 'psychology', sync: 'ok' },
  { name: 'refine', desc: 'Shape ideas through list/notes style dialogue.', type: 'mode', icon: 'psychology', sync: 'drift' },
  { name: 'launch', desc: 'Build and implement with checkpoint discipline.', type: 'mode', icon: 'psychology', sync: 'ok' },
  { name: 'review', desc: 'Post-mortem, evaluation, file drift detection.', type: 'mode', icon: 'psychology', sync: 'ok' },
  { name: 'export-safety', desc: 'Verify all importers before modifying exported JS functions.', type: 'guardrail', icon: 'shield', sync: 'ok' },
  { name: 'path-safety', desc: 'Invoke when moving files, renaming directories, or changing paths.', type: 'guardrail', icon: 'shield', sync: 'ok' },
  { name: 'js-conventions', desc: 'JavaScript naming, patterns, conventions.', type: 'convention', icon: 'rule', sync: 'ok' },
  { name: 'css-conventions', desc: 'CSS patterns, naming, anti-patterns.', type: 'convention', icon: 'rule', sync: 'ok' },
  { name: 'handoff', desc: 'End a session — extract insights, commit state, prepare for next.', type: 'utility', icon: 'build', sync: 'ok' },
  { name: 'resume', desc: 'Start a session — load previous context, orient.', type: 'utility', icon: 'build', sync: 'ok' },
  { name: 'sync', desc: 'Keep Claude Code commands and Cursor skills in sync.', type: 'utility', icon: 'build', sync: 'ok' },
  { name: 'version-hygiene', desc: 'Invoke when creating versioned artifacts or time-ordered data.', type: 'guardrail', icon: 'shield', sync: 'drift' },
];

const KIMI_SKILLS = [
  { name: 'wiki-sync', desc: 'Bidirectional sync between local wiki and GitLab wiki.', type: 'agent', icon: 'smart_toy', sync: 'ok' },
  { name: 'ticket-route', desc: 'Route incoming tickets to the right background agent.', type: 'agent', icon: 'smart_toy', sync: 'ok' },
  { name: 'preflight', desc: 'Run lint, type check, and test suite before commit.', type: 'pipeline', icon: 'deployed_code', sync: 'ok' },
  { name: 'deploy', desc: 'Build, test, and deploy to Cloud Run staging.', type: 'pipeline', icon: 'deployed_code', sync: 'ok' },
  { name: 'status', desc: 'Show server health, active sessions, agent status.', type: 'diagnostic', icon: 'monitoring', sync: 'ok' },
  { name: 'replay', desc: 'Replay an agent run from its manifest and frozen artifacts.', type: 'diagnostic', icon: 'history', sync: 'ok' },
  { name: 'capture', desc: 'Quick-capture an idea to the capture workspace inbox.', type: 'utility', icon: 'edit_note', sync: 'ok' },
  { name: 'gitlab-sync', desc: 'Push/pull issues between local index and GitLab API.', type: 'integration', icon: 'sync', sync: 'ok' },
];

function renderSkillRow(skill) {
  const syncClass = skill.sync === 'ok' ? 'ws-sync-ok' : skill.sync === 'drift' ? 'ws-sync-drift' : 'ws-sync-missing';
  return `
    <div class="ws-skill-row">
      <div class="ws-skill-row-icon">
        <span class="material-symbols-outlined">${skill.icon}</span>
      </div>
      <div class="ws-skill-row-info">
        <div class="ws-skill-row-name">${skill.name}</div>
        <div class="ws-skill-row-desc">${skill.desc}</div>
        <span class="ws-skill-tag">${skill.type}</span>
      </div>
      <div class="ws-skill-row-sync ${syncClass}"></div>
    </div>
  `;
}

function renderEmpty(message) {
  return `
    <div class="ws-skill-empty">
      <span class="material-symbols-outlined">link_off</span>
      <div class="ws-skill-empty-text">${message}</div>
    </div>
  `;
}

export function mount(el, ctx) {
  // Render local skills
  const localList = el.querySelector('[data-list="local"]');
  const localCount = el.querySelector('[data-count="local"]');
  const localStatus = el.querySelector('[data-status="local"]');
  const localDot = localStatus?.previousElementSibling;

  if (localList) {
    localList.innerHTML = LOCAL_SKILLS.map(renderSkillRow).join('');
  }
  if (localCount) localCount.textContent = LOCAL_SKILLS.length;
  if (localStatus) localStatus.textContent = `~/.claude/commands/ · ${LOCAL_SKILLS.length} skills loaded`;
  if (localDot) { localDot.className = 'ws-status-dot ws-dot-connected'; }

  // Render kimi skills
  const kimiList = el.querySelector('[data-list="kimi"]');
  const kimiCount = el.querySelector('[data-count="kimi"]');
  const kimiStatus = el.querySelector('[data-status="kimi"]');
  const kimiDot = kimiStatus?.previousElementSibling;

  if (kimiList) {
    kimiList.innerHTML = KIMI_SKILLS.map(renderSkillRow).join('');
  }
  if (kimiCount) kimiCount.textContent = KIMI_SKILLS.length;
  if (kimiStatus) kimiStatus.textContent = `kimi CLI · localhost:3001 · connected`;
  if (kimiDot) { kimiDot.className = 'ws-status-dot ws-dot-connected'; }

  // Claude column — disconnected state
  const claudeList = el.querySelector('[data-list="claude"]');
  if (claudeList) {
    claudeList.innerHTML = renderEmpty(
      'Claude Code CLI not connected.<br>Connect to see built-in commands and custom skills.'
    );
  }
}

export function unmount(el, ctx) {
  // Nothing to clean up — no timers or listeners
}
