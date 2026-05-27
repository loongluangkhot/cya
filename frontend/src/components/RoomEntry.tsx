import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../api';
import { socket } from '../socket';
import Room from './Room';
import {
  CenterMessage,
  type Identity,
  JoiningScreen,
  type OccupantPeek,
  SetupScreen,
} from './Screens';

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

function saveIdentity(me: Identity) {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // ignore
  }
}

type RoomCheck = 'checking' | 'ok' | 'not_found';
type Phase = 'check' | 'setup' | 'joining' | 'room';

export default function RoomEntry() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromInvite = !!(location.state as { fromInvite?: boolean } | null)?.fromInvite;

  const [roomCheck, setRoomCheck] = useState<RoomCheck>('checking');
  const [me, setMe] = useState<Identity | null>(loadIdentity());
  const [phase, setPhase] = useState<Phase>(() => {
    if (!loadIdentity()) return 'setup';
    return fromInvite ? 'room' : 'joining';
  });
  const [occupants, setOccupants] = useState<OccupantPeek[] | null>(null);
  const meRef = useRef(me);
  meRef.current = me;

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

  // On phase=room, connect socket and join.
  useEffect(() => {
    if (phase !== 'room' || !roomId) return;
    const current = meRef.current;
    if (!current) return;

    function doJoin() {
      const cm = meRef.current;
      if (!cm || !roomId) return;
      socket.emit(
        'join',
        {
          roomId,
          name: cm.name,
          character: cm.character,
          color: cm.color,
        },
        (ack) => {
          if (!ack?.ok) setRoomCheck('not_found');
        },
      );
    }

    function onDisconnect(reason: string) {
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
  }, [phase, roomId, navigate]);

  // Fetch real occupant list for the joining screen.
  useEffect(() => {
    if (phase !== 'joining' || roomCheck !== 'ok' || !roomId) return;
    let cancelled = false;
    setOccupants(null);
    fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/peek`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('peek failed'))))
      .then((data: { users: OccupantPeek[] }) => {
        if (!cancelled) setOccupants(data.users ?? []);
      })
      .catch(() => {
        if (!cancelled) setOccupants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, roomCheck, roomId]);

  if (roomCheck === 'checking') {
    return (
      <div className="cya-app">
        <CenterMessage title="checking room…" subtitle={typeof window !== 'undefined' ? window.location.host : ''} />
      </div>
    );
  }

  if (roomCheck === 'not_found') {
    return (
      <div className="cya-app">
        <CenterMessage title="this room doesn't exist anymore" subtitle={typeof window !== 'undefined' ? window.location.host : ''}>
          <button type="button" className="btn" onClick={() => navigate('/')}>
            back home
          </button>
        </CenterMessage>
      </div>
    );
  }

  if (phase === 'setup' || !me) {
    return (
      <div className="cya-app">
        <SetupScreen
          initial={me}
          onDone={(next) => {
            setMe(next);
            saveIdentity(next);
            setPhase('joining');
          }}
          onCancel={me ? () => setPhase('joining') : undefined}
          submitLabel={me ? 'save' : 'continue'}
        />
      </div>
    );
  }

  if (phase === 'joining' && roomId) {
    return (
      <div className="cya-app">
        <JoiningScreen
          roomId={roomId}
          me={me}
          occupants={occupants}
          onEnter={() => setPhase('room')}
          onEditMe={() => setPhase('setup')}
        />
      </div>
    );
  }

  if (phase === 'room' && roomId && me) {
    return (
      <div className="cya-app">
        <Room
          roomId={roomId}
          onEditMe={() => setPhase('setup')}
          onLeave={() => navigate('/')}
        />
      </div>
    );
  }

  return null;
}
