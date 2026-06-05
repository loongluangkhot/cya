import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensurePushSubscription,
  pushSupported,
  registerSubscription,
  unregisterSubscription,
} from '../push';
import type { ChatMessage } from '../types';
import { formatVoiceDuration } from './useRoomState';
import { useStoredState } from './useStoredState';

const NOTIF_PREF_KEY = 'cya:notif:v1';

export type NotifState =
  | 'off'
  | 'on'
  | 'denied'
  | 'unsupported'
  /** iOS Safari in a regular tab — push works only when the user
   *  installs the site to their home screen. The UI surfaces an
   *  install hint instead of the generic "unsupported" message. */
  | 'needs-install';

interface UseMessageNotificationsOpts {
  roomId: string;
  /** Stable clientId from Identity. Required to register the push
   *  subscription on the backend; null while the user hasn't completed
   *  Setup yet (the hook silently no-ops until present). */
  clientId: string | null;
  /** Live chat history — drives the in-tab notification fallback. */
  messages: ChatMessage[];
  /** Local user id (clientId), so we don't notify for our own messages. */
  meId: string | null;
}

function notificationApiSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function pushFullySupported(): boolean {
  return notificationApiSupported() && pushSupported();
}

/** Detect iOS Safari (or any WebKit shell on iOS — Chrome iOS shares
 *  the same limitation) running in a regular tab, not as a home-screen
 *  PWA. iOS only exposes PushManager for installed PWAs, so the user
 *  needs to "add to home screen" to enable notifications. */
function isIosTabNeedsInstall(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  // iOS uses the legacy `navigator.standalone === true` flag when
  // launched from the home screen; modern browsers also expose
  // `display-mode: standalone` via matchMedia.
  const navStandalone = (navigator as { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return !navStandalone && !mediaStandalone;
}

function tabHidden(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState === 'hidden') return true;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return true;
  return false;
}

/** Permission + push-subscription manager + in-tab fallback.
 *
 *  Two delivery paths:
 *   1. **SW Web Push.** Server fans out on `status=away`; the SW
 *      receives and either posts a message to a visible client or
 *      fires an OS notification. This is the only path that survives
 *      a frozen tab.
 *   2. **In-tab Notification API.** Fires on chat messages arriving
 *      via socket. Used as the fallback when (a) push isn't wired
 *      (no VAPID, dev mode, browser unsupported), or (b) the tab is
 *      visible-but-unfocused — a gap the server-side `status=away`
 *      filter doesn't cover. Gated by `hasPushSub` so it stays
 *      silent when SW push will handle the case.
 */
export function useMessageNotifications({
  roomId,
  clientId,
  messages,
  meId,
}: UseMessageNotificationsOpts) {
  const [enabledPref, setEnabledPref] = useStoredState<boolean>(
    NOTIF_PREF_KEY,
    true,
    (v) => (typeof v === 'boolean' ? v : null),
  );
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () => (notificationApiSupported() ? Notification.permission : null),
  );
  // True once we've successfully ensured a PushSubscription and POSTed
  // it to the backend. Used to gate the in-tab fallback so we don't
  // double-notify when SW push will also fire.
  const [hasPushSub, setHasPushSub] = useState(false);

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

  // Push subscription lifecycle. The server's POST is idempotent so
  // we can be sloppy about re-registering. Sets hasPushSub on success
  // so the in-tab fallback knows to step aside for the hidden-tab case.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    if (enabledPref && permission === 'granted' && pushFullySupported()) {
      (async () => {
        const sub = await ensurePushSubscription();
        if (cancelled) return;
        if (sub) {
          const ok = await registerSubscription(roomId, clientId, sub);
          if (!cancelled) setHasPushSub(ok);
        } else {
          // VAPID not configured or browser refused — fall back to
          // in-tab notifications only.
          if (!cancelled) setHasPushSub(false);
        }
      })();
    } else if (!enabledPref || permission === 'denied') {
      (async () => {
        await unregisterSubscription(roomId, clientId);
        if (!cancelled) setHasPushSub(false);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [enabledPref, permission, roomId, clientId]);

  // ────────────── In-tab notification fallback ──────────────
  // Tracks the last message we surfaced (whether actually fired or
  // not) so a re-mount or reconnect doesn't replay old messages.
  const lastNotifiedIdRef = useRef<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const last = messages[messages.length - 1];
    lastNotifiedIdRef.current = last ? last.id : null;
  }, [messages]);

  useEffect(() => {
    if (!enabledPref) return;
    if (!notificationApiSupported() || permission !== 'granted') return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last || last.id === lastNotifiedIdRef.current) return;
    // Advance the ref before any early return so foreground / from-me
    // messages still consume the id. Keeps reconnect-correct behaviour.
    lastNotifiedIdRef.current = last.id;
    if (last.userId === meId) return;
    if (!tabHidden()) return;
    // SW push will handle the truly-hidden case if wired. Avoid
    // double-firing by deferring there; still cover visible-but-blurred
    // (visibilityState === 'visible' but hasFocus() === false), which
    // the server-side `status=away` push filter never reaches.
    const fullyHidden =
      typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hasPushSub && fullyHidden) return;
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
  }, [messages, enabledPref, permission, meId, roomId, hasPushSub]);

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

  // State drives the Settings UI:
  //  - iOS Safari tab: 'needs-install' regardless of Notification API
  //    presence (the API exists since 16.4 but delivery only works
  //    from an installed PWA).
  //  - Any other browser without Notification API: 'unsupported'.
  //  - Otherwise: off / on / denied based on pref + permission.
  // Browsers that have Notification API but not Push API (rare; some
  // older mobile) read as 'on' once permission is granted — the in-tab
  // fallback covers them.
  const state: NotifState = isIosTabNeedsInstall()
    ? 'needs-install'
    : !notificationApiSupported()
      ? 'unsupported'
      : permission === 'denied'
        ? 'denied'
        : enabledPref && permission === 'granted'
          ? 'on'
          : 'off';

  return { state, toggle };
}
