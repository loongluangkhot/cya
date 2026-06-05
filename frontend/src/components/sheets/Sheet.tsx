import type { ReactNode } from 'react';
import Icon from '../Icon';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  /** Optional element rendered to the right of the title, before the
   *  close button — used by features with an on/off toggle (music,
   *  mugshot) so the toggle lives next to the title in the header. */
  headerAction?: ReactNode;
}

export function Sheet({ open, title, onClose, children, tall, headerAction }: SheetProps) {
  return (
    <div className={`sheet-root ${open ? 'open' : 'closed'}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${tall ? ' tall' : ''}`}>
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <div className="sheet-head-actions">
            {headerAction}
            <button type="button" className="sheet-close" onClick={onClose} aria-label="close">
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
