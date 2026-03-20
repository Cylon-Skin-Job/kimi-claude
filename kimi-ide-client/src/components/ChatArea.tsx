import { useRef, useEffect, useState } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useWebSocket } from '../hooks/useWebSocket';
import type { WorkspaceId } from '../types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  workspace: WorkspaceId;
}

export function ChatArea({ workspace }: ChatAreaProps) {
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const justSentRef = useRef(false);
  const [spacerHeight, setSpacerHeight] = useState('4rem');

  // Store data
  const messages = useWorkspaceStore((state) => state.workspaces[workspace].messages);
  const currentTurn = useWorkspaceStore((state) => state.workspaces[workspace].currentTurn);
  const segments = useWorkspaceStore((state) => state.workspaces[workspace].segments);
  const contextUsage = useWorkspaceStore((state) => state.contextUsage);
  const pendingTurnEnd = useWorkspaceStore((state) => state.workspaces[workspace].pendingTurnEnd);

  const addMessage = useWorkspaceStore((state) => state.addMessage);
  const { sendMessage } = useWebSocket();

  // Detect manual scroll — if user scrolls up, disable auto-scroll
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      userScrolledRef.current = !atBottom;
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // On send: scroll user bubble to top of viewport
  useEffect(() => {
    if (justSentRef.current && lastUserMsgRef.current) {
      justSentRef.current = false;
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages.length]);

  // On turn end: scroll to bottom of response (unless user scrolled up)
  useEffect(() => {
    if (pendingTurnEnd && !userScrolledRef.current && chatBottomRef.current) {
      // Shrink spacer back to default
      setSpacerHeight('4rem');
      // Small delay to let the DOM settle after blocks finalize
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [pendingTurnEnd]);

  const handleSend = (text: string) => {
    // Expand spacer so there's room to scroll user bubble to top
    setSpacerHeight('80vh');

    // Disable auto-scroll-to-bottom during streaming — user is watching live
    userScrolledRef.current = true;

    // Add user message
    justSentRef.current = true;
    addMessage(workspace, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now()
    });

    // Send via WebSocket
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
            lastUserMsgRef={lastUserMsgRef}
          />
        )}

        {/* Scroll target for turn-end auto-scroll */}
        <div ref={chatBottomRef} />

        {/* Bottom spacer — expands on send for scroll room, shrinks on turn end */}
        <div style={{ minHeight: spacerHeight }} />
      </div>

      <ChatInput onSend={handleSend} disabled={false} workspace={workspace} />
    </section>
  );
}
