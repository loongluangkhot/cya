import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { socket } from '../socket';
import IsoScene from './IsoScene';
import PixelCharacter from './PixelCharacter';
import SpotifyPlayer from './SpotifyPlayer';
import ErrorBoundary from './ErrorBoundary';
import Icon from './Icon';
import { colorHex } from '../characters';
import type {
  Ambient,
  AmbientRoom,
  AmbientTime,
  AmbientWeather,
  BubbleState,
  CharacterId,
  ChatMessage,
  ColorId,
  PlaybackState,
  User,
} from '../types';

const EMPTY_PLAYBACK: PlaybackState = {
  trackUri: null,
  isPlaying: false,
  positionMs: 0,
  positionUpdatedAt: 0,
};

// Room is 1280×720 on the server. We map server coords to the iso scene's
// 0..100 percent on the floor.
const SERVER_W = 1280;
const SERVER_H = 720;
const STEP_PCT = 4;
const SEND_INTERVAL_MS = 60;
const BUBBLE_MS = 4500;

// Iso floor area where the character can stand (with a margin).
const MIN_PCT = 6;
const MAX_PCT = 94;

interface RoomProps {
  roomId: string;
  onEditMe: () => void;
  onLeave: () => void;
}

type Sheet = 'people' | 'chat' | 'music' | 'ambience' | null;

export default function Room({ roomId, onEditMe, onLeave }: RoomProps) {
  const [meId, setMeId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, BubbleState>>({});
  const [ambient, setAmbient] = useState<Ambient>({
    time: 'dawn',
    weather: 'clear',
    room: 'clearing',
    intensity: 70,
  });
  const [playback, setPlayback] = useState<PlaybackState>(EMPTY_PLAYBACK);
  const [queue, setQueue] = useState<string[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState('');
  // Per-uri title + art cache for the dock chip. Populated via Spotify's
  // oEmbed endpoint (no auth required) so the chip can render even for
  // users who haven't connected Spotify.
  const [trackMeta, setTrackMeta] = useState<Record<string, { art: string; title: string }>>({});
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const [wandering, setWandering] = useState(false);

  function pushToast(text: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }

  const posRef = useRef({ x: 50, y: 50 });
  const keysRef = useRef<Set<string>>(new Set());
  // Tracks the last trackUri we toasted for, so the now-playing notification
  // doesn't double-fire under React Strict Mode's double-invoke of updaters.
  const lastToastedTrackRef = useRef<string | null>(null);

  // ────────────── Socket wiring ──────────────
  useEffect(() => {
    function onState(payload: {
      you: User;
      users: User[];
      messages: ChatMessage[];
      ambient: Ambient;
      playback: PlaybackState;
      queue?: string[];
    }) {
      setMeId(payload.you.id);
      const normalized = payload.users.map((u) => ({
        ...u,
        x: (u.x / SERVER_W) * 100,
        y: (u.y / SERVER_H) * 100,
      }));
      setUsers(normalized);
      setMessages(payload.messages ?? []);
      if (payload.ambient) setAmbient(payload.ambient);
      if (payload.playback) setPlayback(payload.playback);
      if (Array.isArray(payload.queue)) setQueue(payload.queue);
      const meServer = payload.you;
      posRef.current = {
        x: (meServer.x / SERVER_W) * 100,
        y: (meServer.y / SERVER_H) * 100,
      };
    }
    function onUserMoved({ id, x, y }: { id: string; x: number; y: number }) {
      setUsers((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, x: (x / SERVER_W) * 100, y: (y / SERVER_H) * 100 }
            : p,
        ),
      );
    }
    function onUserUpdated(payload: {
      id: string;
      character?: CharacterId;
      name?: string;
      color?: ColorId;
    }) {
      setUsers((prev) =>
        prev.map((p) => {
          if (p.id !== payload.id) return p;
          return {
            ...p,
            ...(payload.character !== undefined && { character: payload.character }),
            ...(payload.name !== undefined && { name: payload.name }),
            ...(payload.color !== undefined && { color: payload.color }),
          };
        }),
      );
    }
    function onChat(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg].slice(-200));
      setBubbles((prev) => ({
        ...prev,
        [msg.userId]: { text: msg.text, expiresAt: Date.now() + BUBBLE_MS, id: msg.id },
      }));
    }
    function onAmbientChanged(next: Ambient) {
      setAmbient(next);
    }

    // Server emits absolute coords; normalize here so peer % positions stay
    // consistent inside the iso scene.
    function handleUserJoined(u: User) {
      const normalized = {
        ...u,
        x: (u.x / SERVER_W) * 100,
        y: (u.y / SERVER_H) * 100,
      };
      setUsers((prev) => [...prev.filter((p) => p.id !== u.id), normalized]);
      if (u.id !== meRef.current) pushToast(`${u.name} joined`);
    }
    function handleUserLeft(payload: { id: string }) {
      // Capture name before we remove from state.
      let name: string | undefined;
      setUsers((prev) => {
        const found = prev.find((p) => p.id === payload.id);
        name = found?.name;
        return prev.filter((p) => p.id !== payload.id);
      });
      setBubbles((prev) => {
        if (!prev[payload.id]) return prev;
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      if (payload.id !== meRef.current && name) pushToast(`${name} left`);
    }
    function handlePlaybackChanged(next: PlaybackState) {
      // Toast outside the setter — putting side effects inside setPlayback
      // would double-fire under React Strict Mode's double-invoke.
      if (next.trackUri && next.trackUri !== lastToastedTrackRef.current) {
        pushToast('now playing · new track');
      }
      lastToastedTrackRef.current = next.trackUri;
      setPlayback(next);
    }

    function onQueueChanged(payload: { queue: string[] }) {
      setQueue(payload.queue);
    }

    socket.on('state', onState as never);
    socket.on('queueChanged', onQueueChanged);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('userMoved', onUserMoved);
    socket.on('userUpdated', onUserUpdated);
    socket.on('chatMessage', onChat);
    socket.on('ambientChanged', onAmbientChanged);
    socket.on('playbackChanged', handlePlaybackChanged);

    return () => {
      socket.off('state', onState as never);
      socket.off('queueChanged', onQueueChanged);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('userMoved', onUserMoved);
      socket.off('userUpdated', onUserUpdated);
      socket.off('chatMessage', onChat);
      socket.off('ambientChanged', onAmbientChanged);
      socket.off('playbackChanged', handlePlaybackChanged);
    };
  }, []);

  // ────────────── Track metadata (oEmbed) ──────────────
  useEffect(() => {
    const uri = playback.trackUri;
    if (!uri || trackMeta[uri]) return;
    const id = uri.replace('spotify:track:', '');
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return;
    let cancelled = false;
    const target = `https://open.spotify.com/track/${id}`;
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(target)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const art = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '';
        const title = typeof data.title === 'string' ? data.title : '';
        if (!art && !title) return;
        setTrackMeta((prev) => ({ ...prev, [uri]: { art, title } }));
      })
      .catch(() => {
        // ignore — chip falls back to defaults
      });
    return () => {
      cancelled = true;
    };
  }, [playback.trackUri, trackMeta]);

  // ────────────── Bubble expiry ──────────────
  useEffect(() => {
    const id = setInterval(() => {
      setBubbles((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, BubbleState> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.expiresAt > now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // ────────────── Movement input (arrow keys + D-pad) ──────────────
  const meRef = useRef<string | null>(null);
  meRef.current = meId;
  const lastSentSig = useRef('');

  function nudge(dx: number, dy: number) {
    if (!meRef.current) return;
    const cur = posRef.current;
    const m = dx && dy ? Math.SQRT1_2 : 1;
    const nx = Math.max(MIN_PCT, Math.min(MAX_PCT, cur.x + dx * STEP_PCT * m));
    const ny = Math.max(MIN_PCT, Math.min(MAX_PCT, cur.y + dy * STEP_PCT * m));
    posRef.current = { x: nx, y: ny };
    setUsers((prev) =>
      prev.map((p) => (p.id === meRef.current ? { ...p, x: nx, y: ny } : p)),
    );
    const sig = `${Math.round(nx)},${Math.round(ny)}`;
    if (sig !== lastSentSig.current) {
      lastSentSig.current = sig;
      socket.emit('move', {
        x: (nx / 100) * SERVER_W,
        y: (ny / 100) * SERVER_H,
        direction: 'right',
      });
    }
  }

  // Wander — picks random floor targets and walks toward them via nudge(),
  // same as user input so server sync and animation work identically.
  useEffect(() => {
    if (!wandering) return;
    function pickTarget() {
      return {
        x: MIN_PCT + 4 + Math.random() * (MAX_PCT - MIN_PCT - 8),
        y: MIN_PCT + 4 + Math.random() * (MAX_PCT - MIN_PCT - 8),
      };
    }
    let target = pickTarget();
    let arrivedAt = 0;
    const id = window.setInterval(() => {
      const pos = posRef.current;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) {
        // Arrived; idle briefly then pick a new spot.
        if (arrivedAt === 0) arrivedAt = Date.now();
        if (Date.now() - arrivedAt > 1400) {
          target = pickTarget();
          arrivedAt = 0;
        }
        return;
      }
      arrivedAt = 0;
      const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1;
      nudge(sx, sy);
    }, 160);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wandering]);

  // Arrow key handler — drive our own repeat (avoid OS auto-repeat delay).
  useEffect(() => {
    const held = keysRef.current;
    let timer: number | null = null;

    function tick() {
      let dx = 0;
      let dy = 0;
      if (held.has('ArrowUp')) dy -= 1;
      if (held.has('ArrowDown')) dy += 1;
      if (held.has('ArrowLeft')) dx -= 1;
      if (held.has('ArrowRight')) dx += 1;
      if (dx || dy) nudge(dx, dy);
    }

    function down(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      // Any manual movement cancels wander.
      setWandering(false);
      if (!held.has(e.key)) {
        const first = held.size === 0;
        held.add(e.key);
        if (first) {
          tick();
          timer = window.setInterval(tick, 130);
        }
      }
    }
    function up(e: KeyboardEvent) {
      if (!held.has(e.key)) return;
      held.delete(e.key);
      if (held.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function blur() {
      held.clear();
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      if (timer !== null) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────── Send chat ──────────────
  function sendMessage(text: string) {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat', { text: t });
    setDraft('');
  }

  function changeAmbient(next: Partial<Ambient>) {
    setAmbient((cur) => ({ ...cur, ...next }));
    socket.emit('updateAmbient', next);
  }

  function changePlayback(next: { trackUri: string | null; isPlaying: boolean; positionMs: number }) {
    setPlayback({
      trackUri: next.trackUri,
      isPlaying: next.isPlaying,
      positionMs: next.positionMs,
      positionUpdatedAt: Date.now(),
    });
    socket.emit('updatePlayback', next);
  }

  function addToQueue(uri: string) {
    setQueue((q) => [...q, uri]);
    socket.emit('addToQueue', { uri });
  }

  function removeFromQueue(uri: string, index: number) {
    setQueue((q) => {
      if (q[index] === uri) {
        const next = q.slice();
        next.splice(index, 1);
        return next;
      }
      return q;
    });
    socket.emit('removeFromQueue', { uri, index });
  }

  function advanceQueueLocal(afterTrackUri: string | null) {
    socket.emit('advanceQueue', { afterTrackUri });
  }

  function clearQueueLocal() {
    setQueue([]);
    socket.emit('clearQueue');
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
        onSend={sendMessage}
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
        onRemoveFromQueue={removeFromQueue}
        onAdvanceQueue={advanceQueueLocal}
        onClearQueue={clearQueueLocal}
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
