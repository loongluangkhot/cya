import { useState, type FormEvent, type ReactNode } from 'react';
import {
  CHARACTERS,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  DEFAULT_COLOR,
  IDENTITY_COLORS,
  colorHex,
  darken,
} from '../characters';
import type { CharacterId, ColorId, User } from '../types';
import PixelCharacter from './PixelCharacter';
import Wordmark from './Wordmark';

// ───────── Splash ─────────

interface SplashProps {
  onStart: () => void;
}

export function SplashScreen({ onStart }: SplashProps) {
  return (
    <div className="screen">
      <div className="status-bar-space" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <Wordmark size={88} sub="a shared room for a while" />
        <p className="lede">
          Make a place. Share a link. Sit around the same music, the same light, the same nothing. Leave when you leave.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
        <button type="button" className="btn" onClick={onStart}>get started</button>
        <div className="h-mono" style={{ textAlign: 'center' }}>no account · no email · just a link</div>
      </div>
    </div>
  );
}

// ───────── Setup ─────────

export interface Identity {
  name: string;
  color: ColorId;
  character: CharacterId;
}

interface SetupProps {
  initial: Identity | null;
  onDone: (next: Identity) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function SetupScreen({ initial, onDone, onCancel, submitLabel }: SetupProps) {
  const [name, setName] = useState(initial?.name || '');
  const [color, setColor] = useState<ColorId>(initial?.color || DEFAULT_COLOR);
  const [character, setCharacter] = useState<CharacterId>(initial?.character || DEFAULT_CHARACTER);
  const canSave = name.trim().length > 0;
  const preview = name.trim() || 'you';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onDone({ name: name.trim(), color, character });
  }

  return (
    <form className="screen" onSubmit={submit}>
      <div className="status-bar-space" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <Wordmark size={28} />
        {onCancel && (
          <button type="button" className="text-link" onClick={onCancel}>cancel</button>
        )}
      </div>

      <div className="h-display">{initial ? 'edit your marker' : 'pick a marker'}</div>
      <div className="body-text" style={{ marginTop: 4 }}>
        so the others know it's you. you can change this anytime.
      </div>

      <div className="preview-card">
        <div className="character-slot">
          <PixelCharacter character={character} color={colorHex(color)} scale={4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{ fontSize: 20 }}>{preview}</div>
          <div className="h-mono" style={{ fontWeight: 700 }}>
            {CHARACTERS[character].label} · this is you
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="label">name</div>
        <input
          className="field"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="what should we call you?"
          autoFocus={!initial}
          maxLength={20}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="label">color</div>
        <div className="color-grid">
          {IDENTITY_COLORS.map((c) => {
            const selected = c.id === color;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.id}
                onClick={() => setColor(c.id)}
                className="color-swatch"
                style={{
                  background: c.hex,
                  border: selected
                    ? 'calc(var(--border-w) + 1px) solid var(--fg)'
                    : `var(--border-w) solid ${darken(c.hex, 0.35)}`,
                  boxShadow: selected
                    ? '0 0 0 2px var(--bg), 0 0 0 calc(2px + var(--border-w)) var(--fg)'
                    : 'none',
                  transform: selected ? 'scale(1.08)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="label">who are you</div>
        <div className="character-grid">
          {CHARACTER_IDS.map((key) => {
            const selected = key === character;
            return (
              <button
                key={key}
                type="button"
                className={`character-tile${selected ? ' selected' : ''}`}
                onClick={() => setCharacter(key)}
                aria-pressed={selected}
              >
                <PixelCharacter character={key} color={colorHex(color)} scale={2} />
                <span className="character-label">{CHARACTERS[key].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <button type="submit" className="btn" disabled={!canSave}>
        {submitLabel ?? (initial ? 'save' : 'continue')} →
      </button>
    </form>
  );
}

// ───────── Home ─────────

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

// ───────── Invite (post-create) ─────────

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

// ───────── Joining (returning visitor / link arrival) ─────────

export type OccupantPeek = Pick<User, 'id' | 'name' | 'character' | 'color'>;

interface JoiningProps {
  roomId: string;
  me: Identity;
  occupants: OccupantPeek[] | null;
  onEnter: () => void;
  onEditMe: () => void;
}

export function JoiningScreen({ roomId, me, occupants, onEnter, onEditMe }: JoiningProps) {
  const displayName = roomId.replace(/-/g, ' ');
  const url = typeof window !== 'undefined' ? `${window.location.host}/r/${roomId}` : `/r/${roomId}`;
  return (
    <div className="screen">
      <div className="status-bar-space" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        <div className="h-mono">you were invited to</div>
        <div className="space-name lg">{displayName}</div>
        <div className="h-mono">{url}</div>

        <div className="who-card" style={{ marginTop: 22 }}>
          <div className="h-mono" style={{ marginBottom: 10 }}>
            {occupants ? `${occupants.length} inside` : 'checking room…'}
          </div>
          <div className="who-list">
            {occupants?.length === 0 && (
              <div className="body-text">no one's in here yet — be the first.</div>
            )}
            {occupants?.map((p) => (
              <div className="who-row" key={p.id}>
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={3} />
                <span className="name">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="you-chip"
          onClick={onEditMe}
          style={{ marginTop: 6, border: 'var(--border-w) dashed var(--scene-line)', background: 'transparent' }}
        >
          <PixelCharacter character={me.character} color={colorHex(me.color)} scale={3} />
          <span className="name">entering as {me.name}</span>
          <span className="edit">change</span>
        </button>
      </div>

      <button type="button" className="btn" onClick={onEnter}>drop in →</button>
    </div>
  );
}

// ───────── Centered status fallback (errors, loading) ─────────

interface CenterMessageProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function CenterMessage({ title, subtitle, children }: CenterMessageProps) {
  return (
    <div className="center-screen">
      <Wordmark size={48} sub={subtitle} />
      <div className="h-display" style={{ fontSize: 18 }}>{title}</div>
      {children}
    </div>
  );
}
