import { WORKSPACE_CONFIGS, type WorkspaceId } from '../types';

interface ToolsPanelProps {
  currentWorkspace: WorkspaceId;
  onSwitch: (id: WorkspaceId) => void;
}

export function ToolsPanel({ currentWorkspace, onSwitch }: ToolsPanelProps) {
  const workspaces = Object.entries(WORKSPACE_CONFIGS) as [WorkspaceId, typeof WORKSPACE_CONFIGS[WorkspaceId]][];
  
  return (
    <nav className="tools-panel">
      {workspaces.map(([id, config]) => (
        <button
          key={id}
          className={`tool-btn ${currentWorkspace === id ? 'active' : ''}`}
          onClick={() => onSwitch(id)}
          title={config.name}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
            {config.icon}
          </span>
        </button>
      ))}
    </nav>
  );
}
