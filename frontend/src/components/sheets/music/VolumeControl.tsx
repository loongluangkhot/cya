import { useRef, useState } from 'react';
import Icon from '../../Icon';

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
}

/** Speaker button in the transport row → tap opens a compact slider
    popover. Per-listener, local-only — the room never sees the value. */
export function VolumeControl({
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
}: VolumeControlProps) {
  const [open, setOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const shown = muted ? 0 : volume;
  const iconName = muted || volume === 0 ? 'volx' : 'vol';

  function setFromX(clientX: number) {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pct = Math.round(((clientX - r.left) / r.width) * 100);
    onChangeVolume(Math.max(0, Math.min(100, pct)));
  }
  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromX(e.clientX);
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (draggingRef.current) setFromX(e.clientX);
  }
  function onUp() {
    draggingRef.current = false;
  }

  return (
    <div className="music-vol-wrap">
      <button
        type="button"
        className={`row-icon-btn ghost${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="volume"
        title="volume"
      >
        <Icon name={iconName} size={15} />
      </button>
      {open && (
        <>
          {/* Click-outside dismiss layer. Lives in the same wrapper so
              tapping the popover itself doesn't bubble through. */}
          <div className="music-vol-dismiss" onClick={() => setOpen(false)} />
          <div className="music-vol-pop" role="dialog" aria-label="volume">
            <button
              type="button"
              className="music-vol-mute"
              onClick={onToggleMute}
              title={muted ? 'unmute' : 'mute'}
              aria-label={muted ? 'unmute' : 'mute'}
            >
              <Icon name={iconName} size={15} />
            </button>
            <div
              className="music-vol-track"
              ref={trackRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              role="slider"
              aria-label="volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={shown}
            >
              <div className="music-vol-fill" style={{ width: `${shown}%` }} />
              <div className="music-vol-thumb" style={{ left: `${shown}%` }} />
            </div>
            <span className="music-vol-val">{shown}</span>
          </div>
        </>
      )}
    </div>
  );
}
