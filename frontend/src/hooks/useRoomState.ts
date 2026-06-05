import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { socket } from '../socket';
import type {
  Ambient,
  BubbleState,
  CharacterId,
  ChatMessage,
  ColorId,
  PlaybackState,
  User,
} from '../types';

// Server room dimensions; we normalize to 0..100 percent for the iso scene.
const SERVER_W = 1280;
const SERVER_H = 720;
const BUBBLE_MS = 4500;

const EMPTY_PLAYBACK: PlaybackState = {
  trackUri: null,
  isPlaying: false,
  positionMs: 0,
  positionUpdatedAt: 0,
};

const INITIAL_AMBIENT: Ambient = {
  time: 'dawn',
  weather: 'clear',
  room: 'clearing',
  intensity: 70,
};

export interface UseRoomStateOpts {
  onToast: (text: string) => void;
}

export interface UseRoomStateResult {
  meId: string | null;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  messages: ChatMessage[];
  bubbles: Record<string, BubbleState>;
  ambient: Ambient;
  playback: PlaybackState;
  queue: string[];
  trackMeta: Record<string, { art: string; title: string }>;
  mugshotIntervalS: number;
  nextMugshotAt: number;
  mugshotsTakenAt: Record<string, number>;
  /** Fires when the server pushes a mugshotPrompt — for the capture UI to subscribe to. */
  promptToken: number;
  sendMessage: (text: string) => void;
  sendVoice: (audio: ArrayBuffer, durationMs: number, mime: string) => void;
  updateMemo: (memo: string) => void;
  changeAmbient: (next: Partial<Ambient>) => void;
  changePlayback: (next: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
  addToQueue: (uri: string) => void;
  addManyToQueue: (uris: string[]) => void;
  playCollection: (uris: string[]) => void;
  removeFromQueue: (uri: string, index: number) => void;
  advanceQueue: (afterTrackUri: string | null) => void;
  clearQueue: () => void;
  submitMugshot: (image: ArrayBuffer, mime: string) => void;
  updateMugshotInterval: (intervalS: number) => void;
}

const QUEUE_MAX = 200;

export function formatVoiceDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function useRoomState({ onToast }: UseRoomStateOpts): UseRoomStateResult {
  const [meId, setMeId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, BubbleState>>({});
  const [ambient, setAmbient] = useState<Ambient>(INITIAL_AMBIENT);
  const [playback, setPlayback] = useState<PlaybackState>(EMPTY_PLAYBACK);
  const [queue, setQueue] = useState<string[]>([]);
  const [trackMeta, setTrackMeta] = useState<
    Record<string, { art: string; title: string }>
  >({});
  const [mugshotIntervalS, setMugshotIntervalS] = useState<number>(1800);
  const [nextMugshotAt, setNextMugshotAt] = useState<number>(0);
  const [mugshotsTakenAt, setMugshotsTakenAt] = useState<Record<string, number>>({});
  // Monotonic counter bumped on every server-pushed prompt — components
  // can useEffect on it to trigger the capture sheet without depending
  // on the (stable) timestamp values.
  const [promptToken, setPromptToken] = useState<number>(0);

  const meRef = useRef<string | null>(null);
  meRef.current = meId;
  // Tracks the last trackUri we toasted for, so the now-playing notification
  // doesn't double-fire under React Strict Mode's double-invoke of updaters.
  const lastToastedTrackRef = useRef<string | null>(null);
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  // ────────────── Socket wiring ──────────────
  useEffect(() => {
    function onState(payload: {
      you: User;
      users: User[];
      messages: ChatMessage[];
      ambient: Ambient;
      playback: PlaybackState;
      queue?: string[];
      mugshotIntervalS?: number;
      nextMugshotAt?: number;
      mugshotsTakenAt?: Record<string, number>;
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
      if (typeof payload.mugshotIntervalS === 'number') {
        setMugshotIntervalS(payload.mugshotIntervalS);
      }
      if (typeof payload.nextMugshotAt === 'number') {
        setNextMugshotAt(payload.nextMugshotAt);
      }
      if (payload.mugshotsTakenAt) setMugshotsTakenAt(payload.mugshotsTakenAt);
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
      memo?: string;
    }) {
      setUsers((prev) =>
        prev.map((p) => {
          if (p.id !== payload.id) return p;
          return {
            ...p,
            ...(payload.character !== undefined && { character: payload.character }),
            ...(payload.name !== undefined && { name: payload.name }),
            ...(payload.color !== undefined && { color: payload.color }),
            ...(payload.memo !== undefined && { memo: payload.memo }),
          };
        }),
      );
    }
    function onChat(msg: ChatMessage) {
      setMessages((prev) => [...prev, msg].slice(-200));
      const bubbleText =
        msg.kind === 'voice'
          ? `🎤 voice ${formatVoiceDuration(msg.audioDurationMs)}`
          : msg.text;
      setBubbles((prev) => ({
        ...prev,
        [msg.userId]: { text: bubbleText, expiresAt: Date.now() + BUBBLE_MS, id: msg.id },
      }));
    }
    function onAudioExpired(payload: { ids: string[] }) {
      const ids = new Set(payload.ids);
      if (ids.size === 0) return;
      setMessages((prev) =>
        prev.map((m) => (ids.has(m.id) ? { ...m, audioExpired: true } : m)),
      );
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
      if (u.id !== meRef.current) onToastRef.current(`${u.name} joined`);
    }
    function handleUserLeft(payload: { id: string }) {
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
      if (payload.id !== meRef.current && name) onToastRef.current(`${name} left`);
    }
    function handlePlaybackChanged(next: PlaybackState) {
      // The toast itself fires from a separate effect that waits for
      // the track's oEmbed title to arrive (see "Now-playing toast"
      // below) — we just track the playback here.
      setPlayback(next);
    }
    function onQueueChanged(payload: { queue: string[] }) {
      setQueue(payload.queue);
    }
    function onMugshotPrompt(payload: { nextAt: number }) {
      if (typeof payload.nextAt === 'number') setNextMugshotAt(payload.nextAt);
      // Bump regardless of nextAt — every prompt should open the sheet.
      setPromptToken((n) => n + 1);
    }
    function onMugshotSubmitted(payload: { userId: string; takenAt: number }) {
      setMugshotsTakenAt((prev) => ({ ...prev, [payload.userId]: payload.takenAt }));
    }
    function onMugshotIntervalChanged(payload: { intervalS: number; nextAt: number }) {
      setMugshotIntervalS(payload.intervalS);
      setNextMugshotAt(payload.nextAt);
    }
    function onUserLeftDropMugshot({ id }: { id: string }) {
      // Server drops the mugshot on disconnect; mirror that on the
      // client so the board updates without waiting for a refetch.
      setMugshotsTakenAt((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }

    socket.on('state', onState as never);
    socket.on('queueChanged', onQueueChanged);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('userLeft', onUserLeftDropMugshot);
    socket.on('userMoved', onUserMoved);
    socket.on('userUpdated', onUserUpdated);
    socket.on('chatMessage', onChat);
    socket.on('audioExpired', onAudioExpired);
    socket.on('ambientChanged', onAmbientChanged);
    socket.on('playbackChanged', handlePlaybackChanged);
    socket.on('mugshotPrompt', onMugshotPrompt);
    socket.on('mugshotSubmitted', onMugshotSubmitted);
    socket.on('mugshotIntervalChanged', onMugshotIntervalChanged);

    return () => {
      socket.off('state', onState as never);
      socket.off('queueChanged', onQueueChanged);
      socket.off('userJoined', handleUserJoined);
      socket.off('userLeft', handleUserLeft);
      socket.off('userLeft', onUserLeftDropMugshot);
      socket.off('userMoved', onUserMoved);
      socket.off('userUpdated', onUserUpdated);
      socket.off('chatMessage', onChat);
      socket.off('audioExpired', onAudioExpired);
      socket.off('ambientChanged', onAmbientChanged);
      socket.off('playbackChanged', handlePlaybackChanged);
      socket.off('mugshotPrompt', onMugshotPrompt);
      socket.off('mugshotSubmitted', onMugshotSubmitted);
      socket.off('mugshotIntervalChanged', onMugshotIntervalChanged);
    };
  }, []);

  // ────────────── Now-playing toast ──────────────
  // Fires once per track change. If the track's oEmbed title is already
  // cached, the toast appears immediately with the real title; otherwise
  // we wait briefly for the metadata fetch (below) to land and then fire.
  // If the title never resolves (e.g. 401 / network failure) the timeout
  // falls back to a generic message so the user still sees the toast.
  useEffect(() => {
    const id = playback.trackUri;
    if (!id || lastToastedTrackRef.current === id) return;
    const title = trackMeta[id]?.title?.trim();
    if (title) {
      onToastRef.current(`now playing · ${title}`);
      lastToastedTrackRef.current = id;
      return;
    }
    const timeout = window.setTimeout(() => {
      if (lastToastedTrackRef.current === id) return;
      onToastRef.current('now playing · new track');
      lastToastedTrackRef.current = id;
    }, 1500);
    return () => window.clearTimeout(timeout);
  }, [playback.trackUri, trackMeta]);

  // ────────────── Track metadata (oEmbed) ──────────────
  // Per-id title + art cache for the dock chip. Populated via YouTube's
  // oEmbed endpoint (no auth required).
  useEffect(() => {
    const id = playback.trackUri;
    if (!id || trackMeta[id]) return;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    let cancelled = false;
    const target = `https://www.youtube.com/watch?v=${id}`;
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const art = typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '';
        const title = typeof data.title === 'string' ? data.title : '';
        if (!art && !title) return;
        setTrackMeta((prev) => ({ ...prev, [id]: { art, title } }));
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

  // ────────────── Actions ──────────────
  function sendMessage(text: string) {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat', { text: t });
  }
  function sendVoice(audio: ArrayBuffer, durationMs: number, mime: string) {
    if (!audio.byteLength || durationMs <= 0) return;
    socket.emit('voiceMessage', { audio, durationMs, mime });
  }
  function updateMemo(memo: string) {
    // Optimistic update of the local user's memo — server will echo it back
    // via userUpdated, which will re-confirm.
    setUsers((prev) =>
      prev.map((p) => (p.id === meRef.current ? { ...p, memo } : p)),
    );
    socket.emit('updateMemo', { memo });
  }
  function changeAmbient(next: Partial<Ambient>) {
    setAmbient((cur) => ({ ...cur, ...next }));
    socket.emit('updateAmbient', next);
  }
  function changePlayback(next: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) {
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
  function addManyToQueue(uris: string[]) {
    if (uris.length === 0) return;
    setQueue((q) => [...q, ...uris].slice(0, QUEUE_MAX));
    socket.emit('addManyToQueue', { uris });
  }
  function playCollection(uris: string[]) {
    if (uris.length === 0) return;
    const [first, ...rest] = uris;
    setPlayback({
      trackUri: first,
      isPlaying: true,
      positionMs: 0,
      positionUpdatedAt: Date.now(),
    });
    setQueue(rest.slice(0, QUEUE_MAX));
    socket.emit('playCollection', { uris });
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
  function advanceQueue(afterTrackUri: string | null) {
    socket.emit('advanceQueue', { afterTrackUri });
  }
  function clearQueue() {
    setQueue([]);
    socket.emit('clearQueue');
  }
  function submitMugshot(image: ArrayBuffer, mime: string) {
    if (!image.byteLength) return;
    socket.emit('submitMugshot', { image, mime });
  }
  function updateMugshotInterval(intervalS: number) {
    if (!Number.isFinite(intervalS) || intervalS <= 0) return;
    // Optimistic — server echoes back via mugshotIntervalChanged.
    setMugshotIntervalS(intervalS);
    setNextMugshotAt(Date.now() + intervalS * 1000);
    socket.emit('updateMugshotInterval', { intervalS });
  }

  return {
    meId,
    users,
    setUsers,
    messages,
    bubbles,
    ambient,
    playback,
    queue,
    trackMeta,
    mugshotIntervalS,
    nextMugshotAt,
    mugshotsTakenAt,
    promptToken,
    sendMessage,
    sendVoice,
    updateMemo,
    changeAmbient,
    changePlayback,
    addToQueue,
    addManyToQueue,
    playCollection,
    removeFromQueue,
    advanceQueue,
    clearQueue,
    submitMugshot,
    updateMugshotInterval,
  };
}
