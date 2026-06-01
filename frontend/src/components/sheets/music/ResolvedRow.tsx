import Icon from '../../Icon';
import { useYoutubeMeta } from '../../../hooks/useYoutubeMeta';

export function ResolvedRow({
  title,
  art,
  videoId,
  onPlay,
  onQueue,
}: {
  title: string;
  art: string;
  videoId: string;
  onPlay: () => void;
  onQueue: () => void;
}) {
  const meta = useYoutubeMeta(videoId);
  const blocked = meta.available === false;
  return (
    <div>
      <div className="music-section-label">{title}</div>
      <div className="spotify-row">
        <img src={meta.art || art} className="spotify-row-art" alt="" />
        <div className="spotify-row-body">
          <div className="spotify-row-title">{meta.title}</div>
          <div className="spotify-row-meta">
            {blocked ? "can't be played outside youtube" : meta.channel}
          </div>
        </div>
        <div className="spotify-row-actions">
          <button
            type="button"
            className="row-icon-btn primary"
            aria-label="play now"
            onClick={onPlay}
            disabled={blocked}
            style={{ opacity: blocked ? 0.4 : 1 }}
          >
            <Icon name="play" size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn"
            aria-label="add to queue"
            onClick={onQueue}
            disabled={blocked}
            style={{ opacity: blocked ? 0.4 : 1 }}
          >
            <Icon name="queue-add" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
