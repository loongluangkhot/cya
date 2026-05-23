export type Direction = 'left' | 'right';

export type CharacterId = string;
export type ThemeId = string;
export type BackgroundId = 'lcd' | 'classroom' | 'downtown' | 'farm' | 'themepark';

export interface User {
  id: string;
  name: string;
  character: CharacterId;
  x: number;
  y: number;
  direction: Direction;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  character: CharacterId;
  text: string;
  timestamp: number;
}

export interface RoomDimensions {
  width: number;
  height: number;
}

export interface StatePayload {
  you: User;
  users: User[];
  messages: ChatMessage[];
  room: RoomDimensions;
}

export interface MovePayload {
  id: string;
  x: number;
  y: number;
  direction: Direction;
}

export interface UserUpdatedPayload {
  id: string;
  character?: CharacterId;
  name?: string;
}

export interface BubbleState {
  text: string;
  expiresAt: number;
  id: string;
}

export interface ServerToClientEvents {
  state: (payload: StatePayload) => void;
  userJoined: (user: User) => void;
  userLeft: (payload: { id: string }) => void;
  userMoved: (payload: MovePayload) => void;
  userUpdated: (payload: UserUpdatedPayload) => void;
  chatMessage: (msg: ChatMessage) => void;
}

export interface ClientToServerEvents {
  join: (payload: { name: string; character: CharacterId }) => void;
  move: (payload: { x: number; y: number; direction: Direction }) => void;
  chat: (payload: { text: string }) => void;
  updateCharacter: (payload: { character: CharacterId }) => void;
  updateName: (payload: { name: string }) => void;
}

export interface ColorMap {
  [key: string]: string;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  type: 'pixel';
  color: string;
  grid: readonly string[];
  colors: ColorMap;
}

export interface CharacterCollection {
  id: string;
  name: string;
  characters: CharacterDef[];
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  swatch: [string, string];
}

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
}
