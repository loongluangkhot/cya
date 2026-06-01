import { type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '../Icon';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { formatVoiceDuration } from '../../hooks/useRoomState';
import type { Ambient, PlaybackState } from '../../types';

interface RoomDockProps {
  ambient: Ambient;
  roomId: string;
  onSendVoice: (audio: ArrayBuffer, durationMs: number, mime: string) => void;
  playback: PlaybackState;
  playbackMeta: string;
  /** True once the local user has opted into music. */
  musicEnabled: boolean;
  trackArt: string | undefined;
  trackTitle: string | undefined;
  /** Player is in audio-only mode — hide the "watch in room" toggle. */
  audioOnly: boolean;
  /** Room video surface is currently visible (placement != off). */
  roomVideoOn: boolean;
  onToggleRoomVideo: () => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onOpenMusic: () => void;
  onOpenAmbience: () => void;
  onOpenMinds: () => void;
  onOpenChat: () => void;
  hasQueue: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
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

export function RoomDock({
  ambient,
  onSendVoice,
  playback,
  playbackMeta,
  musicEnabled,
  trackArt,
  trackTitle,
  audioOnly,
  roomVideoOn,
  onToggleRoomVideo,
  draft,
  setDraft,
  onSend,
  onOpenMusic,
  onOpenAmbience,
  onOpenMinds,
  onOpenChat,
  hasQueue,
  onPrev,
  onTogglePlay,
  onNext,
}: RoomDockProps) {
  const showTrack = musicEnabled && !!playback.trackUri;
  const recorder = useVoiceRecorder();
  const recording = recorder.status === 'recording';

  function submit(e: FormEvent) {
    e.preventDefault();
    onSend(draft);
  }
  async function micDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    await recorder.start();
  }
  async function micUp() {
    if (!recording) {
      recorder.cancel();
      return;
    }
    const clip = await recorder.stop();
    if (clip) onSendVoice(clip.audio, clip.durationMs, clip.mime);
  }
  function micCancel() {
    recorder.cancel();
  }
  return (
    <form className="dock" onSubmit={submit}>
      <div className="dock-chips">
        <div className="dock-chip dock-chip-music">
          <button type="button" className="dock-chip-open" onClick={onOpenMusic}>
            {showTrack && trackArt ? (
              <img src={trackArt} className="dock-chip-art" alt="" style={{ objectFit: 'cover' }} />
            ) : (
              <div
                className="dock-chip-art"
                style={{ background: 'linear-gradient(135deg, #2b2118 0%, #b54822 100%)' }}
              />
            )}
            <div className="dock-chip-text">
              <div className="dock-chip-title">
                {showTrack ? (trackTitle || 'now playing') : 'music'}
              </div>
              <div className="dock-chip-meta">{playbackMeta}</div>
            </div>
          </button>
          {showTrack && (
            <div className="dock-chip-controls">
              {!audioOnly && (
                <button
                  type="button"
                  className={`dock-chip-ctrl${roomVideoOn ? ' primary' : ''}`}
                  aria-label={roomVideoOn ? 'hide video' : 'watch video'}
                  aria-pressed={roomVideoOn}
                  title={roomVideoOn ? 'hide video' : 'watch in room'}
                  onClick={onToggleRoomVideo}
                >
                  <Icon name="screen" size={12} />
                </button>
              )}
              <button type="button" className="dock-chip-ctrl" aria-label="restart" onClick={onPrev}>
                <Icon name="prev" size={12} />
              </button>
              <button
                type="button"
                className="dock-chip-ctrl primary"
                aria-label={playback.isPlaying ? 'pause' : 'play'}
                onClick={onTogglePlay}
              >
                <Icon name={playback.isPlaying ? 'pause' : 'play'} size={12} />
              </button>
              <button
                type="button"
                className="dock-chip-ctrl"
                aria-label="next"
                onClick={onNext}
                disabled={!hasQueue}
              >
                <Icon name="next" size={12} />
              </button>
            </div>
          )}
        </div>
        <button type="button" className="dock-chip compact" onClick={onOpenAmbience} aria-label="ambience">
          <span className="dock-chip-glyph">{ambientGlyph(ambient)}</span>
          <span className="dock-chip-meta" style={{ fontWeight: 700 }}>{ambient.time}</span>
        </button>
        <button
          type="button"
          className="dock-chip compact dock-chip-minds"
          onClick={onOpenMinds}
          aria-label="on everyone's mind"
        >
          <span className="dock-chip-glyph">✺</span>
          <span className="dock-chip-meta" style={{ fontWeight: 700 }}>minds</span>
        </button>
      </div>
      <div className="composer">
        {recording ? (
          <div className="composer-input is-recording" aria-live="polite">
            <span className="rec-dot" aria-hidden="true" />
            <span>recording… {formatVoiceDuration(recorder.elapsedMs)}</span>
            <span className="rec-hint">release to send</span>
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
            aria-label={recording ? 'release to send voice message' : 'hold to record voice message'}
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={micCancel}
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
    </form>
  );
}
