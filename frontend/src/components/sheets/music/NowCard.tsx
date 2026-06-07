import Icon from '../../Icon';
import { useYoutubeMeta } from '../../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../../youtube';
import { VolumeControl } from './VolumeControl';

interface NowCardProps {
  trackId: string;
  isPlaying: boolean;
  currentSec: number;
  durationSec: number;
  hasNext: boolean;
  volume: number;
  muted: boolean;
  onTogglePlay: () => void;
  /** Jump to a position (ms). The progress bar's click handler computes
      the target from the click X relative to the bar's bounds. */
  onSeek: (positionMs: number) => void;
  onNext: () => void;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowCard({
  trackId,
  isPlaying,
  currentSec,
  durationSec,
  hasNext,
  volume,
  muted,
  onTogglePlay,
  onSeek,
  onNext,
  onChangeVolume,
  onToggleMute,
}: NowCardProps) {
  const meta = useYoutubeMeta(trackId);
  const pct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
  const remainingSec = Math.max(0, durationSec - currentSec);

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (durationSec <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.floor(fraction * durationSec * 1000));
  }

  return (
    <div>
      <div className="music-now">
        <img
          src={meta.art || thumbUrl(trackId)}
          className="music-art-lg"
          alt=""
          style={{ objectFit: 'cover' }}
        />
        <div className="music-now-meta">
          <div className="music-now-title yt-clamp">{meta.title}</div>
          <div className="body-text yt-clamp">{meta.channel}</div>
        </div>
        <button
          type="button"
          className="row-icon-btn primary"
          aria-label={isPlaying ? 'pause' : 'play'}
          onClick={onTogglePlay}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
        </button>
        <button
          type="button"
          className="row-icon-btn ghost"
          aria-label="next"
          onClick={onNext}
          disabled={!hasNext}
        >
          <Icon name="next" size={15} />
        </button>
        <VolumeControl
          volume={volume}
          muted={muted}
          onChangeVolume={onChangeVolume}
          onToggleMute={onToggleMute}
        />
      </div>
      <div
        className="music-bar"
        onClick={handleBarClick}
        title="seek"
        role="slider"
        aria-label="seek"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.floor(durationSec))}
        aria-valuenow={Math.max(0, Math.floor(currentSec))}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="music-bar-times">
        <span>{fmtTime(currentSec)}</span>
        <span>-{fmtTime(remainingSec)}</span>
      </div>
    </div>
  );
}
