// Small wrappers around the browser storage APIs. They swallow the SecurityError
// browsers throw in private windows / blocked-storage contexts, so callers don't
// have to repeat try/catch at every site.

export function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function safeLocalRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function safeLocalGetJSON<T>(key: string): T | null {
  const raw = safeLocalGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeLocalSetJSON(key: string, value: unknown): void {
  try {
    safeLocalSet(key, JSON.stringify(value));
  } catch {
    // ignore (JSON.stringify can throw on circular refs)
  }
}

export function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
