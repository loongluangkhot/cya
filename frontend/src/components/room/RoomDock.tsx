import { type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Icon from '../Icon';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { formatVoiceDuration } from '../../hooks/useRoomState';
import type { UseSpotifyPlayerResult } from '../../hooks/useSpotifyPlayer';
import type { Ambient, PlaybackState } from '../../types';

interface RoomDockProps {
  ambient: Ambient;
  spotifyConnected: boolean;
  roomId: string;
  onSendVoice: (audio: ArrayBuffer, durationMs: number, mime: string) => void;
  playback: PlaybackState;
  playbackLabel: string;
  trackArt: string | undefined;
  trackTitle: string | undefined;
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

export function computeDockPlaybackLabel(
  playback: PlaybackState,
  player: UseSpotifyPlayerResult,
): string {
  // Users who haven't connected Spotify can't hear anything, so the chip
  // is purely a CTA — don't leak what others in the room are playing.
  if (!player.connected) return 'connect spotify';
  if (!playback.trackUri) return 'tap to set a track';
  // While the local SDK is still spinning up, the room's "playing" state
  // hasn't translated into audio yet — say so. Once status resolves
  // (ready / premium-required / error), trust the room state: users
  // without Premium can never make the SDK report local playback, and
  // we don't want the chip stuck on "starting…" for them.
  const sdkSpinningUp = player.status === 'idle' || player.status === 'loading';
  if (sdkSpinningUp && playback.isPlaying) return 'starting…';
  return playback.isPlaying ? 'playing' : 'paused';
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
  spotifyConnected,
  onSendVoice,
  playback,
  playbackLabel,
  trackArt,
  trackTitle,
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
  // Only surface the track to users who can actually hear it. Otherwise
  // the chip degrades into a "connect spotify" CTA.
  const showTrack = spotifyConnected && !!playback.trackUri;
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
              <img
                src={trackArt}
                className="dock-chip-art"
                alt=""
                style={{ objectFit: 'cover' }}
              />
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
              <div className="dock-chip-meta">{playbackLabel}</div>
            </div>
          </button>
          {showTrack && (
            <div className="dock-chip-controls">
              <button
                type="button"
                className="dock-chip-ctrl"
                aria-label="previous"
                onClick={onPrev}
              >
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
