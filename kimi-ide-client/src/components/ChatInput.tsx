/**
 * ChatInput — Send button + Stop button in the same position.
 *
 * Send: visible when no turn is active. Sends user message.
 * Stop: visible when a turn is active (streaming or revealing).
 *       Immediately ends the turn — renders all remaining content
 *       instantly and finalizes to history.
 *
 * The stop button has a spinning 3/4-circle border to indicate
 * the AI is working. Clicking it kills the turn cleanly.
 */

import { useState, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  panel: string;
  /** True when the AI is streaming or the renderer is still revealing. */
  isTurnActive: boolean;
}

export function ChatInput({ onSend, onStop, disabled, panel, isTurnActive }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const config = usePanelStore((s) => s.getPanelConfig(panel));

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isTurnActive) {
        onStop();
      } else {
        handleSend();
      }
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={`Ask about ${(config?.name || panel).toLowerCase()}...`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={1}
        />
        {isTurnActive ? (
          <button
            className="stop-btn"
            onClick={onStop}
            title="Stop generating"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              stop
            </span>
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              arrow_upward
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
