import { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { logger } from '../lib/logger';

interface SidebarProps {
  workspace: string;
}

interface ConfirmationModal {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Sidebar({ workspace }: SidebarProps) {
  const config = useWorkspaceStore((s) => s.getWorkspaceConfig(workspace));
  const ws = useWorkspaceStore((state) => state.ws);
  const threads = useWorkspaceStore((state) => state.threads);
  const currentThreadId = useWorkspaceStore((state) => state.currentThreadId);
  
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmationModal>({
    show: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });
  
  // Request thread list when connected
  useEffect(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:list' }));
    }
  }, [ws, workspace]);

  // Handle WebSocket messages for confirmation modal
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'thread:create:confirm') {
          setConfirmModal({
            show: true,
            message: msg.message,
            onConfirm: () => {
              // Send confirmed creation
              sendMessage({ type: 'thread:create', confirmed: true });
              setConfirmModal(prev => ({ ...prev, show: false }));
            },
            onCancel: () => {
              setConfirmModal(prev => ({ ...prev, show: false }));
            }
          });
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);
  
  const sendMessage = useCallback((msg: object) => {
    console.log('[Sidebar] Sending:', msg, 'WS state:', ws?.readyState);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.error('[Sidebar] WebSocket not connected! State:', ws?.readyState);
    }
  }, [ws]);
  
  const handleCreateThread = () => {
    logger.info('[Sidebar] BUTTON CLICKED: New Thread');
    
    if (!ws) {
      logger.error('[Sidebar] WebSocket is NULL - not initialized');
      return;
    }
    
    if (ws.readyState !== WebSocket.OPEN) {
      logger.error('[Sidebar] WebSocket not OPEN. State:', ws.readyState);
      logger.error('[Sidebar] State 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
      return;
    }
    
    logger.info('[Sidebar] WebSocket is OPEN - sending thread:create');
    sendMessage({ type: 'thread:create' });
    logger.info('[Sidebar] Message sent');
  };
  
  const handleOpenThread = (threadId: string) => {
    sendMessage({ type: 'thread:open', threadId });
  };
  
  const handleRenameStart = (threadId: string, currentName: string) => {
    setRenamingId(threadId);
    setRenameValue(currentName);
  };
  
  const handleRenameSubmit = (threadId: string) => {
    if (renameValue.trim()) {
      sendMessage({ 
        type: 'thread:rename', 
        threadId, 
        name: renameValue.trim() 
      });
    }
    setRenamingId(null);
    setRenameValue('');
  };
  
  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue('');
  };
  
  const handleDeleteThread = (threadId: string) => {
    if (confirm('Delete this conversation?')) {
      sendMessage({ type: 'thread:delete', threadId });
    }
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'unknown';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'unknown';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return 'unknown';
    }
  };
  
  return (
    <aside className="sidebar">
      <div className="sidebar-header">{config?.name || workspace}</div>
      
      <button 
        className="new-chat-btn"
        onClick={handleCreateThread}
      >
        <span className="material-symbols-outlined">add</span>
        New Thread
      </button>
      
      <div className="thread-list">
        {!threads || threads.length === 0 ? (
          <div className="chat-item">
            <span className="chat-item-text">No threads yet</span>
          </div>
        ) : (
          threads.filter(t => t && t.threadId && t.entry).map((thread) => (
            <div 
              key={thread.threadId}
              className={`chat-item ${currentThreadId === thread.threadId ? 'active' : ''}`}
              onClick={() => handleOpenThread(thread.threadId)}
            >
              {renamingId === thread.threadId ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit(thread.threadId);
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  onBlur={() => handleRenameSubmit(thread.threadId)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    fontSize: '12px',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
              ) : (
                <>
                  <div className="thread-row thread-row-top">
                    <span className="chat-item-text" title={thread.entry?.name || 'Unnamed'}>
                      {thread.entry?.name || 'Unnamed'}
                      {thread.entry?.status === 'active' && (
                        <span style={{ color: '#4caf50', marginLeft: '4px', fontSize: '8px' }}>●</span>
                      )}
                    </span>
                    <button 
                      className="thread-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === thread.threadId ? null : thread.threadId);
                      }}
                      title="More options"
                    >
                      ⋮
                    </button>
                    {menuOpenId === thread.threadId && (
                      <div className="thread-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            handleRenameStart(thread.threadId, thread.entry?.name || 'Unnamed');
                            setMenuOpenId(null);
                          }}
                        >
                          ✎ Rename
                        </button>
                        <button 
                          onClick={() => {
                            handleDeleteThread(thread.threadId);
                            setMenuOpenId(null);
                          }}
                        >
                          × Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="thread-row thread-row-bottom">
                    <span className="chat-item-meta">
                      {thread.entry?.messageCount || 0} msgs · {formatDate(thread.entry?.createdAt)}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={confirmModal.onCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p className="modal-message">{confirmModal.message}</p>
            <div className="modal-buttons">
              <button className="modal-btn modal-btn-secondary" onClick={confirmModal.onCancel}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-primary" onClick={confirmModal.onConfirm}>
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
