import type { PlayerMode } from './types';

const MODES: PlayerMode[] = ['theater', 'audio'];

export function PlayerModeRow({
  value,
  onChange,
}: {
  value: PlayerMode;
  onChange: (m: PlayerMode) => void;
}) {
  return (
    <div className="yt-mode-row">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={`yt-mode-chip${value === m ? ' selected' : ''}`}
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
