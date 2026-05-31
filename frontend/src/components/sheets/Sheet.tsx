import type { ReactNode } from 'react';
import Icon from '../Icon';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
}

export function Sheet({ open, title, onClose, children, tall }: SheetProps) {
  return (
    <div className={`sheet-root ${open ? 'open' : 'closed'}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${tall ? ' tall' : ''}`}>
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="close">
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
