import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../api';
import type { MarqueeFeed, MarqueeItem } from '../types';
import { useStoredState } from './useStoredState';

const OPT_IN_KEY = 'cya:marquee:opt-in:v1';
const STRIP_KEY = 'cya:marquee:strip:v1';
const USER_FEEDS_KEY = 'cya:marquee:user-feeds:v1';
const MUTED_KEY = 'cya:marquee:muted:v1';

const USER_REFRESH_MS = 5 * 60 * 1000;
const MERGED_ITEMS_CAP = 60;
const USER_FEED_MAX = 10;

function isBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function isUserFeedList(v: unknown): MarqueeFeed[] | null {
  if (!Array.isArray(v)) return null;
  const out: MarqueeFeed[] = [];
  for (const e of v) {
    if (!e || typeof e !== 'object') return null;
    const url = (e as { url?: unknown }).url;
    const title = (e as { title?: unknown }).title;
    if (typeof url !== 'string' || !url) return null;
    out.push({
      url,
      title: typeof title === 'string' ? title : '',
      added_by: null,
    });
  }
  return out;
}

function isStringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

export interface UseMarqueeOpts {
  roomMarqueeFeeds: MarqueeFeed[];
  roomMarqueeItems: Record<string, MarqueeItem[]>;
}

export interface UseMarqueeResult {
  optIn: boolean;
  setOptIn: (next: boolean | ((prev: boolean) => boolean)) => void;
  stripOn: boolean;
  setStripOn: (next: boolean | ((prev: boolean) => boolean)) => void;
  roomFeeds: MarqueeFeed[];
  userFeeds: MarqueeFeed[];
  mutedSources: string[];
  toggleMute: (url: string) => void;
  addUserFeed: (feed: MarqueeFeed) => boolean;
  removeUserFeed: (url: string) => void;
  /** Items merged from room + user feeds, filtered by mute set, newest-first. */
  mergedItems: MarqueeItem[];
  /** Find the item by its id across the merged feed (room + user). */
  findItem: (itemId: string) => MarqueeItem | null;
  /** Lookup a feed's display title (host fallback if title is empty). */
  feedTitle: (url: string) => string;
}

function feedHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function useMarquee({
  roomMarqueeFeeds,
  roomMarqueeItems,
}: UseMarqueeOpts): UseMarqueeResult {
  const [optIn, setOptIn] = useStoredState<boolean>(OPT_IN_KEY, true, isBool);
  const [stripOn, setStripOn] = useStoredState<boolean>(STRIP_KEY, true, isBool);
  const [userFeeds, setUserFeeds] = useStoredState<MarqueeFeed[]>(
    USER_FEEDS_KEY,
    [],
    isUserFeedList,
  );
  const [mutedSources, setMutedSources] = useStoredState<string[]>(
    MUTED_KEY,
    [],
    isStringList,
  );
  const [userItems, setUserItems] = useState<Record<string, MarqueeItem[]>>({});

  const userItemsRef = useRef(userItems);
  userItemsRef.current = userItems;

  // Poll each user feed at the same cadence as the per-room loop. We
  // don't gate this on optIn — the user can toggle off and the items
  // come back instantly when they toggle back on.
  useEffect(() => {
    if (userFeeds.length === 0) {
      setUserItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;

    async function fetchOne(url: string) {
      try {
        const res = await fetch(`${API_BASE}/api/marquee/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: MarqueeItem[] };
        if (cancelled || !Array.isArray(data.items)) return;
        setUserItems((prev) => ({ ...prev, [url]: data.items as MarqueeItem[] }));
      } catch {
        // ignore — sheet shows an empty list for this feed.
      }
    }

    // Initial pass: fetch any user feed without a cached items list.
    for (const f of userFeeds) {
      if (!userItemsRef.current[f.url]) void fetchOne(f.url);
    }

    const id = window.setInterval(() => {
      for (const f of userFeeds) void fetchOne(f.url);
    }, USER_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [userFeeds]);

  // Drop cached user-items for any URL that's no longer in the list.
  useEffect(() => {
    setUserItems((prev) => {
      const allowed = new Set(userFeeds.map((f) => f.url));
      let changed = false;
      const next: Record<string, MarqueeItem[]> = {};
      for (const [url, items] of Object.entries(prev)) {
        if (allowed.has(url)) next[url] = items;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [userFeeds]);

  function toggleMute(url: string) {
    setMutedSources((prev) => {
      const set = new Set(prev);
      if (set.has(url)) set.delete(url);
      else set.add(url);
      return Array.from(set);
    });
  }

  function addUserFeed(feed: MarqueeFeed): boolean {
    if (userFeeds.length >= USER_FEED_MAX) return false;
    if (userFeeds.some((f) => f.url === feed.url)) return false;
    setUserFeeds((prev) => [...prev, { url: feed.url, title: feed.title, added_by: null }]);
    return true;
  }

  function removeUserFeed(url: string) {
    setUserFeeds((prev) => prev.filter((f) => f.url !== url));
  }

  const muteSet = useMemo(() => new Set(mutedSources), [mutedSources]);

  const mergedItems = useMemo(() => {
    const out: MarqueeItem[] = [];
    for (const f of roomMarqueeFeeds) {
      if (muteSet.has(f.url)) continue;
      const items = roomMarqueeItems[f.url];
      if (items) out.push(...items);
    }
    for (const f of userFeeds) {
      if (muteSet.has(f.url)) continue;
      const items = userItems[f.url];
      if (items) out.push(...items);
    }
    out.sort((a, b) => b.published_at - a.published_at);
    return out.slice(0, MERGED_ITEMS_CAP);
  }, [roomMarqueeFeeds, roomMarqueeItems, userFeeds, userItems, muteSet]);

  function findItem(itemId: string): MarqueeItem | null {
    return mergedItems.find((i) => i.id === itemId) ?? null;
  }

  function feedTitle(url: string): string {
    const room = roomMarqueeFeeds.find((f) => f.url === url);
    if (room && room.title) return room.title;
    const user = userFeeds.find((f) => f.url === url);
    if (user && user.title) return user.title;
    return feedHost(url);
  }

  return {
    optIn,
    setOptIn,
    stripOn,
    setStripOn,
    roomFeeds: roomMarqueeFeeds,
    userFeeds,
    mutedSources,
    toggleMute,
    addUserFeed,
    removeUserFeed,
    mergedItems,
    findItem,
    feedTitle,
  };
}
