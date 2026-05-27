/// <reference types="vite/client" />

declare const __BACKEND_URL__: string;

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
