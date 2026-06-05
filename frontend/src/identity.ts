// Shared identity-in-localStorage helpers. Both App (Landing) and
// RoomEntry persist the same `Identity` shape under the same key — this
// module owns the key, the validator, and the get/set wrappers so the
// two screens can't drift apart.

import type { Identity } from './components/Screens';

export const ME_KEY = 'cya:identity:v2';

function newClientId(): string {
  // crypto.randomUUID is supported in all modern browsers; fall back to
  // a hand-rolled v4-ish string only in ancient ones (matters for old
  // mobile WebViews).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** Validate a parsed JSON value as an Identity. Used by App's
    `useStoredState` validator and internally by `loadIdentity`. Legacy
    identities (pre-memo, pre-clientId) get migrated with sensible
    defaults — a missing clientId is minted on the fly and the saved
    record will pick up the new value on next save. */
export function validateIdentity(parsed: unknown): Identity | null {
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Identity).name === 'string' &&
    typeof (parsed as Identity).color === 'string' &&
    typeof (parsed as Identity).character === 'string'
  ) {
    const p = parsed as Partial<Identity>;
    const memo = typeof p.memo === 'string' ? p.memo : '';
    const clientId =
      typeof p.clientId === 'string' && p.clientId ? p.clientId : newClientId();
    return { ...(parsed as Identity), memo, clientId };
  }
  return null;
}

/** Read + validate the stored identity. Returns null if missing,
    malformed, or storage is unavailable (private window etc.). */
export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    return validateIdentity(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveIdentity(me: Identity): void {
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // ignore — private window / blocked storage
  }
}
