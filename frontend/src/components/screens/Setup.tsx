import { useState, type FormEvent } from 'react';
import {
  CHARACTERS,
  CHARACTER_IDS,
  DEFAULT_CHARACTER,
  DEFAULT_COLOR,
  IDENTITY_COLORS,
  colorHex,
  darken,
} from '../../characters';
import {
  THEMES,
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemeId,
} from '../../themes';
import type { CharacterId, ColorId } from '../../types';
import PixelCharacter from '../PixelCharacter';
import Wordmark from '../Wordmark';

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
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const canSave = name.trim().length > 0;
  const preview = name.trim() || 'you';

  // Theme is a personal preference — apply + persist immediately on
  // selection so the user sees the change as a live preview. It's
  // independent of identity (cancelling setup keeps the new theme).
  function chooseTheme(next: ThemeId) {
    setTheme(next);
    applyTheme(next);
    saveTheme(next);
  }

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

      <div style={{ marginBottom: 24 }}>
        <div className="label">look</div>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-tile${t.id === theme ? ' selected' : ''}`}
              onClick={() => chooseTheme(t.id)}
              aria-pressed={t.id === theme}
              aria-label={`theme: ${t.name}`}
            >
              <div
                className="theme-swatch"
                style={{ background: t.bg, borderColor: t.fg, color: t.fg }}
              >
                Aa
              </div>
              <span className="theme-tile-label">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <button type="submit" className="btn" disabled={!canSave}>
        {submitLabel ?? (initial ? 'save' : 'continue')} →
      </button>
    </form>
  );
}
