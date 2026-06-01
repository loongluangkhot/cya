import type { RefObject } from 'react';
import Icon from '../../Icon';
import { useYoutubeMeta } from '../../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../../youtube';
import { ProgressBar } from './ProgressBar';
import { PlayerModeRow } from './PlayerModeRow';
import type { PlayerMode } from './types';

interface NowCardProps {
  trackId: string;
  playerMode: PlayerMode;
  isPlaying: boolean;
  currentSec: number;
  durationSec: number;
  stageRef: RefObject<HTMLDivElement>;
  hasNext: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onNext: () => void;
  onChangePlayerMode: (mode: PlayerMode) => void;
}

export function NowCard({
  trackId,
  playerMode,
  isPlaying,
  currentSec,
  durationSec,
  stageRef,
  hasNext,
  onTogglePlay,
  onRestart,
  onNext,
  onChangePlayerMode,
}: NowCardProps) {
  const meta = useYoutubeMeta(trackId);
  return (
    <div>
      {playerMode === 'theater' && (
        <div className="yt-theater">
          <div ref={stageRef} className="yt-theater-frame" />
        </div>
      )}
      <div className="music-now">
        <img
          src={meta.art || thumbUrl(trackId)}
          className="music-art-lg"
          alt=""
          style={{ objectFit: 'cover' }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div className="h-display yt-clamp" style={{ fontSize: 17 }}>
            {meta.title}
          </div>
          <div className="body-text yt-clamp">{meta.channel}</div>
        </div>
        <div className="music-now-controls">
          <button type="button" className="row-icon-btn" aria-label="restart" onClick={onRestart}>
            <Icon name="prev" size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn primary"
            aria-label={isPlaying ? 'pause' : 'play'}
            onClick={onTogglePlay}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn"
            aria-label="next"
            onClick={onNext}
            disabled={!hasNext}
            style={{ opacity: hasNext ? 1 : 0.4 }}
          >
            <Icon name="next" size={14} />
          </button>
        </div>
      </div>
      <div style={{ margin: '-8px 0 18px' }}>
        <ProgressBar cur={currentSec} dur={durationSec} />
      </div>
      <PlayerModeRow value={playerMode} onChange={onChangePlayerMode} />
    </div>
  );
}
