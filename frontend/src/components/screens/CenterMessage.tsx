import type { ReactNode } from 'react';
import Wordmark from '../Wordmark';

interface CenterMessageProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function CenterMessage({ title, subtitle, children }: CenterMessageProps) {
  return (
    <div className="center-screen">
      <Wordmark size={48} sub={subtitle} />
      <div className="h-display" style={{ fontSize: 18 }}>{title}</div>
      {children}
    </div>
  );
}
