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
    onDisable,
    onExpandPlaylist,
  } = props;
  const trackId = playback.trackUri;

  return (
    <div>
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
          <div className="h-mono">now playing</div>
          <div className="body-text" style={{ marginTop: 6 }}>
            nothing yet — paste a youtube link below to start.
          </div>
        </div>
      )}

      <div className="music-section-label">add</div>
      <PasteBar
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onPlayCollection={onPlayCollection}
        onAddManyToQueue={onAddManyToQueue}
        onExpandPlaylist={onExpandPlaylist}
      />

      <div className="music-section-label" style={{ marginTop: 4 }}>
        up next · {queue.length}
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

      <div className="music-footer">
        {queue.length > 0 && (
          <button type="button" className="music-footer-link" onClick={onClearQueue}>
            clear queue
          </button>
        )}
        <button type="button" className="music-footer-link" onClick={onDisable}>
          turn off music
        </button>
      </div>
    </div>
  );
}
