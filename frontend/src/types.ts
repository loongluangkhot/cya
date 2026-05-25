export type Direction = 'left' | 'right';

export type CharacterId = string;
export type ThemeId = string;
export type BackgroundId =
  | 'lcd'
  | 'classroom'
  | 'downtown'
  | 'farm'
  | 'themepark'
  | 'palletTown'
  | 'viridianForest'
  | 'lavenderTown'
  | 'pokemonCenter';

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

export interface PlaybackState {
  trackUri: string | null;
  isPlaying: boolean;
  positionMs: number;
  positionUpdatedAt: number;
}

export interface StatePayload {
  you: User;
  users: User[];
  messages: ChatMessage[];
  room: RoomDimensions;
  background: BackgroundId;
  playback: PlaybackState;
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
  backgroundChanged: (payload: { background: BackgroundId }) => void;
  playbackChanged: (payload: PlaybackState) => void;
}

export interface JoinAck {
  ok: boolean;
  error?: 'room_not_found';
}

export interface ClientToServerEvents {
  join: (
    payload: {
      roomId: string;
      name: string;
      character: CharacterId;
      background: BackgroundId;
    },
    ack?: (res: JoinAck) => void,
  ) => void;
  move: (payload: { x: number; y: number; direction: Direction }) => void;
  chat: (payload: { text: string }) => void;
  updateCharacter: (payload: { character: CharacterId }) => void;
  updateName: (payload: { name: string }) => void;
  updateBackground: (payload: { background: BackgroundId }) => void;
  updatePlayback: (payload: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
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
