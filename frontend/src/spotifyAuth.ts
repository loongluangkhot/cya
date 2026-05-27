// Spotify OAuth — PKCE flow, client-side only.
//
// State persistence:
//   - sessionStorage holds the PKCE code_verifier + the "return to" path
//     between the redirect-out and the callback-in.
//   - localStorage holds the resulting token set, so the user stays
//     connected across reloads.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ');

const TOKEN_KEY = 'cya:spotify:token';
const VERIFIER_KEY = 'cya:spotify:verifier';
const RETURN_KEY = 'cya:spotify:returnTo';

export interface SpotifyTokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms epoch
  scope: string;
}

export function getRedirectUri(): string {
  return `${window.location.origin}/spotify/callback`;
}

function loadTokenSet(): SpotifyTokenSet | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.access_token === 'string' &&
      typeof parsed.refresh_token === 'string' &&
      typeof parsed.expires_at === 'number'
    ) {
      return parsed as SpotifyTokenSet;
    }
  } catch {
    // ignore
  }
  return null;
}

function storeTokenSet(tok: SpotifyTokenSet) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tok));
  } catch {
    // ignore
  }
}

export function clearSpotifyToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function hasSpotifyToken(): boolean {
  const tok = loadTokenSet();
  if (!tok) return false;
  // Reject tokens minted with an older, smaller scope set.
  const required = SCOPES.split(' ');
  const granted = (tok.scope || '').split(/\s+/);
  if (!required.every((s) => granted.includes(s))) {
    clearSpotifyToken();
    return false;
  }
  return true;
}

// ───────── PKCE helpers ─────────

function base64urlEncode(arr: Uint8Array): string {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateVerifier(length = 64): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf).slice(0, length);
}

async function codeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(new Uint8Array(hash));
}

// ───────── Public flow ─────────

export async function beginSpotifyLogin(returnTo?: string) {
  if (!CLIENT_ID) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID not configured');
  }
  const verifier = generateVerifier();
  const challenge = await codeChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(
    RETURN_KEY,
    returnTo ?? window.location.pathname + window.location.search,
  );
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

export async function handleSpotifyCallback(
  code: string,
): Promise<{ ok: true; returnTo: string } | { ok: false; error: string }> {
  if (!CLIENT_ID) {
    return { ok: false, error: 'VITE_SPOTIFY_CLIENT_ID not configured' };
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    return { ok: false, error: 'missing PKCE verifier — please try again' };
  }
  const returnTo = sessionStorage.getItem(RETURN_KEY) || '/';
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_KEY);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `token exchange failed (${res.status}): ${text}` };
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    };
    storeTokenSet({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    });
    return { ok: true, returnTo };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Returns a valid access token, refreshing if needed. Returns null if the
// user isn't connected or the refresh failed.
let refreshInFlight: Promise<string | null> | null = null;

export async function getValidSpotifyToken(): Promise<string | null> {
  const tok = loadTokenSet();
  if (!tok) return null;
  if (Date.now() < tok.expires_at - 60_000) return tok.access_token;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshToken(tok).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshToken(prev: SpotifyTokenSet): Promise<string | null> {
  if (!CLIENT_ID) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: prev.refresh_token,
    client_id: CLIENT_ID,
  });
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      clearSpotifyToken();
      return null;
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };
    const next: SpotifyTokenSet = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || prev.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope || prev.scope,
    };
    storeTokenSet(next);
    return next.access_token;
  } catch {
    clearSpotifyToken();
    return null;
  }
}
