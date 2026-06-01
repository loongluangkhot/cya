import { useEffect, useState } from 'react';
import { API_BASE } from '../api';
import type { YouTubeExample } from '../youtube';

// Process-wide cache. The examples list rarely changes — env-driven on
// the backend — so a single fetch per page load is plenty.
let cache: YouTubeExample[] | null = null;
let inflight: Promise<YouTubeExample[]> | null = null;

async function loadExamples(): Promise<YouTubeExample[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(`${API_BASE}/api/youtube/examples`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
    .then((data: { examples?: unknown }) => {
      const raw = Array.isArray(data.examples) ? data.examples : [];
      const out: YouTubeExample[] = [];
      for (const item of raw) {
        if (
          item &&
          typeof item === 'object' &&
          typeof (item as YouTubeExample).label === 'string' &&
          typeof (item as YouTubeExample).url === 'string'
        ) {
          out.push({
            label: (item as YouTubeExample).label,
            url: (item as YouTubeExample).url,
          });
        }
      }
      cache = out;
      return out;
    })
    .catch(() => {
      // Server unreachable or bad response — fall back to an empty list so
      // the input still works; chips just don't render.
      cache = [];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useYoutubeExamples(): YouTubeExample[] {
  const [examples, setExamples] = useState<YouTubeExample[]>(() => cache ?? []);

  useEffect(() => {
    let cancelled = false;
    loadExamples().then((list) => {
      if (!cancelled) setExamples(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return examples;
}
