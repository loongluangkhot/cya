import type { PlaybackState } from '../../types';

export type Status = 'idle' | 'loading' | 'ready' | 'premium-required' | 'error';
export type Tab = 'now' | 'search' | 'library';
export type Drill = {
  kind: 'playlist' | 'album';
  id: string;
  name: string;
  ownerId?: string;
} | null;

// Brief visual confirmation when a row's primary action fires.
export type FlashKind = 'play' | 'queue';
export type Flash = { uri: string; kind: FlashKind } | null;

export interface SearchState {
  query: string;
  // The query string that produced the currently-cached `results`.
  // If query === lastSearchedQuery and results !== null, no fresh search
  // is fired on (re-)mount — the cached results render immediately.
  lastSearchedQuery: string;
  results: {
    tracks: import('../../spotifyApi').SpTrack[];
    albums: import('../../spotifyApi').SpAlbum[];
    playlists: import('../../spotifyApi').SpPlaylist[];
  } | null;
  loading: boolean;
  error: string | null;
}

export const INITIAL_SEARCH: SearchState = {
  query: '',
  lastSearchedQuery: '',
  results: null,
  loading: false,
  error: null,
};

export function effectivePosition(p: PlaybackState): number {
  const base = p.positionMs || 0;
  if (!p.isPlaying) return Math.max(0, Math.round(base));
  const elapsed = Math.max(0, Date.now() - (p.positionUpdatedAt || 0));
  return Math.max(0, Math.round(base + elapsed));
}

export function joinArtists(artists: { name?: string }[] | undefined): string {
  if (!artists || !Array.isArray(artists)) return '';
  return artists
    .map((a) => (a && typeof a.name === 'string' ? a.name : ''))
    .filter(Boolean)
    .join(', ');
}
