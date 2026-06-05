// Web Push client helpers. Wraps the browser's `pushManager` plumbing
// (which uses raw Uint8Array keys and slightly clumsy promises) into a
// shape the notifications hook can call without knowing the spec.

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

let cachedPublicKey: string | null | undefined; // undefined = unfetched

async function getVapidPublicKey(): Promise<string | null> {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  try {
    const r = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    if (!r.ok) {
      cachedPublicKey = null;
      return null;
    }
    const data = (await r.json()) as { publicKey?: string };
    const key = data.publicKey?.trim() || null;
    cachedPublicKey = key;
    return key;
  } catch {
    cachedPublicKey = null;
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

/** Register the subscription with the backend (per-room). Idempotent
 *  server-side. */
export async function registerSubscription(
  roomId: string,
  clientId: string,
  subscription: PushSubscription,
): Promise<boolean> {
  try {
    const r = await fetch(
      `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/push/subscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, subscription: subscription.toJSON() }),
      },
    );
    return r.ok;
  } catch {
    return false;
  }
}

/** Tell the backend to drop the subscription (e.g. user opted out).
 *  Also unsubscribes the browser-side PushSubscription if present. */
export async function unregisterSubscription(
  roomId: string,
  clientId: string,
): Promise<void> {
  try {
    await fetch(
      `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/push/subscribe`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      },
    );
  } catch {
    // ignore — server-side cleanup will happen on grace timeout anyway
  }
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    // ignore
  }
}
