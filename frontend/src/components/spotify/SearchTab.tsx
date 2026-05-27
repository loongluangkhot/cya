import { useEffect } from 'react';
import { searchSpotify } from '../../spotifyApi';
import { AlbumRow, PlaylistRow, TrackRow } from './rows';
import { DrillView } from './DrillView';
import type { Drill, Flash, SearchState } from './shared';

export function SearchTab({
  state,
  setState,
  drill,
  setDrill,
  flash,
  onPlay,
  onAddToQueue,
}: {
  state: SearchState;
  setState: (updater: (prev: SearchState) => SearchState) => void;
  drill: Drill;
  setDrill: (d: Drill) => void;
  flash: Flash;
  onPlay: (uri: string) => void;
  onAddToQueue: (uri: string) => void;
}) {
  const { query, lastSearchedQuery, results, loading, error: err } = state;

  // Debounced search — only fires when the trimmed query differs from the
  // one that produced the currently-cached results. So remounting the tab
  // with unchanged input doesn't trigger a refetch.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Empty input clears any prior results.
      if (results !== null || lastSearchedQuery !== '') {
        setState((s) => ({
          ...s,
          results: null,
          loading: false,
          error: null,
          lastSearchedQuery: '',
        }));
      }
      return;
    }
    if (trimmed === lastSearchedQuery && results !== null) {
      // Cached results match the input — skip.
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      searchSpotify(trimmed, ctrl.signal)
        .then((r) =>
          setState((s) => ({
            ...s,
            results: r,
            loading: false,
            lastSearchedQuery: trimmed,
          })),
        )
        .catch((e: Error) => {
          if (e.name !== 'AbortError') {
            setState((s) => ({ ...s, error: e.message, loading: false }));
          }
        });
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (drill) {
    return (
      <DrillView
        drill={drill}
        onBack={() => setDrill(null)}
        flash={flash}
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
      />
    );
  }

  return (
    <div>
      <input
        className="search-input"
        type="text"
        value={query}
        onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
        placeholder="search tracks, albums, playlists…"
      />
      {loading && <div className="list-loading">searching…</div>}
      {err && <small className="music-error">{err}</small>}
      {!loading && !query.trim() && (
        <div className="search-empty">type to search Spotify.</div>
      )}
      {results && !loading && (
        <>
          {results.tracks.length > 0 && (
            <>
              <div className="music-section-label">tracks</div>
              {results.tracks.map((t) => (
                <TrackRow key={t.id} track={t} flash={flash} onPlay={onPlay} onAddToQueue={onAddToQueue} />
              ))}
            </>
          )}
          {results.albums.length > 0 && (
            <>
              <div className="music-section-label">albums</div>
              {results.albums.map((a) => (
                <AlbumRow key={a.id} album={a} onOpen={() => setDrill({ kind: 'album', id: a.id, name: a.name })} />
              ))}
            </>
          )}
          {results.playlists.length > 0 && (
            <>
              <div className="music-section-label">playlists</div>
              {results.playlists.map((p) => (
                <PlaylistRow key={p.id} playlist={p} onOpen={() => setDrill({ kind: 'playlist', id: p.id, name: p.name, ownerId: p.owner?.id })} />
              ))}
            </>
          )}
          {results.tracks.length === 0 &&
            results.albums.length === 0 &&
            results.playlists.length === 0 && (
              <div className="search-empty">no results.</div>
            )}
        </>
      )}
    </div>
  );
}
