import { useState, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  panel: string;
}

export function ChatInput({ onSend, disabled, panel }: ChatInputProps) {
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
      handleSend();
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
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            arrow_upward
          </span>
        </button>
      </div>
    </div>
  );
}
