import Icon from '../../Icon';

export function MusicGate({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="sheet-gate">
      <div className="sheet-gate-mark" style={{ color: '#e62117' }}>
        <Icon name="yt" size={30} />
      </div>
      <div className="h-display" style={{ fontSize: 20, marginBottom: 8 }}>
        play music together
      </div>
      <div className="body-text" style={{ marginBottom: 18, maxWidth: 280 }}>
        everyone in the room hears the same track, in sync. no login, no premium — just
        paste a youtube link.
      </div>
      <button type="button" className="btn compact" onClick={onEnable}>
        turn on music
      </button>
    </div>
  );
}
