// Spotify Web Playback SDK — loader, type declarations, URI parsing.

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

// Minimal type subset of the SDK we use.
export interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string; uri: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
    uri: string;
  };
  duration_ms: number;
}

export interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack;
    previous_tracks: SpotifyTrack[];
    next_tracks: SpotifyTrack[];
  };
}

export interface SpotifyReadyEvent {
  device_id: string;
}

export interface SpotifyErrorEvent {
  message: string;
}

export type SpotifyEvent =
  | 'ready'
  | 'not_ready'
  | 'player_state_changed'
  | 'initialization_error'
  | 'authentication_error'
  | 'account_error'
  | 'playback_error'
  | 'autoplay_failed';

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready' | 'not_ready', cb: (e: SpotifyReadyEvent) => void): boolean;
  addListener(event: 'player_state_changed', cb: (s: SpotifyPlayerState | null) => void): boolean;
  addListener(
    event:
      | 'initialization_error'
      | 'authentication_error'
      | 'account_error'
      | 'playback_error'
      | 'autoplay_failed',
    cb: (e: SpotifyErrorEvent) => void,
  ): boolean;
  removeListener(event: SpotifyEvent): boolean;
  togglePlay(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
}

interface SpotifyPlayerConstructor {
  new (options: SpotifyPlayerInit): SpotifyPlayer;
}

declare global {
  interface Window {
    Spotify?: { Player: SpotifyPlayerConstructor };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let sdkPromise: Promise<void> | null = null;

export function loadSpotifySDK(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    const existing = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (existing) existing();
      resolve();
    };
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () =>
      reject(new Error('failed to load Spotify Web Playback SDK (blocked or offline?)'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// ───────── URI parsing ─────────

const TRACK_ID_RE = /^[A-Za-z0-9]{22}$/;

export function extractSpotifyTrackUri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('spotify:track:')) {
    const id = trimmed.slice('spotify:track:'.length);
    return TRACK_ID_RE.test(id) ? `spotify:track:${id}` : null;
  }
  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/,
  );
  if (urlMatch && TRACK_ID_RE.test(urlMatch[1])) {
    return `spotify:track:${urlMatch[1]}`;
  }
  if (TRACK_ID_RE.test(trimmed)) {
    return `spotify:track:${trimmed}`;
  }
  return null;
}
