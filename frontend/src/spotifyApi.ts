// Thin client around the Spotify Web API. Each call grabs a fresh access
// token via getValidSpotifyToken() so refresh rotates transparently.

import { getValidSpotifyToken } from './spotifyAuth';

const BASE = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`spotify api ${status}: ${body || '(no body)'}`);
    this.status = status;
    this.body = body;
  }
}

async function spFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidSpotifyToken();
  if (!token) throw new SpotifyApiError(401, 'not connected to spotify');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(BASE + path, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SpotifyApiError(res.status, body);
  }
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface SpImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string; uri: string }[];
  album: { id: string; name: string; uri: string; images: SpImage[] };
}

export interface SpAlbum {
  id: string;
  uri: string;
  name: string;
  artists: { id: string; name: string; uri: string }[];
  images: SpImage[];
  total_tracks: number;
}

export interface SpPlaylist {
  id: string;
  uri: string;
  name: string;
  description: string;
  images: SpImage[];
  tracks: { total: number };
  owner: { id: string; display_name: string };
}

export interface Paginated<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SearchResponse {
  tracks?: { items: SpTrack[] };
  albums?: { items: SpAlbum[] };
  playlists?: { items: SpPlaylist[] };
}

// ─── Operations ──────────────────────────────────────────────────────

export function pickImage(images: SpImage[] | undefined, minSize = 60): SpImage | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted.find((i) => (i.width ?? 0) >= minSize) ?? sorted[sorted.length - 1];
}

function isValidTrack(t: unknown): t is SpTrack {
  if (!t || typeof t !== 'object') return false;
  const o = t as Partial<SpTrack>;
  return typeof o.uri === 'string' && o.uri.startsWith('spotify:track:') && typeof o.name === 'string';
}

function isValidAlbum(a: unknown): a is SpAlbum {
  if (!a || typeof a !== 'object') return false;
  const o = a as Partial<SpAlbum>;
  return typeof o.id === 'string' && typeof o.name === 'string';
}

function isValidPlaylist(p: unknown): p is SpPlaylist {
  if (!p || typeof p !== 'object') return false;
  const o = p as Partial<SpPlaylist>;
  return typeof o.id === 'string' && typeof o.name === 'string';
}

export async function searchSpotify(
  query: string,
  signal?: AbortSignal,
): Promise<{ tracks: SpTrack[]; albums: SpAlbum[]; playlists: SpPlaylist[] }> {
  if (!query.trim()) return { tracks: [], albums: [], playlists: [] };
  const params = new URLSearchParams({
    q: query.trim(),
    type: 'track,album,playlist',
    limit: '10',
  });
  const data = await spFetch<SearchResponse>(`/search?${params.toString()}`, { signal });
  return {
    tracks: (data.tracks?.items ?? []).filter(isValidTrack),
    albums: (data.albums?.items ?? []).filter(isValidAlbum),
    playlists: (data.playlists?.items ?? []).filter(isValidPlaylist),
  };
}

export async function getMyPlaylists(): Promise<SpPlaylist[]> {
  const data = await spFetch<Paginated<SpPlaylist>>('/me/playlists?limit=50');
  return (data.items ?? []).filter(isValidPlaylist);
}

export async function getMyAlbums(): Promise<SpAlbum[]> {
  const data = await spFetch<Paginated<{ album: SpAlbum }>>('/me/albums?limit=50');
  return (data.items ?? []).map((i) => i?.album).filter(isValidAlbum);
}

export async function getPlaylistTracks(playlistId: string): Promise<SpTrack[]> {
  const data = await spFetch<Paginated<{ track: SpTrack | null }>>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`,
  );
  return (data.items ?? [])
    .map((i) => i?.track)
    .filter(isValidTrack);
}

export async function getAlbumTracks(albumId: string): Promise<SpTrack[]> {
  // Album tracks endpoint returns simplified tracks (no album field); fetch
  // the album once and stitch.
  const album = await spFetch<SpAlbum>(`/albums/${encodeURIComponent(albumId)}`);
  const data = await spFetch<Paginated<Omit<SpTrack, 'album'>>>(
    `/albums/${encodeURIComponent(albumId)}/tracks?limit=50`,
  );
  return data.items.map((t) => ({ ...t, album }));
}

export async function getTrack(trackId: string): Promise<SpTrack> {
  return spFetch<SpTrack>(`/tracks/${encodeURIComponent(trackId)}`);
}

export function trackIdFromUri(uri: string): string | null {
  if (!uri.startsWith('spotify:track:')) return null;
  return uri.slice('spotify:track:'.length);
}
