import { useCallback, useEffect, useState } from 'react';
import {
  ensurePushSubscription,
  pushSupported,
  registerSubscription,
  unregisterSubscription,
} from '../push';
import { useStoredState } from './useStoredState';

const NOTIF_PREF_KEY = 'cya:notif:v1';

export type NotifState = 'off' | 'on' | 'denied' | 'unsupported';

interface UseMessageNotificationsOpts {
  roomId: string;
  /** Stable clientId from Identity. Required to register the push
   *  subscription on the backend; null while the user hasn't completed
   *  Setup yet (the hook silently no-ops until present). */
  clientId: string | null;
}

function notificationApiSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function isFullySupported(): boolean {
  return notificationApiSupported() && pushSupported();
}

/** Permission + push-subscription manager.
 *
 *  Surfaces the same on/off/denied/unsupported state the UI has always
 *  used. Underneath, notification *delivery* is now SW-only — the SW
 *  fires OS notifications and (for tabs visible on the right room URL)
 *  posts a message back to the page, where `useRoomState` translates it
 *  into an in-app toast.
 */
export function useMessageNotifications({
  roomId,
  clientId,
}: UseMessageNotificationsOpts) {
  const [enabledPref, setEnabledPref] = useStoredState<boolean>(
    NOTIF_PREF_KEY,
    true,
    (v) => (typeof v === 'boolean' ? v : null),
  );
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => (notificationApiSupported() ? Notification.permission : null),
  );

  // First-gesture permission prompt — browsers reject
  // requestPermission() outside a user gesture, so we can't fire it on
  // load.
  useEffect(() => {
    if (!notificationApiSupported()) return;
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

  // Push subscription lifecycle. The "POST is idempotent" contract on
  // the server lets us be sloppy about re-registering on every mount.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    if (enabledPref && permission === 'granted' && isFullySupported()) {
      (async () => {
        const sub = await ensurePushSubscription();
        if (cancelled || !sub) return;
        await registerSubscription(roomId, clientId, sub);
      })();
    } else if (clientId && (!enabledPref || permission === 'denied')) {
      (async () => {
        await unregisterSubscription(roomId, clientId);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [enabledPref, permission, roomId, clientId]);

  const toggle = useCallback(() => {
    if (!notificationApiSupported()) return;
    const perm = Notification.permission;
    // Effective "on" requires both pref and granted permission. If
    // either is missing, treat the click as "turn on" — flip the pref
    // and, if needed, request permission. Otherwise the click is
    // "turn off".
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

  const state: NotifState = !isFullySupported()
    ? 'unsupported'
    : permission === 'denied'
      ? 'denied'
      : enabledPref && permission === 'granted'
        ? 'on'
        : 'off';

  return { state, toggle };
}
