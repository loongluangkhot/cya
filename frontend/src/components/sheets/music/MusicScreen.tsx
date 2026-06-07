import { useRef, useState } from 'react';
import { NowCard } from './NowCard';
import { PasteBar } from './PasteBar';
import { QueueRow } from './QueueRow';
import type { MusicScreenProps } from './types';

const QUEUE_PEEK_LIMIT = 5;

export function MusicScreen(props: MusicScreenProps) {
  const {
    playback,
    queue,
    currentSec,
    durationSec,
    volume,
    muted,
    onChangeVolume,
    onToggleMute,
    onTogglePlay,
    onRestart,
    onNext,
    onPlay,
    onAddToQueue,
    onPlayCollection,
    onAddManyToQueue,
    onRemoveFromQueue,
    onReorderQueue,
    onClearQueue,
    onExpandPlaylist,
  } = props;
  const trackId = playback.trackUri;
  const [showAll, setShowAll] = useState(false);

  // Drag-reorder controller shared across rows. Each row registers its
  // own DOM node via the bind() ref, the grip's pointer handlers feed
  // pointer Y back to .move(), and the row whose bounds contain it
  // becomes the new target. We optimistic-update via onReorderQueue,
  // which already snaps the local queue and emits to the server.
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [activeIndex, setActiveIndex] = useState(-1);
  const dragFromRef = useRef(-1);
  // The videoId of the dragged item, captured at grip-down. We re-resolve
  // dragFromRef from this on every move so a remote queueChanged (someone
  // else adds/removes/advances while we're dragging) doesn't end up
  // reordering whichever item happens to sit at our original index now.
  const draggedIdRef = useRef<string | null>(null);

  const visible = showAll ? queue : queue.slice(0, QUEUE_PEEK_LIMIT);
  const hidden = queue.length - visible.length;

  function gripStart(i: number, id: string) {
    dragFromRef.current = i;
    draggedIdRef.current = id;
    setActiveIndex(i);
  }
  function gripMove(y: number) {
    let from = dragFromRef.current;
    const id = draggedIdRef.current;
    if (from < 0 || id === null) return;
    // Re-anchor by id in case the local queue shifted under us. If the
    // dragged item is gone entirely (someone removed it), end the drag.
    if (visible[from] !== id) {
      const found = visible.indexOf(id);
      if (found < 0) {
        gripEnd();
        return;
      }
      from = found;
      dragFromRef.current = from;
      setActiveIndex(from);
    }

    // Find the target row by pointer Y. Edge-clamp: dragging above the
    // first visible row's top targets index 0, below the last row's
    // bottom targets the last. Break on first containment so overlapping
    // rects during the lift animation don't make the last-iterated row
    // win.
    let target = from;
    let firstTop = Number.POSITIVE_INFINITY;
    let firstIdx = -1;
    let lastBottom = Number.NEGATIVE_INFINITY;
    let lastIdx = -1;
    let matched = false;
    for (const [k, el] of Object.entries(rowRefs.current)) {
      if (!el) continue;
      const idx = Number(k);
      const r = el.getBoundingClientRect();
      if (r.top < firstTop) {
        firstTop = r.top;
        firstIdx = idx;
      }
      if (r.bottom > lastBottom) {
        lastBottom = r.bottom;
        lastIdx = idx;
      }
      if (!matched && y >= r.top && y <= r.bottom) {
        target = idx;
        matched = true;
      }
    }
    if (!matched) {
      if (firstIdx >= 0 && y < firstTop) target = firstIdx;
      else if (lastIdx >= 0 && y > lastBottom) target = lastIdx;
    }

    if (target !== from) {
      onReorderQueue(from, target);
      dragFromRef.current = target;
      setActiveIndex(target);
    }
  }
  function gripEnd() {
    dragFromRef.current = -1;
    draggedIdRef.current = null;
    setActiveIndex(-1);
  }

  return (
    <div>
      {trackId ? (
        <NowCard
          trackId={trackId}
          isPlaying={playback.isPlaying}
          currentSec={currentSec}
          durationSec={durationSec}
          hasNext={queue.length > 0}
          volume={volume}
          muted={muted}
          onTogglePlay={onTogglePlay}
          onRestart={onRestart}
          onNext={onNext}
          onChangeVolume={onChangeVolume}
          onToggleMute={onToggleMute}
        />
      ) : (
        <div className="yt-empty-now">nothing playing — add a track below.</div>
      )}

      <PasteBar
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onPlayCollection={onPlayCollection}
        onAddManyToQueue={onAddManyToQueue}
        onExpandPlaylist={onExpandPlaylist}
      />

      <div className="music-section-head">
        <span className="music-section-label">up next · {queue.length}</span>
        {queue.length > 0 && (
          <button type="button" className="music-section-action" onClick={onClearQueue}>
            clear
          </button>
        )}
      </div>
      {queue.length === 0 ? (
        <div className="queue-empty">queue is empty.</div>
      ) : (
        <div className="music-qlist">
          {visible.map((id, i) => (
            <QueueRow
              key={`${id}-${i}`}
              videoId={id}
              index={i}
              lifting={activeIndex === i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              onPlay={() => onPlay(id)}
              onRemove={() => onRemoveFromQueue(id, i)}
              onMoveTop={() => onReorderQueue(i, 0)}
              onGripDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                gripStart(i, id);
              }}
              onGripMove={(e) => gripMove(e.clientY)}
              onGripUp={gripEnd}
            />
          ))}
          {hidden > 0 && (
            <button type="button" className="music-more" onClick={() => setShowAll(true)}>
              +{hidden} more
            </button>
          )}
          {showAll && queue.length > QUEUE_PEEK_LIMIT && (
            <button type="button" className="music-more" onClick={() => setShowAll(false)}>
              show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
