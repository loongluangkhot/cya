import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import PixelCharacter from './PixelCharacter';
import { Sheet } from './Sheet';
import { colorHex } from '../characters';
import type { User } from '../types';

interface MindsSheetProps {
  open: boolean;
  onClose: () => void;
  peers: User[];
  meId: string | null;
  onEditMine: () => void;
}

export function MindsSheet({ open, onClose, peers, meId, onEditMine }: MindsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="on everyone's mind" tall>
      <MindsBoard peers={peers} meId={meId} onEditMine={onEditMine} />
    </Sheet>
  );
}

function MindsBoard({
  peers,
  meId,
  onEditMine,
}: {
  peers: User[];
  meId: string | null;
  onEditMine: () => void;
}) {
  const me = peers.find((p) => p.id === meId) ?? null;
  const others = peers.filter((p) => p.id !== meId && p.memo.trim().length > 0);
  const myMemo = me?.memo.trim() ?? '';
  const noOneShared = !myMemo && others.length === 0;

  return (
    <>
      {myMemo ? (
        <BoardCard peer={me!} isMe onEdit={onEditMine} />
      ) : (
        <button type="button" className="board-empty-cta" onClick={onEditMine}>
          ＋ share what's on your mind
        </button>
      )}
      {others.map((p) => (
        <BoardCard key={p.id} peer={p} />
      ))}
      {noOneShared && (
        <div className="board-foot">no one has shared yet — be the first</div>
      )}
      <div className="board-foot">— your note carries with you between rooms —</div>
    </>
  );
}

function BoardCard({
  peer,
  isMe = false,
  onEdit,
}: {
  peer: User;
  isMe?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className={`board-card${isMe ? ' me' : ''}`}>
      <span className="board-corner" aria-hidden="true" />
      <div className="board-avatar">
        <PixelCharacter character={peer.character} color={colorHex(peer.color)} scale={2} crop="head" />
      </div>
      <div className="board-main">
        <div className="board-name">{isMe ? 'you' : peer.name}</div>
        <div className="board-text memo-rendered">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{peer.memo}</ReactMarkdown>
        </div>
        {isMe && onEdit && (
          <button type="button" className="board-edit-link" onClick={onEdit}>
            ✎ edit
          </button>
        )}
      </div>
    </div>
  );
}
