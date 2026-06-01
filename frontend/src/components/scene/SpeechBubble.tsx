import { colorHex } from '../../characters';
import { isoFromPct } from '../../iso';
import type { User } from '../../types';
import { WALK_MS_ME, WALK_MS_OTHER } from './constants';

interface SpeechBubbleProps {
  peer: User;
  text: string;
  isMe: boolean;
}

export function SpeechBubble({ peer, text, isMe }: SpeechBubbleProps) {
  if (!text) return null;
  const { x, y } = isoFromPct(peer.x, peer.y);
  const c = colorHex(peer.color);
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  return (
    <div
      className="bubble"
      style={{
        top: 'var(--iso-origin-y, 32%)',
        transform: `translate3d(calc(-50% + ${x}px), calc(-100% - 56px + ${y}px), 0)`,
        transition: `transform ${dur}ms linear`,
      }}
    >
      <div className="bubble-body" style={{ borderLeft: `4px solid ${c}` }}>
        {text}
        <div className="bubble-tail" />
      </div>
    </div>
  );
}
