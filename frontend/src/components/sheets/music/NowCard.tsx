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
  /** Restart the current track. Wired to the progress bar — clicking
      anywhere on the bar jumps back to 0. No separate restart button. */
  onRestart: () => void;
  onNext: () => void;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
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
  onRestart,
  onNext,
  onChangeVolume,
  onToggleMute,
}: NowCardProps) {
  const meta = useYoutubeMeta(trackId);
  const pct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
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
      {/* Click anywhere on the bar to restart — replaces the per-row
          restart button from the old layout. */}
      <div
        className="music-bar"
        onClick={onRestart}
        title="restart"
        role="button"
        aria-label="restart"
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
