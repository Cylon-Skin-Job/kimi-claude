import { useWorkspaceStore } from '../state/workspaceStore';

interface ToolsPanelProps {
  currentWorkspace: string;
  onSwitch: (id: string) => void;
}

export function ToolsPanel({ currentWorkspace, onSwitch }: ToolsPanelProps) {
  const configs = useWorkspaceStore((s) => s.workspaceConfigs);

  return (
    <nav className="tools-panel">
      {configs.map((config) => (
        <button
          key={config.id}
          className={`tool-btn ${currentWorkspace === config.id ? 'active' : ''}`}
          onClick={() => onSwitch(config.id)}
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
