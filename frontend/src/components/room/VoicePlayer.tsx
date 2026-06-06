import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { API_BASE } from '../../api';
import { formatVoiceDuration } from '../../hooks/useRoomState';

interface VoicePlayerProps {
  roomId: string;
  messageId: string;
  durationMs: number;
  mime: string;
  expired: boolean;
  /** Smaller variant for the IRC log overlay. */
  compact?: boolean;
  /** When true, this player starts playback on the `cya:voice-arrived` event
   *  whose detail.messageId matches its own — used by the IRC log to
   *  autoplay freshly-arrived clips. */
  autoplay?: boolean;
}

// Module-scoped "active player" slot. A voice clip starts by stopping
// whoever's currently in this slot, then claiming it. We keep the
// previous player's `release` fn so it can update its own UI to paused.
let activeVoiceRelease: (() => void) | null = null;

export function VoicePlayer({ roomId, messageId, durationMs, mime, expired, compact, autoplay }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
        clearSlotIfMine();
      };
      el.onerror = () => {
        setError(true);
        setPlaying(false);
        clearSlotIfMine();
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

  async function toggle() {
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

  const label = expired
    ? 'voice clip expired'
    : error
      ? 'voice clip unavailable'
      : `voice ${formatVoiceDuration(durationMs)}`;
  return (
    <button
      type="button"
      className={`voice-row${compact ? ' is-compact' : ''}${expired || error ? ' is-expired' : ''}${playing ? ' is-playing' : ''}`}
      onClick={toggle}
      disabled={expired || error}
      aria-label={expired ? 'voice clip expired' : playing ? 'pause voice message' : 'play voice message'}
    >
      <Icon name={playing ? 'pause' : expired ? 'mic-off' : 'play'} size={compact ? 11 : 14} />
      <span>{label}</span>
    </button>
  );
}
