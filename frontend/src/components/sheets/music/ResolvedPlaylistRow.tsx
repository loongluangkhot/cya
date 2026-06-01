import Icon from '../../Icon';
import { useYoutubePlaylistMeta } from '../../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../../youtube';

export function ResolvedPlaylistRow({
  playlistId,
  videoIds,
  onPlayAll,
  onQueueAll,
}: {
  playlistId: string;
  videoIds: string[];
  onPlayAll: () => void;
  onQueueAll: () => void;
}) {
  const meta = useYoutubePlaylistMeta(playlistId);
  // YouTube oEmbed doesn't always return a playlist thumbnail; fall back
  // to the first video's mqdefault as the cover.
  const art = meta.art || (videoIds[0] ? thumbUrl(videoIds[0]) : '');
  return (
    <div>
      <div className="music-section-label">found a playlist</div>
      <div className="spotify-row">
        {art ? (
          <img src={art} className="spotify-row-art" alt="" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="spotify-row-art yt-pl-art">
            <Icon name="list" size={20} />
          </div>
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{meta.title}</div>
          <div className="spotify-row-meta">
            {meta.channel ? `${meta.channel} · ` : ''}
            {videoIds.length} videos
          </div>
        </div>
        <div className="spotify-row-actions">
          <button type="button" className="row-icon-btn primary" aria-label="play all" onClick={onPlayAll}>
            <Icon name="play" size={14} />
          </button>
          <button type="button" className="row-icon-btn" aria-label="queue all" onClick={onQueueAll}>
            <Icon name="queue-add" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
