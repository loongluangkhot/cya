export type Direction = 'left' | 'right';

export type CharacterId =
  | 'chef'
  | 'astronaut'
  | 'detective'
  | 'wizard'
  | 'diver'
  | 'pilot'
  | 'skater'
  | 'knight';

export type ColorId =
  | 'rose'
  | 'amber'
  | 'butter'
  | 'leaf'
  | 'sea'
  | 'cobalt'
  | 'plum'
  | 'fog';

// @sync: backend/payloads.py:AMBIENT_TIMES / AMBIENT_WEATHERS / AMBIENT_ROOMS
export type AmbientTime = 'dawn' | 'day' | 'dusk' | 'night';
export type AmbientWeather = 'clear' | 'rain' | 'snow' | 'fog';
export type AmbientRoom = 'clearing' | 'plaza';

// Keep in sync with backend/main.py — the @dataclass definitions there
// emit (via dataclasses.asdict) directly into the socket.io payloads
// below, so adding/removing a field must be done in both places.

// @sync: backend/main.py:Ambient
export interface Ambient {
  time: AmbientTime;
  weather: AmbientWeather;
  room: AmbientRoom;
  /** 0..100 — multiplies the weather overlay opacity. */
  intensity: number;
}

// @sync: backend/main.py:User
export interface User {
  id: string;
  name: string;
  character: CharacterId;
  color: ColorId;
  x: number;
  y: number;
  direction: Direction;
  /** "On My Mind" memo — markdown text the user carries between rooms. */
  memo: string;
}

// @sync: backend/main.py:ChatMessage
export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  character: CharacterId;
  color: ColorId;
  text: string;
  timestamp: number;
}

export interface RoomDimensions {
  width: number;
  height: number;
}

// @sync: backend/main.py:_playback_snapshot
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
  ambient: Ambient;
  playback: PlaybackState;
  queue: string[];
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
  color?: ColorId;
  memo?: string;
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
  ambientChanged: (payload: Ambient) => void;
  playbackChanged: (payload: PlaybackState) => void;
  queueChanged: (payload: { queue: string[] }) => void;
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
      color: ColorId;
      memo: string;
    },
    ack?: (res: JoinAck) => void,
  ) => void;
  move: (payload: { x: number; y: number; direction: Direction }) => void;
  chat: (payload: { text: string }) => void;
  updateCharacter: (payload: { character: CharacterId }) => void;
  updateColor: (payload: { color: ColorId }) => void;
  updateName: (payload: { name: string }) => void;
  updateMemo: (payload: { memo: string }) => void;
  updateAmbient: (payload: Partial<Ambient>) => void;
  updatePlayback: (payload: {
    trackUri: string | null;
    isPlaying: boolean;
    positionMs: number;
  }) => void;
  addToQueue: (payload: { uri: string }) => void;
  addManyToQueue: (payload: { uris: string[] }) => void;
  playCollection: (payload: { uris: string[] }) => void;
  removeFromQueue: (payload: { uri: string; index?: number }) => void;
  advanceQueue: (payload: { afterTrackUri: string | null }) => void;
  clearQueue: () => void;
}

export interface ColorMap {
  [key: string]: string;
}

export interface CharacterDef {
  id: CharacterId;
  label: string;
  description: string;
  grid: readonly string[];
  colors: ColorMap;
}

export interface ColorDef {
  id: ColorId;
  hex: string;
}
