import Icon from '../../Icon';
import { useYoutubeMeta } from '../../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../../youtube';

export function QueueRow({
  videoId,
  onPlay,
  onRemove,
}: {
  videoId: string;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const meta = useYoutubeMeta(videoId);
  const blocked = meta.available === false;
  return (
    <div className="spotify-row">
      <img src={meta.art || thumbUrl(videoId)} className="spotify-row-art" alt="" />
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
        <button type="button" className="row-icon-btn" aria-label="remove" onClick={onRemove}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}
