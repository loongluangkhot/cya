// YouTube URL parsing + light metadata helpers. The shared backend stores
// the 11-char video id in `trackUri`; clients translate between URLs and ids.

export const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export interface ParsedYouTube {
  kind: 'video' | 'playlist';
  /** Video id (11 chars) or playlist id. */
  id: string;
}

export function parseYouTube(raw: string): ParsedYouTube | null {
  const s = raw.trim();
  if (!s) return null;
  const listMatch = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  const vMatch = s.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  const shortMatch = s.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  const embedMatch = s.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
  // `/live/{id}` (live streams) and `/shorts/{id}` use the same id shape.
  const liveMatch = s.match(/\/(?:live|shorts)\/([a-zA-Z0-9_-]{6,})/);
  const hasVideoPath = !!vMatch || !!shortMatch || !!embedMatch || !!liveMatch;
  const isPlaylistUrl = /\/playlist\?/.test(s) || (!!listMatch && !hasVideoPath);
  if (isPlaylistUrl && listMatch) return { kind: 'playlist', id: listMatch[1] };
  const vid =
    (vMatch && vMatch[1]) ||
    (shortMatch && shortMatch[1]) ||
    (embedMatch && embedMatch[1]) ||
    (liveMatch && liveMatch[1]);
  if (vid && YT_ID_RE.test(vid)) return { kind: 'video', id: vid };
  if (YT_ID_RE.test(s)) return { kind: 'video', id: s };
  return null;
}

export function thumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

export interface YouTubeMeta {
  title: string;
  channel: string;
  art: string;
  /** False when oEmbed refused metadata for this id — a strong signal the
      IFrame embed will refuse playback too. Undefined while still loading. */
  available?: boolean;
}

/** Fetch oEmbed metadata. No API key required. */
export async function fetchYouTubeMeta(id: string): Promise<YouTubeMeta | null> {
  if (!YT_ID_RE.test(id)) return null;
  const target = `https://www.youtube.com/watch?v=${id}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: typeof data.title === 'string' ? data.title : 'YouTube video',
      channel: typeof data.author_name === 'string' ? data.author_name : '',
      art: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : thumbUrl(id),
      available: true,
    };
  } catch {
    return null;
  }
}

/** Same flow for a playlist URL. YouTube oEmbed handles `/playlist?list=…`
    and returns the playlist title + creator + cover thumbnail. */
export async function fetchYouTubePlaylistMeta(playlistId: string): Promise<YouTubeMeta | null> {
  const target = `https://www.youtube.com/playlist?list=${playlistId}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: typeof data.title === 'string' ? data.title : 'YouTube playlist',
      channel: typeof data.author_name === 'string' ? data.author_name : '',
      art: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
      available: true,
    };
  } catch {
    return null;
  }
}

export interface YouTubeExample {
  label: string;
  url: string;
}
