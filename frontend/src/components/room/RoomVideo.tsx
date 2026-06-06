import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import Icon from '../Icon';
import { useYoutubeMeta } from '../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../youtube';

interface RoomVideoProps {
  trackId: string;
  audioOnly: boolean;
  isPlaying: boolean;
  hasQueue: boolean;
  stageRef: RefObject<HTMLDivElement>;
  onOpen: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onClose: () => void;
}

interface Rect {
  x: number | null;
  y: number | null;
  width: number;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 212;
const RECT_KEY = 'cya:yt:rect:v1';

function loadRect(): Rect {
  try {
    const raw = localStorage.getItem(RECT_KEY);
    if (!raw) return { x: null, y: null, width: DEFAULT_WIDTH };
    const parsed = JSON.parse(raw) as Partial<Rect>;
    return {
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null,
      width:
        typeof parsed.width === 'number'
          ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width))
          : DEFAULT_WIDTH,
    };
  } catch {
    return { x: null, y: null, width: DEFAULT_WIDTH };
  }
}

function saveRect(rect: Rect) {
  try {
    localStorage.setItem(RECT_KEY, JSON.stringify(rect));
  } catch {
    // ignore — private window
  }
}

export function RoomVideo({
  trackId,
  audioOnly,
  isPlaying,
  hasQueue,
  stageRef,
  onOpen,
  onTogglePlay,
  onNext,
  onClose,
}: RoomVideoProps) {
  const meta = useYoutubeMeta(trackId);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<Rect>(() => loadRect());

  useEffect(() => {
    saveRect(rect);
  }, [rect]);

  function onGripDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const grip = e.currentTarget;
    // Pointer capture keeps move/up firing even when the cursor crosses
    // over the YouTube iframe (which would otherwise swallow events).
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
    function move(ev: PointerEvent) {
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (ev.clientX - startX)));
      setRect((cur) => ({ ...cur, width: next }));
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

  const moved = rect.x !== null && rect.y !== null;
  const style: React.CSSProperties = {
    width: rect.width,
    ...(moved
      ? {
          left: rect.x as number,
          top: rect.y as number,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
        }
      : {}),
  };

  return (
    <div
      ref={boxRef}
      className={`room-video${audioOnly ? ' is-audio' : ''}${moved ? ' is-dragged' : ''}`}
      style={style}
    >
      {audioOnly ? (
        <img
          src={meta.art || thumbUrl(trackId)}
          className="room-video-art"
          alt=""
        />
      ) : (
        <div ref={stageRef} className="room-video-frame" />
      )}
      <div className="room-video-bar">
        <button
          type="button"
          className="room-video-grip"
          aria-label="move player"
          title="drag to move"
          onPointerDown={onGripDown}
        >
          <Icon name="grip" size={13} />
        </button>
        <button
          type="button"
          className="room-video-title yt-clamp"
          onClick={onOpen}
          title="open music"
        >
          {meta.title}
        </button>
        <button
          type="button"
          className="dock-chip-ctrl primary"
          aria-label={isPlaying ? 'pause' : 'play'}
          onClick={onTogglePlay}
        >
          <Icon name={isPlaying ? 'pause' : 'play'} size={12} />
        </button>
        <button
          type="button"
          className="dock-chip-ctrl"
          aria-label="next"
          onClick={onNext}
          disabled={!hasQueue}
        >
          <Icon name="next" size={12} />
        </button>
        <button
          type="button"
          className="dock-chip-ctrl"
          aria-label="hide in-room player"
          title="hide in-room player"
          onClick={onClose}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
      <button
        type="button"
        className="room-video-resize"
        aria-label="resize player"
        title="drag to resize"
        onPointerDown={onResizeDown}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M9 1L1 9M9 5L5 9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

