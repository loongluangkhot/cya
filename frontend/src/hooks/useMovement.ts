import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { socket } from '../socket';
import type { User } from '../types';

const SERVER_W = 1280;
const SERVER_H = 720;
const STEP_PCT = 4;
// Iso floor area where the character can stand (with a margin).
const MIN_PCT = 6;
const MAX_PCT = 94;

export interface UseMovementOpts {
  meId: string | null;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
}

export interface UseMovementResult {
  nudge: (dx: number, dy: number) => void;
  wandering: boolean;
  setWandering: Dispatch<SetStateAction<boolean>>;
}

export function useMovement({ meId, users, setUsers }: UseMovementOpts): UseMovementResult {
  const posRef = useRef({ x: 50, y: 50 });
  const seededRef = useRef(false);
  const meRef = useRef<string | null>(null);
  meRef.current = meId;
  const lastSentSig = useRef('');
  const keysRef = useRef<Set<string>>(new Set());
  const [wandering, setWandering] = useState(false);

  // Seed posRef from the server snapshot the first time we know who we are,
  // so nudge() walks from the right starting point.
  useEffect(() => {
    if (seededRef.current || !meId) return;
    const me = users.find((u) => u.id === meId);
    if (me) {
      posRef.current = { x: me.x, y: me.y };
      seededRef.current = true;
    }
  }, [meId, users]);

  function nudge(dx: number, dy: number) {
    if (!meRef.current) return;
    const cur = posRef.current;
    const m = dx && dy ? Math.SQRT1_2 : 1;
    const nx = Math.max(MIN_PCT, Math.min(MAX_PCT, cur.x + dx * STEP_PCT * m));
    const ny = Math.max(MIN_PCT, Math.min(MAX_PCT, cur.y + dy * STEP_PCT * m));
    posRef.current = { x: nx, y: ny };
    setUsers((prev) =>
      prev.map((p) => (p.id === meRef.current ? { ...p, x: nx, y: ny } : p)),
    );
    const sig = `${Math.round(nx)},${Math.round(ny)}`;
    if (sig !== lastSentSig.current) {
      lastSentSig.current = sig;
      socket.emit('move', {
        x: (nx / 100) * SERVER_W,
        y: (ny / 100) * SERVER_H,
        direction: 'right',
      });
    }
  }

  // Wander — picks random floor targets and walks toward them via nudge(),
  // same as user input so server sync and animation work identically.
  useEffect(() => {
    if (!wandering) return;
    function pickTarget() {
      return {
        x: MIN_PCT + 4 + Math.random() * (MAX_PCT - MIN_PCT - 8),
        y: MIN_PCT + 4 + Math.random() * (MAX_PCT - MIN_PCT - 8),
      };
    }
    let target = pickTarget();
    let arrivedAt = 0;
    const id = window.setInterval(() => {
      const pos = posRef.current;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        // Arrived; idle briefly then pick a new spot.
        if (arrivedAt === 0) arrivedAt = Date.now();
        if (Date.now() - arrivedAt > 1400) {
          target = pickTarget();
          arrivedAt = 0;
        }
        return;
      }
      arrivedAt = 0;
      const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      nudge(sx, sy);
    }, 160);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wandering]);

  // Arrow-key handler — drive our own repeat (avoid OS auto-repeat delay).
  useEffect(() => {
    const held = keysRef.current;
    let timer: number | null = null;

    function tick() {
      let dx = 0;
      let dy = 0;
      if (held.has('ArrowUp')) dy -= 1;
      if (held.has('ArrowDown')) dy += 1;
      if (held.has('ArrowLeft')) dx -= 1;
      if (held.has('ArrowRight')) dx += 1;
      if (dx || dy) nudge(dx, dy);
    }

    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      // Any manual movement cancels wander.
      setWandering(false);
      if (!held.has(e.key)) {
        const first = held.size === 0;
        held.add(e.key);
        if (first) {
          tick();
          timer = window.setInterval(tick, 130);
        }
      }
    }
    function up(e: KeyboardEvent) {
      if (!held.has(e.key)) return;
      held.delete(e.key);
      if (held.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function blur() {
      held.clear();
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      if (timer !== null) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { nudge, wandering, setWandering };
}
