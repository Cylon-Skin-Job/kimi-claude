import { useRef, useEffect, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { MessageList } from './MessageList';
import { ChatInput, type ChatInputRef } from './ChatInput';
import { ClipboardTrigger } from '../clipboard';
import { ScreenshotsTrigger } from '../screenshots';
import { RecentFilesTrigger } from '../recent-files';
import { EmojiTrigger } from '../emojis';
import { MicTrigger } from '../mic';

interface ChatAreaProps {
  panel: string;
}

export function ChatArea({ panel }: ChatAreaProps) {
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const justSentRef = useRef(false);
  const [isSending, setIsSending] = useState(false);

  const handleInsertText = (text: string) => {
    chatInputRef.current?.insertText(text);
  };

  // Store data
  const messages = usePanelStore((state) => state.panels[panel]?.messages || []);
  const currentTurn = usePanelStore((state) => state.panels[panel]?.currentTurn || null);
  const segments = usePanelStore((state) => state.panels[panel]?.segments || []);
  const contextUsage = usePanelStore((state) => state.contextUsage);

  const addMessage = usePanelStore((state) => state.addMessage);
  const sendMessage = usePanelStore((state) => state.sendMessage);

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

  const finalizeTurn = usePanelStore((state) => state.finalizeTurn);

  // Turn is active if there's a currentTurn (streaming or revealing).
  // This drives the send/stop button toggle.
  const isTurnActive = !!currentTurn || isSending;

  const handleSend = (text: string) => {
    setIsSending(true);

    // If there's an active turn, finalize it BEFORE adding the user
    // message. finalizeTurn snapshots to messages[], clears currentTurn.
    //
    // KNOWN PAST BUG (DO NOT REINTRODUCE):
    // User bubble appeared above the live assistant response mid-stream.
    const ps = usePanelStore.getState().panels[panel];
    if (ps?.currentTurn) {
      finalizeTurn(panel);
    }

    justSentRef.current = true;
    addMessage(panel, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now()
    });

    sendMessage(text, panel);
  };

  // Stop: immediately finalize the turn — snap all remaining content
  // to display, move to history. The AI may keep running server-side
  // but the client moves on.
  const handleStop = () => {
    const ps = usePanelStore.getState().panels[panel];
    if (ps?.currentTurn) {
      finalizeTurn(panel);
    }
    setIsSending(false);
  };

  return (
    <section className="chat-area">
      <div className="chat-messages" ref={chatContainerRef}>
        {messages.length === 0 && !currentTurn && !showOrb ? (
          <div className="message message-system">
            {panel} panel active - Start a conversation
          </div>
        ) : (
          <MessageList
            panel={panel}
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

      <div className="chat-footer">
        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          onStop={handleStop}
          disabled={false}
          panel={panel}
          isTurnActive={isTurnActive}
        />
        <div className="chat-composer-meta-row">
          <div style={{ display: 'flex', gap: '4px' }}>
            <ClipboardTrigger onInsert={handleInsertText} />
            <ScreenshotsTrigger onInsert={handleInsertText} />
            <RecentFilesTrigger onInsert={handleInsertText} />
            <EmojiTrigger onInsert={handleInsertText} />
            <MicTrigger onInsert={handleInsertText} />
          </div>
          <div className="context-usage context-usage-below-input">
            <div className="context-usage-bar">
              <div
                className="context-usage-fill"
                style={{ width: `${Math.min(contextUsage, 100)}%` }}
              />
            </div>
            <span>{Math.round(contextUsage)}%</span>
          </div>
          {isTurnActive ? (
            <button
              className="chat-footer-btn stop-btn"
              onClick={handleStop}
              title="Stop generating"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                stop
              </span>
            </button>
          ) : (
            <button
              className="chat-footer-btn send-btn"
              onClick={() => {
                const text = chatInputRef.current?.getText();
                if (text?.trim()) {
                  handleSend(text.trim());
                  chatInputRef.current?.clearText();
                }
              }}
              title="Send message"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                arrow_upward
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
