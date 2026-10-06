import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import Icon from '../Icon';
import PixelCharacter from '../PixelCharacter';
import { colorHex } from '../../characters';
import { isoFromPct } from '../../iso';
import type { User } from '../../types';
import { WALK_MS_ME, WALK_MS_OTHER } from './constants';

interface PeerOnIsoProps {
  peer: User;
  isMe: boolean;
  previewOpen: boolean;
  /** Auto-opened memo peek: fades on its own, no backdrop, tap pins it. */
  peeking: boolean;
  /** Peek lifetime — drives the fade-in / hold / fade-out animation. */
  peekMs: number;
  onTogglePreview: () => void;
  /** Close button: unpins an opened preview, or ends a peek early. */
  onClosePreview: () => void;
  onSeeMore: () => void;
  onWriteMemo?: () => void;
}

export function PeerOnIso({
  peer,
  isMe,
  previewOpen,
  peeking,
  peekMs,
  onTogglePreview,
  onClosePreview,
  onSeeMore,
  onWriteMemo,
}: PeerOnIsoProps) {
  const dur = isMe ? WALK_MS_ME : WALK_MS_OTHER;
  const { x, y } = isoFromPct(peer.x, peer.y);
  const hasMemo = peer.memo.trim().length > 0;
  const showAddCue = isMe && !hasMemo && !!onWriteMemo;
  const isPeek = peeking && !previewOpen;
  const showPreview = hasMemo && (previewOpen || isPeek);

  return (
    <div
      className="peer-stage"
      style={{
        top: 'var(--iso-origin-y, 32%)',
        transform: `translate3d(calc(-50% + ${x}px), calc(-82% + ${y}px), 0)`,
        transition: `transform ${dur}ms linear`,
        zIndex: showPreview ? 240 : 50 + Math.round(peer.y),
      }}
    >
      <div className="peer-stage-inner">
        {showPreview && (
          <div
            className={`memo-note-preview${isPeek ? ' is-peek' : ''}`}
            style={isPeek ? { ['--peek-ms' as string]: `${peekMs}ms` } : undefined}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              // Any touch on a peek (tap, start of a scroll) pins it so it
              // doesn't fade out mid-read.
              if (isPeek) onTogglePreview();
            }}
            onWheel={() => {
              if (isPeek) onTogglePreview();
            }}
          >
            <div className="memo-note-preview-head">
              <div className="memo-note-preview-label">on my mind</div>
              <button
                type="button"
                className="memo-note-close"
                aria-label="close"
                // Don't let the close tap count as a touch that pins a peek.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onClosePreview();
                }}
              >
                <Icon name="x" size={10} />
              </button>
            </div>
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
          <span
            className={`status-dot${peer.status === 'away' ? ' is-away' : ''}`}
            aria-label={peer.status === 'away' ? 'away' : 'online'}
            title={peer.status === 'away' ? 'away' : 'online'}
          />
          {peer.name}
          {isMe ? '·you' : ''}
        </div>
      </div>
    </div>
  );
}
