import { useState } from 'react';

interface InviteProps {
  roomId: string;
  onEnter: () => void;
  onBack: () => void;
}

export function InviteScreen({ roomId, onEnter, onBack }: InviteProps) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.host}/r/${roomId}` : `/r/${roomId}`;
  const displayName = roomId.replace(/-/g, ' ');

  async function copy() {
    try {
      const full = typeof window !== 'undefined' ? `${window.location.origin}/r/${roomId}` : url;
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  }

  return (
    <div className="screen">
      <div className="status-bar-space" />
      <button type="button" className="text-link" onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
        ← back
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <div className="h-mono">your new space</div>
        <div className="space-name">{displayName}</div>

        <div style={{ marginTop: 26 }}>
          <div className="label">invite link</div>
          <button type="button" className="invite-link" onClick={copy}>
            <span className="url">{url}</span>
            <span className={`copy-tag${copied ? ' copied' : ''}`}>
              {copied ? 'copied ✓' : 'copy'}
            </span>
          </button>
          <div className="body-text" style={{ marginTop: 10 }}>
            anyone with this link drops in. no signup. it stops working when the room empties.
          </div>
        </div>
      </div>

      <button type="button" className="btn" onClick={onEnter}>enter the space →</button>
    </div>
  );
}
