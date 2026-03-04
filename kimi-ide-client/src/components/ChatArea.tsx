import { useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEngineBridge } from '../hooks/useEngineBridge';
import type { WorkspaceId } from '../types';
import { MessageList } from './MessageList';
import { BlockRenderer } from './BlockRenderer';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  workspace: WorkspaceId;
}

export function ChatArea({ workspace }: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  
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
        
        {/* Block Renderer for streaming content */}
        {currentTurn?.status === 'streaming' && (
          <BlockRenderer workspace={workspace} />
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <ChatInput onSend={handleSend} disabled={false} workspace={workspace} />
    </section>
  );
}
