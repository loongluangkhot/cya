import { useEffect, useState } from 'react';
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

const ME_KEY = 'cya:identity:v2';

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.color === 'string' &&
      typeof parsed.character === 'string'
    ) {
      return parsed as Identity;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveIdentity(me: Identity | null) {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_KEY);
  } catch {
    // ignore
  }
}

type LandingMode =
  | { kind: 'splash' }
  | { kind: 'setup' }
  | { kind: 'home' }
  | { kind: 'invite'; roomId: string };

function Landing() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Identity | null>(() => loadIdentity());
  const [mode, setMode] = useState<LandingMode>(() =>
    loadIdentity() ? { kind: 'home' } : { kind: 'splash' },
  );
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    saveIdentity(me);
  }, [me]);

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
          onEnter={() => navigate(`/r/${mode.roomId}`, { state: { fromInvite: true } })}
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
      <CenterMessage title="that page doesn't exist" subtitle="404">
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
