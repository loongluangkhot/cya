import PixelCharacter from '../PixelCharacter';
import { Sheet } from './Sheet';
import { colorHex } from '../../characters';
import type { User } from '../../types';

interface PeopleSheetProps {
  open: boolean;
  onClose: () => void;
  peers: User[];
  meId: string | null;
  onEditMe: () => void;
}

export function PeopleSheet({ open, onClose, peers, meId, onEditMe }: PeopleSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={`${peers.length} in the room`} tall>
      <div>
        {peers.map((p) => {
          const isMe = p.id === meId;
          const away = p.status === 'away';
          return (
            <div key={p.id} className="person-row">
              <div className="person-row-head">
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={3} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="name">
                    <span
                      className={`status-dot${away ? ' is-away' : ''}`}
                      aria-label={away ? 'away' : 'online'}
                      title={away ? 'away' : 'online'}
                    />
                    {p.name}{isMe ? ' (you)' : ''}
                  </div>
                  <div className="role">
                    {isMe ? 'this is you' : away ? 'away' : 'here now'}
                  </div>
                </div>
                {isMe ? (
                  <button type="button" className="person-edit" onClick={onEditMe}>
                    edit
                  </button>
                ) : (
                  <span className="live-dot" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
