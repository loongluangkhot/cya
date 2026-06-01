// Shared identity-in-localStorage helpers. Both App (Landing) and
// RoomEntry persist the same `Identity` shape under the same key — this
// module owns the key, the validator, and the get/set wrappers so the
// two screens can't drift apart.

import type { Identity } from './components/Screens';

export const ME_KEY = 'cya:identity:v2';

/** Validate a parsed JSON value as an Identity. Used by App's
    `useStoredState` validator and internally by `loadIdentity`. Legacy
    identities (pre-memo) get migrated with an empty memo. */
export function validateIdentity(parsed: unknown): Identity | null {
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as Identity).name === 'string' &&
    typeof (parsed as Identity).color === 'string' &&
    typeof (parsed as Identity).character === 'string'
  ) {
    const memo =
      typeof (parsed as Identity).memo === 'string' ? (parsed as Identity).memo : '';
    return { ...(parsed as Identity), memo };
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
