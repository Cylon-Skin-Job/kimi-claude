import { useEffect, useRef, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { applyPanelTheme } from '../lib/panels';
import { useWebSocket } from '../hooks/useWebSocket';
import { ToolsPanel } from './ToolsPanel';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ContentArea } from './ContentArea';
import { Toast } from './Toast';
import { ModalOverlay } from './Modal/ModalOverlay';
import { RobinOverlay } from './Robin/RobinOverlay';
import './App.css';

function App() {
  // WebSocket connection — must run BEFORE the loading gate
  // so discovery can complete and populate configs
  useWebSocket();

  const currentPanel = usePanelStore((state) => state.currentPanel);
  const setCurrentPanel = usePanelStore((state) => state.setCurrentPanel);
  const ws = usePanelStore((state) => state.ws);
  const configs = usePanelStore((state) => state.panelConfigs);
  const getConfig = usePanelStore((state) => state.getPanelConfig);
  const isConnected = ws?.readyState === WebSocket.OPEN;
  const containerRef = useRef<HTMLDivElement>(null);

  const [robinOpen, setRobinOpen] = useState(false);

  const loading = configs.length === 0;

  // Apply panel theme as CSS custom properties
  useEffect(() => {
    const config = getConfig(currentPanel);
    if (config && containerRef.current) {
      applyPanelTheme(containerRef.current, config.theme);
      containerRef.current.style.setProperty('--theme-primary', config.theme.primary);
      const hex = config.theme.primary;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      containerRef.current.style.setProperty('--theme-primary-rgb', `${r}, ${g}, ${b}`);
      containerRef.current.style.setProperty('--theme-border', `rgba(${r}, ${g}, ${b}, 0.3)`);
      containerRef.current.style.setProperty('--theme-border-glow', `rgba(${r}, ${g}, ${b}, 0.6)`);
    }
  }, [currentPanel, getConfig, configs]);

  // Once discovery completes, set currentPanel to first available if current isn't valid
  useEffect(() => {
    if (configs.length > 0 && !configs.find((c) => c.id === currentPanel)) {
      setCurrentPanel(configs[0].id);
    }
  }, [configs, currentPanel, setCurrentPanel]);

  if (loading) {
    return (
      <div ref={containerRef} className="app-container">
        <header className="header">
          <div className="header-left">
            <button className="menu-btn">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          </div>
          <div className="header-right">
            <button className="robin-icon-btn" onClick={() => setRobinOpen(true)}>
              <span className="material-symbols-outlined">raven</span>
            </button>
          </div>
        </header>
        <div className="panel-container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim, #555)',
          fontSize: '0.875rem',
        }}>
          Discovering panels...
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
          <div className={`connection-status ${isConnected ? 'connected' : ''}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="header-right">
          <button className="robin-icon-btn" onClick={() => setRobinOpen(true)}>
            <span className="material-symbols-outlined">raven</span>
          </button>
        </div>
      </header>

      {/* Tools Panel */}
      <ToolsPanel
        currentPanel={currentPanel}
        onSwitch={setCurrentPanel}
      />

      {/* Panel Container */}
      <div className="panel-container">
        {configs.map((config) => {
          const layout = config.layout || (config.hasChat ? 'sidebar-chat-content' : 'full');

          return (
            <div
              key={config.id}
              className={`panel layout-${layout} ${currentPanel === config.id ? 'active' : ''}`}
            >
              {layout === 'full' ? (
                <ContentArea panel={config.id} />
              ) : layout === 'chat-content' ? (
                <>
                  <ChatArea panel={config.id} />
                  <ContentArea panel={config.id} />
                </>
              ) : (
                <>
                  <Sidebar panel={config.id} />
                  <ChatArea panel={config.id} />
                  <ContentArea panel={config.id} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <Toast />
      <ModalOverlay />
      <RobinOverlay open={robinOpen} onClose={() => setRobinOpen(false)} />
    </div>
  );
}

export default App;
