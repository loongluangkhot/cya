import { useState, type FormEvent } from 'react';
import { COLLECTIONS, DEFAULT_CHARACTER } from '../characters';
import Sprite from './Sprite';
import ThemePicker from './ThemePicker';
import type { CharacterId, ThemeId } from '../types';

interface LandingProps {
  onJoin: (name: string, character: CharacterId) => void;
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
}

export default function Landing({ onJoin, theme, onThemeChange }: LandingProps) {
  const [name, setName] = useState('');
  const [character, setCharacter] = useState<CharacterId>(DEFAULT_CHARACTER);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onJoin(trimmed, character);
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="title">cya</h1>
        <p className="subtitle">a tamagotchi-style virtual hangout</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>your name</span>
            <input
              autoFocus
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="who are you?"
            />
          </label>
          <div className="field">
            <span>pick a buddy</span>
            {COLLECTIONS.map((coll) => (
              <div key={coll.id} className="collection-section">
                <h3 className="collection-name">{coll.name}</h3>
                <div className="char-grid">
                  {coll.characters.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`char-option ${character === c.id ? 'selected' : ''}`}
                      onClick={() => setCharacter(c.id)}
                      aria-pressed={character === c.id}
                    >
                      <div className="char-sprite-slot">
                        <Sprite character={c.id} />
                      </div>
                      <span className="char-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="field">
            <span>theme</span>
            <ThemePicker theme={theme} onChange={onThemeChange} />
          </div>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            enter room
          </button>
        </form>
      </div>
    </div>
  );
}
