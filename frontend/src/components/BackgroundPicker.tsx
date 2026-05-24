import { BACKGROUNDS } from '../backgrounds';
import BackgroundLayer from './BackgroundLayer';
import type { BackgroundId } from '../types';

interface BackgroundPickerProps {
  background: BackgroundId;
  onChange: (id: BackgroundId) => void;
}

export default function BackgroundPicker({
  background,
  onChange,
}: BackgroundPickerProps) {
  return (
    <div className="bg-picker">
      {BACKGROUNDS.map((bg) => (
        <button
          key={bg.id}
          type="button"
          className={`bg-option ${background === bg.id ? 'selected' : ''}`}
          onClick={() => onChange(bg.id)}
          aria-pressed={background === bg.id}
        >
          <div className="bg-preview">
            <BackgroundLayer id={bg.id} />
          </div>
          <span className="bg-name">{bg.name}</span>
        </button>
      ))}
    </div>
  );
}
