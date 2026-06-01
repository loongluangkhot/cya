import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { API_BASE } from './api';
import {
  CenterMessage,
  HomeScreen,
  type Identity,
  InviteScreen,
  SetupScreen,
  SplashScreen,
} from './components/Screens';
import RoomEntry from './components/RoomEntry';
import { ME_KEY, validateIdentity } from './identity';
import { markRoomJoined } from './roomState';
import { useStoredState } from './hooks/useStoredState';

type LandingMode =
  | { kind: 'splash' }
  | { kind: 'setup' }
  | { kind: 'home' }
  | { kind: 'invite'; roomId: string };

function Landing() {
  const navigate = useNavigate();
  const [me, setMe] = useStoredState<Identity | null>(ME_KEY, null, validateIdentity);
  const [mode, setMode] = useState<LandingMode>(() =>
    me ? { kind: 'home' } : { kind: 'splash' },
  );
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function createRoom(): Promise<string | null> {
    setBusy(true);
    setCreateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { id: string };
      return data.id;
    } catch {
      setCreateError("couldn't create a room — is the server running?");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onHomeCreate() {
    const id = await createRoom();
    if (id) setMode({ kind: 'invite', roomId: id });
  }

  function onJoinLink(slug: string) {
    navigate(`/r/${slug}`);
  }

  if (mode.kind === 'splash') {
    return (
      <div className="cya-app">
        <SplashScreen onStart={() => setMode({ kind: 'setup' })} />
      </div>
    );
  }

  if (mode.kind === 'setup') {
    return (
      <div className="cya-app">
        <SetupScreen
          initial={me}
          onDone={(next) => {
            setMe(next);
            setMode({ kind: 'home' });
          }}
          onCancel={me ? () => setMode({ kind: 'home' }) : undefined}
        />
      </div>
    );
  }

  if (mode.kind === 'invite') {
    return (
      <div className="cya-app">
        <InviteScreen
          roomId={mode.roomId}
          onEnter={() => {
            markRoomJoined(mode.roomId);
            navigate(`/r/${mode.roomId}`);
          }}
          onBack={() => setMode({ kind: 'home' })}
        />
      </div>
    );
  }

  // home
  if (!me) {
    return (
      <div className="cya-app">
        <SplashScreen onStart={() => setMode({ kind: 'setup' })} />
      </div>
    );
  }

  return (
    <div className="cya-app">
      <HomeScreen
        me={me}
        creating={busy}
        createError={createError}
        onCreate={onHomeCreate}
        onJoinLink={onJoinLink}
        onEditMe={() => setMode({ kind: 'setup' })}
      />
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="cya-app">
      <CenterMessage title="that page doesn't exist">
        <button type="button" className="btn" onClick={() => navigate('/')}>
          back home
        </button>
      </CenterMessage>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/r/:roomId" element={<RoomEntry />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
