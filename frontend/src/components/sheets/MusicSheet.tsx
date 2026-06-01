import { useState, type RefObject } from 'react';
import Icon from '../Icon';
import { Sheet } from './Sheet';
import { useYoutubeExamples } from '../../hooks/useYoutubeExamples';
import { useYoutubeMeta, useYoutubePlaylistMeta } from '../../hooks/useYoutubeMeta';
import { parseYouTube, thumbUrl } from '../../youtube';
import type { PlaybackState } from '../../types';

export type PlayerMode = 'theater' | 'audio';

interface MusicSheetProps {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  playback: PlaybackState;
  queue: string[];
  /** Mount target for the YouTube IFrame in mini/theater modes. Room owns
      the ref because the player has to survive when the sheet closes. */
  stageRef: RefObject<HTMLDivElement>;
  playerMode: PlayerMode;
  onChangePlayerMode: (mode: PlayerMode) => void;
  currentSec: number;
  durationSec: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onNext: () => void;
  onPlay: (videoId: string) => void;
  onAddToQueue: (videoId: string) => void;
  onPlayCollection: (videoIds: string[]) => void;
  onAddManyToQueue: (videoIds: string[]) => void;
  onRemoveFromQueue: (videoId: string, index: number) => void;
  onClearQueue: () => void;
  /** Expand a pasted playlist URL into its video ids via the IFrame
      player (no API key). Returns [] if expansion fails. */
  onExpandPlaylist: (playlistId: string) => Promise<string[]>;
}

export function MusicSheet(props: MusicSheetProps) {
  const { open, onClose, enabled } = props;
  return (
    <Sheet open={open} onClose={onClose} title="music" tall>
      {enabled ? <MusicScreen {...props} /> : <MusicGate onEnable={props.onEnable} />}
    </Sheet>
  );
}

function MusicGate({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="yt-gate">
      <div className="yt-gate-mark"><Icon name="yt" size={30} /></div>
      <div className="h-display" style={{ fontSize: 20, marginBottom: 8 }}>play music together</div>
      <div className="body-text" style={{ marginBottom: 18, maxWidth: 280 }}>
        everyone in the room hears the same track, in sync. no login, no premium — just paste a youtube link.
      </div>
      <button type="button" className="btn compact" onClick={onEnable}>
        turn on music
      </button>
    </div>
  );
}

function MusicScreen(props: MusicSheetProps) {
  const {
    playback, queue, stageRef, playerMode, onChangePlayerMode,
    currentSec, durationSec,
    onTogglePlay, onRestart, onNext,
    onPlay, onAddToQueue, onPlayCollection, onAddManyToQueue,
    onRemoveFromQueue, onClearQueue, onDisable, onExpandPlaylist,
  } = props;
  const trackId = playback.trackUri;

  return (
    <div>
      {trackId ? (
        <NowCard
          trackId={trackId}
          playerMode={playerMode}
          isPlaying={playback.isPlaying}
          currentSec={currentSec}
          durationSec={durationSec}
          stageRef={stageRef}
          hasNext={queue.length > 0}
          onTogglePlay={onTogglePlay}
          onRestart={onRestart}
          onNext={onNext}
          onChangePlayerMode={onChangePlayerMode}
        />
      ) : (
        <div className="yt-empty-now">
          <div className="h-mono">now playing</div>
          <div className="body-text" style={{ marginTop: 6 }}>
            nothing yet — paste a youtube link below to start.
          </div>
        </div>
      )}

      <div className="music-section-label">add</div>
      <PasteBar
        onPlay={onPlay}
        onAddToQueue={onAddToQueue}
        onPlayCollection={onPlayCollection}
        onAddManyToQueue={onAddManyToQueue}
        onExpandPlaylist={onExpandPlaylist}
      />

      <div className="music-section-label" style={{ marginTop: 4 }}>up next · {queue.length}</div>
      {queue.length === 0 ? (
        <div className="queue-empty">queue is empty.</div>
      ) : (
        <div>
          {queue.map((id, i) => (
            <QueueRow
              key={`${id}-${i}`}
              videoId={id}
              onPlay={() => onPlay(id)}
              onRemove={() => onRemoveFromQueue(id, i)}
            />
          ))}
        </div>
      )}

      <div className="music-footer">
        {queue.length > 0 && (
          <button type="button" className="music-footer-link" onClick={onClearQueue}>
            clear queue
          </button>
        )}
        <button type="button" className="music-footer-link" onClick={onDisable}>
          turn off music
        </button>
      </div>
    </div>
  );
}

interface NowCardProps {
  trackId: string;
  playerMode: PlayerMode;
  isPlaying: boolean;
  currentSec: number;
  durationSec: number;
  stageRef: RefObject<HTMLDivElement>;
  hasNext: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onNext: () => void;
  onChangePlayerMode: (mode: PlayerMode) => void;
}

function NowCard({
  trackId, playerMode, isPlaying, currentSec, durationSec,
  stageRef, hasNext, onTogglePlay, onRestart, onNext, onChangePlayerMode,
}: NowCardProps) {
  const meta = useYoutubeMeta(trackId);
  return (
    <div>
      {playerMode === 'theater' && (
        <div className="yt-theater">
          <div ref={stageRef} className="yt-theater-frame" />
        </div>
      )}
      <div className="music-now">
        <img
          src={meta.art || thumbUrl(trackId)}
          className="music-art-lg"
          alt=""
          style={{ objectFit: 'cover' }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div className="h-mono">now playing</div>
          <div className="h-display yt-clamp" style={{ fontSize: 17 }}>{meta.title}</div>
          <div className="body-text yt-clamp">{meta.channel}</div>
        </div>
        <div className="music-now-controls">
          <button type="button" className="row-icon-btn" aria-label="restart" onClick={onRestart}>
            <Icon name="prev" size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn primary"
            aria-label={isPlaying ? 'pause' : 'play'}
            onClick={onTogglePlay}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn"
            aria-label="next"
            onClick={onNext}
            disabled={!hasNext}
            style={{ opacity: hasNext ? 1 : 0.4 }}
          >
            <Icon name="next" size={14} />
          </button>
        </div>
      </div>
      <div style={{ margin: '-8px 0 18px' }}>
        <ProgressBar cur={currentSec} dur={durationSec} />
      </div>
      <PlayerModeRow value={playerMode} onChange={onChangePlayerMode} />
    </div>
  );
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ProgressBar({ cur, dur }: { cur: number; dur: number }) {
  const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
  return (
    <div className="yt-prog">
      <div className="yt-prog-track">
        <div className="yt-prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="yt-prog-times">
        <span>{fmtTime(cur)}</span>
        <span>youtube · {fmtTime(dur)}</span>
      </div>
    </div>
  );
}

function PlayerModeRow({ value, onChange }: { value: PlayerMode; onChange: (m: PlayerMode) => void }) {
  const modes: PlayerMode[] = ['theater', 'audio'];
  return (
    <div className="yt-mode-row">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          className={`yt-mode-chip${value === m ? ' selected' : ''}`}
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function QueueRow({
  videoId,
  onPlay,
  onRemove,
}: {
  videoId: string;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const meta = useYoutubeMeta(videoId);
  const blocked = meta.available === false;
  return (
    <div className="spotify-row">
      <img src={meta.art || thumbUrl(videoId)} className="spotify-row-art" alt="" />
      <div className="spotify-row-body">
        <div className="spotify-row-title">{meta.title}</div>
        <div className="spotify-row-meta">
          {blocked ? "can't be embedded" : meta.channel}
        </div>
      </div>
      <div className="spotify-row-actions">
        <button
          type="button"
          className="row-icon-btn primary"
          aria-label="play now"
          onClick={onPlay}
          disabled={blocked}
          style={{ opacity: blocked ? 0.4 : 1 }}
        >
          <Icon name="play" size={14} />
        </button>
        <button type="button" className="row-icon-btn" aria-label="remove" onClick={onRemove}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

interface PasteBarProps {
  onPlay: (videoId: string) => void;
  onAddToQueue: (videoId: string) => void;
  onPlayCollection: (videoIds: string[]) => void;
  onAddManyToQueue: (videoIds: string[]) => void;
  onExpandPlaylist: (playlistId: string) => Promise<string[]>;
}

type PasteResult =
  | { kind: 'video'; id: string }
  | { kind: 'playlist'; id: string; ids: string[] }
  | null;

function PasteBar({
  onPlay,
  onAddToQueue,
  onPlayCollection,
  onAddManyToQueue,
  onExpandPlaylist,
}: PasteBarProps) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<PasteResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const examples = useYoutubeExamples();

  async function resolve(raw: string) {
    const parsed = parseYouTube(raw);
    if (!parsed) {
      setResult(null);
      setError("couldn't read that — paste a youtube video or playlist link.");
      return;
    }
    setError(null);
    if (parsed.kind === 'video') {
      setResult({ kind: 'video', id: parsed.id });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const ids = await onExpandPlaylist(parsed.id);
      if (ids.length === 0) {
        setError("couldn't read that playlist — it may be private or unavailable.");
      } else {
        setResult({ kind: 'playlist', id: parsed.id, ids });
      }
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setValue('');
    setResult(null);
  }

  return (
    <div>
      <div className="music-input">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') resolve(value);
          }}
          placeholder="paste a youtube link…"
          inputMode="url"
        />
        <button type="button" disabled={!value.trim() || busy} onClick={() => resolve(value)}>
          {busy ? '…' : 'search'}
        </button>
      </div>

      {examples.length > 0 && (
        <div className="yt-examples">
          <span className="h-mono">try</span>
          {examples.map((ex) => (
            <button
              key={ex.url}
              type="button"
              className="yt-chip"
              onClick={() => {
                setValue(ex.url);
                resolve(ex.url);
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className="music-error">{error}</div>}

      {busy && <div className="music-section-label">searching…</div>}

      {!busy && result?.kind === 'video' && (
        <ResolvedRow
          title="found a video"
          art={thumbUrl(result.id)}
          videoId={result.id}
          onPlay={() => {
            onPlay(result.id);
            clear();
          }}
          onQueue={() => onAddToQueue(result.id)}
        />
      )}
      {!busy && result?.kind === 'playlist' && (
        <ResolvedPlaylistRow
          playlistId={result.id}
          videoIds={result.ids}
          onPlayAll={() => {
            onPlayCollection(result.ids);
            clear();
          }}
          onQueueAll={() => onAddManyToQueue(result.ids)}
        />
      )}
    </div>
  );
}

function ResolvedRow({
  title,
  art,
  videoId,
  onPlay,
  onQueue,
}: {
  title: string;
  art: string;
  videoId: string;
  onPlay: () => void;
  onQueue: () => void;
}) {
  const meta = useYoutubeMeta(videoId);
  const blocked = meta.available === false;
  return (
    <div>
      <div className="music-section-label">{title}</div>
      <div className="spotify-row">
        <img src={meta.art || art} className="spotify-row-art" alt="" />
        <div className="spotify-row-body">
          <div className="spotify-row-title">{meta.title}</div>
          <div className="spotify-row-meta">
            {blocked ? "can't be played outside youtube" : meta.channel}
          </div>
        </div>
        <div className="spotify-row-actions">
          <button
            type="button"
            className="row-icon-btn primary"
            aria-label="play now"
            onClick={onPlay}
            disabled={blocked}
            style={{ opacity: blocked ? 0.4 : 1 }}
          >
            <Icon name="play" size={14} />
          </button>
          <button
            type="button"
            className="row-icon-btn"
            aria-label="add to queue"
            onClick={onQueue}
            disabled={blocked}
            style={{ opacity: blocked ? 0.4 : 1 }}
          >
            <Icon name="queue-add" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolvedPlaylistRow({
  playlistId,
  videoIds,
  onPlayAll,
  onQueueAll,
}: {
  playlistId: string;
  videoIds: string[];
  onPlayAll: () => void;
  onQueueAll: () => void;
}) {
  const meta = useYoutubePlaylistMeta(playlistId);
  // YouTube oEmbed doesn't always return a playlist thumbnail; fall back
  // to the first video's mqdefault as the cover.
  const art = meta.art || (videoIds[0] ? thumbUrl(videoIds[0]) : '');
  return (
    <div>
      <div className="music-section-label">found a playlist</div>
      <div className="spotify-row">
        {art ? (
          <img src={art} className="spotify-row-art" alt="" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="spotify-row-art yt-pl-art">
            <Icon name="list" size={20} />
          </div>
        )}
        <div className="spotify-row-body">
          <div className="spotify-row-title">{meta.title}</div>
          <div className="spotify-row-meta">
            {meta.channel ? `${meta.channel} · ` : ''}
            {videoIds.length} videos
          </div>
        </div>
        <div className="spotify-row-actions">
          <button type="button" className="row-icon-btn primary" aria-label="play all" onClick={onPlayAll}>
            <Icon name="play" size={14} />
          </button>
          <button type="button" className="row-icon-btn" aria-label="queue all" onClick={onQueueAll}>
            <Icon name="queue-add" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
