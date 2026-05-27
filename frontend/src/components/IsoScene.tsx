import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { IsoBackdrop } from './IsoBackdrop';
import {
  ISO_GRID,
  ISO_TILE_H,
  ISO_TILE_W,
  ISO_WALL_H,
  iso,
  isoFromPct,
} from '../iso';
import PixelCharacter from './PixelCharacter';
import { colorHex } from '../characters';
import type { AmbientRoom, BubbleState, User } from '../types';

const WALK_MS_ME = 220;
const WALK_MS_OTHER = 1100;

interface PeerOnIsoProps {
  peer: User;
  isMe: boolean;
  previewOpen: boolean;
  onTogglePreview: () => void;
  onSeeMore: () => void;
}

function PeerOnIso({
  peer,
  isMe,
  previewOpen,
  onTogglePreview,
  onSeeMore,
}: PeerOnIsoProps) {
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  const { x, y } = isoFromPct(peer.x, peer.y);
  const hasMemo = peer.memo.trim().length > 0;

  return (
    <div
      className="peer-stage"
      style={{
        top: 'var(--iso-origin-y, 32%)',
        transform: `translate3d(calc(-50% + ${x}px), calc(-82% + ${y}px), 0)`,
        transition: `transform ${dur}ms linear`,
        zIndex: previewOpen ? 240 : 50 + Math.round(peer.y),
      }}
    >
      <div className="peer-stage-inner">
        {previewOpen && (
          <div
            className="memo-note-preview"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="memo-note-preview-label">on my mind</div>
            <div className="memo-note-preview-rendered memo-rendered">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {peer.memo}
              </ReactMarkdown>
            </div>
            <button
              type="button"
              className="memo-note-more"
              onClick={(e) => {
                e.stopPropagation();
                onSeeMore();
              }}
            >
              see more →
            </button>
          </div>
        )}
        {hasMemo && (
          <button
            type="button"
            className={`memo-note-icon${isMe ? ' is-me' : ''}${previewOpen ? ' open' : ''}`}
            aria-label={`${peer.name}'s memo`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePreview();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2 H11 L14 5 V14 H2 Z" fill="currentColor" stroke="rgba(0,0,0,0.35)" strokeWidth="1" strokeLinejoin="miter" />
              <path d="M11 2 V5 H14" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
              <path d="M4.5 8 H10 M4.5 10.5 H9" stroke="rgba(0,0,0,0.45)" strokeWidth="1" strokeLinecap="square" />
            </svg>
          </button>
        )}
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
  onOpenMemo: (peerId: string) => void;
}

export default function IsoScene({ peers, meId, bubbles, room, onOpenMemo }: IsoSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [manualPan, setManualPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  // Which peer's memo popover is currently shown above the scene. A
  // transparent backdrop dismisses on any outside click.
  const [previewMemoId, setPreviewMemoId] = useState<string | null>(null);
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
      // Cancel any open memo popover once the user commits to a pan.
      setPreviewMemoId(null);
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

        {previewMemoId !== null && (
          <div
            className="memo-note-backdrop"
            onPointerDown={() => setPreviewMemoId(null)}
          />
        )}

        {sortedPeers.map((p) => (
          <PeerOnIso
            key={p.id}
            peer={p}
            isMe={p.id === meId}
            previewOpen={previewMemoId === p.id}
            onTogglePreview={() =>
              setPreviewMemoId((cur) => (cur === p.id ? null : p.id))
            }
            onSeeMore={() => {
              setPreviewMemoId(null);
              onOpenMemo(p.id);
            }}
          />
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
