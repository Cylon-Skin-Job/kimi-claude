import { useRef, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEngineBridge } from '../hooks/useEngineBridge';
import type { WorkspaceId } from '../types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  workspace: WorkspaceId;
}

export function ChatArea({ workspace }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  
  // Local state for immediate orb display
  const [isSending, setIsSending] = useState(false);
  
  // Store data
  const messages = useWorkspaceStore((state) => state.workspaces[workspace].messages);
  const currentTurn = useWorkspaceStore((state) => state.workspaces[workspace].currentTurn);
  const segments = useWorkspaceStore((state) => state.workspaces[workspace].segments);
  const contextUsage = useWorkspaceStore((state) => state.contextUsage);
  
  const addMessage = useWorkspaceStore((state) => state.addMessage);
  const { sendMessage } = useWebSocket();
  const engine = useEngineBridge(workspace);
  
  // Kill auto-scroll when user scrolls up
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
      userScrolledRef.current = !atBottom;
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Re-enable auto-scroll on new user message
  useEffect(() => {
    userScrolledRef.current = false;
  }, [messages.length]);

  // Auto-scroll to bottom (unless user scrolled up)
  useEffect(() => {
    if (!userScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, segments]);

  const handleSend = (text: string) => {
    // Show orb immediately
    setIsSending(true);
    
    // Reset engine for new turn
    engine.reset();
    engine.startTurn();
    
    // Add user message
    addMessage(workspace, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now()
    });
    
    // Send via WebSocket - turn_begin will start engine
    sendMessage(text, workspace);
  };
  
  // Hide orb when first segment arrives
  useEffect(() => {
    if (segments.length > 0) {
      setIsSending(false);
    }
  }, [segments.length]);
  
  // Show orb if: local sending state OR streaming with no segments yet
  const showOrb = (isSending || currentTurn?.status === 'streaming') && segments.length === 0;
  
  return (
    <section className="chat-area" style={{ position: 'relative' }}>
      {/* Context Usage - Lower Right of Chat */}
      <div
        className="context-usage"
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '12px',
          zIndex: 10,
          background: 'var(--bg-solid)',
          padding: '4px 10px',
          borderRadius: '6px',
          border: '1px solid var(--theme-border)'
        }}
      >
        <span className="context-usage-label">Context</span>
        <div className="context-usage-bar">
          <div 
            className="context-usage-fill" 
            style={{ width: `${Math.min(contextUsage, 100)}%` }}
          />
        </div>
        <span>{contextUsage.toFixed(2)}%</span>
      </div>
      
      {/* Messages */}
      <div className="chat-messages" ref={chatContainerRef}>
        {messages.length === 0 && !currentTurn ? (
          <div className="message message-system">
            {workspace} workspace active - Start a conversation
          </div>
        ) : (
          <MessageList 
            workspace={workspace}
            messages={messages}
            currentTurn={currentTurn}
            segments={segments}
          />
        )}
        
        {/* Thinking Orb - shows immediately on send, disappears when first content arrives */}
        {showOrb && (
          <div className="message message-assistant" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0',
            marginLeft: '8px',
          }}>
            <span 
              className="material-symbols-outlined thinking-orb" 
              style={{ 
                fontSize: '24px', 
                color: 'var(--theme-primary)',
                animation: 'thinking-pulse 1200ms ease-in-out infinite',
                display: 'inline-block',
              }}
            >
              lens_blur
            </span>
            <span style={{
              fontSize: '13px',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
            }}>
              Thinking...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <ChatInput onSend={handleSend} disabled={false} workspace={workspace} />
    </section>
  );
}
