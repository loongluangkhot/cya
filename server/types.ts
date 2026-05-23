export type Direction = 'left' | 'right';

export interface User {
  id: string;
  name: string;
  character: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  character: string;
  text: string;
  timestamp: number;
}

export interface StatePayload {
  you: User;
  users: User[];
  messages: ChatMessage[];
  room: { width: number; height: number };
}

export interface ServerToClientEvents {
  state: (payload: StatePayload) => void;
  userJoined: (user: User) => void;
  userLeft: (payload: { id: string }) => void;
  userMoved: (payload: { id: string; x: number; y: number; direction: Direction }) => void;
  userUpdated: (payload: { id: string; character?: string; name?: string }) => void;
  chatMessage: (msg: ChatMessage) => void;
}

export interface ClientToServerEvents {
  join: (payload: { name?: string; character?: string }) => void;
  move: (payload: { x?: number; y?: number; direction?: string }) => void;
  chat: (payload: { text?: string }) => void;
  updateCharacter: (payload: { character?: string }) => void;
  updateName: (payload: { name?: string }) => void;
}
