import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import fs from 'fs';
import type {
  ChatMessage,
  ClientToServerEvents,
  Room,
  ServerToClientEvents,
  SocketData,
  User,
} from './types.js';
import { generateSlug } from './words.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3001;
const ROOM_WIDTH = 1280;
const ROOM_HEIGHT = 720;
const MAX_HISTORY = 100;
const NAME_MAX = 20;
const MSG_MAX = 200;

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  { cors: { origin: '*' } },
);

const rooms = new Map<string, Room>();

function createRoom(): Room {
  for (let i = 0; i < 5; i++) {
    const id = generateSlug();
    if (!rooms.has(id)) {
      const room: Room = { id, users: new Map(), messages: [] };
      rooms.set(id, room);
      return room;
    }
  }
  const id = `${generateSlug()}-${Date.now().toString(36).slice(-4)}`;
  const room: Room = { id, users: new Map(), messages: [] };
  rooms.set(id, room);
  return room;
}

function randomSpawn(): { x: number; y: number } {
  return {
    x: 120 + Math.floor(Math.random() * (ROOM_WIDTH - 240)),
    y: 220 + Math.floor(Math.random() * (ROOM_HEIGHT - 320)),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

app.use(express.json());

app.post('/api/rooms', (_req, res) => {
  const room = createRoom();
  res.json({ id: room.id });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) {
    res.status(404).json({ ok: false });
    return;
  }
  res.json({ ok: true, id: room.id });
});

io.on(
  'connection',
  (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => {
    function currentRoom(): Room | undefined {
      const id = socket.data.roomId;
      return id ? rooms.get(id) : undefined;
    }

    socket.on('join', ({ roomId, name, character }, ack) => {
      const room = rooms.get(String(roomId || ''));
      if (!room) {
        ack?.({ ok: false, error: 'room_not_found' });
        return;
      }

      socket.data.roomId = room.id;
      socket.join(room.id);

      const safeName = String(name || 'Guest').slice(0, NAME_MAX).trim() || 'Guest';
      const safeChar = String(character || 'blob-pink');
      const { x, y } = randomSpawn();
      const user: User = {
        id: socket.id,
        name: safeName,
        character: safeChar,
        x,
        y,
        direction: 'right',
      };
      room.users.set(socket.id, user);

      socket.emit('state', {
        you: user,
        users: Array.from(room.users.values()),
        messages: room.messages,
        room: { width: ROOM_WIDTH, height: ROOM_HEIGHT },
      });
      socket.to(room.id).emit('userJoined', user);
      ack?.({ ok: true });
    });

    socket.on('move', ({ x, y, direction }) => {
      const room = currentRoom();
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      user.x = clamp(Number(x) || 0, 0, ROOM_WIDTH);
      user.y = clamp(Number(y) || 0, 0, ROOM_HEIGHT);
      if (direction === 'left' || direction === 'right') user.direction = direction;
      socket.to(room.id).emit('userMoved', {
        id: user.id,
        x: user.x,
        y: user.y,
        direction: user.direction,
      });
    });

    socket.on('updateCharacter', ({ character }) => {
      const room = currentRoom();
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      const safe = String(character || '').slice(0, 40);
      if (!safe) return;
      user.character = safe;
      io.to(room.id).emit('userUpdated', { id: socket.id, character: user.character });
    });

    socket.on('updateName', ({ name }) => {
      const room = currentRoom();
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      const safe = String(name || '').slice(0, NAME_MAX).trim();
      if (!safe) return;
      user.name = safe;
      io.to(room.id).emit('userUpdated', { id: socket.id, name: user.name });
    });

    socket.on('chat', ({ text }) => {
      const room = currentRoom();
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      const trimmed = String(text || '').slice(0, MSG_MAX).trim();
      if (!trimmed) return;
      const message: ChatMessage = {
        id: randomUUID(),
        userId: user.id,
        name: user.name,
        character: user.character,
        text: trimmed,
        timestamp: Date.now(),
      };
      room.messages.push(message);
      if (room.messages.length > MAX_HISTORY) room.messages.shift();
      io.to(room.id).emit('chatMessage', message);
    });

    socket.on('disconnect', () => {
      const room = currentRoom();
      if (!room) return;
      if (!room.users.has(socket.id)) return;
      room.users.delete(socket.id);
      io.to(room.id).emit('userLeft', { id: socket.id });
    });
  },
);

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('text/plain').send(
      'cya server is running. The client has not been built yet.\n' +
        'Run `npm run dev` from the repo root, or build with `npm run build` then `npm start`.',
    );
  });
}

httpServer.listen(PORT, () => {
  console.log(`cya server listening on http://localhost:${PORT}`);
});
