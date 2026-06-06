import { useEffect, useRef, useState } from 'react';
import type { MarqueeItem } from '../../types';

interface MarqueeStripProps {
  items: MarqueeItem[];
  onOpenArticle: (id: string) => void;
  feedTitle: (url: string) => string;
}

// Pixels-per-second scroll speed. Tuned so a typical headline reads
// comfortably without being slow enough to feel stuck.
const SPEED_PX_S = 60;

// Press shorter than this is treated as a tap (opens the article); longer
// presses are treated as "holding to pause and read" and don't navigate.
const TAP_MAX_MS = 250;

/** Horizontal ticker fixed to the top of the room scene.
 *  Auto-scrolls right-to-left; press-and-hold pauses the scroll
 *  (no drag-to-scroll). The track is doubled and translated by
 *  -trackWidth / 2 so the loop is seamless. */
export function MarqueeStrip({ items, onOpenArticle, feedTitle }: MarqueeStripProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  // Timestamp of the current press; click only navigates if release came
  // within TAP_MAX_MS. A long press is interpreted as "hold to read."
  const pressStartRef = useRef<number>(0);

  // Re-measure when the item set changes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // The track contains two copies of the same headlines for the
    // seamless loop; halve the measured width to get one cycle.
    const measure = () => setTrackWidth(el.scrollWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  const durationS = trackWidth > 0 ? trackWidth / SPEED_PX_S : 0;

  // Don't call setPointerCapture here — if the strip captures the
  // pointer, the inner button never sees a clean pointerdown→pointerup
  // pair and the browser won't dispatch the click event. Instead we
  // attach a window-level pointerup fallback below so the strip still
  // unpauses if the user releases outside it (e.g. mouse drift on desktop).
  function holdStart() {
    pressStartRef.current = Date.now();
    setPaused(true);
  }
  function holdEnd() {
    setPaused(false);
  }

  useEffect(() => {
    if (!paused) return;
    const release = () => setPaused(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [paused]);

  if (items.length === 0) return null;

  // Doubled items so the loop translates seamlessly.
  const doubled = [...items, ...items];

  return (
    <div
      className={`marquee-strip${paused ? ' is-paused' : ''}`}
      onPointerDown={holdStart}
      onPointerUp={holdEnd}
      onPointerCancel={holdEnd}
      onPointerLeave={holdEnd}
      role="region"
      aria-label="marquee"
    >
      <div
        ref={trackRef}
        className="marquee-strip-track"
        style={
          durationS > 0
            ? ({ ['--marquee-duration' as string]: `${durationS}s` } as React.CSSProperties)
            : undefined
        }
      >
        {doubled.map((item, i) => (
          <button
            key={`${item.id}-${i}`}
            type="button"
            className="marquee-strip-item"
            onClick={() => {
              if (Date.now() - pressStartRef.current > TAP_MAX_MS) return;
              onOpenArticle(item.id);
            }}
            aria-label={`${feedTitle(item.feed_url)}: ${item.title}`}
          >
            <span className="marquee-strip-source">{feedTitle(item.feed_url)}</span>
            <span className="marquee-strip-sep" aria-hidden="true">·</span>
            <span className="marquee-strip-title">{item.title}</span>
            <span className="marquee-strip-gap" aria-hidden="true">·</span>
          </button>
        ))}
      </div>
    </div>
  );
}
