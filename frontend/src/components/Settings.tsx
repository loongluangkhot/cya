import { useEffect, useState, type FormEvent } from 'react';
import { COLLECTIONS } from '../characters';
import Sprite from './Sprite';
import ThemePicker from './ThemePicker';
import BackgroundPicker from './BackgroundPicker';
import { extractSpotifyTrackUri } from '../spotify';
import type { BackgroundId, CharacterId, PlaybackState, ThemeId } from '../types';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (name: string) => void;
  character: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  background: BackgroundId;
  onBackgroundChange: (id: BackgroundId) => void;
  playback: PlaybackState;
  onPlaybackChange: (next: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
}

export default function Settings({
  open,
  onClose,
  name,
  onNameChange,
  character,
  onCharacterChange,
  theme,
  onThemeChange,
  background,
  onBackgroundChange,
  playback,
  onPlaybackChange,
}: SettingsProps) {
  const [nameInput, setNameInput] = useState<string>(name ?? '');
  const [musicInput, setMusicInput] = useState('');
  const [musicError, setMusicError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setNameInput(name ?? '');
  }, [open, name]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = nameInput.trim();
  const nameDirty = !!trimmed && trimmed !== name;

  function saveName(e?: FormEvent) {
    e?.preventDefault();
    if (!nameDirty) return;
    onNameChange(trimmed);
  }

  function submitTrack(e: FormEvent) {
    e.preventDefault();
    const uri = extractSpotifyTrackUri(musicInput);
    if (!uri) {
      setMusicError('paste a Spotify track link');
      return;
    }
    setMusicError(null);
    setMusicInput('');
    onPlaybackChange({ trackUri: uri, isPlaying: true, positionMs: 0 });
  }

  function clearTrack() {
    onPlaybackChange({ trackUri: null, isPlaying: false, positionMs: 0 });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-header">
          <span>settings</span>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="close settings"
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          <form className="field" onSubmit={saveName}>
            <span>your name</span>
            <div className="name-row">
              <input
                value={nameInput}
                maxLength={20}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="who are you?"
              />
              <button type="submit" className="name-save" disabled={!nameDirty}>
                save
              </button>
            </div>
          </form>
          <div className="field">
            <span>your buddy</span>
            {COLLECTIONS.map((coll) => (
              <div key={coll.id} className="collection-section">
                <h3 className="collection-name">{coll.name}</h3>
                <div className="char-grid">
                  {coll.characters.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className={`char-option ${character === c.id ? 'selected' : ''}`}
                      onClick={() => onCharacterChange(c.id)}
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
          <form className="field" onSubmit={submitTrack}>
            <span>music</span>
            <div className="field-row">
              <input
                value={musicInput}
                onChange={(e) => {
                  setMusicInput(e.target.value);
                  setMusicError(null);
                }}
                placeholder="paste a Spotify track link"
              />
              <button type="submit" className="btn-secondary" disabled={!musicInput.trim()}>
                play
              </button>
            </div>
            {musicError && <small className="field-error">{musicError}</small>}
            {playback.trackUri && (
              <button type="button" className="btn-secondary music-clear" onClick={clearTrack}>
                clear track
              </button>
            )}
          </form>
          <div className="field">
            <span>background</span>
            <BackgroundPicker background={background} onChange={onBackgroundChange} />
          </div>
          <div className="field">
            <span>theme</span>
            <ThemePicker theme={theme} onChange={onThemeChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
