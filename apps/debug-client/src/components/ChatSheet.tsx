import { useEffect, useRef, useState } from 'react';
import type { ChatMessageEntry } from '../types';

interface ChatSheetProps {
  open: boolean;
  messages: ChatMessageEntry[];
  onClose: () => void;
  onSend: (msg: string) => void;
}

export function ChatSheet({ open, messages, onClose, onSend }: ChatSheetProps) {
  const [draft, setDraft] = useState('');
  const startY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setDraft('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="mobile-sheet-layer mobile-sheet-layer--chat">
      <button
        type="button"
        className="mobile-sheet-backdrop"
        onClick={onClose}
        aria-label="Close chat"
      />
      <div
        className="chat-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat"
        onPointerDown={(e) => {
          startY.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (startY.current === null) return;
          const delta = e.clientY - startY.current;
          if (delta > 40) {
            onClose();
            startY.current = null;
          }
        }}
        onPointerUp={() => {
          startY.current = null;
        }}
        onPointerCancel={() => {
          startY.current = null;
        }}
      >
        <div className="chat-sheet__header">
          <div className="drag-handle" />
          <span>Chat</span>
          <button type="button" onClick={onClose} aria-label="Close chat">x</button>
        </div>
        <div className="chat-sheet__body">
          {messages.length === 0 && <div className="chat-empty">No messages yet</div>}
          {messages.map((m) => (
            <div key={m.id} className="chat-line">
              <span className="chat-from">{m.from}</span>
              <span className="chat-text">{m.message}</span>
            </div>
          ))}
        </div>
        <form
          className="chat-sheet__input"
          onSubmit={(e) => {
            e.preventDefault();
            const msg = draft.trim();
            if (!msg) return;
            onSend(msg);
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something"
            maxLength={240}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
