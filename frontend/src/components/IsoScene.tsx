import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ISO_GRID,
  ISO_TILE_H,
  ISO_TILE_W,
  ISO_WALL_H,
  IsoBackdrop,
  iso,
  isoFromPct,
} from './IsoBackdrop';
import PixelCharacter from './PixelCharacter';
import { colorHex } from '../characters';
import type { AmbientRoom, BubbleState, User } from '../types';

const WALK_MS_ME = 220;
const WALK_MS_OTHER = 1100;

interface PeerOnIsoProps {
  peer: User;
  isMe: boolean;
}

function PeerOnIso({ peer, isMe }: PeerOnIsoProps) {
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  const { x, y } = isoFromPct(peer.x, peer.y);
  return (
    <div
      className="peer-stage"
      style={{
        top: 'var(--iso-origin-y, 32%)',
        transform: `translate3d(calc(-50% + ${x}px), calc(-82% + ${y}px), 0)`,
        transition: `transform ${dur}ms linear`,
        zIndex: 50 + Math.round(peer.y),
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' }}>
        <div className="peer-shadow" />
        <PixelCharacter character={peer.character} color={colorHex(peer.color)} scale={3} />
        <div className={`peer-tag${isMe ? ' is-me' : ''}`}>
          {peer.name}
          {isMe ? '·you' : ''}
        </div>
      </div>
    </div>
  );
}

interface SpeechBubbleProps {
  peer: User;
  text: string;
  isMe: boolean;
}

function SpeechBubble({ peer, text, isMe }: SpeechBubbleProps) {
  if (!text) return null;
  const { x, y } = isoFromPct(peer.x, peer.y);
  const c = colorHex(peer.color);
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  return (
    <div
      className="bubble"
      style={{
        top: 'var(--iso-origin-y, 32%)',
        transform: `translate3d(calc(-50% + ${x}px), calc(-100% - 56px + ${y}px), 0)`,
        transition: `transform ${dur}ms linear`,
      }}
    >
      <div className="bubble-body" style={{ borderLeft: `4px solid ${c}` }}>
        {text}
        <div className="bubble-tail" />
      </div>
    </div>
  );
}

interface IsoSceneProps {
  peers: User[];
  meId: string | null;
  bubbles: Record<string, BubbleState>;
  room: AmbientRoom;
}

export default function IsoScene({ peers, meId, bubbles, room }: IsoSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [manualPan, setManualPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const SVG_LEFT = -ISO_GRID * ISO_TILE_W / 2 - 10;
  const SVG_TOP = -ISO_WALL_H - 20;
  const SVG_W = ISO_GRID * ISO_TILE_W + 20;
  const SVG_H = ISO_WALL_H + ISO_GRID * ISO_TILE_H + 40;

  const FOLLOW = 0.7;
  const me = peers.find((p) => p.id === meId);
  const center = iso(ISO_GRID / 2, ISO_GRID / 2);
  let camX = 0;
  let camY = 0;
  if (me) {
    const m = isoFromPct(me.x, me.y);
    camX = -(m.x - center.x) * FOLLOW;
    camY = -(m.y - center.y) * FOLLOW;
  }
  const totalX = camX + manualPan.x;
  const totalY = camY + manualPan.y;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: manualPan.x,
      panY: manualPan.y,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 5) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      setManualPan({ x: d.panX + dx, y: d.panY + dy });
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    if (dragging) setDragging(false);
  }

  function onDoubleClick() {
    setManualPan({ x: 0, y: 0 });
  }

  const sortedPeers = [...peers].sort((a, b) => (a.id < b.id ? -1 : 1));

  return (
    <div
      ref={containerRef}
      className={`iso-scene${dragging ? ' dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        // Clamp the iso origin so the scene stays on-screen on short
        // viewports (phone landscape, small laptop windows).
        ['--iso-origin-y' as string]: `max(80px, calc(50% - ${(ISO_GRID * ISO_TILE_H) / 2}px))`,
      }}
    >
      <div
        className={`iso-camera${dragging ? ' no-transition' : ''}`}
        style={{ transform: `translate(${totalX}px, ${totalY}px)` }}
      >
        <svg
          className="iso-svg"
          width={SVG_W}
          height={SVG_H}
          viewBox={`${SVG_LEFT} ${SVG_TOP} ${SVG_W} ${SVG_H}`}
          style={{
            top: 'var(--iso-origin-y, 30%)',
            transform: `translate(-50%, ${SVG_TOP}px)`,
          }}
        >
          <IsoBackdrop room={room} />
        </svg>

        {sortedPeers.map((p) => (
          <PeerOnIso key={p.id} peer={p} isMe={p.id === meId} />
        ))}

        {peers.map((p) => {
          const b = bubbles[p.id];
          if (!b) return null;
          return <SpeechBubble key={`b-${p.id}`} peer={p} text={b.text} isMe={p.id === meId} />;
        })}
      </div>
    </div>
  );
}
