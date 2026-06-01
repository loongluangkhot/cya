import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface DPadProps {
  onNudge: (dx: number, dy: number) => void;
}

export function DPad({ onNudge }: DPadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const dirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const activePointerRef = useRef<number | null>(null);
  const [activeDir, setActiveDir] = useState<{ dx: number; dy: number } | null>(null);

  // Map pointer position → 8-way direction. The whole 3×3 cross is one
  // virtual stick: the angle from the center decides which way we walk,
  // so a tap on the up arrow and a drag toward the top-left both work.
  function pointerDir(clientX: number, clientY: number): { dx: number; dy: number } {
    const el = containerRef.current;
    if (!el) return { dx: 0, dy: 0 };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ox = clientX - cx;
    const oy = clientY - cy;
    // Dead zone in the center cell — touching the core shouldn't drift.
    if (Math.hypot(ox, oy) < rect.width * 0.16) return { dx: 0, dy: 0 };
    // 8 sectors: divide 2π into eighths, snap to the nearest cardinal/diagonal.
    const sector = ((Math.round(Math.atan2(oy, ox) / (Math.PI / 4)) % 8) + 8) % 8;
    // 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
    const table: [number, number][] = [
      [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];
    const [dx, dy] = table[sector];
    return { dx, dy };
  }

  function applyDir(dir: { dx: number; dy: number }) {
    dirRef.current = dir;
    setActiveDir(dir.dx === 0 && dir.dy === 0 ? null : dir);
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activePointerRef.current = e.pointerId;
    const dir = pointerDir(e.clientX, e.clientY);
    applyDir(dir);
    if (dir.dx || dir.dy) onNudge(dir.dx, dir.dy);
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      const d = dirRef.current;
      if (d.dx || d.dy) onNudge(d.dx, d.dy);
    }, 130);
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== e.pointerId) return;
    applyDir(pointerDir(e.clientX, e.clientY));
  }
  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    applyDir({ dx: 0, dy: 0 });
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }
  useEffect(
    () => () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    },
    [],
  );

  // Visual cell. Highlights when its direction matches the current
  // 8-way input — cardinal cells light up for diagonal inputs too.
  function cell(dx: number, dy: number, glyph: string, klass: string) {
    const active =
      activeDir !== null &&
      (dx === 0 || activeDir.dx === dx) &&
      (dy === 0 || activeDir.dy === dy) &&
      !(dx === 0 && dy === 0);
    return (
      <div className={`dpad-btn ${klass}${active ? ' is-active' : ''}`} aria-hidden="true">
        {glyph}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="dpad"
      aria-label="movement controls"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {cell(0, -1, '▲', 'dpad-up')}
      {cell(-1, 0, '◀', 'dpad-left')}
      <div className="dpad-core" aria-hidden="true" />
      {cell(1, 0, '▶', 'dpad-right')}
      {cell(0, 1, '▼', 'dpad-down')}
    </div>
  );
}
