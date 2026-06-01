import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import PixelCharacter from '../PixelCharacter';
import { colorHex } from '../../characters';
import { isoFromPct } from '../../iso';
import type { User } from '../../types';
import { WALK_MS_ME, WALK_MS_OTHER } from './constants';

interface PeerOnIsoProps {
  peer: User;
  isMe: boolean;
  previewOpen: boolean;
  onTogglePreview: () => void;
  onSeeMore: () => void;
  onWriteMemo?: () => void;
}

export function PeerOnIso({
  peer,
  isMe,
  previewOpen,
  onTogglePreview,
  onSeeMore,
  onWriteMemo,
}: PeerOnIsoProps) {
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  const { x, y } = isoFromPct(peer.x, peer.y);
  const hasMemo = peer.memo.trim().length > 0;
  const showAddCue = isMe && !hasMemo && !!onWriteMemo;

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
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{peer.memo}</ReactMarkdown>
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
        {showAddCue && (
          <button
            type="button"
            className="memo-note-add"
            aria-label="add a thought"
            onClick={(e) => {
              e.stopPropagation();
              onWriteMemo();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ＋
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
