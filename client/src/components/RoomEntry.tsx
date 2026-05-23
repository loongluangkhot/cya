import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../api';
import { socket } from '../socket';
import Room from './Room';
import SetupForm from './SetupForm';
import ThemePicker from './ThemePicker';
import type { BackgroundId, CharacterId, ThemeId } from '../types';

interface RoomEntryProps {
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  background: BackgroundId;
  onBackgroundChange: (id: BackgroundId) => void;
}

interface Me {
  name: string;
  character: CharacterId;
}

const ME_KEY = 'cya:me';

function loadStoredMe(): Me | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === 'string' && typeof parsed?.character === 'string') {
      return { name: parsed.name, character: parsed.character };
    }
  } catch {
    // ignore
  }
  return null;
}

function persistMe(me: Me) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // ignore
  }
}

type RoomCheck = 'checking' | 'ok' | 'not_found';

export default function RoomEntry({
  theme,
  onThemeChange,
  background,
  onBackgroundChange,
}: RoomEntryProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [roomCheck, setRoomCheck] = useState<RoomCheck>('checking');
  const [me, setMe] = useState<Me | null>(loadStoredMe);
  const meRef = useRef<Me | null>(me);
  meRef.current = me;

  const ready = roomCheck === 'ok' && me !== null;

  useEffect(() => {
    if (!roomId) {
      setRoomCheck('not_found');
      return;
    }
    let cancelled = false;
    setRoomCheck('checking');
    fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}`)
      .then((r) => {
        if (cancelled) return;
        setRoomCheck(r.ok ? 'ok' : 'not_found');
      })
      .catch(() => {
        if (!cancelled) setRoomCheck('not_found');
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!ready || !roomId) return;

    function doJoin() {
      const current = meRef.current;
      if (!current || !roomId) return;
      socket.emit(
        'join',
        { roomId, name: current.name, character: current.character },
        (ack) => {
          if (!ack?.ok) setRoomCheck('not_found');
        },
      );
    }

    function onDisconnect(reason: string) {
      // server-initiated disconnect — kick back home so we don't show a frozen room
      if (reason === 'io server disconnect') {
        navigate('/', { replace: true });
      }
    }

    socket.on('connect', doJoin);
    socket.on('disconnect', onDisconnect);

    if (!socket.connected) socket.connect();
    else doJoin();

    return () => {
      socket.off('connect', doJoin);
      socket.off('disconnect', onDisconnect);
      if (socket.connected) socket.disconnect();
    };
  }, [ready, roomId, navigate]);

  function handleSetup(name: string, character: CharacterId) {
    const next = { name, character };
    persistMe(next);
    setMe(next);
  }

  function handleNameChange(newName: string) {
    const trimmed = newName.trim().slice(0, 20);
    if (!trimmed) return;
    setMe((m) => {
      if (!m) return m;
      const next = { ...m, name: trimmed };
      persistMe(next);
      return next;
    });
    socket.emit('updateName', { name: trimmed });
  }

  function handleCharacterChange(newCharacter: CharacterId) {
    setMe((m) => {
      if (!m) return m;
      const next = { ...m, character: newCharacter };
      persistMe(next);
      return next;
    });
    socket.emit('updateCharacter', { character: newCharacter });
  }

  if (roomCheck === 'checking') {
    return (
      <div className="landing">
        <div className="landing-card">
          <h1 className="title">cya</h1>
          <p className="subtitle">checking room…</p>
        </div>
      </div>
    );
  }

  if (roomCheck === 'not_found') {
    return (
      <div className="landing">
        <div className="landing-card">
          <h1 className="title">cya</h1>
          <p className="subtitle">this room doesn't exist anymore</p>
          <Link to="/" className="btn-primary">back home</Link>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="landing">
        <div className="landing-card">
          <h1 className="title">cya</h1>
          <p className="subtitle">joining <code>{roomId}</code></p>
          <SetupForm onSubmit={handleSetup} submitLabel="enter room" />
          <div className="field">
            <span>theme</span>
            <ThemePicker theme={theme} onChange={onThemeChange} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Room
      roomId={roomId!}
      name={me.name}
      onNameChange={handleNameChange}
      character={me.character}
      onCharacterChange={handleCharacterChange}
      theme={theme}
      onThemeChange={onThemeChange}
      background={background}
      onBackgroundChange={onBackgroundChange}
    />
  );
}
