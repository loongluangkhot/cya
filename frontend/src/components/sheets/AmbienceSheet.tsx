import { Sheet } from './Sheet';
import type { Ambient, AmbientRoom, AmbientTime, AmbientWeather } from '../../types';

interface AmbienceSheetProps {
  open: boolean;
  onClose: () => void;
  ambient: Ambient;
  onChange: (next: Partial<Ambient>) => void;
}

export function AmbienceSheet({ open, onClose, ambient, onChange }: AmbienceSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="ambience">
      <div className="body-text" style={{ marginBottom: 18 }}>
        everyone in the room sees these changes immediately.
      </div>
      <Dial
        label="room"
        value={ambient.room}
        options={['clearing', 'plaza']}
        onChange={(v) => onChange({ room: v as AmbientRoom })}
        cols2
      />
      <Dial
        label="time"
        value={ambient.time}
        options={['dawn', 'day', 'dusk', 'night']}
        onChange={(v) => onChange({ time: v as AmbientTime })}
      />
      <Dial
        label="weather"
        value={ambient.weather}
        options={['clear', 'rain', 'snow', 'fog']}
        onChange={(v) => onChange({ weather: v as AmbientWeather })}
      />
      {ambient.weather !== 'clear' && (
        <div className="dial-group">
          <div className="label">intensity · {ambient.intensity ?? 70}%</div>
          <input
            type="range"
            className="intensity-slider"
            min={0}
            max={100}
            step={1}
            value={ambient.intensity ?? 70}
            onChange={(e) => onChange({ intensity: parseInt(e.target.value, 10) })}
          />
        </div>
      )}
    </Sheet>
  );
}

interface DialProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  cols2?: boolean;
}

function Dial({ label, value, options, onChange, cols2 = false }: DialProps) {
  return (
    <div className="dial-group">
      <div className="label">{label}</div>
      <div className={`dial-options${cols2 ? ' cols-2' : ''}`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`dial-btn${o === value ? ' selected' : ''}`}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
