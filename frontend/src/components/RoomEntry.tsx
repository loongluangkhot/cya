import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../api';
import { loadIdentity, saveIdentity } from '../identity';
import { socket } from '../socket';
import Room from './Room';
import {
  CenterMessage,
  type Identity,
  JoiningScreen,
  type OccupantPeek,
  SetupScreen,
} from './Screens';

function emitIdentityDiff(prev: Identity, next: Identity) {
  if (prev.name !== next.name) socket.emit('updateName', { name: next.name });
  if (prev.character !== next.character) {
    socket.emit('updateCharacter', { character: next.character });
  }
  if (prev.color !== next.color) socket.emit('updateColor', { color: next.color });
}

type RoomCheck = 'checking' | 'ok' | 'not_found';
type Phase = 'joining' | 'room';

export default function RoomEntry() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [roomCheck, setRoomCheck] = useState<RoomCheck>('checking');
  const [me, setMe] = useState<Identity | null>(loadIdentity());
  const [phase, setPhase] = useState<Phase>('joining');
  const [editing, setEditing] = useState(false);
  const [occupants, setOccupants] = useState<OccupantPeek[] | null>(null);
  const meRef = useRef(me);
  meRef.current = me;

  // Single peek call doubles as the existence check, occupant fetch, AND
  // the "am I still in?" probe — the server's USER_GRACE_S window lets a
  // recently-disconnected client jump straight back into the room without
  // the drop-in screen.
  useEffect(() => {
    if (!roomId) {
      setRoomCheck('not_found');
      return;
    }
    let cancelled = false;
    setRoomCheck('checking');
    setOccupants(null);
    const cid = meRef.current?.clientId;
    const qs = cid ? `?clientId=${encodeURIComponent(cid)}` : '';
    fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/peek${qs}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error('not_found')),
      )
      .then((data: { users: OccupantPeek[]; youAreIn?: boolean }) => {
        if (cancelled) return;
        setRoomCheck('ok');
        setOccupants(data.users ?? []);
        if (data.youAreIn) setPhase('room');
      })
      .catch(() => {
        if (!cancelled) setRoomCheck('not_found');
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Connect socket once we're in the room phase.
  useEffect(() => {
    if (phase !== 'room' || !roomId || !meRef.current) return;

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
          memo: cm.memo,
          clientId: cm.clientId,
        },
        (ack) => {
          if (!ack?.ok) {
            setRoomCheck('not_found');
            setPhase('joining');
            return;
          }
          // Tell the lossy-emit queue in useRoomState that we're
          // session-attached on the server and queued emits can flush.
          window.dispatchEvent(new CustomEvent('cya:join-ack'));
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

  if (roomCheck === 'checking') {
    return (
      <div className="cya-app">
        <CenterMessage title="checking room…" />
      </div>
    );
  }

  if (roomCheck === 'not_found') {
    return (
      <div className="cya-app">
        <CenterMessage title="this room doesn't exist anymore">
          <button type="button" className="btn" onClick={() => navigate('/')}>
            back home
          </button>
        </CenterMessage>
      </div>
    );
  }

  // First-time setup — no stored identity yet.
  if (!me) {
    return (
      <div className="cya-app">
        <SetupScreen
          initial={null}
          onDone={(next) => {
            setMe(next);
            saveIdentity(next);
            setPhase('joining');
          }}
          submitLabel="continue"
        />
      </div>
    );
  }

  return (
    <div className="cya-app">
      {phase === 'joining' && roomId && (
        <JoiningScreen
          roomId={roomId}
          me={me}
          occupants={occupants}
          onEnter={() => setPhase('room')}
          onEditMe={() => setEditing(true)}
        />
      )}
      {phase === 'room' && roomId && (
        <Room
          roomId={roomId}
          onEditMe={() => setEditing(true)}
          onLeave={() => {
            navigate('/');
          }}
          onMemoPersist={(memo) => {
            // Memo is part of Identity (travels between rooms), so persist
            // the change to localStorage here. The socket emit happens
            // inside useRoomState.updateMemo.
            const cur = meRef.current;
            if (!cur) return;
            const next = { ...cur, memo };
            setMe(next);
            saveIdentity(next);
          }}
        />
      )}
      {editing && (
        <div className="setup-overlay">
          <SetupScreen
            initial={me}
            onDone={(next) => {
              if (phase === 'room') emitIdentityDiff(me, next);
              setMe(next);
              saveIdentity(next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            submitLabel="save"
          />
        </div>
      )}
    </div>
  );
}
