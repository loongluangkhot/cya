import { useRef, useState } from 'react';
import Icon from '../../Icon';
import { useYoutubeExamples } from '../../../hooks/useYoutubeExamples';
import { parseYouTube, thumbUrl } from '../../../youtube';
import { ResolvedRow } from './ResolvedRow';
import { ResolvedPlaylistRow } from './ResolvedPlaylistRow';

interface PasteBarProps {
  onPlay: (videoId: string) => void;
  onAddToQueue: (videoId: string) => void;
  onPlayCollection: (videoIds: string[]) => void;
  onAddManyToQueue: (videoIds: string[]) => void;
  onExpandPlaylist: (playlistId: string) => Promise<string[]>;
}

type PasteResult =
  | { kind: 'video'; id: string }
  | { kind: 'playlist'; id: string; ids: string[] }
  | null;

/** Collapsible add-music section. Renders as a single `+ add music`
    button until the user opens it; then exposes the paste field, the
    "try" example chips, and the resolved-track card. Closing collapses
    everything back to the button. */
export function PasteBar({
  onPlay,
  onAddToQueue,
  onPlayCollection,
  onAddManyToQueue,
  onExpandPlaylist,
}: PasteBarProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<PasteResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const examples = useYoutubeExamples();
  // Monotonic token. Bumped on every resolve() start and on close() —
  // any in-flight onExpandPlaylist whose token no longer matches the
  // current one is stale (user kicked off a second resolve, or closed
  // the add-music UI) and must not write state. Prevents a cancelled
  // playlist from showing up in a later session.
  const resolveTokenRef = useRef(0);

  async function resolve(raw: string) {
    const token = ++resolveTokenRef.current;
    const parsed = parseYouTube(raw);
    if (!parsed) {
      setResult(null);
      setError("couldn't read that — paste a youtube video or playlist link.");
      return;
    }
    setError(null);
    if (parsed.kind === 'video') {
      setResult({ kind: 'video', id: parsed.id });
      return;
    }
    setBusy(true);
    setResult(null);
    let ids: string[] = [];
    try {
      ids = await onExpandPlaylist(parsed.id);
    } catch {
      if (token !== resolveTokenRef.current) return;
      setBusy(false);
      setError("couldn't read that playlist — it may be private or unavailable.");
      return;
    }
    if (token !== resolveTokenRef.current) return;
    setBusy(false);
    if (ids.length === 0) {
      setError("couldn't read that playlist — it may be private or unavailable.");
    } else {
      setResult({ kind: 'playlist', id: parsed.id, ids });
    }
  }

  function close() {
    // Bump the token so any in-flight resolve becomes stale and skips
    // its setState — otherwise re-opening later would surface a result
    // the user thought they'd cancelled.
    resolveTokenRef.current++;
    setOpen(false);
    setValue('');
    setResult(null);
    setError(null);
    setBusy(false);
  }
  function clearResolved() {
    setValue('');
    setResult(null);
  }

  if (!open) {
    return (
      <button type="button" className="music-add-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} />
        <span>add music</span>
      </button>
    );
  }

  return (
    <div className="music-add">
      <div className="music-add-head">
        <span className="music-section-label">add music</span>
        <button type="button" className="music-textbtn" onClick={close}>
          close
        </button>
      </div>
      <div className="music-input">
        <Icon name="link" size={15} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') resolve(value);
          }}
          placeholder="paste a youtube link…"
          inputMode="url"
          autoFocus
        />
        <button
          type="button"
          className="music-input-go"
          disabled={!value.trim() || busy}
          onClick={() => resolve(value)}
        >
          {busy ? '…' : 'search'}
        </button>
      </div>

      {examples.length > 0 && (
        <div className="music-chips">
          <span className="music-section-label sm">try</span>
          {examples.map((ex) => (
            <button
              key={ex.url}
              type="button"
              className="music-chip"
              onClick={() => {
                setValue(ex.url);
                resolve(ex.url);
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className="music-error">{error}</div>}
      {busy && <div className="music-section-label">searching…</div>}

      {!busy && result?.kind === 'video' && (
        <ResolvedRow
          title="found a video"
          art={thumbUrl(result.id)}
          videoId={result.id}
          onPlay={() => {
            onPlay(result.id);
            close();
          }}
          onQueue={() => {
            onAddToQueue(result.id);
            clearResolved();
          }}
        />
      )}
      {!busy && result?.kind === 'playlist' && (
        <ResolvedPlaylistRow
          playlistId={result.id}
          videoIds={result.ids}
          onPlayAll={() => {
            onPlayCollection(result.ids);
            close();
          }}
          onQueueAll={() => {
            onAddManyToQueue(result.ids);
            clearResolved();
          }}
        />
      )}
    </div>
  );
}
