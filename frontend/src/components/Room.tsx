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
import { colorHex } from '../characters';
import { useToasts } from '../hooks/useToasts';
import { useRoomState } from '../hooks/useRoomState';
import { useMovement } from '../hooks/useMovement';
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
}

type Sheet = 'people' | 'chat' | 'music' | 'ambience' | null;

export default function Room({ roomId, onEditMe, onLeave }: RoomProps) {
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

  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');

  function onSend(text: string) {
    if (!text.trim()) return;
    sendMessage(text);
    setDraft('');
  }

  const peersById: Record<string, User> = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div className="room-root">
      <IsoScene peers={users} meId={meId} bubbles={bubbles} room={ambient.room} />
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
        playback={playback}
        trackArt={playback.trackUri ? trackMeta[playback.trackUri]?.art : undefined}
        trackTitle={playback.trackUri ? trackMeta[playback.trackUri]?.title : undefined}
        draft={draft}
        setDraft={setDraft}
        onSend={onSend}
        onOpenMusic={() => setSheet('music')}
        onOpenAmbience={() => setSheet('ambience')}
        onOpenChat={() => setSheet('chat')}
      />

      <Toasts items={toasts} />

      <PeopleSheet
        open={sheet === 'people'}
        onClose={() => setSheet(null)}
        peers={users}
        meId={meId}
        onEditMe={onEditMe}
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
        playback={playback}
        queue={queue}
        onPlaybackChange={changePlayback}
        onAddToQueue={addToQueue}
        onAddManyToQueue={addManyToQueue}
        onPlayCollection={playCollection}
        onRemoveFromQueue={removeFromQueue}
        onAdvanceQueue={advanceQueue}
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
  playback: PlaybackState;
  trackArt: string | undefined;
  trackTitle: string | undefined;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  onOpenMusic: () => void;
  onOpenAmbience: () => void;
  onOpenChat: () => void;
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
  playback,
  trackArt,
  trackTitle,
  draft,
  setDraft,
  onSend,
  onOpenMusic,
  onOpenAmbience,
  onOpenChat,
}: RoomDockProps) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSend(draft);
  }
  return (
    <form className="dock" onSubmit={submit}>
      <div className="dock-chips">
        <button type="button" className="dock-chip" onClick={onOpenMusic}>
          {playback.trackUri && trackArt ? (
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
              {playback.trackUri ? (trackTitle || 'now playing') : 'no track'}
            </div>
            <div className="dock-chip-meta">
              {playback.trackUri ? (
                <span className="dock-chip-status">
                  <Icon name={playback.isPlaying ? 'play' : 'pause'} size={10} />
                  {playback.isPlaying ? 'playing' : 'paused'}
                </span>
              ) : (
                'tap to set a track'
              )}
            </div>
          </div>
        </button>
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
  const holdRef = useRef<number | null>(null);
  function start(dx: number, dy: number) {
    return (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      onNudge(dx, dy);
      if (holdRef.current !== null) clearInterval(holdRef.current);
      holdRef.current = window.setInterval(() => onNudge(dx, dy), 130);
    };
  }
  function stop() {
    if (holdRef.current !== null) clearInterval(holdRef.current);
    holdRef.current = null;
  }
  useEffect(() => () => stop(), []);

  function btn(dx: number, dy: number, glyph: string, label: string, klass: string) {
    return (
      <button
        type="button"
        aria-label={label}
        className={`dpad-btn ${klass}`}
        onPointerDown={start(dx, dy)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        {glyph}
      </button>
    );
  }

  return (
    <div className="dpad" aria-label="movement controls">
      {btn(0, -1, '▲', 'up', 'dpad-up')}
      {btn(-1, 0, '◀', 'left', 'dpad-left')}
      <div className="dpad-core" aria-hidden="true" />
      {btn(1, 0, '▶', 'right', 'dpad-right')}
      {btn(0, 1, '▼', 'down', 'dpad-down')}
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
}: {
  open: boolean;
  onClose: () => void;
  peers: User[];
  meId: string | null;
  onEditMe: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={`${peers.length} in the room`}>
      <div>
        {peers.map((p) => {
          const isMe = p.id === meId;
          return (
            <div key={p.id} className="person-row">
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
  playback,
  queue,
  onPlaybackChange,
  onAddToQueue,
  onAddManyToQueue,
  onPlayCollection,
  onRemoveFromQueue,
  onAdvanceQueue,
  onClearQueue,
}: {
  open: boolean;
  onClose: () => void;
  playback: PlaybackState;
  queue: string[];
  onPlaybackChange: (next: { trackUri: string | null; isPlaying: boolean; positionMs: number }) => void;
  onAddToQueue: (uri: string) => void;
  onAddManyToQueue: (uris: string[]) => void;
  onPlayCollection: (uris: string[]) => void;
  onRemoveFromQueue: (uri: string, index: number) => void;
  onAdvanceQueue: (afterTrackUri: string | null) => void;
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
          playback={playback}
          queue={queue}
          onLocalChange={onPlaybackChange}
          onAddToQueue={onAddToQueue}
          onAddManyToQueue={onAddManyToQueue}
          onPlayCollection={onPlayCollection}
          onRemoveFromQueue={onRemoveFromQueue}
          onAdvanceQueue={onAdvanceQueue}
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
