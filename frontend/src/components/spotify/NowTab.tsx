import Icon from '../Icon';
import { pickImage, type SpTrack } from '../../spotifyApi';
import type { PlaybackState } from '../../types';
import { joinArtists, type Flash } from './shared';

export function NowTab({
  playback,
  paused,
  queue,
  trackCache,
  flash,
  onPlay,
  onTogglePlay,
  onNext,
  onRemoveFromQueue,
  canControl,
}: {
  playback: PlaybackState;
  paused: boolean;
  queue: string[];
  trackCache: Record<string, SpTrack>;
  flash: Flash;
  onPlay: (uri: string) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onRemoveFromQueue: (uri: string, index: number) => void;
  canControl: boolean;
}) {
  const current = playback.trackUri ? trackCache[playback.trackUri] : null;
  const art = current ? pickImage(current.album.images, 80) : null;

  return (
    <div>
      {current ? (
        <div className="music-now">
          {art ? (
            <img src={art.url} className="music-art-lg" alt="" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="music-art-lg" />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div className="h-mono">now playing</div>
            <div
              className="h-display"
              style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {current.name}
            </div>
            <div
              className="body-text"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {joinArtists(current.artists)}
            </div>
          </div>
          {playback.trackUri && canControl && (
            <div className="music-now-controls">
              <button
                type="button"
                className="row-icon-btn primary"
                aria-label={paused ? 'play' : 'pause'}
                onClick={onTogglePlay}
              >
                <Icon name={paused ? 'play' : 'pause'} size={14} />
              </button>
              <button
                type="button"
                className="row-icon-btn"
                aria-label="next"
                onClick={onNext}
                disabled={queue.length === 0}
                style={{ opacity: queue.length === 0 ? 0.4 : 1 }}
              >
                <Icon name="next" size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="queue-empty">nothing playing yet — search or browse your library to start something.</div>
      )}

      <div className="music-section-label">up next · {queue.length}</div>
      {queue.length === 0 ? (
        <div className="queue-empty">queue is empty.</div>
      ) : (
        <div>
          {queue.map((uri, i) => {
            const t = trackCache[uri];
            const rowArt = t ? pickImage(t.album?.images, 44) : null;
            const playFlashing = flash?.uri === uri && flash.kind === 'play';
            return (
              <div className="spotify-row" key={`${uri}-${i}`}>
                {rowArt ? (
                  <img src={rowArt.url} className="spotify-row-art" alt="" />
                ) : (
                  <div className="spotify-row-art" />
                )}
                <div className="spotify-row-body">
                  <div className="spotify-row-title">{t?.name ?? 'loading…'}</div>
                  <div className="spotify-row-meta">{t ? joinArtists(t.artists) : ''}</div>
                </div>
                <div className="spotify-row-actions">
                  <button
                    type="button"
                    className={`row-icon-btn primary${playFlashing ? ' flashing' : ''}`}
                    aria-label="play now"
                    onClick={() => {
                      onPlay(uri);
                      onRemoveFromQueue(uri, i);
                    }}
                  >
                    <Icon name={playFlashing ? 'check' : 'play'} size={14} />
                  </button>
                  <button
                    type="button"
                    className="row-icon-btn"
                    aria-label="remove"
                    onClick={() => onRemoveFromQueue(uri, i)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
