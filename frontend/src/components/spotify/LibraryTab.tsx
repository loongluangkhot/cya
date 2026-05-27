import { useEffect, useState } from 'react';
import { getMyAlbums, getMyPlaylists, type SpAlbum, type SpPlaylist } from '../../spotifyApi';
import { AlbumRow, PlaylistRow } from './rows';
import { DrillView } from './DrillView';
import type { Drill, Flash } from './shared';

export function LibraryTab({
  drill,
  setDrill,
  flash,
  onPlay,
  onAddToQueue,
  onPlayCollection,
  onQueueCollection,
}: {
  drill: Drill;
  setDrill: (d: Drill) => void;
  flash: Flash;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
  onPlayCollection: (flashKey: string, uris: string[]) => void;
  onQueueCollection: (flashKey: string, uris: string[]) => void;
}) {
  const [playlists, setPlaylists] = useState<SpPlaylist[] | null>(null);
  const [albums, setAlbums] = useState<SpAlbum[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMyPlaylists().catch((e: Error) => {
        if (!cancelled) setErr(e.message);
        return [];
      }),
      getMyAlbums().catch(() => []),
    ]).then(([pls, alb]) => {
      if (cancelled) return;
      setPlaylists(pls);
      setAlbums(alb);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (drill) {
    return (
      <DrillView
        drill={drill}
        onBack={() => setDrill(null)}
        flash={flash}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onPlayCollection={onPlayCollection}
        onQueueCollection={onQueueCollection}
      />
    );
  }

  if (!playlists || !albums) {
    return <div className="list-loading">loading library…</div>;
  }

  return (
    <div>
      {err && <small className="music-error">{err}</small>}
      <div className="music-section-label">your playlists · {playlists.length}</div>
      {playlists.length === 0 ? (
        <div className="search-empty">no playlists yet.</div>
      ) : (
        playlists.map((p) => (
          <PlaylistRow
            key={p.id}
            playlist={p}
            flash={flash}
            onOpen={() => setDrill({ kind: 'playlist', id: p.id, name: p.name, ownerId: p.owner?.id })}
            onPlayCollection={onPlayCollection}
            onQueueCollection={onQueueCollection}
          />
        ))
      )}
      <div className="music-section-label">saved albums · {albums.length}</div>
      {albums.length === 0 ? (
        <div className="search-empty">no saved albums.</div>
      ) : (
        albums.map((a) => (
          <AlbumRow
            key={a.id}
            album={a}
            flash={flash}
            onOpen={() => setDrill({ kind: 'album', id: a.id, name: a.name })}
            onPlayCollection={onPlayCollection}
            onQueueCollection={onQueueCollection}
          />
        ))
      )}
    </div>
  );
}
