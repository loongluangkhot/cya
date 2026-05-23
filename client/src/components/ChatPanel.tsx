import { useEffect, useRef, useState, type FormEvent } from 'react';
import { characterColor } from '../characters';
import type { ChatMessage } from '../types';

interface ChatRowProps {
  m: ChatMessage;
  mine: boolean;
}

function ChatRow({ m, mine }: ChatRowProps) {
  return (
    <div className={`chat-row ${mine ? 'mine' : ''}`}>
      <span className="chat-name" style={{ color: characterColor(m.character) }}>
        {m.name}
      </span>
      <span className="chat-text">{m.text}</span>
    </div>
  );
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  meId: string | null;
}

export default function ChatPanel({ messages, onSend, meId }: ChatPanelProps) {
  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (collapsed) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, collapsed]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }

  const last = messages[messages.length - 1];

  return (
    <aside className={`chat-panel ${collapsed ? 'collapsed' : ''}`}>
      <header className="chat-header">
        <span className="chat-header-title">chat</span>
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'expand chat' : 'collapse chat'}
          aria-expanded={!collapsed}
        >
          {collapsed ? '▴' : '▾'}
        </button>
      </header>

      {collapsed ? (
        <div className="chat-last">
          {last ? (
            <ChatRow m={last} mine={last.userId === meId} />
          ) : (
            <p className="empty-hint">no messages yet</p>
          )}
        </div>
      ) : (
        <div className="chat-list" ref={listRef}>
          {messages.length === 0 && (
            <p className="empty-hint">no messages yet — say hi</p>
          )}
          {messages.map((m) => (
            <ChatRow key={m.id} m={m} mine={m.userId === meId} />
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder="say something..."
          aria-label="message"
        />
        <button type="submit" disabled={!text.trim()}>send</button>
      </form>
    </aside>
  );
}
