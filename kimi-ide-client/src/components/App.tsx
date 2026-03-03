import { useWorkspaceStore } from '../state/workspaceStore';
import { WORKSPACE_CONFIGS, type WorkspaceId } from '../types';
import { ToolsPanel } from './ToolsPanel';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ContentArea } from './ContentArea';
import './App.css';

function App() {
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace);
  const setCurrentWorkspace = useWorkspaceStore((state) => state.setCurrentWorkspace);
  const ws = useWorkspaceStore((state) => state.ws);
  const isConnected = ws?.readyState === WebSocket.OPEN;
  
  return (
    <div className={`app-container workspace-${currentWorkspace}`}>
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
        {(Object.keys(WORKSPACE_CONFIGS) as WorkspaceId[]).map((workspace) => (
          <div 
            key={workspace}
            className={`workspace ${currentWorkspace === workspace ? 'active' : ''}`}
          >
            <Sidebar workspace={workspace} />
            <ChatArea workspace={workspace} />
            <ContentArea workspace={workspace} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
