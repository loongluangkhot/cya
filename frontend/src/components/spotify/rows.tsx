import { useState } from 'react';
import Icon from '../Icon';
import {
  getAlbumTracks,
  getPlaylistTracks,
  pickImage,
  type SpAlbum,
  type SpPlaylist,
  type SpTrack,
} from '../../spotifyApi';
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

// ─────────────────────────────────────────────────────────────────────
// Collection rows — Album & Playlist
//
// The body region (art + title + meta) is a button that drills into the
// collection's track list. The two action icons resolve the track list
// inline and bulk-emit play/queue. While the fetch is in flight we show
// a tiny loading state on the pressed button.
// ─────────────────────────────────────────────────────────────────────

function CollectionRow({
  art,
  title,
  meta,
  uri,
  flash,
  onOpen,
  fetchUris,
  onPlayCollection,
  onQueueCollection,
}: {
  art: { url: string } | null;
  title: string;
  meta: string;
  uri: string;
  flash: Flash;
  onOpen: () => void;
  fetchUris: () => Promise<string[]>;
  onPlayCollection: (flashKey: string, uris: string[]) => void;
  onQueueCollection: (flashKey: string, uris: string[]) => void;
}) {
  const [busy, setBusy] = useState<'play' | 'queue' | null>(null);
  const flashing = flash?.uri === uri;
  const playFlash = flashing && flash?.kind === 'play';
  const queueFlash = flashing && flash?.kind === 'queue';

  async function fire(kind: 'play' | 'queue') {
    if (busy) return;
    setBusy(kind);
    try {
      const uris = await fetchUris();
      if (uris.length === 0) return;
      if (kind === 'play') onPlayCollection(uri, uris);
      else onQueueCollection(uri, uris);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="spotify-row">
      <button type="button" className="spotify-row-open" onClick={onOpen} aria-label={`open ${title}`}>
        {art ? (
          <img src={art.url} className="spotify-row-art" alt="" />
        ) : (
          <div className="spotify-row-art" />
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{title}</div>
          <div className="spotify-row-meta">{meta}</div>
        </div>
      </button>
      <div className="spotify-row-actions">
        <button
          type="button"
          className={`row-icon-btn primary${playFlash ? ' flashing' : ''}`}
          aria-label="play all"
          onClick={() => fire('play')}
          disabled={busy !== null}
        >
          <Icon name={playFlash ? 'check' : 'play'} size={14} />
        </button>
        <button
          type="button"
          className={`row-icon-btn${queueFlash ? ' flashing' : ''}`}
          aria-label="add all to queue"
          onClick={() => fire('queue')}
          disabled={busy !== null}
        >
          <Icon name={queueFlash ? 'check' : 'queue-add'} size={14} />
        </button>
      </div>
    </div>
  );
}

async function safeUris(fetcher: () => Promise<SpTrack[]>): Promise<string[]> {
  try {
    const tracks = await fetcher();
    return tracks.map((t) => t.uri).filter(Boolean);
  } catch {
    return [];
  }
}

export function AlbumRow({
  album,
  flash,
  onOpen,
  onPlayCollection,
  onQueueCollection,
}: {
  album: SpAlbum;
  flash: Flash;
  onOpen: () => void;
  onPlayCollection: (flashKey: string, uris: string[]) => void;
  onQueueCollection: (flashKey: string, uris: string[]) => void;
}) {
  return (
    <CollectionRow
      art={pickImage(album.images, 44)}
      title={album.name}
      meta={`album · ${joinArtists(album.artists)}`}
      uri={album.uri}
      flash={flash}
      onOpen={onOpen}
      fetchUris={() => safeUris(() => getAlbumTracks(album.id))}
      onPlayCollection={onPlayCollection}
      onQueueCollection={onQueueCollection}
    />
  );
}

export function PlaylistRow({
  playlist,
  flash,
  onOpen,
  onPlayCollection,
  onQueueCollection,
}: {
  playlist: SpPlaylist;
  flash: Flash;
  onOpen: () => void;
  onPlayCollection: (flashKey: string, uris: string[]) => void;
  onQueueCollection: (flashKey: string, uris: string[]) => void;
}) {
  const total = playlist.tracks?.total ?? 0;
  const owner = playlist.owner?.display_name ?? '';
  const meta = owner ? `${total} tracks · ${owner}` : `${total} tracks`;
  return (
    <CollectionRow
      art={pickImage(playlist.images, 44)}
      title={playlist.name}
      meta={meta}
      uri={playlist.uri}
      flash={flash}
      onOpen={onOpen}
      fetchUris={() => safeUris(() => getPlaylistTracks(playlist.id))}
      onPlayCollection={onPlayCollection}
      onQueueCollection={onQueueCollection}
    />
  );
}
