import { useRef, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  workspace: string;
}

export function ChatArea({ workspace }: ChatAreaProps) {
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const justSentRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  // Store data
  const messages = useWorkspaceStore((state) => state.workspaces[workspace]?.messages || []);
  const currentTurn = useWorkspaceStore((state) => state.workspaces[workspace]?.currentTurn || null);
  const segments = useWorkspaceStore((state) => state.workspaces[workspace]?.segments || []);
  const contextUsage = useWorkspaceStore((state) => state.contextUsage);

  const addMessage = useWorkspaceStore((state) => state.addMessage);
  const sendMessage = useWorkspaceStore((state) => state.sendMessage);

  // On send: scroll user bubble to top of viewport
  useEffect(() => {
    if (justSentRef.current && lastUserMsgRef.current) {
      justSentRef.current = false;
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages.length]);

  // Hide orb state when first segment arrives
  useEffect(() => {
    if (segments.length > 0) {
      setIsSending(false);
    }
  }, [segments.length]);

  // Show orb if: local sending state OR streaming with no segments yet
  const showOrb = (isSending || currentTurn?.status === 'streaming') && segments.length === 0;

  const handleSend = (text: string) => {
    setIsSending(true);

    justSentRef.current = true;
    addMessage(workspace, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now()
    });

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
        {messages.length === 0 && !currentTurn && !showOrb ? (
          <div className="message message-system">
            {workspace} workspace active - Start a conversation
          </div>
        ) : (
          <MessageList
            workspace={workspace}
            messages={messages}
            currentTurn={currentTurn}
            segments={segments}
            lastUserMsgRef={lastUserMsgRef}
            showOrb={showOrb}
          />
        )}

        {/* Fixed spacer — always present, never changes size.
            Provides scroll room so user bubble can scroll to top of viewport. */}
        <div style={{ minHeight: '80vh' }} />
      </div>

      <ChatInput onSend={handleSend} disabled={false} workspace={workspace} />
    </section>
  );
}
