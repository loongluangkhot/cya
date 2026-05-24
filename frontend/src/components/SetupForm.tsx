import { useState, type FormEvent } from 'react';
import { COLLECTIONS, DEFAULT_CHARACTER } from '../characters';
import Sprite from './Sprite';
import type { CharacterId } from '../types';

interface SetupFormProps {
  onSubmit: (name: string, character: CharacterId) => void;
  submitLabel?: string;
  initialName?: string;
  initialCharacter?: CharacterId;
}

export default function SetupForm({
  onSubmit,
  submitLabel = 'enter room',
  initialName = '',
  initialCharacter = DEFAULT_CHARACTER,
}: SetupFormProps) {
  const [name, setName] = useState(initialName);
  const [character, setCharacter] = useState<CharacterId>(initialCharacter);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, character);
  }

  return (
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
      <button type="submit" className="btn-primary" disabled={!name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
