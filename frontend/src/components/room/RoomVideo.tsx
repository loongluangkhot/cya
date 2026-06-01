import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import Icon from '../Icon';
import { useYoutubeMeta } from '../../hooks/useYoutubeMeta';
import { thumbUrl } from '../../youtube';

export type RoomPlacement = 'corner' | 'wall' | 'off';

interface RoomVideoProps {
  trackId: string;
  placement: 'corner' | 'wall';
  audioOnly: boolean;
  isPlaying: boolean;
  hasQueue: boolean;
  stageRef: RefObject<HTMLDivElement>;
  onOpen: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onClose: () => void;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 720;

export function RoomVideo({
  trackId,
  placement,
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  // Snap back to the CSS-default spot/size whenever placement changes.
  useEffect(() => {
    setPos(null);
    setWidth(null);
  }, [placement]);

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
    const rect = box.getBoundingClientRect();
    const op = (box.offsetParent as HTMLElement | null) ?? document.body;
    const parent = op.getBoundingClientRect();
    const start = {
      mx: e.clientX,
      my: e.clientY,
      ox: rect.left - parent.left,
      oy: rect.top - parent.top,
      w: rect.width,
      h: rect.height,
      pw: parent.width || window.innerWidth,
      ph: parent.height || window.innerHeight,
    };
    function move(ev: PointerEvent) {
      let nx = start.ox + (ev.clientX - start.mx);
      let ny = start.oy + (ev.clientY - start.my);
      nx = Math.max(6, Math.min(nx, start.pw - start.w - 6));
      ny = Math.max(6, Math.min(ny, start.ph - start.h - 6));
      setPos({ x: nx, y: ny });
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
      setWidth(next);
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

  const style: React.CSSProperties | undefined = pos || width !== null
    ? {
        ...(pos
          ? {
              left: pos.x,
              top: pos.y,
              right: 'auto' as const,
              bottom: 'auto' as const,
              transform: 'none',
            }
          : {}),
        ...(width !== null ? { width } : {}),
      }
    : undefined;

  return (
    <div
      ref={boxRef}
      className={`room-video ${placement}${audioOnly ? ' is-audio' : ''}${pos || width !== null ? ' is-dragged' : ''}`}
      style={style}
    >
      {placement === 'wall' && !audioOnly && (
        <div className="room-video-cap h-mono">now playing</div>
      )}
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
          aria-label="hide video"
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

