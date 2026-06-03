import { Sheet } from './Sheet';
import { THEMES, type ThemeId } from '../../themes';

export type NotifState = 'off' | 'on' | 'denied' | 'unsupported';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  theme: ThemeId;
  onChangeTheme: (next: ThemeId) => void;
  notifState: NotifState;
  onToggleNotif: () => void;
}

export function SettingsSheet({
  open,
  onClose,
  theme,
  onChangeTheme,
  notifState,
  onToggleNotif,
}: SettingsSheetProps) {
  const notifOn = notifState === 'on';
  const notifDisabled = notifState === 'unsupported' || notifState === 'denied';
  const notifHint =
    notifState === 'denied'
      ? 'blocked in browser — re-enable in site permissions'
      : notifState === 'unsupported'
        ? 'not supported on this device'
        : notifOn
          ? 'on — only when this tab is in the background'
          : 'off';

  return (
    <Sheet open={open} onClose={onClose} title="settings">
      <div className="body-text" style={{ marginBottom: 18 }}>
        preferences here do not propagate to other people in the space.
      </div>

      <div className="dial-group">
        <div className="label">notifications</div>
        <button
          type="button"
          className={`dial-btn${notifOn ? ' selected' : ''}`}
          onClick={onToggleNotif}
          disabled={notifDisabled}
          aria-pressed={notifOn}
          style={{ width: '100%' }}
        >
          {notifOn ? 'on' : 'off'} · new messages
        </button>
        <div className="body-text" style={{ marginTop: 6, color: 'var(--muted)' }}>
          {notifHint}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div className="label">look</div>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-tile${t.id === theme ? ' selected' : ''}`}
              onClick={() => onChangeTheme(t.id)}
              aria-pressed={t.id === theme}
              aria-label={`theme: ${t.name}`}
            >
              <div
                className="theme-swatch"
                style={{ background: t.bg, borderColor: t.fg, color: t.fg }}
              >
                Aa
              </div>
              <span className="theme-tile-label">{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
