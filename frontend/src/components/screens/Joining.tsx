import { colorHex } from '../../characters';
import type { User } from '../../types';
import PixelCharacter from '../PixelCharacter';
import type { Identity } from './Setup';

export type OccupantPeek = Pick<User, 'id' | 'name' | 'character' | 'color'>;

interface JoiningProps {
  roomId: string;
  me: Identity;
  occupants: OccupantPeek[] | null;
  onEnter: () => void;
  onEditMe: () => void;
}

export function JoiningScreen({ roomId, me, occupants, onEnter, onEditMe }: JoiningProps) {
  const displayName = roomId.replace(/-/g, ' ');
  const url = typeof window !== 'undefined' ? `${window.location.host}/r/${roomId}` : `/r/${roomId}`;
  return (
    <div className="screen">
      <div className="status-bar-space" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18 }}>
        <div className="h-mono">you were invited to</div>
        <div className="space-name lg">{displayName}</div>
        <div className="h-mono">{url}</div>

        <div className="who-card" style={{ marginTop: 22 }}>
          <div className="h-mono" style={{ marginBottom: 10 }}>
            {occupants ? `${occupants.length} inside` : 'checking room…'}
          </div>
          <div className="who-list">
            {occupants?.length === 0 && (
              <div className="body-text">no one's in here yet — be the first.</div>
            )}
            {occupants?.map((p) => (
              <div className="who-row" key={p.id}>
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={3} />
                <span className="name">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="you-chip"
          onClick={onEditMe}
          style={{ marginTop: 6, border: 'var(--border-w) dashed var(--scene-line)', background: 'transparent' }}
        >
          <PixelCharacter character={me.character} color={colorHex(me.color)} scale={3} />
          <span className="name">entering as {me.name}</span>
          <span className="edit">change</span>
        </button>
      </div>

      <button type="button" className="btn" onClick={onEnter}>drop in →</button>
    </div>
  );
}
