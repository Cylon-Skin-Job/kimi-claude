import { useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../state/workspaceStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { getQueue } from '../lib/simpleQueue';
import { getAccumulator } from '../lib/contentAccumulator';
import { SEGMENT_ICONS, getSegmentCategory } from '../lib/instructions';
import type { WorkspaceId } from '../types';
import { MessageList } from './MessageList';
import { SimpleBlockRenderer } from './SimpleBlockRenderer';
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
    // /demo command — fire off every block type for visual testing
    if (text.trim() === '/demo') {
      const queue = getQueue(workspace);
      queue.startTurn();

      // Orb
      queue.addBlock({ type: 'orb', content: '' });

      // Thinking (collapsible)
      queue.addBlock({
        type: 'think',
        content: 'Analyzing the request and considering the best approach to solve this problem...',
        complete: true,
        header: { icon: 'lightbulb', label: 'Thinking' },
      });

      // Text
      queue.addBlock({
        type: 'text',
        content: 'Here is a sample response with **markdown** support and `inline code`.',
        complete: true,
      });

      // Code
      queue.addBlock({
        type: 'code',
        content: 'function hello() {\n  console.log("Hello, world!");\n}',
        complete: true,
        meta: { language: 'javascript' },
      });

      // Inline tools
      const inlineTypes = ['read', 'glob', 'grep', 'web_search', 'fetch', 'subagent', 'todo'];
      for (const segType of inlineTypes) {
        const info = SEGMENT_ICONS[segType] || { icon: 'build', label: segType };
        queue.addBlock({
          type: 'tool',
          content: '',
          complete: true,
          header: { icon: info.icon, label: info.label },
          meta: { segmentType: segType, toolCallId: `demo-${segType}` },
        });
      }

      // Shell (collapsible)
      queue.addBlock({
        type: 'tool',
        content: '$ npm run build\n\n> kimi-ide-client@0.1.0 build\n> vite build\n\n✓ 42 modules transformed.\ndist/index.html    0.45 kB │ gzip: 0.29 kB\ndist/assets/index-DiwrgTda.css  6.12 kB │ gzip: 1.87 kB\ndist/assets/index-BqeVJ9xN.js  142.35 kB │ gzip: 45.67 kB\n✓ built in 1.23s',
        complete: true,
        header: { icon: 'terminal', label: 'Shell' },
        meta: { segmentType: 'shell', toolCallId: 'demo-shell' },
      });

      // Write (collapsible with code content)
      queue.addBlock({
        type: 'tool',
        content: 'import { useEffect, useState } from \'react\';\nimport { getQueue } from \'../lib/simpleQueue\';\n\nexport function useBlockQueue(workspace: string) {\n  const queue = getQueue(workspace);\n  const [state, setState] = useState(() => queue.getState());\n\n  useEffect(() => {\n    return queue.subscribe((s) => setState({ ...s }));\n  }, [queue]);\n\n  return state;\n}',
        complete: true,
        header: { icon: 'edit_note', label: 'Write `src/hooks/useBlockQueue.ts`' },
        meta: { segmentType: 'write', toolCallId: 'demo-write' },
      });

      // Edit (collapsible with diff content)
      queue.addBlock({
        type: 'tool',
        content: '- const COLLAPSIBLE_TYPES = new Set([\'think\', \'shell\', \'write\']);\n+ const COLLAPSIBLE_TYPES = new Set([\'think\', \'shell\', \'write\', \'edit\']);',
        complete: true,
        header: { icon: 'edit_note', label: 'Edit `src/lib/instructions.ts`' },
        meta: { segmentType: 'edit', toolCallId: 'demo-edit' },
      });

      return;
    }

    // Add orb block immediately (before server responds)
    const queue = getQueue(workspace);
    const accumulator = getAccumulator(workspace);
    accumulator.reset();
    queue.startTurn();
    queue.addBlock({
      type: 'orb',
      content: '',
    });

    // Add user message
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
          />
        )}

        {/* Block Renderer — always mounted, shows nothing when empty */}
        <SimpleBlockRenderer workspace={workspace} />

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={false} workspace={workspace} />
    </section>
  );
}
