import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';
import ThemePicker from './ThemePicker';
import type { ThemeId } from '../types';

interface LandingProps {
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
}

function extractSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/\/r\/([a-z0-9-]+)/i);
  if (m) return m[1];
  if (/^[a-z0-9-]+$/i.test(trimmed)) return trimmed;
  return null;
}

export default function Landing({ theme, onThemeChange }: LandingProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  async function createRoom() {
    setBusy(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const { id } = (await res.json()) as { id: string };
      navigate(`/r/${id}`);
    } catch {
      setCreateError("couldn't create a room — is the server running?");
      setBusy(false);
    }
  }

  function joinByLink(e: FormEvent) {
    e.preventDefault();
    const slug = extractSlug(linkInput);
    if (!slug) {
      setLinkError("paste a room link or code");
      return;
    }
    navigate(`/r/${slug}`);
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="title">cya</h1>
        <p className="subtitle">a tamagotchi-style virtual hangout</p>

        <div className="field">
          <button
            type="button"
            className="btn-primary"
            onClick={createRoom}
            disabled={busy}
          >
            {busy ? 'creating…' : 'create a room'}
          </button>
          {createError && <small className="field-error">{createError}</small>}
        </div>

        <form onSubmit={joinByLink} className="field">
          <span>or join with a link</span>
          <input
            value={linkInput}
            onChange={(e) => {
              setLinkInput(e.target.value);
              setLinkError(null);
            }}
            placeholder="paste room link or code"
          />
          <button type="submit" className="btn-secondary" disabled={!linkInput.trim()}>
            join
          </button>
          {linkError && <small className="field-error">{linkError}</small>}
        </form>

        <div className="field">
          <span>theme</span>
          <ThemePicker theme={theme} onChange={onThemeChange} />
        </div>
      </div>
    </div>
  );
}
