import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Icon from '../Icon';
import { API_BASE } from '../../api';
import { colorHex } from '../../characters';
import type { User } from '../../types';

interface MugshotBoardProps {
  roomId: string;
  users: User[];
  /** Per-user takenAt timestamps. Anyone present in users but absent here hasn't snapped yet. */
  takenAt: Record<string, number>;
  onClose: () => void;
}

interface Rect {
  x: number | null;
  y: number | null;
  width: number;
  photo: number;
}

// Width controls how many thumbs fit horizontally (still scrolls beyond
// that). Photo size is the thumb edge length in px — vertical drag grows
// it, capped at MAX_PHOTO; the box auto-sizes around it.
const MIN_WIDTH = 110;
const MAX_WIDTH = 740;
const DEFAULT_WIDTH = 220;
const MIN_PHOTO = 60;
const MAX_PHOTO = 200;
const DEFAULT_PHOTO = 92;
const RECT_KEY = 'cya:mug:rect:v1';

function loadRect(): Rect {
  try {
    const raw = localStorage.getItem(RECT_KEY);
    if (!raw) return { x: null, y: null, width: DEFAULT_WIDTH, photo: DEFAULT_PHOTO };
    const parsed = JSON.parse(raw) as Partial<Rect>;
    return {
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null,
      width:
        typeof parsed.width === 'number'
          ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width))
          : DEFAULT_WIDTH,
      photo:
        typeof parsed.photo === 'number'
          ? Math.max(MIN_PHOTO, Math.min(MAX_PHOTO, parsed.photo))
          : DEFAULT_PHOTO,
    };
  } catch {
    return { x: null, y: null, width: DEFAULT_WIDTH, photo: DEFAULT_PHOTO };
  }
}

function saveRect(rect: Rect) {
  try {
    localStorage.setItem(RECT_KEY, JSON.stringify(rect));
  } catch {
    // ignore — private window
  }
}

export function MugshotBoard({ roomId, users, takenAt, onClose }: MugshotBoardProps) {
  const [rect, setRect] = useState<Rect>(() => loadRect());
  const boxRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // Persist rect changes — debounced via the layout effect's natural batching.
  useEffect(() => {
    saveRect(rect);
  }, [rect]);

  // Build the display list: users in the room who have snapped, oldest → newest.
  // Newest on the right matches the IRC log convention so the auto-scroll
  // direction is consistent across the app.
  const entries = useMemo(() => {
    return users
      .map((u) => ({ user: u, takenAt: takenAt[u.id] }))
      .filter((e): e is { user: User; takenAt: number } => typeof e.takenAt === 'number')
      .sort((a, b) => a.takenAt - b.takenAt);
  }, [users, takenAt]);

  // Auto-scroll to the newest photo whenever the list grows or a photo
  // updates. Matches IrcLog's pattern.
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [entries]);

  function onGripDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const grip = e.currentTarget;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const r = box.getBoundingClientRect();
    const op = (box.offsetParent as HTMLElement | null) ?? document.body;
    const parent = op.getBoundingClientRect();
    const start = {
      mx: e.clientX,
      my: e.clientY,
      ox: r.left - parent.left,
      oy: r.top - parent.top,
      w: r.width,
      h: r.height,
      pw: parent.width || window.innerWidth,
      ph: parent.height || window.innerHeight,
    };
    function move(ev: PointerEvent) {
      let nx = start.ox + (ev.clientX - start.mx);
      let ny = start.oy + (ev.clientY - start.my);
      nx = Math.max(6, Math.min(nx, start.pw - start.w - 6));
      ny = Math.max(6, Math.min(ny, start.ph - start.h - 6));
      setRect((cur) => ({ ...cur, x: nx, y: ny }));
    }
    function up() {
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
    }
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  }

  function onResizeDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const startW = box.getBoundingClientRect().width;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPhoto = rect.photo;
    function move(ev: PointerEvent) {
      const nextW = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startW + (ev.clientX - startX)),
      );
      const nextPhoto = Math.max(
        MIN_PHOTO,
        Math.min(MAX_PHOTO, startPhoto + (ev.clientY - startY)),
      );
      setRect((cur) => ({ ...cur, width: nextW, photo: nextPhoto }));
    }
    function up() {
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    }
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  }

  const style: React.CSSProperties = {
    width: rect.width,
    ['--mug-thumb-size' as string]: `${rect.photo}px`,
    ...(rect.x !== null && rect.y !== null
      ? { left: rect.x, top: rect.y, right: 'auto', bottom: 'auto' }
      : {}),
  };

  return (
    <div ref={boxRef} className="mug-board" style={style}>
      <div ref={stripRef} className="mug-strip">
        {entries.length === 0 ? (
          <div className="mug-empty">no mugshots yet</div>
        ) : (
          entries.map(({ user, takenAt: t }) => (
            <figure key={user.id} className="mug-thumb" title={user.name}>
              <img
                src={`${API_BASE}/api/rooms/${roomId}/mugshot/${user.id}?t=${t}`}
                alt={`${user.name}'s mugshot`}
                draggable={false}
              />
              <span
                className={`status-dot mug-thumb-status${user.status === 'away' ? ' is-away' : ''}`}
                aria-label={user.status === 'away' ? 'away' : 'online'}
                title={user.status === 'away' ? 'away' : 'online'}
              />
              <figcaption
                className="mug-thumb-name"
                style={{ color: colorHex(user.color) }}
              >
                {user.name}
              </figcaption>
            </figure>
          ))
        )}
      </div>
      <div className="mug-board-bar">
        <button
          type="button"
          className="room-video-grip"
          aria-label="move mugshot board"
          title="drag to move"
          onPointerDown={onGripDown}
        >
          <Icon name="grip" size={13} />
        </button>
        <div className="mug-board-title h-mono">mugshots</div>
        <button
          type="button"
          className="dock-chip-ctrl"
          aria-label="hide mugshot board"
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <button
        type="button"
        className="room-video-resize"
        aria-label="resize mugshot board"
        title="drag to resize"
        onPointerDown={onResizeDown}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M9 1L1 9M9 5L5 9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
