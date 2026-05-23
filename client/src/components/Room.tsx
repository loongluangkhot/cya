import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { socket } from '../socket';
import Sprite from './Sprite';
import ChatBubble from './ChatBubble';
import ChatPanel from './ChatPanel';
import Settings from './Settings';
import BackgroundLayer from './BackgroundLayer';
import type {
  BackgroundId,
  BubbleState,
  CharacterId,
  ChatMessage,
  Direction,
  ThemeId,
  User,
} from '../types';

const SPEED = 5;
const ROOM_W = 1280;
const ROOM_H = 720;
const BUBBLE_MS = 4500;
const SEND_INTERVAL_MS = 50;

type KeyName =
  | 'arrowup'
  | 'arrowdown'
  | 'arrowleft'
  | 'arrowright'
  | 'w'
  | 'a'
  | 's'
  | 'd';

interface DPadProps {
  press: (key: KeyName, isDown: boolean) => void;
}

function DPad({ press }: DPadProps) {
  const make = (key: KeyName) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      press(key, true);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      press(key, false);
    },
    onPointerCancel: () => press(key, false),
    onPointerLeave: () => press(key, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <div className="dpad" aria-label="movement controls">
      <button type="button" className="dpad-btn dpad-up" aria-label="up" {...make('arrowup')}>↑</button>
      <button type="button" className="dpad-btn dpad-left" aria-label="left" {...make('arrowleft')}>←</button>
      <button type="button" className="dpad-btn dpad-right" aria-label="right" {...make('arrowright')}>→</button>
      <button type="button" className="dpad-btn dpad-down" aria-label="down" {...make('arrowdown')}>↓</button>
    </div>
  );
}

interface RoomProps {
  roomId: string;
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  character: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
  name: string;
  onNameChange: (name: string) => void;
  background: BackgroundId;
  onBackgroundChange: (id: BackgroundId) => void;
}

interface PositionRef {
  x: number;
  y: number;
  direction: Direction;
}

export default function Room({
  roomId,
  theme,
  onThemeChange,
  character,
  onCharacterChange,
  name,
  onNameChange,
  background,
  onBackgroundChange,
}: RoomProps) {
  const [meId, setMeId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, BubbleState>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const keysRef = useRef<Partial<Record<string, boolean>>>({});
  const posRef = useRef<PositionRef>({
    x: ROOM_W / 2,
    y: ROOM_H / 2,
    direction: 'right',
  });
  const settingsOpenRef = useRef(false);
  const screenFitRef = useRef<HTMLDivElement | null>(null);
  const screenSizeRef = useRef({ cw: 0, ch: 0 });

  function applyCamera() {
    const fit = screenFitRef.current;
    if (!fit) return;
    const { cw, ch } = screenSizeRef.current;
    if (cw <= 0 || ch <= 0) return;
    const pos = posRef.current;
    const camX =
      cw >= ROOM_W
        ? ROOM_W / 2
        : Math.max(cw / 2, Math.min(ROOM_W - cw / 2, pos.x));
    const camY =
      ch >= ROOM_H
        ? ROOM_H / 2
        : Math.max(ch / 2, Math.min(ROOM_H - ch / 2, pos.y));
    fit.style.setProperty('--crop-x', `${camX - cw / 2}px`);
    fit.style.setProperty('--crop-y', `${camY - ch / 2}px`);
  }

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
    if (settingsOpen) keysRef.current = {};
  }, [settingsOpen]);

  useEffect(() => {
    function onState({
      you,
      users: list,
      messages: history,
    }: {
      you: User;
      users: User[];
      messages: ChatMessage[];
    }) {
      setMeId(you.id);
      setUsers(list);
      setMessages(history || []);
      posRef.current = { x: you.x, y: you.y, direction: you.direction };
      applyCamera();
    }
    function onUserJoined(u: User) {
      setUsers((prev) => [...prev.filter((p) => p.id !== u.id), u]);
    }
    function onUserLeft({ id }: { id: string }) {
      setUsers((prev) => prev.filter((p) => p.id !== id));
      setBubbles((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    function onUserMoved({
      id,
      x,
      y,
      direction,
    }: {
      id: string;
      x: number;
      y: number;
      direction: Direction;
    }) {
      setUsers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, x, y, direction } : p)),
      );
    }
    function onUserUpdated({
      id,
      character,
      name,
    }: {
      id: string;
      character?: CharacterId;
      name?: string;
    }) {
      setUsers((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const next = { ...p };
          if (character !== undefined) next.character = character;
          if (name !== undefined) next.name = name;
          return next;
        }),
      );
    }
    function onChat(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg].slice(-200));
      setBubbles((prev) => ({
        ...prev,
        [msg.userId]: {
          text: msg.text,
          expiresAt: Date.now() + BUBBLE_MS,
          id: msg.id,
        },
      }));
    }

    socket.on('state', onState);
    socket.on('userJoined', onUserJoined);
    socket.on('userLeft', onUserLeft);
    socket.on('userMoved', onUserMoved);
    socket.on('userUpdated', onUserUpdated);
    socket.on('chatMessage', onChat);

    return () => {
      socket.off('state', onState);
      socket.off('userJoined', onUserJoined);
      socket.off('userLeft', onUserLeft);
      socket.off('userMoved', onUserMoved);
      socket.off('userUpdated', onUserUpdated);
      socket.off('chatMessage', onChat);
    };
  }, []);

  useLayoutEffect(() => {
    const fit = screenFitRef.current;
    if (!fit) return;
    function update() {
      if (!fit) return;
      screenSizeRef.current = { cw: fit.clientWidth, ch: fit.clientHeight };
      applyCamera();
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(fit);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
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
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (settingsOpenRef.current) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        keysRef.current[k] = true;
      }
    }
    function up(e: KeyboardEvent) {
      keysRef.current[e.key.toLowerCase()] = false;
    }
    function blur() {
      keysRef.current = {};
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (!meId) return;
    let raf = 0;
    let lastSendT = 0;
    let lastSentSig = '';

    function tick() {
      const k = keysRef.current;
      const pos = posRef.current;
      let dx = 0;
      let dy = 0;
      if (k['arrowup'] || k['w']) dy -= SPEED;
      if (k['arrowdown'] || k['s']) dy += SPEED;
      if (k['arrowleft'] || k['a']) { dx -= SPEED; pos.direction = 'left'; }
      if (k['arrowright'] || k['d']) { dx += SPEED; pos.direction = 'right'; }

      if (dx !== 0 || dy !== 0) {
        pos.x = Math.max(60, Math.min(ROOM_W - 60, pos.x + dx));
        pos.y = Math.max(180, Math.min(ROOM_H - 40, pos.y + dy));
      }

      const now = performance.now();
      const sig = `${Math.round(pos.x)},${Math.round(pos.y)},${pos.direction}`;
      if (now - lastSendT > SEND_INTERVAL_MS && sig !== lastSentSig) {
        lastSendT = now;
        lastSentSig = sig;
        setUsers((prev) =>
          prev.map((p) =>
            p.id === meId
              ? { ...p, x: pos.x, y: pos.y, direction: pos.direction }
              : p,
          ),
        );
        socket.emit('move', { x: pos.x, y: pos.y, direction: pos.direction });
        applyCamera();
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [meId]);

  function sendMessage(text: string) {
    socket.emit('chat', { text });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be unavailable
    }
  }

  function pressKey(key: KeyName, isDown: boolean) {
    keysRef.current[key] = isDown;
  }

  const sorted = [...users].sort((a, b) => a.y - b.y);

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-title">cya</span>
        <span className="app-room-id" title="room code">
          /r/{roomId}
        </span>
        <div className="app-header-right">
          <span className="app-count">
            <span className="live-dot" />
            {users.length} online
          </span>
          <button
            type="button"
            className="settings-btn"
            onClick={copyLink}
            aria-label="copy room link"
          >
            {copied ? 'copied!' : 'copy link'}
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="open settings"
          >
            settings
          </button>
        </div>
      </header>
      <div className="app-main">
        <div className="screen-area">
          <div className="screen-fit" ref={screenFitRef}>
            <div className="screen" data-bg={background}>
              <BackgroundLayer id={background} />
              {sorted.map((u) => (
                <div
                  key={u.id}
                  className="sprite-stage"
                  style={{
                    left: `calc(${u.x}px - var(--crop-x, 0px))`,
                    top: `calc(${u.y}px - var(--crop-y, 0px))`,
                  }}
                >
                  {bubbles[u.id] && (
                    <div className="bubble-wrap">
                      <ChatBubble text={bubbles[u.id].text} />
                    </div>
                  )}
                  <div className="sprite-name">
                    {u.name}
                    {u.id === meId && <span className="you-tag">you</span>}
                  </div>
                  <Sprite character={u.character} direction={u.direction} />
                </div>
              ))}
            </div>
            <DPad press={pressKey} />
            <span className="kb-hint">← ↑ ↓ → / WASD</span>
          </div>
        </div>
        <ChatPanel
          messages={messages}
          onSend={sendMessage}
          meId={meId}
        />
      </div>
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        name={name}
        onNameChange={onNameChange}
        character={character}
        onCharacterChange={onCharacterChange}
        theme={theme}
        onThemeChange={onThemeChange}
        background={background}
        onBackgroundChange={onBackgroundChange}
      />
    </div>
  );
}
