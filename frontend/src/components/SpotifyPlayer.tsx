import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadSpotifySDK,
  type SpotifyPlayer as SDKPlayer,
  type SpotifyPlayerState,
  type SpotifyTrack as SDKTrack,
} from '../spotify';
import {
  beginSpotifyLogin,
  clearSpotifyToken,
  getValidSpotifyToken,
  hasSpotifyToken,
} from '../spotifyAuth';
import {
  getAlbumTracks,
  getMyAlbums,
  getMyPlaylists,
  getPlaylistTracks,
  getTrack,
  pickImage,
  searchSpotify,
  trackIdFromUri,
  type SpAlbum,
  type SpPlaylist,
  type SpTrack,
} from '../spotifyApi';
import Icon from './Icon';
import type { PlaybackState } from '../types';

interface SpotifyPlayerProps {
  playback: PlaybackState;
  queue: string[];
  onLocalChange: (next: { trackUri: string | null; isPlaying: boolean; positionMs: number }) => void;
  onAddToQueue: (uri: string) => void;
  onRemoveFromQueue: (uri: string, index: number) => void;
  onAdvanceQueue: (afterTrackUri: string | null) => void;
  onClearQueue: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'premium-required' | 'error';
type Tab = 'now' | 'search' | 'library';
type Drill = {
  kind: 'playlist' | 'album';
  id: string;
  name: string;
  ownerId?: string;
} | null;

interface SearchState {
  query: string;
  // The query string that produced the currently-cached `results`.
  // If query === lastSearchedQuery and results !== null, no fresh search
  // is fired on (re-)mount — the cached results render immediately.
  lastSearchedQuery: string;
  results: { tracks: SpTrack[]; albums: SpAlbum[]; playlists: SpPlaylist[] } | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_SEARCH: SearchState = {
  query: '',
  lastSearchedQuery: '',
  results: null,
  loading: false,
  error: null,
};

// Brief visual confirmation when a row's primary action fires.
type FlashKind = 'play' | 'queue';

function effectivePosition(p: PlaybackState): number {
  const base = p.positionMs || 0;
  if (!p.isPlaying) return Math.max(0, Math.round(base));
  const elapsed = Math.max(0, Date.now() - (p.positionUpdatedAt || 0));
  return Math.max(0, Math.round(base + elapsed));
}

function joinArtists(artists: { name?: string }[] | undefined): string {
  if (!artists || !Array.isArray(artists)) return '';
  return artists
    .map((a) => (a && typeof a.name === 'string' ? a.name : ''))
    .filter(Boolean)
    .join(', ');
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
  const [connected, setConnected] = useState(hasSpotifyToken());
  const [status, setStatus] = useState<Status>('idle');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSDKTrack, setCurrentSDKTrack] = useState<SDKTrack | null>(null);
  const [paused, setPaused] = useState(true);

  const [tab, setTab] = useState<Tab>('now');
  const [drill, setDrill] = useState<Drill>(null);
  // Search state lives here (not inside SearchTab) so it survives tab switches.
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);

  const [trackCache, setTrackCache] = useState<Record<string, SpTrack>>({});

  // Brief flash on row action ("play" / "queue"). Keyed by uri+kind so two
  // adjacent rows don't visually collide.
  const [flash, setFlash] = useState<{ uri: string; kind: FlashKind } | null>(null);
  function fireFlash(uri: string, kind: FlashKind) {
    setFlash({ uri, kind });
  }
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(t);
  }, [flash]);

  const playerRef = useRef<SDKPlayer | null>(null);
  const suppressUntilRef = useRef(0);
  const lastEndedUriRef = useRef<string | null>(null);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const onLocalChangeRef = useRef(onLocalChange);
  onLocalChangeRef.current = onLocalChange;
  const onAdvanceQueueRef = useRef(onAdvanceQueue);
  onAdvanceQueueRef.current = onAdvanceQueue;

  // ────────────── SDK init ──────────────
  useEffect(() => {
    if (!connected) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setError(null);

    loadSpotifySDK()
      .then(() => {
        if (cancelled || !window.Spotify) return;
        const player = new window.Spotify.Player({
          name: 'cya',
          getOAuthToken: (cb) => {
            getValidSpotifyToken().then((t) => cb(t || ''));
          },
          volume: 0.5,
        });

        player.addListener('ready', async ({ device_id }) => {
          if (cancelled) return;
          setDeviceId(device_id);
          setStatus('ready');
          // Transfer playback to this device so subsequent play commands
          // targeting it are accepted by Spotify Connect. Without this,
          // PUT /me/player/play returns 404 "Device not found".
          try {
            const tok = await getValidSpotifyToken();
            if (!tok || cancelled) return;
            await fetch('https://api.spotify.com/v1/me/player', {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${tok}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ device_ids: [device_id], play: false }),
            });
          } catch {
            // ignore — applyRemote will retry on the next state change
          }
        });
        player.addListener('not_ready', () => {
          if (cancelled) return;
          setDeviceId(null);
        });
        player.addListener('initialization_error', ({ message }) => {
          if (cancelled) return;
          setError(message);
          setStatus('error');
        });
        player.addListener('authentication_error', () => {
          if (cancelled) return;
          clearSpotifyToken();
          setConnected(false);
          setStatus('idle');
          setError('Spotify session expired — please reconnect.');
        });
        player.addListener('account_error', () => {
          if (cancelled) return;
          setStatus('premium-required');
        });
        player.addListener('playback_error', ({ message }) => {
          if (cancelled) return;
          const m = (message || '').toLowerCase();
          // "no list was loaded": benign — fires when SDK has no queue yet.
          // "device not found" / "device not active": we recover via the
          // Web-API transfer+retry path, so don't surface it.
          if (m.includes('no list was loaded')) return;
          if (m.includes('device not found')) return;
          if (m.includes('device not active')) return;
          setError(message);
        });
        player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
          if (cancelled || !state) return;
          setCurrentSDKTrack(state.track_window.current_track);
          setPaused(state.paused);

          // ── Auto-advance on track end ──
          // The SDK signals end-of-track by jumping position back to 0 with
          // paused=true on the same track. Only emit once per track.
          if (
            state.paused &&
            state.position === 0 &&
            state.track_window.current_track.uri === playbackRef.current.trackUri &&
            lastEndedUriRef.current !== state.track_window.current_track.uri
          ) {
            lastEndedUriRef.current = state.track_window.current_track.uri;
            onAdvanceQueueRef.current(state.track_window.current_track.uri);
            return;
          }
          if (!state.paused) lastEndedUriRef.current = null;

          // Echo local play/pause back to the room.
          if (Date.now() < suppressUntilRef.current) return;
          const current = playbackRef.current;
          if (!current.trackUri) return;
          if (state.track_window.current_track.uri !== current.trackUri) return;
          if (state.paused === !current.isPlaying) return;
          onLocalChangeRef.current({
            trackUri: current.trackUri,
            isPlaying: !state.paused,
            positionMs: state.position,
          });
        });

        playerRef.current = player;
        player.connect();
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      setDeviceId(null);
    };
  }, [connected]);

  // ────────────── Apply remote → SDK ──────────────
  useEffect(() => {
    if (status !== 'ready' || !deviceId) return;
    applyRemote(playback, deviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.trackUri, playback.isPlaying, playback.positionUpdatedAt, deviceId, status]);

  async function applyRemote(p: PlaybackState, dev: string) {
    const token = await getValidSpotifyToken();
    if (!token) return;
    const state = await playerRef.current?.getCurrentState();

    if (!p.trackUri) {
      if (state) {
        suppressUntilRef.current = Date.now() + 1500;
        await controlPlayback(dev, token, { kind: 'pause' });
      }
      return;
    }

    const currentUri = state?.track_window.current_track.uri;
    const targetMs = effectivePosition(p);

    if (currentUri === p.trackUri) {
      const drift = state ? Math.abs(state.position - targetMs) : 0;
      if (drift > 1500) {
        suppressUntilRef.current = Date.now() + 800;
        await controlPlayback(dev, token, { kind: 'seek', positionMs: targetMs });
      }
      if (p.isPlaying && state?.paused) {
        suppressUntilRef.current = Date.now() + 800;
        await controlPlayback(dev, token, { kind: 'resume' });
      } else if (!p.isPlaying && !state?.paused) {
        suppressUntilRef.current = Date.now() + 800;
        await controlPlayback(dev, token, { kind: 'pause' });
      }
      return;
    }

    suppressUntilRef.current = Date.now() + 2500;
    lastEndedUriRef.current = null;
    const ok = await controlPlayback(dev, token, {
      kind: 'play',
      uri: p.trackUri,
      positionMs: targetMs,
    });
    if (!ok) return;
    if (!p.isPlaying) {
      // Track loads playing by default; pause shortly after.
      window.setTimeout(() => {
        getValidSpotifyToken().then((t) => {
          if (t) controlPlayback(dev, t, { kind: 'pause' });
        });
      }, 600);
    }
  }

  type ControlAction =
    | { kind: 'play'; uri: string; positionMs: number }
    | { kind: 'resume' }
    | { kind: 'pause' }
    | { kind: 'seek'; positionMs: number };

  async function controlPlayback(
    dev: string,
    token: string,
    action: ControlAction,
    retry = true,
  ): Promise<boolean> {
    let path: string;
    let body: string | undefined;
    if (action.kind === 'play') {
      path = `/me/player/play?device_id=${encodeURIComponent(dev)}`;
      const positionMs = Math.max(0, Math.round(action.positionMs || 0));
      body = JSON.stringify({ uris: [action.uri], position_ms: positionMs });
    } else if (action.kind === 'resume') {
      // PUT /me/player/play with no body resumes the current track on the
      // target device.
      path = `/me/player/play?device_id=${encodeURIComponent(dev)}`;
    } else if (action.kind === 'pause') {
      path = `/me/player/pause?device_id=${encodeURIComponent(dev)}`;
    } else {
      const positionMs = Math.max(0, Math.round(action.positionMs || 0));
      path = `/me/player/seek?position_ms=${positionMs}&device_id=${encodeURIComponent(dev)}`;
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(`https://api.spotify.com/v1${path}`, {
        method: 'PUT',
        headers,
        body,
      });
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
    if (res.ok || res.status === 204) return true;

    // 404 → device is no longer active. Re-transfer playback and retry once.
    if (res.status === 404 && retry) {
      try {
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [dev], play: false }),
        });
        await new Promise((r) => setTimeout(r, 500));
        return controlPlayback(dev, token, action, false);
      } catch {
        // fall through
      }
    }

    // 403 with the right account but no premium device — also benign for our
    // purposes (the next state echo will resync).
    if (res.status === 403) return false;

    const errBody = await res.text().catch(() => '');
    // "Restriction violated" is also a transient state when racing with
    // user activity in another Spotify app; ignore it visually.
    if (errBody.toLowerCase().includes('restriction violated')) return false;
    setError(`spotify ${action.kind} failed (${res.status}): ${errBody || 'no body'}`);
    return false;
  }

  // ────────────── Track cache hydration ──────────────
  // Resolve URIs (for queue + current playback) to full track info so we can
  // display names/artists/art.
  useEffect(() => {
    const allUris = new Set<string>(queue);
    if (playback.trackUri) allUris.add(playback.trackUri);
    const missing = Array.from(allUris).filter((uri) => !trackCache[uri]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((uri) => {
        const id = trackIdFromUri(uri);
        if (!id) return null;
        return getTrack(id).catch(() => null);
      }),
    ).then((tracks) => {
      if (cancelled) return;
      setTrackCache((cur) => {
        const next = { ...cur };
        tracks.forEach((t) => {
          if (t) next[t.uri] = t;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.join('|'), playback.trackUri]);

  // Seed cache from SDK state so we don't extra-fetch the current track.
  useEffect(() => {
    if (!currentSDKTrack) return;
    setTrackCache((cur) => {
      if (cur[currentSDKTrack.uri]) return cur;
      // SDK track shape is close enough to our SpTrack interface that we can
      // synthesize an entry with just the visible fields.
      return {
        ...cur,
        [currentSDKTrack.uri]: {
          id: currentSDKTrack.uri.split(':').pop() || '',
          uri: currentSDKTrack.uri,
          name: currentSDKTrack.name,
          duration_ms: currentSDKTrack.duration_ms,
          artists: currentSDKTrack.artists.map((a) => ({ id: '', uri: a.uri, name: a.name })),
          album: {
            id: '',
            uri: currentSDKTrack.album.uri,
            name: currentSDKTrack.album.name,
            images: currentSDKTrack.album.images,
          },
        },
      };
    });
  }, [currentSDKTrack]);

  // ────────────── User actions ──────────────

  const playUri = useCallback(
    (uri: string) => {
      onLocalChange({ trackUri: uri, isPlaying: true, positionMs: 0 });
      fireFlash(uri, 'play');
    },
    [onLocalChange],
  );

  const queueUri = useCallback(
    (uri: string) => {
      onAddToQueue(uri);
      fireFlash(uri, 'queue');
    },
    [onAddToQueue],
  );

  const togglePlay = useCallback(() => {
    if (!playback.trackUri) return;
    onLocalChange({
      trackUri: playback.trackUri,
      isPlaying: !playback.isPlaying,
      positionMs: effectivePosition(playback),
    });
  }, [playback, onLocalChange]);

  const next = useCallback(() => {
    onAdvanceQueue(playback.trackUri);
  }, [playback.trackUri, onAdvanceQueue]);

  const disconnectSpotify = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.disconnect();
      playerRef.current = null;
    }
    clearSpotifyToken();
    setConnected(false);
    setStatus('idle');
    setDeviceId(null);
    setCurrentSDKTrack(null);
  }, []);

  // ────────────── Connect CTA ──────────────

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

// ─────────────────────────────────────────────────────────────────────
//   Now tab — current track, controls, shared queue
// ─────────────────────────────────────────────────────────────────────

function NowTab({
  playback,
  paused,
  queue,
  trackCache,
  flash,
  onPlay,
  onTogglePlay,
  onNext,
  onRemoveFromQueue,
  canControl,
}: {
  playback: PlaybackState;
  paused: boolean;
  queue: string[];
  trackCache: Record<string, SpTrack>;
  flash: { uri: string; kind: FlashKind } | null;
  onPlay: (uri: string) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onRemoveFromQueue: (uri: string, index: number) => void;
  canControl: boolean;
}) {
  const current = playback.trackUri ? trackCache[playback.trackUri] : null;
  const art = current ? pickImage(current.album.images, 80) : null;

  return (
    <div>
      {current ? (
        <div className="music-now">
          {art ? (
            <img src={art.url} className="music-art-lg" alt="" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="music-art-lg" />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div className="h-mono">now playing</div>
            <div
              className="h-display"
              style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {current.name}
            </div>
            <div
              className="body-text"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {joinArtists(current.artists)}
            </div>
          </div>
          {playback.trackUri && canControl && (
            <div className="music-now-controls">
              <button
                type="button"
                className="row-icon-btn primary"
                aria-label={paused ? 'play' : 'pause'}
                onClick={onTogglePlay}
              >
                <Icon name={paused ? 'play' : 'pause'} size={14} />
              </button>
              <button
                type="button"
                className="row-icon-btn"
                aria-label="next"
                onClick={onNext}
                disabled={queue.length === 0}
                style={{ opacity: queue.length === 0 ? 0.4 : 1 }}
              >
                <Icon name="next" size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="queue-empty">nothing playing yet — search or browse your library to start something.</div>
      )}

      <div className="music-section-label">up next · {queue.length}</div>
      {queue.length === 0 ? (
        <div className="queue-empty">queue is empty.</div>
      ) : (
        <div>
          {queue.map((uri, i) => {
            const t = trackCache[uri];
            const art = t ? pickImage(t.album?.images, 44) : null;
            const playFlashing = flash?.uri === uri && flash.kind === 'play';
            return (
              <div className="spotify-row" key={`${uri}-${i}`}>
                {art ? (
                  <img src={art.url} className="spotify-row-art" alt="" />
                ) : (
                  <div className="spotify-row-art" />
                )}
                <div className="spotify-row-body">
                  <div className="spotify-row-title">{t?.name ?? 'loading…'}</div>
                  <div className="spotify-row-meta">{t ? joinArtists(t.artists) : ''}</div>
                </div>
                <div className="spotify-row-actions">
                  <button
                    type="button"
                    className={`row-icon-btn primary${playFlashing ? ' flashing' : ''}`}
                    aria-label="play now"
                    onClick={() => {
                      onPlay(uri);
                      onRemoveFromQueue(uri, i);
                    }}
                  >
                    <Icon name={playFlashing ? 'check' : 'play'} size={14} />
                  </button>
                  <button
                    type="button"
                    className="row-icon-btn"
                    aria-label="remove"
                    onClick={() => onRemoveFromQueue(uri, i)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//   Search tab
// ─────────────────────────────────────────────────────────────────────

function SearchTab({
  state,
  setState,
  drill,
  setDrill,
  flash,
  onPlay,
  onAddToQueue,
}: {
  state: SearchState;
  setState: (updater: (prev: SearchState) => SearchState) => void;
  drill: Drill;
  setDrill: (d: Drill) => void;
  flash: { uri: string; kind: FlashKind } | null;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}) {
  const { query, lastSearchedQuery, results, loading, error: err } = state;

  // Debounced search — only fires when the trimmed query differs from the
  // one that produced the currently-cached results. So remounting the tab
  // with unchanged input doesn't trigger a refetch.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Empty input clears any prior results.
      if (results !== null || lastSearchedQuery !== '') {
        setState((s) => ({
          ...s,
          results: null,
          loading: false,
          error: null,
          lastSearchedQuery: '',
        }));
      }
      return;
    }
    if (trimmed === lastSearchedQuery && results !== null) {
      // Cached results match the input — skip.
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      searchSpotify(trimmed, ctrl.signal)
        .then((r) =>
          setState((s) => ({
            ...s,
            results: r,
            loading: false,
            lastSearchedQuery: trimmed,
          })),
        )
        .catch((e: Error) => {
          if (e.name !== 'AbortError') {
            setState((s) => ({ ...s, error: e.message, loading: false }));
          }
        });
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (drill) {
    return (
      <DrillView
        drill={drill}
        onBack={() => setDrill(null)}
        flash={flash}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
      />
    );
  }

  return (
    <div>
      <input
        className="search-input"
        type="text"
        value={query}
        onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
        placeholder="search tracks, albums, playlists…"
      />
      {loading && <div className="list-loading">searching…</div>}
      {err && <small className="music-error">{err}</small>}
      {!loading && !query.trim() && (
        <div className="search-empty">type to search Spotify.</div>
      )}
      {results && !loading && (
        <>
          {results.tracks.length > 0 && (
            <>
              <div className="music-section-label">tracks</div>
              {results.tracks.map((t) => (
                <TrackRow key={t.id} track={t} flash={flash} onPlay={onPlay} onAddToQueue={onAddToQueue} />
              ))}
            </>
          )}
          {results.albums.length > 0 && (
            <>
              <div className="music-section-label">albums</div>
              {results.albums.map((a) => (
                <AlbumRow key={a.id} album={a} onOpen={() => setDrill({ kind: 'album', id: a.id, name: a.name })} />
              ))}
            </>
          )}
          {results.playlists.length > 0 && (
            <>
              <div className="music-section-label">playlists</div>
              {results.playlists.map((p) => (
                <PlaylistRow key={p.id} playlist={p} onOpen={() => setDrill({ kind: 'playlist', id: p.id, name: p.name, ownerId: p.owner?.id })} />
              ))}
            </>
          )}
          {results.tracks.length === 0 &&
            results.albums.length === 0 &&
            results.playlists.length === 0 && (
              <div className="search-empty">no results.</div>
            )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//   Library tab
// ─────────────────────────────────────────────────────────────────────

function LibraryTab({
  drill,
  setDrill,
  flash,
  onPlay,
  onAddToQueue,
}: {
  drill: Drill;
  setDrill: (d: Drill) => void;
  flash: { uri: string; kind: FlashKind } | null;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}) {
  const [playlists, setPlaylists] = useState<SpPlaylist[] | null>(null);
  const [albums, setAlbums] = useState<SpAlbum[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMyPlaylists().catch((e: Error) => {
        if (!cancelled) setErr(e.message);
        return [];
      }),
      getMyAlbums().catch(() => []),
    ]).then(([pls, alb]) => {
      if (cancelled) return;
      setPlaylists(pls);
      setAlbums(alb);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (drill) {
    return (
      <DrillView
        drill={drill}
        onBack={() => setDrill(null)}
        flash={flash}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
      />
    );
  }

  if (!playlists || !albums) {
    return <div className="list-loading">loading library…</div>;
  }

  return (
    <div>
      {err && <small className="music-error">{err}</small>}
      <div className="music-section-label">your playlists · {playlists.length}</div>
      {playlists.length === 0 ? (
        <div className="search-empty">no playlists yet.</div>
      ) : (
        playlists.map((p) => (
          <PlaylistRow key={p.id} playlist={p} onOpen={() => setDrill({ kind: 'playlist', id: p.id, name: p.name, ownerId: p.owner?.id })} />
        ))
      )}
      <div className="music-section-label">saved albums · {albums.length}</div>
      {albums.length === 0 ? (
        <div className="search-empty">no saved albums.</div>
      ) : (
        albums.map((a) => (
          <AlbumRow key={a.id} album={a} onOpen={() => setDrill({ kind: 'album', id: a.id, name: a.name })} />
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//   Drill view — tracks inside a chosen playlist or album
// ─────────────────────────────────────────────────────────────────────

function DrillView({
  drill,
  onBack,
  flash,
  onPlay,
  onAddToQueue,
}: {
  drill: NonNullable<Drill>;
  onBack: () => void;
  flash: { uri: string; kind: FlashKind } | null;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
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
        // 403 on a Spotify-curated playlist (Discover Weekly, Daily Mix,
        // "Made for you" etc.). Translate to a friendlier message.
        if (drill.kind === 'playlist' && /\b403\b/.test(e.message)) {
          setErr(
            "Spotify-curated playlists (like Discover Weekly or Daily Mix) aren't accessible from third-party apps. Try one of your own playlists instead.",
          );
        } else {
          setErr(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [drill.kind, drill.id]);

  return (
    <div>
      <button type="button" className="music-back" onClick={onBack}>
        ← back
      </button>
      <div className="h-display" style={{ fontSize: 18, marginBottom: 10 }}>
        {drill.name}
      </div>
      {err && <small className="music-error">{err}</small>}
      {tracks === null && !err && <div className="list-loading">loading…</div>}
      {tracks && tracks.length === 0 && <div className="search-empty">empty.</div>}
      {tracks?.map((t) => (
        <TrackRow key={t.id + t.uri} track={t} flash={flash} onPlay={onPlay} onAddToQueue={onAddToQueue} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//   Row components
// ─────────────────────────────────────────────────────────────────────

function TrackRow({
  track,
  flash,
  onPlay,
  onAddToQueue,
}: {
  track: SpTrack;
  flash: { uri: string; kind: FlashKind } | null;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}) {
  const art = pickImage(track.album?.images, 44);
  const isFlashing = flash?.uri === track.uri;
  const playFlash = isFlashing && flash.kind === 'play';
  const queueFlash = isFlashing && flash.kind === 'queue';
  return (
    <div className="spotify-row">
      {art ? (
        <img src={art.url} className="spotify-row-art" alt="" />
      ) : (
        <div className="spotify-row-art" />
      )}
      <div className="spotify-row-body">
        <div className="spotify-row-title">{track.name}</div>
        <div className="spotify-row-meta">{joinArtists(track.artists)}</div>
      </div>
      <div className="spotify-row-actions">
        <button
          type="button"
          className={`row-icon-btn primary${playFlash ? ' flashing' : ''}`}
          aria-label="play now"
          onClick={() => onPlay(track.uri)}
        >
          <Icon name={playFlash ? 'check' : 'play'} size={14} />
        </button>
        <button
          type="button"
          className={`row-icon-btn${queueFlash ? ' flashing' : ''}`}
          aria-label="add to queue"
          onClick={() => onAddToQueue(track.uri)}
        >
          <Icon name={queueFlash ? 'check' : 'queue-add'} size={14} />
        </button>
      </div>
    </div>
  );
}

function AlbumRow({ album, onOpen }: { album: SpAlbum; onOpen: () => void }) {
  const art = pickImage(album.images, 44);
  return (
    <button type="button" className="spotify-tile" onClick={onOpen}>
      <div className="spotify-row">
        {art ? (
          <img src={art.url} className="spotify-row-art" alt="" />
        ) : (
          <div className="spotify-row-art" />
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{album.name}</div>
          <div className="spotify-row-meta">
            album · {joinArtists(album.artists)}
          </div>
        </div>
      </div>
    </button>
  );
}

function PlaylistRow({ playlist, onOpen }: { playlist: SpPlaylist; onOpen: () => void }) {
  const art = pickImage(playlist.images, 44);
  const total = playlist.tracks?.total ?? 0;
  const owner = playlist.owner?.display_name ?? '';
  const meta = owner ? `${total} tracks · ${owner}` : `${total} tracks`;
  return (
    <button type="button" className="spotify-tile" onClick={onOpen}>
      <div className="spotify-row">
        {art ? (
          <img src={art.url} className="spotify-row-art" alt="" />
        ) : (
          <div className="spotify-row-art" />
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{playlist.name}</div>
          <div className="spotify-row-meta">{meta}</div>
        </div>
      </div>
    </button>
  );
}

// Reference 'useMemo' to silence its unused-import warning — kept available
// for future memoization but not used right now.
void useMemo;
