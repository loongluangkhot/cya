import { useEffect, useRef } from 'react';
import { Sheet } from './Sheet';
import { VoicePlayer } from '../room/VoicePlayer';
import { colorHex } from '../../characters';
import type { ChatMessage, User } from '../../types';

interface ChatLogSheetProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  peersById: Record<string, User>;
  roomId: string;
}

export function ChatLogSheet({ open, onClose, messages, peersById, roomId }: ChatLogSheetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [open, messages.length]);

  return (
    <Sheet open={open} onClose={onClose} title="log" tall>
      <div ref={ref}>
        {messages.map((m) => {
          const peer = peersById[m.userId];
          const c = peer ? colorHex(peer.color) : colorHex(m.color);
          return (
            <div key={m.id} className="chat-row">
              <span className="time">{new Date(m.timestamp).toTimeString().slice(0, 5)}</span>
              <span className="who" style={{ color: c }}>&lt;{m.name}&gt;</span>
              {m.kind === 'voice' ? (
                <span className="text">
                  <VoicePlayer
                    roomId={roomId}
                    messageId={m.id}
                    durationMs={m.audioDurationMs}
                    mime={m.audioMime}
                    expired={m.audioExpired}
                  />
                </span>
              ) : (
                <span className="text">{m.text}</span>
              )}
            </div>
          );
        })}
        {messages.length === 0 && <div className="chat-empty">nothing said yet</div>}
      </div>
    </Sheet>
  );
}
