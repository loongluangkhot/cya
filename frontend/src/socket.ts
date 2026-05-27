import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';
import type { ClientToServerEvents, ServerToClientEvents } from './types';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_BASE, {
  autoConnect: false,
});
