import { useState } from 'react';
import Icon from '../Icon';
import PixelCharacter from '../PixelCharacter';
import { colorHex } from '../../characters';
import type { User } from '../../types';

interface RoomTopBarProps {
  roomId: string;
  peers: User[];
  onOpenPeople: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
}

export function RoomTopBar({ roomId, peers, onOpenPeople, onOpenSettings, onLeave }: RoomTopBarProps) {
  const displayName = roomId.replace(/-/g, ' ');
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const stackOffset = Math.min(2, peers.length - 1);
  const headsToShow = peers.slice(0, 3);
  const [copied, setCopied] = useState(false);

  async function copyRoomLink() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    let ok = false;
    // Preferred: modern Clipboard API. Requires a secure context (HTTPS
    // or localhost). Silently throws otherwise.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      // fall through to execCommand fallback below
    }
    // Fallback: hidden textarea + execCommand('copy'). Works in insecure
    // contexts (HTTP, LAN IPs).
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // give up
      }
    }
    // Always show feedback so the click never feels like a no-op — if
    // both paths failed, the user can still long-press the title to copy
    // manually but at least sees acknowledgment.
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn('copyRoomLink: clipboard write failed in both code paths');
    }
  }

  return (
    <div className="room-top">
      <button
        type="button"
        className="room-top-title"
        onClick={copyRoomLink}
        aria-label="copy room link"
        title="copy room link"
      >
        <span className={`slug${copied ? ' copied' : ''}`}>
          {copied ? 'copied to clipboard ✓' : `${host}/r/${roomId}`}
        </span>
        <span className="name">{displayName}</span>
      </button>
      <div className="room-top-actions">
        <button type="button" className="people-pill" onClick={onOpenPeople}>
          <div className="head-stack" style={{ width: 22 + Math.max(0, stackOffset) * 12 }}>
            {headsToShow.map((p, i) => (
              <div key={p.id} className="head" style={{ left: i * 12 }}>
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={2} crop="head" />
              </div>
            ))}
          </div>
          <span style={{ marginLeft: 4 }}>{peers.length}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="settings"
          onClick={onOpenSettings}
        >
          <Icon name="gear" size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="leave" onClick={onLeave}>
          <Icon name="leave" size={16} />
        </button>
      </div>
    </div>
  );
}
