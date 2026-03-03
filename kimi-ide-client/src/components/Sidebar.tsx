import { useWorkspaceStore } from '../state/workspaceStore';
import { WORKSPACE_CONFIGS, type WorkspaceId } from '../types';

interface SidebarProps {
  workspace: WorkspaceId;
}

export function Sidebar({ workspace }: SidebarProps) {
  const config = WORKSPACE_CONFIGS[workspace];
  const clearWorkspace = useWorkspaceStore((state) => state.clearWorkspace);
  const messages = useWorkspaceStore((state) => state.workspaces[workspace].messages);
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">{config.name}</div>
      
      <button 
        className="new-chat-btn"
        onClick={() => clearWorkspace(workspace)}
      >
        <span className="material-symbols-outlined">add</span>
        New {config.name.split(' ')[0]} Session
      </button>
      
      <div className="chat-list">
        {messages.length === 0 ? (
          <div className="chat-item">
            <span className="chat-item-text">No sessions yet</span>
          </div>
        ) : (
          messages
            .filter(m => m.type === 'user')
            .slice(-5)
            .map((msg, i) => (
              <div key={i} className="chat-item">
                <span className="chat-item-text">{msg.content.slice(0, 30)}...</span>
              </div>
            ))
        )}
      </div>
    </aside>
  );
}
