// Type declarations + script loader for the YouTube IFrame Player API.
// We touch only the surface we actually use; the upstream is much larger.

interface YTPlayerCtor {
  new (el: HTMLElement, opts: YTPlayerOptions): YTPlayer;
}

export interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
  };
}

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(sec: number, allow?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
  cuePlaylist?(opts: { list: string; listType?: string; index?: number }): void;
  getPlaylist?(): string[] | null;
}

export interface YTNamespace {
  Player: YTPlayerCtor;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<boolean> | null = null;

/** Load the IFrame Player API script (idempotent — multiple callers share
    one fetch). Resolves true when `window.YT.Player` is available,
    false if the script can't load within a hard timeout. */
export function loadYouTubeApi(): Promise<boolean> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(true);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(true);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => resolve(false);
    document.head.appendChild(tag);
    // Hard timeout — if the API hasn't initialised, give up.
    window.setTimeout(() => resolve(!!(window.YT && window.YT.Player)), 6000);
  });
  return apiPromise;
}
