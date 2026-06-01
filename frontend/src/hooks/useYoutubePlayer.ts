import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackState } from '../types';

/** YouTube IFrame Player API global. We only touch the surface we use. */
interface YTPlayerCtor {
  new (el: HTMLElement, opts: YTPlayerOptions): YTPlayer;
}
interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
  };
}
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number, allow?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
  cuePlaylist?(opts: { list: string; listType?: string; index?: number }): void;
  getPlaylist?(): string[] | null;
}
interface YTNamespace {
  Player: YTPlayerCtor;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<boolean> | null = null;
function loadYouTubeApi(): Promise<boolean> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(true);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(true);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => resolve(false);
    document.head.appendChild(tag);
    // Hard timeout — if the API hasn't initialised, give up.
    window.setTimeout(() => resolve(!!(window.YT && window.YT.Player)), 6000);
  });
  return apiPromise;
}

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AttachOpts {
  videoId: string;
  startAt?: number;
  playing?: boolean;
}

export interface UseYoutubePlayerResult {
  /** Whether the local user has opted into music (gate). */
  enabled: boolean;
  enable: () => void;
  disable: () => void;
  status: PlayerStatus;
  currentSec: number;
  durationSec: number;
  isPlaying: boolean;
  /** Current playhead in ms — used when toggling so the wire carries
      real position, not a stale 0. */
  getPositionMs: () => number;
  /** Mount the player into a container. Pass null to unmount. */
  attach: (container: HTMLElement | null, opts: AttachOpts | null) => void;
  /** Resolve a playlist id to its video ids via a temporary off-screen
      player + cuePlaylist/getPlaylist. No API key required. */
  expandPlaylist: (playlistId: string) => Promise<string[]>;
}

interface UseYoutubePlayerOpts {
  /** Shared room playback — drives the loaded video + sync target. */
  playback: PlaybackState;
  /** Called when the video ends naturally so the room can advance. */
  onEnded: () => void;
}

/** When in doubt, don't seek — small drift is fine; only correct when
    we're meaningfully off the target. Avoids audio glitches from the
    local user's own optimistic update echoing back. */
const SEEK_THRESHOLD_SEC = 2;

export function useYoutubePlayer({ playback, onEnded }: UseYoutubePlayerOpts): UseYoutubePlayerResult {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const pollRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  function clearPoll() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const buildPlayer = useCallback((container: HTMLElement, opts: AttachOpts) => {
    const YT = window.YT;
    if (!YT) return false;
    const host = document.createElement('div');
    host.style.width = '100%';
    host.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(host);
    try {
      playerRef.current = new YT.Player(host, {
        width: '100%',
        height: '100%',
        videoId: opts.videoId,
        playerVars: {
          autoplay: opts.playing ? 1 : 0,
          start: Math.floor(opts.startAt ?? 0),
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          controls: 1,
        },
        events: {
          onReady: (e) => {
            setStatus('ready');
            setDurationSec(e.target.getDuration() || 0);
            if (opts.playing) e.target.playVideo();
            clearPoll();
            pollRef.current = window.setInterval(() => {
              const p = playerRef.current;
              if (!p) return;
              setCurrentSec(p.getCurrentTime() || 0);
              const d = p.getDuration() || 0;
              if (d) setDurationSec(d);
            }, 250);
          },
          onStateChange: (e) => {
            const Y = window.YT;
            if (!Y) return;
            if (e.data === Y.PlayerState.PLAYING) setIsPlaying(true);
            else if (e.data === Y.PlayerState.PAUSED) setIsPlaying(false);
            else if (e.data === Y.PlayerState.ENDED) {
              setIsPlaying(false);
              onEndedRef.current();
            }
          },
          onError: () => {
            setStatus('error');
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const attach = useCallback(
    async (container: HTMLElement | null, opts: AttachOpts | null) => {
      containerRef.current = container;
      clearPoll();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      if (!container || !opts || !opts.videoId) {
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setCurrentSec(opts.startAt ?? 0);
      setIsPlaying(!!opts.playing);
      const ok = await loadYouTubeApi();
      if (containerRef.current !== container) return;
      if (!ok || !window.YT || !window.YT.Player) {
        setStatus('error');
        return;
      }
      if (!buildPlayer(container, opts)) {
        setStatus('error');
      }
    },
    [buildPlayer],
  );

  const getPositionMs = useCallback(() => {
    const p = playerRef.current;
    if (!p) return 0;
    try {
      return Math.max(0, Math.floor((p.getCurrentTime() || 0) * 1000));
    } catch {
      return 0;
    }
  }, []);

  // Sync the local player to room playback. Fires when the room state's
  // play/pause flips OR when positionMs/positionUpdatedAt change. We seek
  // only when the player's current position drifts past the threshold —
  // the same client's own optimistic update echoes back and shouldn't
  // glitch its own audio.
  useEffect(() => {
    if (!enabled || !playback.trackUri || status !== 'ready') return;
    const p = playerRef.current;
    if (!p) return;
    const elapsedMs = playback.isPlaying
      ? Date.now() - playback.positionUpdatedAt
      : 0;
    const targetSec = (playback.positionMs + elapsedMs) / 1000;
    let cur = 0;
    try {
      cur = p.getCurrentTime() || 0;
    } catch {
      // ignore
    }
    if (Math.abs(targetSec - cur) > SEEK_THRESHOLD_SEC) {
      try {
        p.seekTo(targetSec, true);
      } catch {
        // ignore
      }
    }
    try {
      if (playback.isPlaying) p.playVideo();
      else p.pauseVideo();
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, status, playback.isPlaying, playback.positionMs, playback.positionUpdatedAt]);

  const expandPlaylist = useCallback(async (playlistId: string): Promise<string[]> => {
    const ok = await loadYouTubeApi();
    if (!ok || !window.YT) return [];
    return new Promise((resolve) => {
      const host = document.createElement('div');
      host.style.cssText =
        'position:absolute;width:1px;height:1px;left:-9999px;top:0;opacity:0;pointer-events:none;';
      document.body.appendChild(host);
      let p: YTPlayer | null = null;
      let resolved = false;
      function finish(ids: string[]) {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timeout);
        try {
          p?.destroy();
        } catch {
          // ignore
        }
        host.remove();
        resolve(ids);
      }
      // Cap total wait — bad playlist ids should fail fast.
      const timeout = window.setTimeout(() => finish([]), 8000);
      try {
        p = new (window.YT as YTNamespace).Player(host, {
          width: 1,
          height: 1,
          playerVars: { autoplay: 0, controls: 0 },
          events: {
            onReady: (e) => {
              try {
                e.target.cuePlaylist?.({ list: playlistId, listType: 'playlist' });
              } catch {
                finish([]);
              }
            },
            onStateChange: () => {
              if (!p) return;
              try {
                const ids = p.getPlaylist?.() ?? [];
                if (Array.isArray(ids) && ids.length > 0) finish(ids);
              } catch {
                // ignore — wait for the next state change or the timeout
              }
            },
            onError: () => finish([]),
          },
        });
      } catch {
        finish([]);
      }
    });
  }, []);

  // Clean up timers and player on unmount.
  useEffect(() => {
    return () => {
      clearPoll();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, []);

  return {
    enabled,
    enable: () => setEnabled(true),
    disable: () => {
      setEnabled(false);
      attach(null, null);
    },
    status,
    currentSec,
    durationSec,
    isPlaying,
    getPositionMs,
    attach,
    expandPlaylist,
  };
}
