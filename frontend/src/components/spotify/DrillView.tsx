import { useEffect, useState } from 'react';
import { beginSpotifyLogin } from '../../spotifyAuth';
import { getAlbumTracks, getPlaylistTracks, type SpTrack } from '../../spotifyApi';
import Icon from '../Icon';
import { TrackRow } from './rows';
import type { Drill, Flash } from './shared';

export function DrillView({
  drill,
  onBack,
  flash,
  onPlay,
  onAddToQueue,
  onPlayCollection,
  onQueueCollection,
}: {
  drill: NonNullable<Drill>;
  onBack: () => void;
  flash: Flash;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
  onPlayCollection: (flashKey: string, uris: string[]) => void;
  onQueueCollection: (flashKey: string, uris: string[]) => void;
}) {
  const [tracks, setTracks] = useState<SpTrack[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTracks(null);
    setErr(null);
    // Short-circuit: Spotify-curated playlists are blocked at the API level
    // for third-party dev-mode apps. Don't bother making the request.
    if (drill.kind === 'playlist' && drill.ownerId === 'spotify') {
      setTracks([]);
      setErr(
        "Spotify-curated playlists (like Discover Weekly or Daily Mix) aren't accessible from third-party apps. Try one of your own playlists instead.",
      );
      return;
    }
    const promise =
      drill.kind === 'playlist'
        ? getPlaylistTracks(drill.id)
        : getAlbumTracks(drill.id);
    promise
      .then((t) => {
        if (!cancelled) setTracks(t);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        // 403 on user-owned playlists usually means the user isn't listed
        // under "Users and Access" in the Spotify Developer Dashboard
        // (required for apps in Development Mode). 403 on Spotify-curated
        // playlists hits the same code path — both get the same hint.
        if (/\b403\b/.test(e.message)) {
          setErr(
            "Spotify returned 403 Forbidden. If this is your own playlist, your Spotify account may not be added to this app's 'Users and Access' list (required for apps in Development Mode). Open developer.spotify.com/dashboard → your app → Users and Access → add your Spotify email, then reconnect below.",
          );
        } else {
          setErr(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [drill.kind, drill.id]);

  const collectionUri = `spotify:${drill.kind}:${drill.id}`;
  const flashing = flash?.uri === collectionUri;
  const playFlash = flashing && flash?.kind === 'play';
  const queueFlash = flashing && flash?.kind === 'queue';
  const hasTracks = !!tracks && tracks.length > 0;

  return (
    <div>
      <button type="button" className="music-back" onClick={onBack}>
        ← back
      </button>
      <div className="drill-head">
        <div className="h-display" style={{ fontSize: 18, flex: 1, minWidth: 0 }}>
          {drill.name}
        </div>
        {hasTracks && (
          <div className="spotify-row-actions">
            <button
              type="button"
              className={`row-icon-btn primary${playFlash ? ' flashing' : ''}`}
              aria-label="play all"
              onClick={() => onPlayCollection(collectionUri, tracks!.map((t) => t.uri))}
            >
              <Icon name={playFlash ? 'check' : 'play'} size={14} />
            </button>
            <button
              type="button"
              className={`row-icon-btn${queueFlash ? ' flashing' : ''}`}
              aria-label="add all to queue"
              onClick={() => onQueueCollection(collectionUri, tracks!.map((t) => t.uri))}
            >
              <Icon name={queueFlash ? 'check' : 'queue-add'} size={14} />
            </button>
          </div>
        )}
      </div>
      {err && (
        <>
          <small className="music-error" style={{ display: 'block', lineHeight: 1.45 }}>{err}</small>
          {/\b403\b/.test(err) || err.includes('403 Forbidden') ? (
            <button
              type="button"
              className="btn btn-ghost compact"
              style={{ marginTop: 10 }}
              onClick={() => beginSpotifyLogin({ forceConsent: true })}
            >
              reconnect spotify
            </button>
          ) : null}
        </>
      )}
      {tracks === null && !err && <div className="list-loading">loading…</div>}
      {tracks && tracks.length === 0 && <div className="search-empty">empty.</div>}
      {tracks?.map((t) => (
        <TrackRow key={t.id + t.uri} track={t} flash={flash} onPlay={onPlay} onAddToQueue={onAddToQueue} />
      ))}
    </div>
  );
}
