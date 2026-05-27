import Icon from '../Icon';
import { pickImage, type SpAlbum, type SpPlaylist, type SpTrack } from '../../spotifyApi';
import { joinArtists, type Flash } from './shared';

export function TrackRow({
  track,
  flash,
  onPlay,
  onAddToQueue,
}: {
  track: SpTrack;
  flash: Flash;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}) {
  const art = pickImage(track.album?.images, 44);
  const isFlashing = flash?.uri === track.uri;
  const playFlash = isFlashing && flash.kind === 'play';
  const queueFlash = isFlashing && flash.kind === 'queue';
  return (
    <div className="spotify-row">
      {art ? (
        <img src={art.url} className="spotify-row-art" alt="" />
      ) : (
        <div className="spotify-row-art" />
      )}
      <div className="spotify-row-body">
        <div className="spotify-row-title">{track.name}</div>
        <div className="spotify-row-meta">{joinArtists(track.artists)}</div>
      </div>
      <div className="spotify-row-actions">
        <button
          type="button"
          className={`row-icon-btn primary${playFlash ? ' flashing' : ''}`}
          aria-label="play now"
          onClick={() => onPlay(track.uri)}
        >
          <Icon name={playFlash ? 'check' : 'play'} size={14} />
        </button>
        <button
          type="button"
          className={`row-icon-btn${queueFlash ? ' flashing' : ''}`}
          aria-label="add to queue"
          onClick={() => onAddToQueue(track.uri)}
        >
          <Icon name={queueFlash ? 'check' : 'queue-add'} size={14} />
        </button>
      </div>
    </div>
  );
}

export function AlbumRow({ album, onOpen }: { album: SpAlbum; onOpen: () => void }) {
  const art = pickImage(album.images, 44);
  return (
    <button type="button" className="spotify-tile" onClick={onOpen}>
      <div className="spotify-row">
        {art ? (
          <img src={art.url} className="spotify-row-art" alt="" />
        ) : (
          <div className="spotify-row-art" />
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{album.name}</div>
          <div className="spotify-row-meta">
            album · {joinArtists(album.artists)}
          </div>
        </div>
      </div>
    </button>
  );
}

export function PlaylistRow({ playlist, onOpen }: { playlist: SpPlaylist; onOpen: () => void }) {
  const art = pickImage(playlist.images, 44);
  const total = playlist.tracks?.total ?? 0;
  const owner = playlist.owner?.display_name ?? '';
  const meta = owner ? `${total} tracks · ${owner}` : `${total} tracks`;
  return (
    <button type="button" className="spotify-tile" onClick={onOpen}>
      <div className="spotify-row">
        {art ? (
          <img src={art.url} className="spotify-row-art" alt="" />
        ) : (
          <div className="spotify-row-art" />
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{playlist.name}</div>
          <div className="spotify-row-meta">{meta}</div>
        </div>
      </div>
    </button>
  );
}
