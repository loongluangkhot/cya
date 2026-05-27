import { useState } from 'react';
import { colorHex } from '../../characters';
import PixelCharacter from '../PixelCharacter';
import Wordmark from '../Wordmark';
import type { Identity } from './Setup';

interface HomeProps {
  me: Identity;
  onCreate: () => Promise<void> | void;
  onJoinLink: (slug: string) => void;
  onEditMe: () => void;
  creating?: boolean;
  createError?: string | null;
}

function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/r\/([a-z0-9-]+)/i);
  if (m) return m[1].toLowerCase();
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export function HomeScreen({ me, onCreate, onJoinLink, onEditMe, creating, createError }: HomeProps) {
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const host = typeof window !== 'undefined' ? window.location.host : '';

  function go() {
    const slug = extractSlug(link);
    if (!slug) {
      setLinkError('paste a room link or code');
      return;
    }
    setLinkError(null);
    onJoinLink(slug);
  }

  return (
    <div className="screen">
      <div className="status-bar-space" />
      <button type="button" className="you-chip" onClick={onEditMe}>
        <PixelCharacter character={me.character} color={colorHex(me.color)} scale={3} />
        <span className="name">{me.name}</span>
        <span className="edit">edit</span>
      </button>

      <div style={{ marginTop: 28 }}>
        <Wordmark size={64} sub="hi again" />
      </div>

      <div style={{ marginTop: 36, marginBottom: 14 }}>
        <div className="h-display" style={{ fontSize: 22 }}>start something</div>
      </div>

      <button type="button" className="btn" onClick={() => onCreate()} disabled={!!creating}>
        {creating ? 'creating…' : '+ create a space'}
      </button>
      {createError && <div className="error-text">{createError}</div>}

      <div className="divider">
        <hr />
        <span>or</span>
        <hr />
      </div>

      <div className="label">got a link?</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="field"
          type="text"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go();
            }
          }}
          placeholder={host ? `paste ${host}/r/…` : 'paste a link'}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn compact"
          onClick={go}
          disabled={!link.trim()}
          style={{ padding: '14px 18px' }}
        >
          go →
        </button>
      </div>
      {linkError && <div className="error-text">{linkError}</div>}

      <div style={{ flex: 1 }} />
      <div className="h-mono" style={{ textAlign: 'center', paddingBottom: 18 }}>
        rooms vanish when everyone leaves
      </div>
    </div>
  );
}
