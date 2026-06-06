import { useLayoutEffect, useRef } from 'react';
import { VoicePlayer } from './VoicePlayer';
import { colorHex } from '../../characters';
import type { ChatMessage, User } from '../../types';

interface IrcLogProps {
  messages: ChatMessage[];
  peersById: Record<string, User>;
  roomId: string;
  voiceAutoplay: boolean;
}

export function IrcLog({ messages, peersById, roomId, voiceAutoplay }: IrcLogProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="irc-log">
      <div className="irc-log-scroll" ref={scrollRef}>
        {messages.map((m) => {
          const peer = peersById[m.userId];
          const c = peer ? colorHex(peer.color) : colorHex(m.color);
          const age = Date.now() - m.timestamp;
          const opacity = Math.max(0.8, 1 - age / 16000);
          return (
            <div className="irc-row" key={m.id} style={{ opacity }}>
              <span className="irc-name" style={{ color: c }}>&lt;{m.name}&gt;</span>
              {m.kind === 'voice' ? (
                <span style={{ marginLeft: 6 }}>
                  <VoicePlayer
                    roomId={roomId}
                    messageId={m.id}
                    durationMs={m.audioDurationMs}
                    mime={m.audioMime}
                    expired={m.audioExpired}
                    compact
                    autoplay={voiceAutoplay}
                  />
                </span>
              ) : (
                <span style={{ marginLeft: 6 }}>{m.text}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
