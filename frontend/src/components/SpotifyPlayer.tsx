import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createController,
  extractSpotifyTrackUri,
  type SpotifyController,
  type SpotifyPlaybackUpdate,
} from '../spotify';
import type { PlaybackState } from '../types';

interface SpotifyPlayerProps {
  playback: PlaybackState;
  onLocalChange: (next: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
}

function effectivePosition(p: PlaybackState): number {
  if (!p.isPlaying) return p.positionMs;
  return p.positionMs + Math.max(0, Date.now() - p.positionUpdatedAt);
}

export default function SpotifyPlayer({ playback, onLocalChange }: SpotifyPlayerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const loadedUriRef = useRef<string | null>(null);
  const lastIsPausedRef = useRef<boolean | null>(null);
  const lastUpdateRef = useRef<SpotifyPlaybackUpdate | null>(null);
  const suppressUntilRef = useRef(0);
  const onLocalChangeRef = useRef(onLocalChange);
  onLocalChangeRef.current = onLocalChange;
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  function suppressFor(ms: number) {
    const until = Date.now() + ms;
    if (until > suppressUntilRef.current) suppressUntilRef.current = until;
  }

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let cancelled = false;
    const slot = document.createElement('div');
    container.appendChild(slot);

    createController(slot).then(
      (controller) => {
        if (cancelled) {
          controller.destroy();
          return;
        }
        controllerRef.current = controller;
        controller.addListener('playback_update', (e) => {
          const u = e.data;
          lastUpdateRef.current = u;
          const prev = lastIsPausedRef.current;
          lastIsPausedRef.current = u.isPaused;
          if (prev === null || prev === u.isPaused) return;
          if (Date.now() < suppressUntilRef.current) return;
          const current = playbackRef.current;
          if (!current.trackUri) return;
          onLocalChangeRef.current({
            trackUri: current.trackUri,
            isPlaying: !u.isPaused,
            positionMs: Math.round(u.position),
          });
        });
        setReady(true);
        suppressFor(1500);
        controller.pause();
        applyRemote(controller, playbackRef.current);
      },
      (err: Error) => {
        if (!cancelled) setLoadError(err.message);
      },
    );

    return () => {
      cancelled = true;
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
      while (container.firstChild) container.removeChild(container.firstChild);
      loadedUriRef.current = null;
      lastIsPausedRef.current = null;
      lastUpdateRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !ready) return;
    applyRemote(controller, playback);
  }, [playback, ready]);

  function applyRemote(controller: SpotifyController, p: PlaybackState) {
    if (!p.trackUri) {
      suppressFor(1500);
      controller.pause();
      loadedUriRef.current = null;
      return;
    }
    const targetMs = effectivePosition(p);
    if (loadedUriRef.current !== p.trackUri) {
      loadedUriRef.current = p.trackUri;
      suppressFor(2500);
      controller.loadUri(p.trackUri);
      window.setTimeout(() => {
        controller.seek(targetMs / 1000);
        if (p.isPlaying) controller.resume();
        else controller.pause();
      }, 600);
      return;
    }
    const last = lastUpdateRef.current;
    if (last && Math.abs(last.position - targetMs) > 1500) {
      suppressFor(800);
      controller.seek(targetMs / 1000);
    }
    if (p.isPlaying && lastIsPausedRef.current !== false) {
      suppressFor(800);
      controller.resume();
    } else if (!p.isPlaying && lastIsPausedRef.current !== true) {
      suppressFor(800);
      controller.pause();
    }
  }

  function submitTrack(e: FormEvent) {
    e.preventDefault();
    const uri = extractSpotifyTrackUri(input);
    if (!uri) {
      setInputError('paste a Spotify track link');
      return;
    }
    setInputError(null);
    setInput('');
    onLocalChange({ trackUri: uri, isPlaying: true, positionMs: 0 });
  }

  function clearTrack() {
    onLocalChange({ trackUri: null, isPlaying: false, positionMs: 0 });
  }

  return (
    <div>
      <form className="music-input" onSubmit={submitTrack}>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(null);
          }}
          placeholder="paste a Spotify track link"
        />
        <button type="submit" disabled={!input.trim()}>play</button>
      </form>
      {inputError && <small className="music-error">{inputError}</small>}
      {loadError && <small className="music-error">Spotify embed didn't load: {loadError}</small>}
      {!ready && !loadError && <small className="spotify-status">loading Spotify player…</small>}
      <div ref={mountRef} className="spotify-embed" />
      {playback.trackUri && (
        <button
          type="button"
          className="btn btn-ghost compact"
          style={{ marginTop: 12 }}
          onClick={clearTrack}
        >
          clear track
        </button>
      )}
    </div>
  );
}
