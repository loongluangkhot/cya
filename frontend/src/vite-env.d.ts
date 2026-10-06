/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_SPOTIFY_CLIENT_ID: string;
  readonly VITE_DEFAULT_PLAYLIST_URL?: string;
  readonly VITE_MEMO_PEEK_GAP_S?: string;
  readonly VITE_MEMO_PEEK_FIRST_S?: string;
  readonly VITE_MEMO_PEEK_SHOW_S?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
