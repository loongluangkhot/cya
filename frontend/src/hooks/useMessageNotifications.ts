import { useCallback, useEffect, useRef, useState } from 'react';
import { useStoredState } from './useStoredState';
import type { ChatMessage } from '../types';
import { formatVoiceDuration } from './useRoomState';

const NOTIF_PREF_KEY = 'cya:notif:v1';

export type NotifState = 'off' | 'on' | 'denied' | 'unsupported';

interface UseMessageNotificationsOpts {
  messages: ChatMessage[];
  meId: string | null;
  roomId: string;
}

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function tabHidden(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState === 'hidden') return true;
  // Some browsers leave visibilityState=visible when another window is focused.
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return true;
  return false;
}

export function useMessageNotifications({
  messages,
  meId,
  roomId,
}: UseMessageNotificationsOpts) {
  const [enabledPref, setEnabledPref] = useStoredState<boolean>(
    NOTIF_PREF_KEY,
    true,
    (v) => (typeof v === 'boolean' ? v : null),
  );

  // Permission is OS/browser state — track it in component state so the UI
  // reflects denials even though we re-read Notification.permission lazily.
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => (isSupported() ? Notification.permission : null),
  );

  // Track which message we've already notified for. Seed lazily on first
  // run so the initial state payload doesn't generate a notification storm.
  const lastNotifiedIdRef = useRef<string | null>(null);
  const seededRef = useRef(false);

  // First-time visitors get the OS permission prompt the first time they
  // interact with the page — browsers reject requestPermission() outside a
  // user gesture, so we can't fire it on load. We only attempt this while
  // the stored preference is on and permission is still 'default'; once the
  // user explicitly toggles off we never re-prompt automatically.
  useEffect(() => {
    if (!isSupported()) return;
    if (!enabledPref) return;
    if (Notification.permission !== 'default') return;
    let cancelled = false;
    function onGesture() {
      if (cancelled) return;
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchend', onGesture);
      Notification.requestPermission()
        .then((p) => setPermission(p))
        .catch(() => {
          // ignore
        });
    }
    window.addEventListener('pointerdown', onGesture, { once: true });
    window.addEventListener('keydown', onGesture, { once: true });
    window.addEventListener('touchend', onGesture, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchend', onGesture);
    };
  }, [enabledPref]);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const last = messages[messages.length - 1];
    lastNotifiedIdRef.current = last ? last.id : null;
  }, [messages]);

  useEffect(() => {
    if (!enabledPref) return;
    if (!isSupported() || permission !== 'granted') return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.id === lastNotifiedIdRef.current) return;
    // Advance the ref *before* the tab-visible / from-me early returns so
    // a foreground or self-authored message still "consumes" the id. This
    // also keeps reconnect-correct behaviour: on `state` re-fire, the
    // last message id matches the ref → silent no-op; a genuinely missed
    // message has a different id → fires once.
    lastNotifiedIdRef.current = last.id;
    if (last.userId === meId) return;
    if (!tabHidden()) return;
    const body =
      last.kind === 'voice'
        ? `🎤 voice ${formatVoiceDuration(last.audioDurationMs)}`
        : last.text;
    try {
      const n = new Notification(`${last.name} · ${roomId}`, {
        body,
        tag: `cya:${roomId}`,
        renotify: true,
      } as NotificationOptions);
      n.onclick = () => {
        try {
          window.focus();
          n.close();
        } catch {
          // ignore
        }
      };
    } catch {
      // Some browsers throw if called before a user gesture or in odd states.
    }
  }, [messages, enabledPref, permission, meId, roomId]);

  const toggle = useCallback(() => {
    if (!isSupported()) return;
    const perm = Notification.permission;
    // Effective "on" requires both the pref and granted permission. If
    // either is missing, treat the click as "turn on" — flip the pref and,
    // if needed, request permission. Otherwise the click is "turn off".
    const effectivelyOn = enabledPref && perm === 'granted';
    if (effectivelyOn) {
      setEnabledPref(false);
      return;
    }
    if (perm === 'denied') {
      setPermission('denied');
      return;
    }
    if (perm === 'granted') {
      setEnabledPref(true);
      setPermission('granted');
      return;
    }
    Notification.requestPermission()
      .then((p) => {
        setPermission(p);
        if (p === 'granted') setEnabledPref(true);
      })
      .catch(() => {
        // ignore
      });
  }, [enabledPref, setEnabledPref]);

  const state: NotifState = !isSupported()
    ? 'unsupported'
    : permission === 'denied'
      ? 'denied'
      : enabledPref && permission === 'granted'
        ? 'on'
        : 'off';

  return { state, toggle };
}
