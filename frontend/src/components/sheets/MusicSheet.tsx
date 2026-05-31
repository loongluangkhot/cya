import SpotifyPlayer from '../SpotifyPlayer';
import ErrorBoundary from '../ErrorBoundary';
import { Sheet } from './Sheet';
import type { UseSpotifyPlayerResult } from '../../hooks/useSpotifyPlayer';
import type { PlaybackState } from '../../types';

interface MusicSheetProps {
  open: boolean;
  onClose: () => void;
  player: UseSpotifyPlayerResult;
  playback: PlaybackState;
  queue: string[];
  onRemoveFromQueue: (uri: string, index: number) => void;
  onClearQueue: () => void;
}

export function MusicSheet({
  open,
  onClose,
  player,
  playback,
  queue,
  onRemoveFromQueue,
  onClearQueue,
}: MusicSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="music" tall>
      <ErrorBoundary
        fallback={(err, reset) => (
          <div>
            <div className="h-display" style={{ fontSize: 18, marginBottom: 10 }}>
              spotify panel crashed
            </div>
            <div className="body-text" style={{ marginBottom: 12 }}>{err.message}</div>
            <button type="button" className="btn" onClick={reset}>
              try again
            </button>
          </div>
        )}
      >
        <SpotifyPlayer
          player={player}
          playback={playback}
          queue={queue}
          onRemoveFromQueue={onRemoveFromQueue}
          onClearQueue={onClearQueue}
        />
      </ErrorBoundary>
    </Sheet>
  );
}
