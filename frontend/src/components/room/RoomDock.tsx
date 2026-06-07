import { useEffect, useState, type FormEvent } from 'react';
import Icon from '../Icon';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { formatVoiceDuration } from '../../hooks/useRoomState';
import type { Ambient, PlaybackState } from '../../types';

interface RoomDockProps {
  ambient: Ambient;
  roomId: string;
  onSendVoice: (audio: ArrayBuffer, durationMs: number, mime: string) => void;
  playback: PlaybackState;
  /** True once the local user has opted into music. */
  musicEnabled: boolean;
  trackArt: string | undefined;
  trackTitle: string | undefined;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onOpenMusic: () => void;
  onOpenAmbience: () => void;
  onOpenMinds: () => void;
  onOpenChat: () => void;
  onTogglePlay: () => void;
  mugshotOptIn: boolean;
  onOpenMugshot: () => void;
  /** ms timestamp of the next scheduled mugshot prompt. */
  mugshotNextAt: number;
  mugshotIntervalS: number;
  marqueeOptIn: boolean;
  marqueeStripOn: boolean;
  onOpenMarquee: () => void;
}

function ambientGlyph(a: Ambient): string {
  if (a.weather === 'rain') return '☂';
  if (a.weather === 'snow') return '❄';
  if (a.weather === 'fog') return '≈';
  if (a.time === 'night') return '☾';
  if (a.time === 'dawn') return '☀';
  if (a.time === 'dusk') return '☉';
  return '☀';
}

interface MugshotGlyphProps {
  optIn: boolean;
  nextAt: number;
  intervalS: number;
  onOpen: () => void;
}

/** Single glyph button. When opted in: a 1Hz-ticking countdown ring
 *  around a center dot. When opted out: a static hollow ring so it's
 *  visibly "off" but still tappable as the path back into the sheet. */
function MugshotGlyph({ optIn, nextAt, intervalS, onOpen }: MugshotGlyphProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // No ticker when opted out — nothing to count down toward.
    if (!optIn) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [optIn]);

  const size = 18;
  const r = 7;
  const c = 2 * Math.PI * r;

  if (!optIn) {
    return (
      <button
        type="button"
        className="dock-glyph is-off"
        onClick={onOpen}
        aria-label="mugshot · off"
        title="mugshot · off — tap to join the wall"
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 18 18"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <circle
            cx="9"
            cy="9"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
      </button>
    );
  }

  const totalMs = Math.max(1, intervalS * 1000);
  const remainingMs = Math.max(0, nextAt - now);
  const elapsed = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
  const remainingMin = Math.ceil(remainingMs / 60_000);
  const title =
    remainingMs <= 0
      ? 'mugshot · prompt due'
      : remainingMs < 60_000
        ? `mugshot · next in ${Math.ceil(remainingMs / 1000)}s`
        : `mugshot · next in ${remainingMin}m`;

  return (
    <button
      type="button"
      className="dock-glyph is-active"
      onClick={onOpen}
      aria-label={title}
      title={title}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - elapsed)}
          transform="rotate(-90 9 9)"
        />
        <circle cx="9" cy="9" r="2" fill="currentColor" />
      </svg>
    </button>
  );
}

export function RoomDock({
  ambient,
  onSendVoice,
  playback,
  musicEnabled,
  trackArt,
  trackTitle,
  draft,
  setDraft,
  onSend,
  onOpenMusic,
  onOpenAmbience,
  onOpenMinds,
  onOpenChat,
  onTogglePlay,
  mugshotOptIn,
  onOpenMugshot,
  mugshotNextAt,
  mugshotIntervalS,
  marqueeOptIn,
  marqueeStripOn,
  onOpenMarquee,
}: RoomDockProps) {
  const showTrack = musicEnabled && !!playback.trackUri;
  const recorder = useVoiceRecorder();
  const recording = recorder.status === 'recording';

  function submit(e: FormEvent) {
    e.preventDefault();
    onSend(draft);
  }

  // Click-to-toggle: first click starts recording, second click stops
  // and sends. Press-and-hold proved unreliable on iOS Safari (pointer
  // capture + system gesture promotion swallowed the release events).
  async function onMicClick() {
    if (recorder.status === 'requesting') return;
    if (recording) {
      const clip = await recorder.stop();
      if (clip) onSendVoice(clip.audio, clip.durationMs, clip.mime);
    } else {
      await recorder.start();
    }
  }

  return (
    <form className="dock" onSubmit={submit}>
      {/* Peek-state row — single-glyph buttons; each opens its sheet for full controls. */}
      <div className="dock-glyphs">
        <button
          type="button"
          className="dock-glyph"
          onClick={onOpenAmbience}
          aria-label={`ambience · ${ambient.weather} · ${ambient.time}`}
          title={`ambience · ${ambient.weather} · ${ambient.time}`}
        >
          <span className="dock-glyph-char">{ambientGlyph(ambient)}</span>
        </button>
        <button
          type="button"
          className="dock-glyph"
          onClick={onOpenMinds}
          aria-label="minds"
          title="minds"
        >
          <span className="dock-glyph-char">✺</span>
        </button>
        <button
          type="button"
          className={`dock-glyph${musicEnabled ? ' is-active' : ''}`}
          onClick={onOpenMusic}
          aria-label="music"
          title={
            musicEnabled
              ? showTrack
                ? `music · ${trackTitle || 'playing'}`
                : 'music · on'
              : 'music · off'
          }
        >
          <Icon name="music" size={16} />
        </button>
        <MugshotGlyph
          optIn={mugshotOptIn}
          nextAt={mugshotNextAt}
          intervalS={mugshotIntervalS}
          onOpen={onOpenMugshot}
        />
        <button
          type="button"
          className={`dock-glyph${marqueeOptIn && marqueeStripOn ? ' is-active' : ''}${!marqueeOptIn ? ' is-off' : ''}`}
          onClick={onOpenMarquee}
          aria-label={marqueeOptIn ? 'marquee' : 'marquee · off'}
          title={
            marqueeOptIn
              ? marqueeStripOn
                ? 'marquee · on'
                : 'marquee · strip hidden'
              : 'marquee · off'
          }
        >
          <Icon name="marquee" size={16} />
        </button>
      </div>

      {/* Now-playing ticker — only visible when music is playing. Keeps
          play/pause inline (the most-common in-flight action); next /
          restart / room-video toggle move into the music sheet. */}
      {showTrack && (
        <div className="dock-ticker">
          {trackArt ? (
            <img src={trackArt} className="dock-ticker-art" alt="" />
          ) : (
            <div className="dock-ticker-art dock-ticker-art-empty" aria-hidden="true" />
          )}
          <button
            type="button"
            className="dock-ticker-title"
            onClick={onOpenMusic}
            title="open music"
          >
            {trackTitle || 'now playing'}
          </button>
          <button
            type="button"
            className="dock-chip-ctrl primary"
            aria-label={playback.isPlaying ? 'pause' : 'play'}
            onClick={onTogglePlay}
          >
            <Icon name={playback.isPlaying ? 'pause' : 'play'} size={12} />
          </button>
        </div>
      )}

      <div className="composer">
        {recording ? (
          <div className="composer-input is-recording" aria-live="polite">
            <span className="rec-dot" aria-hidden="true" />
            <span>recording… {formatVoiceDuration(recorder.elapsedMs)}</span>
            <span className="rec-hint">tap mic to send</span>
          </div>
        ) : (
          <input
            className="composer-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="say something…"
            maxLength={200}
            disabled={recorder.status === 'requesting'}
          />
        )}
        <button
          type="button"
          className="composer-btn"
          aria-label="open log"
          onClick={onOpenChat}
          disabled={recording}
        >
          <Icon name="chat" size={18} />
        </button>
        {draft.trim() ? (
          <button type="submit" className="composer-btn is-send" aria-label="send">
            <Icon name="send" size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={`composer-btn is-mic${recording ? ' is-recording' : ''}`}
            aria-label={recording ? 'stop and send voice message' : 'record voice message'}
            onClick={onMicClick}
            disabled={recorder.status === 'requesting'}
          >
            <Icon name="mic" size={16} />
          </button>
        )}
      </div>
      {recorder.status === 'denied' && (
        <div className="composer-error">microphone access denied — check browser permissions</div>
      )}
      {recorder.status === 'unsupported' && (
        <div className="composer-error">voice messages aren't supported in this browser</div>
      )}
      {recorder.status === 'idle' && recorder.lastError && (
        <div className="composer-error">{recorder.lastError}</div>
      )}
    </form>
  );
}
