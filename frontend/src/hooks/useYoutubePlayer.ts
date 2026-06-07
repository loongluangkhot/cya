import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackState } from '../types';
import { loadYouTubeApi, type YTNamespace, type YTPlayer } from '../youtubeIframeApi';
import { useStoredState } from './useStoredState';

const OPT_IN_KEY = 'cya:yt:opt-in:v1';
const VOLUME_KEY = 'cya:yt:vol:v1';
const MUTED_KEY = 'cya:yt:muted:v1';

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
  /** Local YT player volume 0..100. Per-listener — never broadcast. */
  volume: number;
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (next: boolean) => void;
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

/** Watchdog thresholds. YT's embedded player can sink into BUFFERING and
    never come back out — manually seeking unwedges it, so the watchdog
    automates that nudge once we've been visibly stuck for this long. */
const STUCK_BUFFER_FIRST_NUDGE_MS = 8000;
const STUCK_BUFFER_GIVE_UP_MS = 16000;
/** Playhead progress smaller than this in a watchdog window counts as
    "no progress" — getCurrentTime() can tick by a few hundredths during
    a frozen buffer fill from internal timing noise. */
const STUCK_BUFFER_PROGRESS_EPS_SEC = 0.5;

function ytStateName(state: number): string {
  switch (state) {
    case -1: return 'UNSTARTED';
    case 0: return 'ENDED';
    case 1: return 'PLAYING';
    case 2: return 'PAUSED';
    case 3: return 'BUFFERING';
    case 5: return 'CUED';
    default: return `unknown(${state})`;
  }
}

function validateBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}
function validateVolume(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function useYoutubePlayer({ playback, onEnded }: UseYoutubePlayerOpts): UseYoutubePlayerResult {
  const [enabled, setEnabled] = useStoredState<boolean>(OPT_IN_KEY, true, validateBool);
  const [volume, setVolumeStored] = useStoredState<number>(VOLUME_KEY, 80, validateVolume);
  const [muted, setMutedStored] = useStoredState<boolean>(MUTED_KEY, false, validateBool);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  // Track the videoId the live player is mounted with. Lets attach()
  // fast-path no-op when called with the same container + same video,
  // which is the common case for non-music sheets opening (they don't
  // change the player surface, but Room.tsx's useEffect deps include
  // `sheet`, so it re-fires on every open/close).
  const currentVideoIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  // The watchdog reads playback state from a ref so the interval
  // callback (created once inside buildPlayer's onReady) never sees a
  // stale isPlaying value when the room toggles play/pause.
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  // Volume + mute are read once at onReady from refs (buildPlayer is a
  // useCallback with no deps — without refs we'd close over stale values
  // when the listener changes their volume before a new player is built).
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  // Stuck-BUFFERING tracker: when we first entered the current
  // buffering episode, the playhead at that moment, and whether the
  // first-stage seek nudge has already fired. null whenever the player
  // isn't BUFFERING.
  const bufferingSinceRef = useRef<{
    atMs: number;
    atSec: number;
    nudged: boolean;
  } | null>(null);
  // Last YT player state code we observed — used to gate DEV transition
  // logs so the watchdog poll doesn't spam the console at 4Hz.
  const lastStateRef = useRef<number>(-2);
  // Initial-load gate for the BUFFERING watchdog. Flips true on the
  // first PLAYING transition. Without this, a slow initial chunk fetch
  // (>8s) would trip the seek-nudge from currentSec=0 → 1, silently
  // skipping the first second of the track on every slow-network play.
  const hasEverPlayedRef = useRef(false);

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
          // Start muted so Chrome's autoplay policy lets the iframe
          // begin playing without a fresh gesture. onReady immediately
          // restores the listener's persisted volume + mute preference,
          // so audio kicks in within ~100ms of the player being ready.
          // Without this, the first play after page load wedges at
          // "playing-but-no-audio" until the user manually toggles.
          mute: 1,
        },
        events: {
          onReady: (e) => {
            setStatus('ready');
            setDurationSec(e.target.getDuration() || 0);
            // Apply the listener's persisted volume + mute before play
            // kicks in, so we don't get a brief blast at the iframe's
            // default volume between onReady and the volume sync effect.
            try {
              e.target.setVolume(volumeRef.current);
              if (mutedRef.current) e.target.mute();
              else e.target.unMute();
            } catch {
              // ignore — synced again by the [status, volume, muted] effect
            }
            if (opts.playing) e.target.playVideo();
            clearPoll();
            bufferingSinceRef.current = null;
            lastStateRef.current = -2;
            hasEverPlayedRef.current = false;
            pollRef.current = window.setInterval(() => {
              const p = playerRef.current;
              if (!p) return;
              const curSec = p.getCurrentTime() || 0;
              setCurrentSec(curSec);
              const d = p.getDuration() || 0;
              if (d) setDurationSec(d);

              // ── Watchdog ─────────────────────────────────────────
              const Y = window.YT;
              if (!Y) return;
              let state: number;
              try {
                state = p.getPlayerState();
              } catch {
                return;
              }
              if (import.meta.env.DEV && state !== lastStateRef.current) {
                console.log(
                  `[yt] ${ytStateName(lastStateRef.current)} → ${ytStateName(state)} @ ${curSec.toFixed(1)}s`,
                );
                lastStateRef.current = state;
              }
              // Flip the initial-load gate the first time we see PLAYING.
              // The BUFFERING watchdog below stays disarmed until then so
              // a slow first chunk doesn't get treated as "stuck".
              if (state === Y.PlayerState.PLAYING) hasEverPlayedRef.current = true;

              // PAUSED while the room says we should be playing — covers
              // any local auto-pause (idle prompt, ad transition, user
              // clicking the iframe's own pause button) the rest of the
              // hook doesn't separately model.
              if (
                state === Y.PlayerState.PAUSED &&
                playbackRef.current.isPlaying
              ) {
                try {
                  p.playVideo();
                } catch {
                  // ignore
                }
              }

              // Stuck BUFFERING — YT's embedded recovery often can't
              // self-unwedge once the buffer drains and the next
              // segment fetch wedges. Two-stage escalation: seek-nudge
              // (forces a fresh range request from a new offset, which
              // usually frees the player), then full reload of the
              // video at the current position as a last resort.
              if (state === Y.PlayerState.BUFFERING && hasEverPlayedRef.current) {
                const tracker = bufferingSinceRef.current;
                const nowMs = Date.now();
                if (!tracker) {
                  bufferingSinceRef.current = {
                    atMs: nowMs,
                    atSec: curSec,
                    nudged: false,
                  };
                } else {
                  const elapsedMs = nowMs - tracker.atMs;
                  const advancedSec = curSec - tracker.atSec;
                  if (advancedSec > STUCK_BUFFER_PROGRESS_EPS_SEC) {
                    // We're making progress — just slow buffering, not
                    // wedged. Slide the watchdog window forward so we
                    // only nudge if we genuinely stall.
                    bufferingSinceRef.current = {
                      atMs: nowMs,
                      atSec: curSec,
                      nudged: false,
                    };
                  } else if (elapsedMs >= STUCK_BUFFER_GIVE_UP_MS) {
                    const videoId = currentVideoIdRef.current;
                    if (videoId) {
                      if (import.meta.env.DEV) {
                        console.log(
                          `[yt] still stuck at ${curSec.toFixed(1)}s after ${(elapsedMs / 1000).toFixed(1)}s — reloading video`,
                        );
                      }
                      try {
                        p.loadVideoById({
                          videoId,
                          startSeconds: Math.max(0, Math.floor(curSec)),
                        });
                        // YT's IFrame API doesn't reliably preserve
                        // volume/mute across loadVideoById in all
                        // versions; re-apply the listener's settings so
                        // the reload can't blast at default 100/unmuted.
                        p.setVolume(volumeRef.current);
                        if (mutedRef.current) p.mute();
                        else p.unMute();
                      } catch {
                        // ignore
                      }
                      bufferingSinceRef.current = null;
                      hasEverPlayedRef.current = false;
                    }
                  } else if (
                    elapsedMs >= STUCK_BUFFER_FIRST_NUDGE_MS &&
                    !tracker.nudged
                  ) {
                    if (import.meta.env.DEV) {
                      console.log(
                        `[yt] buffering ${(elapsedMs / 1000).toFixed(1)}s with no progress — nudging via seek`,
                      );
                    }
                    try {
                      p.seekTo(curSec + 1, true);
                    } catch {
                      // ignore
                    }
                    tracker.nudged = true;
                  }
                }
              } else {
                bufferingSinceRef.current = null;
              }
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
      // Fast-path A: same container + same video + a live player → no-op.
      // Without this, opening any non-music sheet would destroy and
      // rebuild the YouTube iframe (Room.tsx's effect re-fires because
      // `sheet` is in its deps), causing a brief audible pause.
      // play/pause state is handled by the separate sync effect below,
      // so we don't need to touch the player here when the surface
      // hasn't changed.
      if (
        container &&
        container === containerRef.current &&
        playerRef.current &&
        opts &&
        opts.videoId === currentVideoIdRef.current
      ) {
        return;
      }
      // Fast-path B: container changed but the video is the same and
      // we already have a live player → move the iframe to the new
      // container instead of destroying and rebuilding. Playback
      // continues seamlessly. Covers the common cases of opening /
      // closing the music sheet and toggling the in-room player.
      if (
        container &&
        container !== containerRef.current &&
        playerRef.current &&
        opts &&
        opts.videoId === currentVideoIdRef.current
      ) {
        try {
          const iframe = playerRef.current.getIframe();
          if (iframe) {
            container.innerHTML = '';
            container.appendChild(iframe);
            containerRef.current = container;
            return;
          }
        } catch {
          // fall through to destroy + rebuild
        }
      }
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
        currentVideoIdRef.current = null;
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
        return;
      }
      currentVideoIdRef.current = opts.videoId;
    },
    [buildPlayer],
  );

  const getPositionMs = useCallback(() => {
    const p = playerRef.current;
    // If the player is live and ready, trust its playhead.
    if (p && status === 'ready') {
      try {
        return Math.max(0, Math.floor((p.getCurrentTime() || 0) * 1000));
      } catch {
        // fall through to the extrapolation below
      }
    }
    // Otherwise extrapolate from the room's last reported position. A
    // play/pause click while the iframe is mid-rebuild would otherwise
    // broadcast positionMs=0 and reset every listener's playhead.
    const pb = playbackRef.current;
    const elapsedMs = pb.isPlaying ? Date.now() - pb.positionUpdatedAt : 0;
    return Math.max(0, Math.floor(pb.positionMs + elapsedMs));
  }, [status]);

  // Volume + mute are local-only — the room never sees them. State lives
  // in localStorage so a refresh keeps the listener's preference, and we
  // apply it to the live player whenever either changes. Dragging the
  // slider above 0 auto-unmutes (matches the prototype).
  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(v)));
      setVolumeStored(clamped);
      if (clamped > 0) setMutedStored(false);
    },
    [setVolumeStored, setMutedStored],
  );
  const setMuted = useCallback(
    (next: boolean) => {
      setMutedStored(next);
    },
    [setMutedStored],
  );
  useEffect(() => {
    if (status !== 'ready') return;
    const p = playerRef.current;
    if (!p) return;
    try {
      p.setVolume(volume);
      if (muted) p.mute();
      else p.unMute();
    } catch {
      // Player may be mid-rebuild — the next ready transition will reapply.
    }
  }, [status, volume, muted]);

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
    volume,
    muted,
    setVolume,
    setMuted,
    getPositionMs,
    attach,
    expandPlaylist,
  };
}
