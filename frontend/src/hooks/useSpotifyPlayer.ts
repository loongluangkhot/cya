import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadSpotifySDK,
  type SpotifyPlayer as SDKPlayer,
  type SpotifyPlayerState,
  type SpotifyTrack as SDKTrack,
} from '../spotify';
import {
  clearSpotifyToken,
  getValidSpotifyToken,
  hasSpotifyToken,
} from '../spotifyAuth';
import { getTrack, trackIdFromUri, type SpTrack } from '../spotifyApi';
import type { PlaybackState } from '../types';
import {
  effectivePosition,
  type Flash,
  type FlashKind,
  type Status,
} from '../components/spotify/shared';

export interface UseSpotifyPlayerOpts {
  playback: PlaybackState;
  queue: string[];
  onLocalChange: (next: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
  onAddToQueue: (uri: string) => void;
  onAdvanceQueue: (afterTrackUri: string | null) => void;
}

export interface UseSpotifyPlayerResult {
  connected: boolean;
  status: Status;
  deviceId: string | null;
  error: string | null;
  currentSDKTrack: SDKTrack | null;
  paused: boolean;
  trackCache: Record<string, SpTrack>;
  flash: Flash;
  playUri: (uri: string) => void;
  queueUri: (uri: string) => void;
  togglePlay: () => void;
  next: () => void;
  disconnectSpotify: () => void;
}

type ControlAction =
  | { kind: 'play'; uri: string; positionMs: number }
  | { kind: 'resume' }
  | { kind: 'pause' }
  | { kind: 'seek'; positionMs: number };

export function useSpotifyPlayer({
  playback,
  queue,
  onLocalChange,
  onAddToQueue,
  onAdvanceQueue,
}: UseSpotifyPlayerOpts): UseSpotifyPlayerResult {
  const [connected, setConnected] = useState(hasSpotifyToken());
  const [status, setStatus] = useState<Status>('idle');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSDKTrack, setCurrentSDKTrack] = useState<SDKTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [trackCache, setTrackCache] = useState<Record<string, SpTrack>>({});
  const [flash, setFlash] = useState<Flash>(null);

  const playerRef = useRef<SDKPlayer | null>(null);
  const suppressUntilRef = useRef(0);
  const lastEndedUriRef = useRef<string | null>(null);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const onLocalChangeRef = useRef(onLocalChange);
  onLocalChangeRef.current = onLocalChange;
  const onAdvanceQueueRef = useRef(onAdvanceQueue);
  onAdvanceQueueRef.current = onAdvanceQueue;

  function fireFlash(uri: string, kind: FlashKind) {
    setFlash({ uri, kind });
  }
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(t);
  }, [flash]);

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

  return {
    connected,
    status,
    deviceId,
    error,
    currentSDKTrack,
    paused,
    trackCache,
    flash,
    playUri,
    queueUri,
    togglePlay,
    next,
    disconnectSpotify,
  };
}
