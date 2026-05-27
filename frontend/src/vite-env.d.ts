/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_SPOTIFY_CLIENT_ID: string;
  readonly VITE_DEFAULT_PLAYLIST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
