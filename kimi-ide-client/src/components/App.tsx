import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { applyWorkspaceTheme } from '../lib/workspaces';
import { useWebSocket } from '../hooks/useWebSocket';
import { ToolsPanel } from './ToolsPanel';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ContentArea } from './ContentArea';
import { Toast } from './Toast';
import './App.css';

function App() {
  // WebSocket connection — must run BEFORE the loading gate
  // so discovery can complete and populate configs
  useWebSocket();

  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const ws = useWorkspaceStore((state) => state.ws);
  const configs = useWorkspaceStore((state) => state.workspaceConfigs);
  const getConfig = useWorkspaceStore((state) => state.getWorkspaceConfig);
  const isConnected = ws?.readyState === WebSocket.OPEN;
  const containerRef = useRef<HTMLDivElement>(null);

  const loading = configs.length === 0;

  // Apply workspace theme as CSS custom properties
  useEffect(() => {
    const config = getConfig(currentWorkspace);
    if (config && containerRef.current) {
      applyWorkspaceTheme(containerRef.current, config.theme);
      containerRef.current.style.setProperty('--theme-primary', config.theme.primary);
      const hex = config.theme.primary;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      containerRef.current.style.setProperty('--theme-primary-rgb', `${r}, ${g}, ${b}`);
      containerRef.current.style.setProperty('--theme-border', `rgba(${r}, ${g}, ${b}, 0.3)`);
      containerRef.current.style.setProperty('--theme-border-glow', `rgba(${r}, ${g}, ${b}, 0.6)`);
    }
  }, [currentWorkspace, getConfig, configs]);

  // Once discovery completes, set currentWorkspace to first available if current isn't valid
  useEffect(() => {
    if (configs.length > 0 && !configs.find((c) => c.id === currentWorkspace)) {
      setCurrentWorkspace(configs[0].id);
    }
  }, [configs, currentWorkspace, setCurrentWorkspace]);

  if (loading) {
    return (
      <div ref={containerRef} className="app-container">
        <header className="header">
          <div className="header-left">
            <button className="menu-btn">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="project-name">kimi-claude</span>
          </div>
          <div className="header-right">
            <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          </div>
        </header>
        <div className="workspace-container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim, #555)',
          fontSize: '0.875rem',
        }}>
          Discovering workspaces...
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button className="menu-btn">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="project-name">kimi-claude</span>
        </div>

        <div className="header-right">
          <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* Tools Panel */}
      <ToolsPanel
        currentWorkspace={currentWorkspace}
        onSwitch={setCurrentWorkspace}
      />

      {/* Workspace Container */}
      <div className="workspace-container">
        {configs.map((config) => {
          const layout = config.layout || (config.hasChat ? 'sidebar-chat-content' : 'full');

          return (
            <div
              key={config.id}
              className={`workspace layout-${layout} ${currentWorkspace === config.id ? 'active' : ''}`}
            >
              {layout === 'full' ? (
                <ContentArea workspace={config.id} />
              ) : layout === 'chat-content' ? (
                <>
                  <ChatArea workspace={config.id} />
                  <ContentArea workspace={config.id} />
                </>
              ) : (
                <>
                  <Sidebar workspace={config.id} />
                  <ChatArea workspace={config.id} />
                  <ContentArea workspace={config.id} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <Toast />
    </div>
  );
}

export default App;
