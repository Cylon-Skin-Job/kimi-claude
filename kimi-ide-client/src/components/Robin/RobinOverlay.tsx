/**
 * @module RobinOverlay
 * @role Full-screen system panel overlay
 *
 * Open Robin sits above workspaces as the system supervisor.
 * Chat on the left, tabbed settings with list/detail split on the right.
 * Wiki detail content comes from robin.db (SQLite) and is injected
 * into Robin's wire session as shared context.
 */

import { useState, useEffect, useCallback } from 'react';
import './robin.css';

interface RobinOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface SettingItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  badge: string;
  badgeType: 'on' | 'off' | 'value';
  section: string;
}

const TABS = [
  { id: 'clis', icon: 'terminal', label: 'CLIs', desc: 'Open Robin works by connecting to AI assistants that run on your machine. These assistants are called CLIs. You need at least one installed for Open Robin to work.', faqs: [
    'What is a CLI?',
    'How does Open Robin use a CLI?',
    'Why does Open Robin require a CLI?',
    'Will I get charged for using a CLI?',
  ]},
  { id: 'connectors', icon: 'link', label: 'Connectors', desc: 'Connectors let Open Robin talk to services you already use, like GitLab or GitHub. When a connector is active, Open Robin can sync tickets, pull in issues, and keep your external tools in the loop.', faqs: [
    'What services can I connect?',
    'Is my data shared externally?',
  ]},
  { id: 'secrets', icon: 'key', label: 'Secrets', desc: 'Some connectors and services need passwords or API keys to work. Secrets are stored safely on your machine and are never shared with AI agents. Only Open Robin uses them behind the scenes.', faqs: [
    'Where are secrets stored?',
    'Can AI agents see my secrets?',
  ]},
  { id: 'enforcement', icon: 'shield', label: 'Enforcement', desc: 'These are the safety rules. They control what AI agents are allowed to do on your machine. You\'re in charge here — agents can\'t change these settings, only you can.', faqs: [
    'What can agents do without my approval?',
    'Can I override these rules?',
  ]},
];

// Settings items per tab — will be driven by robin.db queries
const SETTINGS_BY_TAB: Record<string, SettingItem[]> = {
  clis: [
    { id: 'kimi', icon: 'terminal', name: 'Kimi', desc: 'The default AI assistant. Open Robin uses Kimi to power your chats and run agent tasks.', badge: 'active', badgeType: 'on', section: 'Active' },
  ],
  connectors: [
    { id: 'gitlab', icon: 'cloud', name: 'GitLab', desc: 'Syncs tickets and issues between Open Robin and your GitLab project. Changes flow both ways automatically.', badge: 'connected', badgeType: 'on', section: 'Active' },
  ],
  secrets: [
    { id: 'gitlab-token', icon: 'vpn_key', name: 'GitLab Token', desc: 'Lets Open Robin connect to your GitLab account. Created in GitLab under Settings > Access Tokens.', badge: 'set', badgeType: 'on', section: 'Tokens' },
    { id: 'anthropic-key', icon: 'vpn_key', name: 'Anthropic API Key', desc: 'Required if you want to use Claude as an AI assistant. Get one at console.anthropic.com.', badge: 'set', badgeType: 'on', section: 'Tokens' },
  ],
  enforcement: [
    { id: 'settings-write-lock', icon: 'lock', name: 'Settings Protection', desc: 'AI agents cannot modify any configuration files. Only you can change settings, by dragging files into the settings folder.', badge: 'on', badgeType: 'on', section: 'Rules' },
    { id: 'deploy-modals', icon: 'drag_pan', name: 'Deploy Approval', desc: 'When an AI suggests new configuration, a visual approval screen appears. You drag the file to accept it, or close to reject.', badge: 'on', badgeType: 'on', section: 'Rules' },
    { id: 'settings-archive', icon: 'archive', name: 'Version History', desc: 'Every time you approve a new configuration, the previous version is saved automatically. You can always go back.', badge: 'on', badgeType: 'on', section: 'Rules' },
    { id: 'session-limit', icon: 'memory', name: 'Session Limit', desc: 'The maximum number of AI conversations that can run at the same time. Higher means more parallel work, but uses more memory.', badge: '20', badgeType: 'value', section: 'Limits' },
    { id: 'idle-timeout', icon: 'timer', name: 'Idle Timeout', desc: 'How long an inactive conversation stays open before Open Robin pauses it. The conversation can be resumed anytime.', badge: '9m', badgeType: 'value', section: 'Limits' },
    { id: 'event-log', icon: 'event_log', name: 'Activity Log', desc: 'Records everything that happens in the system — file changes, agent actions, trigger fires. Useful for understanding what happened and when.', badge: 'on', badgeType: 'on', section: 'Logging' },
    { id: 'notifications', icon: 'notifications', name: 'Notifications', desc: 'Shows brief pop-up messages when something completes — an agent finishes a task, a scheduled job runs, or a trigger fires.', badge: 'on', badgeType: 'on', section: 'Logging' },
  ],
};

// Available CLIs that can be added — will come from a registry/server
interface RegistryCLI {
  id: string;
  name: string;
  by: string;
  desc: string;
  version: string;
  installed: boolean;
}

const CLI_REGISTRY: RegistryCLI[] = [
  { id: 'qwen', name: 'Qwen Code', by: 'Alibaba / QwenLM', desc: 'Open-source agent with free tier (2,000 requests/day). Supports ACP wire protocol for IDE embedding. Uses Qwen3-Coder models.', version: '2026', installed: false },
  { id: 'claude', name: 'Claude Code', by: 'Anthropic', desc: 'Deep reasoning and careful analysis. 1M token context window. Supports hooks, plan mode, and the Agent Client Protocol.', version: '2.1', installed: false },
  { id: 'opencode', name: 'OpenCode', by: 'SST', desc: 'Fastest-growing open-source alternative. Go-based, polished UI, 75+ model providers. Works offline with local models.', version: '2026', installed: false },
  { id: 'codex', name: 'Codex CLI', by: 'OpenAI', desc: 'Fast, lightweight Rust-based agent. Full-auto mode for hands-off execution. Cloud mode for async tasks.', version: '0.116', installed: false },
  { id: 'gemini', name: 'Gemini CLI', by: 'Google', desc: 'Free tier with 1,000 requests/day. Built-in Google Search grounding. Open source.', version: '2026', installed: false },
];

const CHAT_MESSAGES = [
  { type: 'system' as const, text: 'Session started' },
  { type: 'robin' as const, text: 'Hey! Everything\u2019s running smoothly. Two conversations are open and your agents are idle. What can I help with?' },
  { type: 'user' as const, text: 'How do the safety settings work?' },
  { type: 'robin' as const, text: 'Great question. Your AI assistants can\u2019t change their own settings \u2014 only you can. When an AI wants to suggest new configuration, it creates a draft and you get a visual approval screen. You drag the file to accept, or just close it to reject. I\u2019ve pulled up the details for you \u2192' },
  { type: 'system' as const, text: 'Viewing: Settings Protection' },
];

export function RobinOverlay({ open, onClose }: RobinOverlayProps) {
  const [activeTab, setActiveTab] = useState('clis');
  const [selectedSetting, setSelectedSetting] = useState(SETTINGS_BY_TAB['clis']?.[0]?.id || '');
  const [showRegistry, setShowRegistry] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const items = SETTINGS_BY_TAB[activeTab] || [];
  const sections = [...new Set(items.map(s => s.section))];
  const selected = items.find(s => s.id === selectedSetting);

  return (
    <div className="robin-overlay">
      {/* Header */}
      <div className="robin-overlay-header">
        <div className="robin-overlay-header-left">
          <span className="material-symbols-outlined robin-overlay-header-icon">raven</span>
          <span className="robin-overlay-header-name">Open Robin</span>
          <span className="robin-overlay-header-subtitle">System Panel</span>
        </div>
        <button className="robin-exit-btn" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Body: Chat | Settings */}
      <div className="robin-overlay-body">

        {/* LEFT: Chat */}
        <div className="robin-chat">
          <div className="robin-chat-messages">
            {CHAT_MESSAGES.map((msg, i) => {
              if (msg.type === 'system') {
                return <div key={i} className="robin-msg-system">{msg.text}</div>;
              }
              if (msg.type === 'user') {
                return (
                  <div key={i} className="robin-msg-user">
                    <div className="robin-msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
                  </div>
                );
              }
              return (
                <div key={i} className="robin-msg-robin">
                  <div className="robin-msg-avatar">
                    <span className="material-symbols-outlined">raven</span>
                  </div>
                  <div className="robin-msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
              );
            })}
          </div>
          <div className="robin-chat-input">
            <textarea rows={2} placeholder="Ask Open Robin anything..." />
          </div>
        </div>

        {/* RIGHT: Settings */}
        <div className="robin-settings">

          {/* Tab header */}
          {(() => {
            const tab = TABS.find(t => t.id === activeTab);
            return (
              <div className="robin-settings-header">
                <div className="robin-settings-header-info">
                  <div className="robin-settings-header-title">
                    <span className="material-symbols-outlined">{tab?.icon}</span>
                    {tab?.label}
                  </div>
                  <div className="robin-settings-header-desc">
                    {tab?.desc}
                  </div>
                </div>
                {tab?.faqs && tab.faqs.length > 0 && (
                  <div className="robin-settings-header-faqs">
                    {tab.faqs.map((faq, i) => (
                      <span key={i} className="robin-faq-link">{faq}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tab bar */}
          <div className="robin-settings-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`robin-settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  const tabItems = SETTINGS_BY_TAB[tab.id] || [];
                  setSelectedSetting(tabItems[0]?.id || '');
                  setShowRegistry(false);
                }}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Split: list + detail */}
          <div className="robin-settings-split">

            {/* Settings list */}
            <div className="robin-settings-list">
              {sections.map(section => (
                <div key={section}>
                  <div className="robin-settings-section-divider">{section}</div>
                  {items.filter(s => s.section === section).map(item => (
                    <div
                      key={item.id}
                      className={`robin-setting-item ${selectedSetting === item.id && !showRegistry ? 'active' : ''}`}
                      onClick={() => { setSelectedSetting(item.id); setShowRegistry(false); }}
                    >
                      <div className="robin-setting-item-icon">
                        <span className="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div className="robin-setting-item-text">
                        <div className="robin-setting-item-name">{item.name}</div>
                        <div className="robin-setting-item-desc">{item.desc}</div>
                      </div>
                      <span className={`robin-setting-item-badge ${item.badgeType}`}>{item.badge}</span>
                    </div>
                  ))}
                </div>
              ))}
              {activeTab === 'clis' && (
                <button
                  className={`robin-add-btn ${showRegistry ? 'active' : ''}`}
                  onClick={() => setShowRegistry(true)}
                >
                  <span className="material-symbols-outlined">add</span>
                  Add CLI
                </button>
              )}
            </div>

            {/* Right panel: wiki detail or registry */}
            <div className="robin-detail">
              <div className="robin-detail-scroll">
                {showRegistry && activeTab === 'clis' ? (
                  <CLIRegistry />
                ) : (
                  selected && <SettingDetail setting={selected} tabLabel={TABS.find(t => t.id === activeTab)?.label || ''} items={items} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingDetail({ setting, tabLabel, items }: { setting: SettingItem; tabLabel: string; items: SettingItem[] }) {
  return (
    <>
      <div className="robin-detail-header">
        <div className="robin-detail-breadcrumb">
          <span>{tabLabel}</span> / <span>{setting.section}</span> / {setting.name}
        </div>

        <div className="robin-detail-title">
          <span className="material-symbols-outlined">{setting.icon}</span>
          {setting.name}
        </div>

        <div className="robin-detail-subtitle">
          {setting.desc}. This page describes how the setting works, its current state, and configuration options.
        </div>

        <div className="robin-detail-meta">
          <div className="robin-detail-meta-item">
            <span className="robin-detail-meta-label">Status</span>
            <span className={`robin-detail-meta-value ${setting.badgeType === 'on' ? 'highlight' : ''}`}>
              {setting.badgeType === 'on' ? 'Active' : setting.badgeType === 'off' ? 'Inactive' : setting.badge}
            </span>
          </div>
          <div className="robin-detail-meta-item">
            <span className="robin-detail-meta-label">Section</span>
            <span className="robin-detail-meta-value">{setting.section}</span>
          </div>
          <div className="robin-detail-meta-item">
            <span className="robin-detail-meta-label">Source</span>
            <span className="robin-detail-meta-value"><code>robin.db</code></span>
          </div>
        </div>

        {setting.badgeType === 'on' && (
          <div className="robin-detail-toggle-row">
            <div>
              <div className="robin-detail-toggle-label">{setting.name}</div>
              <div className="robin-detail-toggle-desc">Toggle this setting on or off</div>
            </div>
            <div className="robin-toggle on" />
          </div>
        )}
      </div>

      <div className="robin-detail-body">
        <h2>What is this?</h2>
        <p>
          {setting.desc}
        </p>

        <h2>How does it work?</h2>
        <p>
          This page will be populated from Open Robin's system knowledge base.
          In the live system, Open Robin reads this same content — so when you ask her
          about {setting.name.toLowerCase()}, she's looking at exactly what you see here.
        </p>

        {setting.badgeType === 'value' && (
          <>
            <h2>Current value</h2>
            <p>
              This is currently set to <strong>{setting.badge}</strong>. You can change it in
              the settings panel or ask Open Robin to walk you through the options.
            </p>
          </>
        )}

        <div className="robin-detail-related">
          <div className="robin-detail-related-title">See also</div>
          <div className="robin-detail-related-links">
            {items.filter(s => s.section === setting.section && s.id !== setting.id).slice(0, 3).map(s => (
              <span key={s.id} className="robin-detail-related-link">
                <span className="material-symbols-outlined">{s.icon}</span>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function CLIRegistry() {
  return (
    <div className="robin-registry">
      <div className="robin-detail-header">
        <div className="robin-detail-title">
          <span className="material-symbols-outlined">add_circle</span>
          Add a CLI
        </div>
        <div className="robin-detail-subtitle">
          Choose an AI assistant to connect to Open Robin. You'll need the CLI installed on your
          machine first — each one has its own setup instructions.
        </div>
      </div>

      <div className="robin-registry-list">
        {CLI_REGISTRY.map(cli => (
          <div key={cli.id} className="robin-registry-item">
            <div className="robin-registry-item-info">
              <div className="robin-registry-item-top">
                <span className="robin-registry-item-name">{cli.name}</span>
                <span className="robin-registry-item-version">v{cli.version}</span>
              </div>
              <div className="robin-registry-item-by">by {cli.by}</div>
              <div className="robin-registry-item-desc">{cli.desc}</div>
            </div>
            <button className="robin-registry-add-btn">
              <span className="material-symbols-outlined">download</span>
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
