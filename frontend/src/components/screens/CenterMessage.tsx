import type { ReactNode } from 'react';
import Wordmark from '../Wordmark';

interface CenterMessageProps {
  title: string;
  children?: ReactNode;
}

export function CenterMessage({ title, children }: CenterMessageProps) {
  return (
    <div className="screen">
      <div className="status-bar-space" />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <Wordmark size={48} />
        <div className="h-display" style={{ fontSize: 18 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}
