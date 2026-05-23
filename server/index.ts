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
  ServerToClientEvents,
  User,
} from './types.js';

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
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: '*' },
});

const users = new Map<string, User>();
const messages: ChatMessage[] = [];

function randomSpawn(): { x: number; y: number } {
  return {
    x: 120 + Math.floor(Math.random() * (ROOM_WIDTH - 240)),
    y: 220 + Math.floor(Math.random() * (ROOM_HEIGHT - 320)),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  socket.on('join', ({ name, character }) => {
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
    users.set(socket.id, user);

    socket.emit('state', {
      you: user,
      users: Array.from(users.values()),
      messages,
      room: { width: ROOM_WIDTH, height: ROOM_HEIGHT },
    });
    socket.broadcast.emit('userJoined', user);
  });

  socket.on('move', ({ x, y, direction }) => {
    const user = users.get(socket.id);
    if (!user) return;
    user.x = clamp(Number(x) || 0, 0, ROOM_WIDTH);
    user.y = clamp(Number(y) || 0, 0, ROOM_HEIGHT);
    if (direction === 'left' || direction === 'right') user.direction = direction;
    socket.broadcast.emit('userMoved', {
      id: user.id,
      x: user.x,
      y: user.y,
      direction: user.direction,
    });
  });

  socket.on('updateCharacter', ({ character }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const safe = String(character || '').slice(0, 40);
    if (!safe) return;
    user.character = safe;
    io.emit('userUpdated', { id: socket.id, character: user.character });
  });

  socket.on('updateName', ({ name }) => {
    const user = users.get(socket.id);
    if (!user) return;
    const safe = String(name || '').slice(0, NAME_MAX).trim();
    if (!safe) return;
    user.name = safe;
    io.emit('userUpdated', { id: socket.id, name: user.name });
  });

  socket.on('chat', ({ text }) => {
    const user = users.get(socket.id);
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
    messages.push(message);
    if (messages.length > MAX_HISTORY) messages.shift();
    io.emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    if (!users.has(socket.id)) return;
    users.delete(socket.id);
    io.emit('userLeft', { id: socket.id });
  });
});

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
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
