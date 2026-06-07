import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '../Icon';
import { API_BASE } from '../../api';
import { formatVoiceDuration } from '../../hooks/useRoomState';

interface VoicePlayerProps {
  roomId: string;
  messageId: string;
  durationMs: number;
  mime: string;
  expired: boolean;
  /** When true, this player starts playback on the `cya:voice-arrived` event
   *  whose detail.messageId matches its own — used by the IRC log to
   *  autoplay freshly-arrived clips. */
  autoplay?: boolean;
}

// Module-scoped "active player" slot. A voice clip starts by stopping
// whoever's currently in this slot, then claiming it. We keep the
// previous player's `release` fn so it can update its own UI to paused.
let activeVoiceRelease: (() => void) | null = null;

export function VoicePlayer({ roomId, messageId, durationMs, mime, expired, autoplay }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Stable handle: identifies *this* player in the global slot regardless
  // of re-renders. Storing the release callback in a ref + comparing by
  // identity avoids clearing the slot when someone else has since claimed it.
  const releaseRef = useRef<() => void>(() => {});
  releaseRef.current = () => {
    const el = audioRef.current;
    if (el && !el.paused) el.pause();
    setPlaying(false);
  };

  function clearSlotIfMine() {
    if (activeVoiceRelease === releaseRef.current) activeVoiceRelease = null;
  }

  useEffect(() => {
    return () => {
      clearSlotIfMine();
      const el = audioRef.current;
      if (el) {
        el.pause();
        if (el.src) URL.revokeObjectURL(el.src);
      }
    };
  }, []);

  async function ensureAudio(): Promise<HTMLAudioElement | null> {
    if (audioRef.current) return audioRef.current;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomId}/audio/${messageId}`);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: mime }));
      const el = new Audio(url);
      el.onended = () => {
        setPlaying(false);
        setPositionMs(0);
        clearSlotIfMine();
      };
      el.onerror = () => {
        setError(true);
        setPlaying(false);
        clearSlotIfMine();
      };
      el.ontimeupdate = () => {
        setPositionMs(Math.min(durationMs, Math.floor(el.currentTime * 1000)));
      };
      audioRef.current = el;
      return el;
    } catch {
      setError(true);
      return null;
    }
  }

  async function startPlayback() {
    if (expired) return;
    const el = await ensureAudio();
    if (!el) return;
    // Stop whoever's currently playing (if anyone) before claiming the
    // slot. Snapshot then null first so a re-entrant release() can't
    // re-stop us mid-play.
    const prev = activeVoiceRelease;
    activeVoiceRelease = null;
    if (prev) prev();
    activeVoiceRelease = releaseRef.current;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      // Browsers block programmatic audio.play() until the user has
      // interacted with the page — for autoplay on first visit this can
      // throw a NotAllowedError. Stay quiet (not a real error state) and
      // release the slot so manual playback still works.
      clearSlotIfMine();
    }
  }

  async function togglePlay() {
    if (expired) return;
    const el = audioRef.current;
    if (el && playing) {
      el.pause();
      setPlaying(false);
      clearSlotIfMine();
      return;
    }
    await startPlayback();
  }

  // Seek the audio element to `fraction` of the clip duration. If the
  // audio isn't loaded yet, fetch + start playing from that offset.
  async function seekToFraction(fraction: number) {
    if (expired) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    const targetMs = Math.floor(clamped * durationMs);
    setPositionMs(targetMs);
    const el = await ensureAudio();
    if (!el) return;
    try {
      el.currentTime = targetMs / 1000;
    } catch {
      // Some browsers reject seeks before metadata is ready; ignore and
      // the next timeupdate will catch up.
    }
    if (!playing) await startPlayback();
  }

  function trackFraction(clientX: number): number {
    const track = trackRef.current;
    if (!track) return 0;
    const r = track.getBoundingClientRect();
    if (r.width <= 0) return 0;
    return (clientX - r.left) / r.width;
  }

  function onTrackDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (expired) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    void seekToFraction(trackFraction(e.clientX));
  }
  function onTrackMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (expired) return;
    // Only react while the pointer is being captured (i.e. the user is
    // actively dragging). buttons === 0 means hover, not drag.
    if (e.buttons === 0) return;
    void seekToFraction(trackFraction(e.clientX));
  }

  // Autoplay: when a fresh clip arrives, the room dispatches `cya:voice-arrived`
  // with the new messageId. The matching player picks it up and starts.
  useEffect(() => {
    if (!autoplay || expired) return;
    function onArrived(e: Event) {
      const detail = (e as CustomEvent).detail as { messageId?: string } | undefined;
      if (!detail || detail.messageId !== messageId) return;
      void startPlayback();
    }
    window.addEventListener('cya:voice-arrived', onArrived);
    return () => window.removeEventListener('cya:voice-arrived', onArrived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, expired, messageId]);

  const disabled = expired || error;
  const pct = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const timeLabel = playing
    ? formatVoiceDuration(positionMs)
    : formatVoiceDuration(durationMs);

  return (
    <span
      className={`voice-row${disabled ? ' is-disabled' : ''}${playing ? ' is-playing' : ''}`}
      aria-label={expired ? 'voice clip expired' : error ? 'voice clip unavailable' : `voice clip ${formatVoiceDuration(durationMs)}`}
    >
      <button
        type="button"
        className="voice-row-play"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={playing ? 'pause voice message' : 'play voice message'}
      >
        <Icon
          name={playing ? 'pause' : expired ? 'mic-off' : 'play'}
          size={16}
        />
      </button>
      <div
        ref={trackRef}
        className="voice-row-track"
        role="slider"
        aria-label="seek"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(durationMs / 1000))}
        aria-valuenow={Math.max(0, Math.floor(positionMs / 1000))}
        aria-disabled={disabled}
        onPointerDown={disabled ? undefined : onTrackDown}
        onPointerMove={disabled ? undefined : onTrackMove}
      >
        <span className="voice-row-fill" style={{ width: `${pct}%` }} />
        <span className="voice-row-thumb" style={{ left: `${pct}%` }} />
      </div>
      <span className="voice-row-time">{timeLabel}</span>
    </span>
  );
}
