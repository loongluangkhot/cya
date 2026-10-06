import { useEffect, useRef, useState } from 'react';
import { extractHeadline } from '../memo';
import type { BubbleState, User } from '../types';

/** Parse "min-max" (or a single number) seconds into ms; fall back when
 *  unset, malformed, or non-positive. */
function envRangeMs(raw: string | undefined, fallback: [number, number]): [number, number] {
  const m = raw?.trim().match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return fallback;
  const lo = Number(m[1]) * 1000;
  const hi = Number(m[2] ?? m[1]) * 1000;
  if (!(lo > 0) || hi < lo) return fallback;
  return [lo, hi];
}

// Ambient cadence: one peek at a time, a jittered gap between them.
// The first one after joining comes sooner so newcomers see the feature.
// Overridable at build time via VITE_MEMO_PEEK_* (see .env.example).
const [GAP_MIN_MS, GAP_MAX_MS] = envRangeMs(import.meta.env.VITE_MEMO_PEEK_GAP_S, [60_000, 90_000]);
const [FIRST_MIN_MS, FIRST_MAX_MS] = envRangeMs(import.meta.env.VITE_MEMO_PEEK_FIRST_S, [10_000, 20_000]);
export const THOUGHT_SHOW_MS = envRangeMs(import.meta.env.VITE_MEMO_PEEK_SHOW_S, [8_000, 8_000])[0];

export interface Thought {
  userId: string;
}

interface Options {
  users: User[];
  bubbles: Record<string, BubbleState>;
  /** Peer whose memo popover is open — never think over it. */
  previewMemoId: string | null;
  muted: boolean;
}

function jitter(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function isVisible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/** A memo with real text — markdown-only memos (`---`, `- [ ]`) don't count. */
function hasText(memo: string) {
  return extractHeadline(memo) !== '';
}

/**
 * Client-local rotation of memo peeks over sprites. Picks one active
 * user with a memo at a time — freshly edited memos first, then whoever
 * was shown longest ago — and yields to speech bubbles and open previews.
 */
export function useThoughtRotation({ users, bubbles, previewMemoId, muted }: Options): {
  thought: Thought | null;
  /** End the current peek early; the rotation timers carry on. */
  dismiss: () => void;
} {
  const [thoughtId, setThoughtId] = useState<string | null>(null);
  const [visible, setVisible] = useState(isVisible);

  // Latest inputs for timer callbacks, without restarting the timer chain.
  const usersRef = useRef(users);
  const bubblesRef = useRef(bubbles);
  const previewRef = useRef(previewMemoId);
  usersRef.current = users;
  bubblesRef.current = bubbles;
  previewRef.current = previewMemoId;

  const lastShownAt = useRef(new Map<string, number>());
  const priority = useRef<string[]>([]);
  const lastMemo = useRef(new Map<string, string>());
  const startedOnce = useRef(false);

  useEffect(() => {
    const onVis = () => setVisible(isVisible());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Memo edits jump the queue; first sight of a user just records their memo.
  useEffect(() => {
    const seen = new Set<string>();
    for (const u of users) {
      seen.add(u.id);
      const prev = lastMemo.current.get(u.id);
      lastMemo.current.set(u.id, u.memo);
      if (prev === undefined || prev === u.memo) continue;
      priority.current = priority.current.filter((id) => id !== u.id);
      if (hasText(u.memo)) priority.current.unshift(u.id);
    }
    for (const id of [...lastMemo.current.keys()]) {
      if (!seen.has(id)) {
        lastMemo.current.delete(id);
        lastShownAt.current.delete(id);
        priority.current = priority.current.filter((p) => p !== id);
      }
    }
  }, [users]);

  // Timer chain — runs only while visible and unmuted.
  useEffect(() => {
    if (muted || !visible) {
      setThoughtId(null);
      return;
    }
    let nextTimer = 0;
    let hideTimer = 0;

    function eligible(u: User) {
      return (
        u.status === 'online' &&
        hasText(u.memo) &&
        !bubblesRef.current[u.id] &&
        previewRef.current !== u.id
      );
    }

    function pick(): string | null {
      const pool = usersRef.current.filter(eligible);
      if (pool.length === 0) return null;
      const ids = new Set(pool.map((u) => u.id));
      const fresh = priority.current.find((id) => ids.has(id));
      if (fresh) return fresh;
      const at = (id: string) => lastShownAt.current.get(id) ?? 0;
      const oldest = Math.min(...pool.map((u) => at(u.id)));
      const ties = pool.filter((u) => at(u.id) === oldest);
      return ties[Math.floor(Math.random() * ties.length)].id;
    }

    function tick() {
      const id = pick();
      if (!id) {
        nextTimer = window.setTimeout(tick, jitter(GAP_MIN_MS, GAP_MAX_MS));
        return;
      }
      lastShownAt.current.set(id, Date.now());
      priority.current = priority.current.filter((p) => p !== id);
      setThoughtId(id);
      hideTimer = window.setTimeout(() => setThoughtId(null), THOUGHT_SHOW_MS);
      nextTimer = window.setTimeout(tick, THOUGHT_SHOW_MS + jitter(GAP_MIN_MS, GAP_MAX_MS));
    }

    const first = !startedOnce.current;
    startedOnce.current = true;
    nextTimer = window.setTimeout(
      tick,
      first ? jitter(FIRST_MIN_MS, FIRST_MAX_MS) : jitter(GAP_MIN_MS, GAP_MAX_MS),
    );
    return () => {
      window.clearTimeout(nextTimer);
      window.clearTimeout(hideTimer);
      setThoughtId(null);
    };
  }, [muted, visible]);

  // Drop the current thought the moment its user stops qualifying —
  // speaks, goes away, clears their memo, leaves, or gets previewed.
  const user = thoughtId ? users.find((u) => u.id === thoughtId) : undefined;
  const stillValid =
    !!user && hasText(user.memo) && user.status === 'online' && !bubbles[user.id] && previewMemoId !== user.id;

  useEffect(() => {
    if (thoughtId && !stillValid) setThoughtId(null);
  }, [thoughtId, stillValid]);

  return {
    thought: thoughtId && stillValid ? { userId: thoughtId } : null,
    dismiss: () => setThoughtId(null),
  };
}
