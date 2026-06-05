// Web Push client helpers. Wraps the browser's `pushManager` plumbing
// (which uses raw Uint8Array keys and slightly clumsy promises) into a
// shape the notifications hook can call without knowing the spec.
//
// Subscription *registration* on the backend is no longer in here —
// that flows through the socket as an authed `subscribePush` event
// (events.py), so a peer can't hijack another user's subscription
// via a public HTTP body. This module just deals with the browser
// PushSubscription object lifecycle.

import { API_BASE } from './api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  // VAPID public keys are base64url-encoded without padding. The
  // browser's pushManager wants a Uint8Array, so we restore padding
  // and translate the URL-safe alphabet before decoding.
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** True when the browser supports both service workers and push. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  );
}

// Only cache *successful* lookups. A 5xx / network failure / unset
// VAPID_PUBLIC_KEY (empty string from server) all return null without
// caching, so the next call retries — otherwise a single failure at
// page load would leave push permanently disabled for the session.
let cachedPublicKey: string | null = null;

async function getVapidPublicKey(): Promise<string | null> {
  if (cachedPublicKey) return cachedPublicKey;
  try {
    const r = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    if (!r.ok) return null;
    const data = (await r.json()) as { publicKey?: string };
    const key = data.publicKey?.trim() || null;
    if (key) cachedPublicKey = key;
    return key;
  } catch {
    return null;
  }
}

/** Subscribe (or return the existing subscription if one already
 *  exists). Returns null if push isn't available or VAPID isn't
 *  configured on the server — caller treats that as "no push". */
export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const publicKey = await getVapidPublicKey();
  if (!publicKey) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) return sub;
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // required by Chromium
      // Cast to BufferSource — TS's lib.dom Uint8Array can be backed
      // by SharedArrayBuffer in strict mode, but pushManager only ever
      // gets a plain ArrayBuffer here.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    return sub;
  } catch {
    return null;
  }
}

/** Release the browser-side PushSubscription. The backend record is
 *  cleared separately via the socket `unsubscribePush` event so the
 *  drop is authenticated. */
export async function releaseBrowserSubscription(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // ignore
  }
}
