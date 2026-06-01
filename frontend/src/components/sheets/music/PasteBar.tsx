import { useState } from 'react';
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

export function PasteBar({
  onPlay,
  onAddToQueue,
  onPlayCollection,
  onAddManyToQueue,
  onExpandPlaylist,
}: PasteBarProps) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<PasteResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const examples = useYoutubeExamples();

  async function resolve(raw: string) {
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
    try {
      const ids = await onExpandPlaylist(parsed.id);
      if (ids.length === 0) {
        setError("couldn't read that playlist — it may be private or unavailable.");
      } else {
        setResult({ kind: 'playlist', id: parsed.id, ids });
      }
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setValue('');
    setResult(null);
  }

  return (
    <div>
      <div className="music-input">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') resolve(value);
          }}
          placeholder="paste a youtube link…"
          inputMode="url"
        />
        <button type="button" disabled={!value.trim() || busy} onClick={() => resolve(value)}>
          {busy ? '…' : 'search'}
        </button>
      </div>

      {examples.length > 0 && (
        <div className="yt-examples">
          <span className="h-mono">try</span>
          {examples.map((ex) => (
            <button
              key={ex.url}
              type="button"
              className="yt-chip"
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
            clear();
          }}
          onQueue={() => onAddToQueue(result.id)}
        />
      )}
      {!busy && result?.kind === 'playlist' && (
        <ResolvedPlaylistRow
          playlistId={result.id}
          videoIds={result.ids}
          onPlayAll={() => {
            onPlayCollection(result.ids);
            clear();
          }}
          onQueueAll={() => onAddManyToQueue(result.ids)}
        />
      )}
    </div>
  );
}
