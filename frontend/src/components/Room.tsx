import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import IsoScene from './IsoScene';
import PixelCharacter from './PixelCharacter';
import SpotifyPlayer from './SpotifyPlayer';
import ErrorBoundary from './ErrorBoundary';
import Icon from './Icon';
import { MemoBlock } from './MemoBlock';
import { effectivePosition } from './spotify/shared';
import { colorHex } from '../characters';
import { useToasts } from '../hooks/useToasts';
import { useRoomState } from '../hooks/useRoomState';
import { useMovement } from '../hooks/useMovement';
import { useSpotifyPlayer, type UseSpotifyPlayerResult } from '../hooks/useSpotifyPlayer';
import type {
  Ambient,
  AmbientRoom,
  AmbientTime,
  AmbientWeather,
  ChatMessage,
  PlaybackState,
  User,
} from '../types';

interface RoomProps {
  roomId: string;
  onEditMe: () => void;
  onLeave: () => void;
  /** Persist a memo change back to the user's localStorage identity, so
      it travels into the next room they join. */
  onMemoPersist: (memo: string) => void;
}

type Sheet = 'people' | 'chat' | 'music' | 'ambience' | null;

export default function Room({ roomId, onEditMe, onLeave, onMemoPersist }: RoomProps) {
  const { toasts, pushToast } = useToasts();
  const {
    meId,
    users,
    setUsers,
    messages,
    bubbles,
    ambient,
    playback,
    queue,
    trackMeta,
    sendMessage,
    updateMemo,
    changeAmbient,
    changePlayback,
    addToQueue,
    addManyToQueue,
    playCollection,
    removeFromQueue,
    advanceQueue,
    clearQueue,
  } = useRoomState({ onToast: pushToast });
  const { nudge, wandering, setWandering } = useMovement({ meId, users, setUsers });

  // Spotify SDK lives at Room scope so the dock chip can reflect *this
  // user's* actual audio state — not just whatever the room thinks is
  // playing. When you first enter a room with Spotify already connected,
  // the SDK takes a beat to load and transfer playback; during that gap
  // the chip should say "starting…" rather than misleadingly say "playing".
  const player = useSpotifyPlayer({
    playback,
    queue,
    onLocalChange: changePlayback,
    onAddToQueue: addToQueue,
    onAddManyToQueue: addManyToQueue,
    onPlayCollection: playCollection,
    onAdvanceQueue: advanceQueue,
  });

  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');
  // Which peer's memo block is open inside PeopleSheet. Lifted here so
  // tapping a sticky note in the scene can open the sheet AND focus that
  // user's memo in one go. We seed it to the local user's id once they're
  // known, so the sheet opens with the user's own memo expanded — but
  // tapping the head still collapses it, so behaviour stays symmetric
  // with peer rows.
  const [expandedMemoId, setExpandedMemoId] = useState<string | null>(null);
  const seededExpandedRef = useRef(false);
  useEffect(() => {
    if (seededExpandedRef.current || !meId) return;
    seededExpandedRef.current = true;
    setExpandedMemoId(meId);
  }, [meId]);

  function onSend(text: string) {
    if (!text.trim()) return;
    sendMessage(text);
    setDraft('');
  }

  function changeMemo(memo: string) {
    updateMemo(memo);
    onMemoPersist(memo);
  }

  // Dock chip playback controls — operate on the shared room playback
  // state, not the local SDK. Whoever's connected applies them.
  function dockPrev() {
    if (!playback.trackUri) return;
    changePlayback({
      trackUri: playback.trackUri,
      isPlaying: true,
      positionMs: 0,
    });
  }
  function dockTogglePlay() {
    if (!playback.trackUri) return;
    changePlayback({
      trackUri: playback.trackUri,
      isPlaying: !playback.isPlaying,
      positionMs: effectivePosition(playback),
    });
  }
  function dockNext() {
    advanceQueue(playback.trackUri);
  }

  const peersById: Record<string, User> = Object.fromEntries(users.map((u) => [u.id, u]));

  // What the dock chip's status line should read. When the user is
  // connected to Spotify we trust the local SDK — otherwise fall back to
  // shared room state (the only signal a non-connected viewer has).
  const dockPlaybackLabel = computeDockPlaybackLabel(playback, player);

  return (
    <div className="room-root">
      <IsoScene
        peers={users}
        meId={meId}
        bubbles={bubbles}
        room={ambient.room}
        onOpenMemo={(peerId) => {
          setExpandedMemoId(peerId);
          setSheet('people');
        }}
      />
      <AmbienceOverlay ambient={ambient} />

      <DPad
        onNudge={(dx, dy) => {
          // Any manual D-pad input cancels wander.
          setWandering(false);
          nudge(dx, dy);
        }}
      />
      <button
        type="button"
        className={`wander-btn${wandering ? ' active' : ''}`}
        onClick={() => setWandering((w) => !w)}
        aria-pressed={wandering}
      >
        wander
      </button>

      <RoomTopBar
        roomId={roomId}
        peers={users}
        onOpenPeople={() => setSheet('people')}
        onLeave={onLeave}
      />

      <IrcLog messages={messages.slice(-4)} peersById={peersById} />

      <RoomDock
        ambient={ambient}
        spotifyConnected={player.connected}
        playback={playback}
        playbackLabel={dockPlaybackLabel}
        trackArt={
          player.connected && playback.trackUri
            ? trackMeta[playback.trackUri]?.art
            : undefined
        }
        trackTitle={
          player.connected && playback.trackUri
            ? trackMeta[playback.trackUri]?.title
            : undefined
        }
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        onOpenMusic={() => setSheet('music')}
        onOpenAmbience={() => setSheet('ambience')}
        onOpenChat={() => setSheet('chat')}
        hasQueue={queue.length > 0}
        onPrev={dockPrev}
        onTogglePlay={dockTogglePlay}
        onNext={dockNext}
      />

      <Toasts items={toasts} />

      <PeopleSheet
        open={sheet === 'people'}
        onClose={() => setSheet(null)}
        peers={users}
        meId={meId}
        onEditMe={onEditMe}
        onChangeMemo={changeMemo}
        expandedMemoId={expandedMemoId}
        onChangeExpandedMemoId={setExpandedMemoId}
      />
      <ChatLogSheet
        open={sheet === 'chat'}
        onClose={() => setSheet(null)}
        messages={messages}
        peersById={peersById}
      />
      <MusicSheet
        open={sheet === 'music'}
        onClose={() => setSheet(null)}
        player={player}
        playback={playback}
        queue={queue}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
      />
      <AmbienceSheet
        open={sheet === 'ambience'}
        onClose={() => setSheet(null)}
        ambient={ambient}
        onChange={changeAmbient}
      />

    </div>
  );
}

// ───────── Top bar ─────────

interface RoomTopBarProps {
  roomId: string;
  peers: User[];
  onOpenPeople: () => void;
  onLeave: () => void;
}

function RoomTopBar({ roomId, peers, onOpenPeople, onLeave }: RoomTopBarProps) {
  const displayName = roomId.replace(/-/g, ' ');
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const stackOffset = Math.min(2, peers.length - 1);
  const headsToShow = peers.slice(0, 3);
  const [copied, setCopied] = useState(false);

  async function copyRoomLink() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    let ok = false;
    // Preferred: modern Clipboard API. Requires a secure context (HTTPS
    // or localhost). Silently throws otherwise.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      // fall through to execCommand fallback below
    }
    // Fallback: hidden textarea + execCommand('copy'). Works in insecure
    // contexts (HTTP, LAN IPs).
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // give up
      }
    }
    // Always show feedback so the click never feels like a no-op — if
    // both paths failed, the user can still long-press the title to copy
    // manually but at least sees acknowledgment.
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn('copyRoomLink: clipboard write failed in both code paths');
    }
  }

  return (
    <div className="room-top">
      <button
        type="button"
        className="room-top-title"
        onClick={copyRoomLink}
        aria-label="copy room link"
        title="copy room link"
      >
        <span className={`slug${copied ? ' copied' : ''}`}>
          {copied ? 'copied to clipboard ✓' : `${host}/r/${roomId}`}
        </span>
        <span className="name">{displayName}</span>
      </button>
      <div className="room-top-actions">
        <button type="button" className="people-pill" onClick={onOpenPeople}>
          <div className="head-stack" style={{ width: 22 + Math.max(0, stackOffset) * 12 }}>
            {headsToShow.map((p, i) => (
              <div key={p.id} className="head" style={{ left: i * 12 }}>
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={2} crop="head" />
              </div>
            ))}
          </div>
          <span style={{ marginLeft: 4 }}>{peers.length}</span>
        </button>
        <button type="button" className="icon-btn" aria-label="leave" onClick={onLeave}>
          <Icon name="leave" size={16} />
        </button>
      </div>
    </div>
  );
}

// ───────── Dock ─────────

interface RoomDockProps {
  ambient: Ambient;
  spotifyConnected: boolean;
  playback: PlaybackState;
  playbackLabel: string;
  trackArt: string | undefined;
  trackTitle: string | undefined;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onOpenMusic: () => void;
  onOpenAmbience: () => void;
  onOpenChat: () => void;
  hasQueue: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
}

function computeDockPlaybackLabel(
  playback: PlaybackState,
  player: UseSpotifyPlayerResult,
): string {
  // Users who haven't connected Spotify can't hear anything, so the chip
  // is purely a CTA — don't leak what others in the room are playing.
  if (!player.connected) return 'connect spotify';
  if (!playback.trackUri) return 'tap to set a track';
  // While the local SDK is still spinning up, the room's "playing" state
  // hasn't translated into audio yet — say so. Once status resolves
  // (ready / premium-required / error), trust the room state: users
  // without Premium can never make the SDK report local playback, and
  // we don't want the chip stuck on "starting…" for them.
  const sdkSpinningUp = player.status === 'idle' || player.status === 'loading';
  if (sdkSpinningUp && playback.isPlaying) return 'starting…';
  return playback.isPlaying ? 'playing' : 'paused';
}

function ambientGlyph(a: Ambient): string {
  if (a.weather === 'rain') return '☂';
  if (a.weather === 'snow') return '❄';
  if (a.weather === 'fog') return '≈';
  if (a.time === 'night') return '☾';
  if (a.time === 'dawn') return '☀';
  if (a.time === 'dusk') return '☉';
  return '☀';
}

function RoomDock({
  ambient,
  spotifyConnected,
  playback,
  playbackLabel,
  trackArt,
  trackTitle,
  draft,
  setDraft,
  onSend,
  onOpenMusic,
  onOpenAmbience,
  onOpenChat,
  hasQueue,
  onPrev,
  onTogglePlay,
  onNext,
}: RoomDockProps) {
  // Only surface the track to users who can actually hear it. Otherwise
  // the chip degrades into a "connect spotify" CTA.
  const showTrack = spotifyConnected && !!playback.trackUri;
  function submit(e: FormEvent) {
    e.preventDefault();
    onSend(draft);
  }
  return (
    <form className="dock" onSubmit={submit}>
      <div className="dock-chips">
        <div className="dock-chip dock-chip-music">
          <button type="button" className="dock-chip-open" onClick={onOpenMusic}>
            {showTrack && trackArt ? (
              <img
                src={trackArt}
                className="dock-chip-art"
                alt=""
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                className="dock-chip-art"
                style={{ background: 'linear-gradient(135deg, #2b2118 0%, #b54822 100%)' }}
              />
            )}
            <div className="dock-chip-text">
              <div className="dock-chip-title">
                {showTrack ? (trackTitle || 'now playing') : 'music'}
              </div>
              <div className="dock-chip-meta">{playbackLabel}</div>
            </div>
          </button>
          {showTrack && (
            <div className="dock-chip-controls">
              <button
                type="button"
                className="dock-chip-ctrl"
                aria-label="previous"
                onClick={onPrev}
              >
                <Icon name="prev" size={12} />
              </button>
              <button
                type="button"
                className="dock-chip-ctrl primary"
                aria-label={playback.isPlaying ? 'pause' : 'play'}
                onClick={onTogglePlay}
              >
                <Icon name={playback.isPlaying ? 'pause' : 'play'} size={12} />
              </button>
              <button
                type="button"
                className="dock-chip-ctrl"
                aria-label="next"
                onClick={onNext}
                disabled={!hasQueue}
              >
                <Icon name="next" size={12} />
              </button>
            </div>
          )}
        </div>
        <button type="button" className="dock-chip compact" onClick={onOpenAmbience} aria-label="ambience">
          <span className="dock-chip-glyph">{ambientGlyph(ambient)}</span>
          <span className="dock-chip-meta" style={{ fontWeight: 700 }}>{ambient.time}</span>
        </button>
      </div>
      <div className="composer">
        <input
          className="composer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="say something…"
          maxLength={200}
        />
        <button
          type="button"
          className="composer-btn"
          aria-label="open log"
          onClick={onOpenChat}
        >
          <Icon name="chat" size={18} />
        </button>
        {draft.trim() && (
          <button type="submit" className="composer-btn is-send" aria-label="send">
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
    </form>
  );
}

// ───────── D-pad ─────────

interface DPadProps {
  onNudge: (dx: number, dy: number) => void;
}

function DPad({ onNudge }: DPadProps) {
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

// ───────── Toasts ─────────

function Toasts({ items }: { items: { id: string; text: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}

// ───────── IRC log ─────────

interface IrcLogProps {
  messages: ChatMessage[];
  peersById: Record<string, User>;
}

function IrcLog({ messages, peersById }: IrcLogProps) {
  return (
    <div className="irc-log">
      {messages.map((m) => {
        const peer = peersById[m.userId];
        const c = peer ? colorHex(peer.color) : colorHex(m.color);
        const age = Date.now() - m.timestamp;
        const opacity = Math.max(0.45, 1 - age / 16000);
        return (
          <div className="irc-row" key={m.id} style={{ opacity }}>
            <span className="irc-name" style={{ color: c }}>&lt;{m.name}&gt;</span>
            <span style={{ marginLeft: 6 }}>{m.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ───────── Ambience overlay ─────────

const TIME_TINTS: Record<AmbientTime, string> = {
  dawn: 'rgba(255,180,120,0.18)',
  day: 'rgba(255,255,200,0.04)',
  dusk: 'rgba(180,120,200,0.20)',
  night: 'rgba(20,20,60,0.42)',
};

function AmbienceOverlay({ ambient }: { ambient: Ambient }) {
  const weatherStyle: React.CSSProperties = {
    opacity: Math.max(0, Math.min(1, (ambient.intensity ?? 70) / 100)),
  };
  return (
    <>
      <div className="ambient-overlay" style={{ background: TIME_TINTS[ambient.time] }} />
      {ambient.weather === 'rain' && <div className="ambient-rain" style={weatherStyle} />}
      {ambient.weather === 'snow' && <div className="ambient-snow" style={weatherStyle} />}
      {ambient.weather === 'fog' && <div className="ambient-fog" style={weatherStyle} />}
    </>
  );
}

// ───────── Sheets ─────────

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
}

function Sheet({ open, title, onClose, children, tall }: SheetProps) {
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

function PeopleSheet({
  open,
  onClose,
  peers,
  meId,
  onEditMe,
  onChangeMemo,
  expandedMemoId,
  onChangeExpandedMemoId,
}: {
  open: boolean;
  onClose: () => void;
  peers: User[];
  meId: string | null;
  onEditMe: () => void;
  onChangeMemo: (memo: string) => void;
  expandedMemoId: string | null;
  onChangeExpandedMemoId: (id: string | null) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`${peers.length} in the room`} tall>
      <div>
        {peers.map((p) => {
          const isMe = p.id === meId;
          const expanded = expandedMemoId === p.id;
          return (
            <div key={p.id} className="person-row">
              <div className="person-row-head">
                <PixelCharacter character={p.character} color={colorHex(p.color)} scale={3} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="name">{p.name}{isMe ? ' (you)' : ''}</div>
                  <div className="role">{isMe ? 'this is you' : 'here now'}</div>
                </div>
                {isMe ? (
                  <button type="button" className="person-edit" onClick={onEditMe}>
                    edit
                  </button>
                ) : (
                  <span className="live-dot" />
                )}
              </div>
              <MemoBlock
                memo={p.memo}
                isMe={isMe}
                expanded={expanded}
                onToggle={() =>
                  onChangeExpandedMemoId(expanded ? null : p.id)
                }
                onChange={isMe ? onChangeMemo : undefined}
              />
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

function ChatLogSheet({
  open,
  onClose,
  messages,
  peersById,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  peersById: Record<string, User>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [open, messages.length]);
  return (
    <Sheet open={open} onClose={onClose} title="log" tall>
      <div ref={ref}>
        {messages.map((m) => {
          const peer = peersById[m.userId];
          const c = peer ? colorHex(peer.color) : colorHex(m.color);
          return (
            <div key={m.id} className="chat-row">
              <span className="time">{new Date(m.timestamp).toTimeString().slice(0, 5)}</span>
              <span className="who" style={{ color: c }}>&lt;{m.name}&gt;</span>
              <span className="text">{m.text}</span>
            </div>
          );
        })}
        {messages.length === 0 && <div className="chat-empty">nothing said yet</div>}
      </div>
    </Sheet>
  );
}

function MusicSheet({
  open,
  onClose,
  player,
  playback,
  queue,
  onRemoveFromQueue,
  onClearQueue,
}: {
  open: boolean;
  onClose: () => void;
  player: UseSpotifyPlayerResult;
  playback: PlaybackState;
  queue: string[];
  onRemoveFromQueue: (uri: string, index: number) => void;
  onClearQueue: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="music" tall>
      <ErrorBoundary
        fallback={(err, reset) => (
          <div>
            <div className="h-display" style={{ fontSize: 18, marginBottom: 10 }}>
              spotify panel crashed
            </div>
            <div className="body-text" style={{ marginBottom: 12 }}>{err.message}</div>
            <button type="button" className="btn" onClick={reset}>
              try again
            </button>
          </div>
        )}
      >
        <SpotifyPlayer
          player={player}
          playback={playback}
          queue={queue}
          onRemoveFromQueue={onRemoveFromQueue}
          onClearQueue={onClearQueue}
        />
      </ErrorBoundary>
    </Sheet>
  );
}

function AmbienceSheet({
  open,
  onClose,
  ambient,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  ambient: Ambient;
  onChange: (next: Partial<Ambient>) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="ambience">
      <div className="body-text" style={{ marginBottom: 18 }}>
        everyone in the room sees these changes immediately.
      </div>
      <Dial
        label="room"
        value={ambient.room}
        options={['clearing', 'plaza']}
        onChange={(v) => onChange({ room: v as AmbientRoom })}
        cols2
      />
      <Dial
        label="time"
        value={ambient.time}
        options={['dawn', 'day', 'dusk', 'night']}
        onChange={(v) => onChange({ time: v as AmbientTime })}
      />
      <Dial
        label="weather"
        value={ambient.weather}
        options={['clear', 'rain', 'snow', 'fog']}
        onChange={(v) => onChange({ weather: v as AmbientWeather })}
      />
      {ambient.weather !== 'clear' && (
        <div className="dial-group">
          <div className="label">intensity · {ambient.intensity ?? 70}%</div>
          <input
            type="range"
            className="intensity-slider"
            min={0}
            max={100}
            step={1}
            value={ambient.intensity ?? 70}
            onChange={(e) => onChange({ intensity: parseInt(e.target.value, 10) })}
          />
        </div>
      )}
    </Sheet>
  );
}

function Dial({
  label,
  value,
  options,
  onChange,
  cols2 = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  cols2?: boolean;
}) {
  return (
    <div className="dial-group">
      <div className="label">{label}</div>
      <div className={`dial-options${cols2 ? ' cols-2' : ''}`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`dial-btn${o === value ? ' selected' : ''}`}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
