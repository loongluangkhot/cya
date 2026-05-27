import { useState } from 'react';
import { beginSpotifyLogin } from '../spotifyAuth';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import type { PlaybackState } from '../types';
import { NowTab } from './spotify/NowTab';
import { SearchTab } from './spotify/SearchTab';
import { LibraryTab } from './spotify/LibraryTab';
import { INITIAL_SEARCH, type Drill, type SearchState, type Tab } from './spotify/shared';

interface SpotifyPlayerProps {
  playback: PlaybackState;
  queue: string[];
  onLocalChange: (next: { trackUri: string | null; isPlaying: boolean; positionMs: number }) => void;
  onAddToQueue: (uri: string) => void;
  onRemoveFromQueue: (uri: string, index: number) => void;
  onAdvanceQueue: (afterTrackUri: string | null) => void;
  onClearQueue: () => void;
}

export default function SpotifyPlayer({
  playback,
  queue,
  onLocalChange,
  onAddToQueue,
  onRemoveFromQueue,
  onAdvanceQueue,
  onClearQueue,
}: SpotifyPlayerProps) {
  const {
    connected,
    status,
    error,
    paused,
    trackCache,
    flash,
    playUri,
    queueUri,
    togglePlay,
    next,
    disconnectSpotify,
  } = useSpotifyPlayer({ playback, queue, onLocalChange, onAddToQueue, onAdvanceQueue });

  const [tab, setTab] = useState<Tab>('now');
  const [drill, setDrill] = useState<Drill>(null);
  // Search state lives here (not inside SearchTab) so it survives tab switches.
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);

  if (!connected) {
    return (
      <div>
        <div className="body-text" style={{ marginBottom: 14 }}>
          connect Spotify to play audio in this room. Spotify Premium is required to stream — without it, you'll still see what others are playing.
        </div>
        <button type="button" className="btn" onClick={() => beginSpotifyLogin()}>
          connect spotify
        </button>
        {error && (
          <small className="music-error" style={{ marginTop: 10 }}>
            {error}
          </small>
        )}
      </div>
    );
  }

  return (
    <div>
      {status === 'loading' && <small className="spotify-status">loading Spotify player…</small>}
      {status === 'premium-required' && (
        <small className="music-error">
          Spotify Premium is required to play audio. You can still pick tracks for others to hear.
        </small>
      )}
      {error && status === 'ready' && <small className="music-error">{error}</small>}

      <div className="music-tabs" role="tablist">
        <button
          type="button"
          className={`music-tab${tab === 'now' ? ' selected' : ''}`}
          onClick={() => {
            setTab('now');
            setDrill(null);
          }}
        >
          now
        </button>
        <button
          type="button"
          className={`music-tab${tab === 'search' ? ' selected' : ''}`}
          onClick={() => {
            setTab('search');
            setDrill(null);
          }}
        >
          search
        </button>
        <button
          type="button"
          className={`music-tab${tab === 'library' ? ' selected' : ''}`}
          onClick={() => {
            setTab('library');
            setDrill(null);
          }}
        >
          library
        </button>
      </div>

      {tab === 'now' && (
        <NowTab
          playback={playback}
          paused={paused}
          queue={queue}
          trackCache={trackCache}
          flash={flash}
          onPlay={playUri}
          onTogglePlay={togglePlay}
          onNext={next}
          onRemoveFromQueue={onRemoveFromQueue}
          canControl={status === 'ready'}
        />
      )}

      {tab === 'search' && (
        <SearchTab
          state={search}
          setState={setSearch}
          drill={drill}
          setDrill={setDrill}
          flash={flash}
          onPlay={playUri}
          onAddToQueue={queueUri}
        />
      )}

      {tab === 'library' && (
        <LibraryTab
          drill={drill}
          setDrill={setDrill}
          flash={flash}
          onPlay={playUri}
          onAddToQueue={queueUri}
        />
      )}

      <div className="music-footer">
        {queue.length > 0 && (
          <button type="button" className="music-footer-link" onClick={onClearQueue}>
            clear queue
          </button>
        )}
        <button type="button" className="music-footer-link" onClick={disconnectSpotify}>
          disconnect spotify
        </button>
      </div>
    </div>
  );
}
