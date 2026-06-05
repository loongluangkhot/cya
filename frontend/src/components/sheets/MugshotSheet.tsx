import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import Icon from '../Icon';
import { useMugshotCamera } from '../../hooks/useMugshotCamera';

interface MugshotSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (image: ArrayBuffer, mime: string) => void;
  optIn: boolean;
  onToggleOptIn: () => void;
  boardOn: boolean;
  onToggleBoard: () => void;
  intervalS: number;
  onChangeInterval: (seconds: number) => void;
}

const INTERVAL_PRESETS: { label: string; seconds: number }[] = [
  { label: '15m', seconds: 15 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '1h', seconds: 60 * 60 },
  { label: '2h', seconds: 2 * 60 * 60 },
];

export function MugshotSheet({
  open,
  onClose,
  onSubmit,
  optIn,
  onToggleOptIn,
  boardOn,
  onToggleBoard,
  intervalS,
  onChangeInterval,
}: MugshotSheetProps) {
  const camera = useMugshotCamera();
  const [busy, setBusy] = useState(false);

  // Camera lifecycle is bound to (sheet open AND opted in). Opted-out
  // sheet views never wake the camera up.
  useEffect(() => {
    if (!open || !optIn) {
      camera.stop();
      return;
    }
    camera.start();
    return () => {
      camera.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, optIn]);

  async function onSnap() {
    if (busy) return;
    setBusy(true);
    try {
      const clip = await camera.capture();
      if (!clip) return;
      onSubmit(clip.image, clip.mime);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const headerAction = (
    <>
      <button
        type="button"
        className={`sheet-toggle${optIn ? ' on' : ''}`}
        onClick={onToggleOptIn}
        aria-pressed={optIn}
        aria-label={optIn ? 'leave the mugshot wall' : 'join the mugshot wall'}
      >
        {optIn ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className={`sheet-icon-toggle${optIn && boardOn ? ' on' : ''}`}
        onClick={onToggleBoard}
        aria-pressed={boardOn}
        aria-label={boardOn ? 'hide the wall' : 'show the wall'}
        title={boardOn ? 'hide the wall' : 'show the wall'}
        disabled={!optIn}
      >
        <Icon name="screen" size={12} />
      </button>
    </>
  );

  // ─── Opted-out: pitch the feature ─────────────────────────
  if (!optIn) {
    return (
      <Sheet open={open} onClose={onClose} title="mugshot" tall headerAction={headerAction}>
        <div className="sheet-gate">
          <div className="sheet-gate-mark" aria-hidden="true">
            ◉
          </div>
          <div className="h-display" style={{ fontSize: 20, marginBottom: 8 }}>
            join the mugshot wall
          </div>
          <div className="body-text" style={{ marginBottom: 18, maxWidth: 280 }}>
            on each prompt, snap a quick selfie — yours appears on the floating
            wall and you can see everyone else&apos;s.
          </div>
          <button type="button" className="btn compact" onClick={onToggleOptIn}>
            join the wall
          </button>
        </div>
      </Sheet>
    );
  }

  // ─── Opted-in: capture flow + inline settings ──────────────
  const errorText =
    camera.status === 'denied'
      ? 'camera access denied — check browser permissions'
      : camera.status === 'unsupported'
        ? "camera isn't supported in this browser"
        : null;
  const ready = camera.status === 'ready';

  return (
    <Sheet open={open} onClose={onClose} title="mugshot" tall headerAction={headerAction}>
      <div className="mug-layout">
        {/* Compact settings strip — interval only; wall visibility is in the header. */}
        <div className="mug-settings">
          <div className="mug-settings-label h-mono">interval</div>
          <div className="mug-interval-row">
            {INTERVAL_PRESETS.map((p) => (
              <button
                key={p.seconds}
                type="button"
                className={`dial-btn${p.seconds === intervalS ? ' selected' : ''}`}
                onClick={() => onChangeInterval(p.seconds)}
                aria-pressed={p.seconds === intervalS}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mug-stage">
          {ready ? (
            <video
              ref={camera.attachVideo}
              className="mug-preview"
              playsInline
              muted
              autoPlay
            />
          ) : (
            <div className="mug-preview mug-preview-empty">
              {camera.status === 'requesting' ? 'waking up the camera…' : ' '}
            </div>
          )}
        </div>

        {errorText && <div className="composer-error">{errorText}</div>}

        <div className="mug-actions">
          <button
            type="button"
            className="dial-btn"
            onClick={onClose}
            disabled={busy}
          >
            cancel
          </button>
          <button
            type="button"
            className="dial-btn selected mug-snap"
            onClick={onSnap}
            disabled={!ready || busy}
          >
            {busy ? 'sending…' : 'snap'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
