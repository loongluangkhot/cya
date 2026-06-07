import { forwardRef } from 'react';
import Icon from '../../Icon';
import { useYoutubeMeta } from '../../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../../youtube';

interface QueueRowProps {
  videoId: string;
  index: number;
  lifting: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onMoveTop: () => void;
  onGripDown: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onGripMove: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onGripUp: (e: React.PointerEvent<HTMLSpanElement>) => void;
}

/** A queue row in the new layout: drag grip on the far left, then art,
    title/channel, then a fixed 3-button cluster (move-to-top, play,
    remove). The duration column from the prototype is omitted — YT's
    oembed feed doesn't surface track lengths and fetching them per row
    would be a separate metadata pass. */
export const QueueRow = forwardRef<HTMLDivElement, QueueRowProps>(
  function QueueRow(
    { videoId, index, lifting, onPlay, onRemove, onMoveTop, onGripDown, onGripMove, onGripUp },
    ref,
  ) {
    const meta = useYoutubeMeta(videoId);
    const blocked = meta.available === false;
    return (
      <div className={`music-qrow${lifting ? ' lifting' : ''}`} ref={ref}>
        <div className="music-qbody">
          <span
            className="music-qgrip"
            title="drag to reorder"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            aria-label="reorder"
          >
            <Icon name="grip" size={16} />
          </span>
          <img src={meta.art || thumbUrl(videoId)} className="music-qart" alt="" />
          <div className="music-qmeta">
            <div className="music-qtitle yt-clamp">{meta.title}</div>
            <div className="music-qsub yt-clamp">
              {blocked ? "can't be played outside youtube" : meta.channel}
            </div>
          </div>
          <div className="music-qactions">
            <button
              type="button"
              className="row-icon-btn"
              title="move to top"
              aria-label="move to top"
              onClick={onMoveTop}
              disabled={index === 0}
            >
              <Icon name="totop" size={13} />
            </button>
            <button
              type="button"
              className="row-icon-btn"
              title="play now"
              aria-label="play now"
              onClick={onPlay}
              disabled={blocked}
            >
              <Icon name="play" size={13} />
            </button>
            <button
              type="button"
              className="row-icon-btn remove"
              title="remove from queue"
              aria-label="remove"
              onClick={onRemove}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  },
);
