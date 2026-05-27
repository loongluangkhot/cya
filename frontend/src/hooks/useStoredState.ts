import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { safeLocalGetJSON, safeLocalRemove, safeLocalSetJSON } from '../storage';

/**
 * React state backed by `localStorage` (JSON-encoded).
 *
 * On mount, reads the stored value and runs `validate` against the parsed
 * JSON. If validation fails (or the key is empty), falls back to `initial`.
 * On every change, writes back — or removes the key if the value is `null` /
 * `undefined`, so callers can clear the slot by setting state to `null`.
 */
export function useStoredState<T>(
  key: string,
  initial: T | (() => T),
  validate?: (parsed: unknown) => T | null,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = safeLocalGetJSON<unknown>(key);
    if (stored !== null) {
      const v = validate ? validate(stored) : (stored as T);
      if (v !== null && v !== undefined) return v;
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  // Skip the write on the first render — the value is either what we just
  // read from storage (no-op write) or the caller's initial (also no need
  // to persist until they actually change it).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (value === null || value === undefined) {
      safeLocalRemove(key);
    } else {
      safeLocalSetJSON(key, value);
    }
  }, [key, value]);

  return [value, setValue];
}
