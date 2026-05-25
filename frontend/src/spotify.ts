export interface SpotifyPlaybackUpdate {
  isPaused: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
}

export interface SpotifyController {
  loadUri: (uri: string) => void;
  play: () => void;
  resume: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  addListener: (
    event: 'playback_update' | 'ready',
    cb: (e: { data: SpotifyPlaybackUpdate }) => void,
  ) => void;
  removeListener: (event: string) => void;
  destroy: () => void;
}

interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri?: string; width?: string | number; height?: string | number },
    cb: (controller: SpotifyController) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
    SpotifyIframeApi?: SpotifyIFrameAPI;
  }
}

const IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
let apiPromise: Promise<SpotifyIFrameAPI> | null = null;

export function loadIFrameAPI(): Promise<SpotifyIFrameAPI> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) {
      resolve(window.SpotifyIframeApi);
      return;
    }
    const existing = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      if (existing) existing(api);
      resolve(api);
    };
    const script = document.createElement('script');
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () =>
      reject(new Error('failed to load Spotify IFrame API (likely blocked by an ad blocker or network)'));
    document.head.appendChild(script);
  });
  return apiPromise;
}

// The IFrame API requires a uri at controller creation; we pause it immediately
// after and replace it once the room's track arrives.
const BOOT_PLACEHOLDER_URI = 'spotify:track:11dFghVXANMlKmJXsNCbNl';

export function createController(
  element: HTMLElement,
  initialUri?: string,
): Promise<SpotifyController> {
  return loadIFrameAPI().then(
    (api) =>
      new Promise((resolve) => {
        api.createController(
          element,
          { uri: initialUri ?? BOOT_PLACEHOLDER_URI, width: '100%', height: '80' },
          (controller) => resolve(controller),
        );
      }),
  );
}

const TRACK_ID_RE = /^[A-Za-z0-9]{22}$/;

export function extractSpotifyTrackUri(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('spotify:track:')) {
    const id = trimmed.slice('spotify:track:'.length);
    return TRACK_ID_RE.test(id) ? `spotify:track:${id}` : null;
  }
  const urlMatch = trimmed.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/);
  if (urlMatch && TRACK_ID_RE.test(urlMatch[1])) {
    return `spotify:track:${urlMatch[1]}`;
  }
  if (TRACK_ID_RE.test(trimmed)) {
    return `spotify:track:${trimmed}`;
  }
  return null;
}
