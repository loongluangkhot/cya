import { THEMES } from '../themes';
import type { ThemeId } from '../types';

interface ThemePickerProps {
  theme: ThemeId;
  onChange: (id: ThemeId) => void;
  compact?: boolean;
}

export default function ThemePicker({
  theme,
  onChange,
  compact = false,
}: ThemePickerProps) {
  return (
    <div className={`theme-picker ${compact ? 'compact' : ''}`}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`theme-swatch ${theme === t.id ? 'selected' : ''}`}
          onClick={() => onChange(t.id)}
          title={t.name}
          aria-label={`theme ${t.name}`}
          aria-pressed={theme === t.id}
        >
          <span className="swatch-half" style={{ background: t.swatch[0] }} />
          <span className="swatch-half" style={{ background: t.swatch[1] }} />
        </button>
      ))}
    </div>
  );
}
