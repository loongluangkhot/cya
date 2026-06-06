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

// Touch press shorter than this is treated as a tap (opens the article);
// longer touches are "hold to pause and read" and don't navigate. Mouse/pen
// users have a real hover, so this gate doesn't apply to them.
const TAP_MAX_MS = 250;

/** Horizontal ticker fixed to the top of the room scene.
 *  Auto-scrolls right-to-left; pauses on hover (desktop) and on
 *  press-and-hold (touch — pointerenter/leave fire on touchstart/end,
 *  so the same handlers cover both). The track is doubled and translated
 *  by -trackWidth / 2 so the loop is seamless. */
export function MarqueeStrip({ items, onOpenArticle, feedTitle }: MarqueeStripProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  // When the strip is entered with a touch pointer, remember the entry
  // time and pointer type so the inner button can suppress the click for
  // a long press. Mouse/pen users hover-to-pause and click freely.
  const pressStartRef = useRef<number>(0);
  const pointerTypeRef = useRef<string>('');

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

  // pointerenter fires on mouse hover (desktop) and on touchstart (mobile),
  // so the same pair of handlers covers hover-to-pause and press-and-hold
  // without any media-query branching.
  function holdStart(e: React.PointerEvent) {
    pointerTypeRef.current = e.pointerType;
    pressStartRef.current = Date.now();
    setPaused(true);
  }
  function holdEnd() {
    setPaused(false);
  }

  // Safety net for pointercancel from the OS — pointerleave usually fires
  // too, but cancel can arrive without it (e.g. touch interrupted by a
  // system gesture).
  useEffect(() => {
    if (!paused) return;
    const release = () => setPaused(false);
    window.addEventListener('pointercancel', release);
    return () => window.removeEventListener('pointercancel', release);
  }, [paused]);

  if (items.length === 0) return null;

  // Doubled items so the loop translates seamlessly.
  const doubled = [...items, ...items];

  return (
    <div
      className={`marquee-strip${paused ? ' is-paused' : ''}`}
      onPointerEnter={holdStart}
      onPointerLeave={holdEnd}
      onPointerCancel={holdEnd}
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
              // Only gate clicks on touch — desktop hover-to-pause should
              // never block a deliberate click, no matter how long the
              // pointer has been over the strip.
              if (
                pointerTypeRef.current === 'touch' &&
                Date.now() - pressStartRef.current > TAP_MAX_MS
              ) {
                return;
              }
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
