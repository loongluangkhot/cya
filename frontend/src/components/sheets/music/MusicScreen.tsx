import { NowCard } from './NowCard';
import { PasteBar } from './PasteBar';
import { QueueRow } from './QueueRow';
import type { MusicScreenProps } from './types';

export function MusicScreen(props: MusicScreenProps) {
  const {
    playback,
    queue,
    stageRef,
    playerMode,
    onChangePlayerMode,
    currentSec,
    durationSec,
    onTogglePlay,
    onRestart,
    onNext,
    onPlay,
    onAddToQueue,
    onPlayCollection,
    onAddManyToQueue,
    onRemoveFromQueue,
    onClearQueue,
    onExpandPlaylist,
  } = props;
  const trackId = playback.trackUri;

  return (
    <div>
      <div className="music-section-label">now playing</div>
      {trackId ? (
        <NowCard
          trackId={trackId}
          playerMode={playerMode}
          isPlaying={playback.isPlaying}
          currentSec={currentSec}
          durationSec={durationSec}
          stageRef={stageRef}
          hasNext={queue.length > 0}
          onTogglePlay={onTogglePlay}
          onRestart={onRestart}
          onNext={onNext}
          onChangePlayerMode={onChangePlayerMode}
        />
      ) : (
        <div className="yt-empty-now">
          nothing yet — paste a youtube link below to start.
        </div>
      )}

      <div className="music-section-head">
        <span className="music-section-label">search</span>
      </div>
      <PasteBar
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onPlayCollection={onPlayCollection}
        onAddManyToQueue={onAddManyToQueue}
        onExpandPlaylist={onExpandPlaylist}
      />

      <div className="music-section-head">
        <span className="music-section-label">queue · {queue.length}</span>
        {queue.length > 0 && (
          <button type="button" className="music-section-action" onClick={onClearQueue}>
            clear
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <div className="queue-empty">queue is empty.</div>
      ) : (
        <div>
          {queue.map((id, i) => (
            <QueueRow
              key={`${id}-${i}`}
              videoId={id}
              onPlay={() => onPlay(id)}
              onRemove={() => onRemoveFromQueue(id, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
