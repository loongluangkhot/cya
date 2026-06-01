import { useEffect, useState } from 'react';
import { fetchYouTubeMeta, fetchYouTubePlaylistMeta, thumbUrl, type YouTubeMeta } from '../youtube';

type Kind = 'video' | 'playlist';

// One cache per kind so video and playlist IDs can't collide.
const caches: Record<Kind, Map<string, YouTubeMeta>> = {
  video: new Map(),
  playlist: new Map(),
};
const inflights: Record<Kind, Map<string, Promise<YouTubeMeta | null>>> = {
  video: new Map(),
  playlist: new Map(),
};

const fetchers: Record<Kind, (id: string) => Promise<YouTubeMeta | null>> = {
  video: fetchYouTubeMeta,
  playlist: fetchYouTubePlaylistMeta,
};

function useMeta(kind: Kind, id: string | null | undefined): YouTubeMeta {
  const [meta, setMeta] = useState<YouTubeMeta>(() => {
    if (id && caches[kind].has(id)) return caches[kind].get(id)!;
    return placeholder(kind, id);
  });

  useEffect(() => {
    if (!id) {
      setMeta(placeholder(kind, null));
      return;
    }
    const cached = caches[kind].get(id);
    if (cached) {
      setMeta(cached);
      return;
    }
    // Reset to the new id's placeholder so a stale fetch from the previous
    // id can't bleed into the UI while the new one is in flight.
    setMeta(placeholder(kind, id));
    let cancelled = false;
    let req = inflights[kind].get(id);
    if (!req) {
      req = fetchers[kind](id);
      inflights[kind].set(id, req);
    }
    req
      .then((m) => {
        inflights[kind].delete(id);
        if (cancelled) return;
        // Cache successes AND failures. Failures get the id-aware
        // placeholder marked unavailable, so we don't keep retrying a
        // 401/404 and so callers can disable play/queue actions.
        const final = m ?? { ...placeholder(kind, id), available: false };
        caches[kind].set(id, final);
        setMeta(final);
      })
      .catch(() => {
        inflights[kind].delete(id);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return meta;
}

export function useYoutubeMeta(id: string | null | undefined): YouTubeMeta {
  return useMeta('video', id);
}

export function useYoutubePlaylistMeta(id: string | null | undefined): YouTubeMeta {
  return useMeta('playlist', id);
}

function placeholder(kind: Kind, id: string | null | undefined): YouTubeMeta {
  if (kind === 'video') {
    return { title: 'YouTube video', channel: '', art: id ? thumbUrl(id) : '' };
  }
  return { title: 'YouTube playlist', channel: '', art: '' };
}
