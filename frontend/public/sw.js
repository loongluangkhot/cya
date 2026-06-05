// cya service worker — handles Web Push delivery while the page is
// frozen or not focused.
//
// Routing policy:
//   - If a controlled client is visible on the same room URL, we
//     postMessage the payload and skip the OS notification (the in-app
//     toast handler renders it). This avoids double-surfacing for
//     foreground tabs.
//   - Otherwise we fire `showNotification`. The tab is hidden, on a
//     different page, or closed entirely.

/* global self, clients */

self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

function buildTitle(data) {
  if (data.kind === 'message') return `${data.fromName || 'someone'} · ${data.roomId}`;
  if (data.kind === 'voice') return `${data.fromName || 'someone'} · ${data.roomId}`;
  if (data.kind === 'mugshot') return `mugshot · ${data.roomId}`;
  return data.roomId || 'cya';
}

function buildOptions(data) {
  let body = '';
  if (data.kind === 'message') body = data.text || '';
  else if (data.kind === 'voice') body = '🎤 voice message';
  else if (data.kind === 'mugshot') body = 'snap a quick selfie';
  return {
    body,
    // tag collapses repeat notifications for the same room into one
    // — desktop browsers stack otherwise.
    tag: `cya:${data.kind}:${data.roomId}`,
    renotify: true,
    data: { roomId: data.roomId, kind: data.kind },
  };
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch (_) {
        // Malformed payload — drop silently.
        return;
      }
      const roomId = data.roomId;
      const matches = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const visibleOnRoom = matches.find(
        (c) => c.visibilityState === 'visible' && c.url.includes(`/r/${roomId}`),
      );
      if (visibleOnRoom) {
        // Hand off to the in-tab toast pipeline; don't fire an OS
        // notification on top of the message they can already see.
        visibleOnRoom.postMessage({ source: 'cya-sw', kind: 'push', payload: data });
        return;
      }
      await self.registration.showNotification(buildTitle(data), buildOptions(data));
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const roomId = event.notification.data && event.notification.data.roomId;
  event.waitUntil(
    (async () => {
      const matches = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Prefer focusing an existing tab on the same room.
      const onRoom = matches.find((c) => roomId && c.url.includes(`/r/${roomId}`));
      if (onRoom) {
        try {
          await onRoom.focus();
          return;
        } catch (_) {
          // fall through to open a new window
        }
      }
      if (roomId) {
        await self.clients.openWindow(`/r/${roomId}`);
      } else if (matches[0]) {
        try {
          await matches[0].focus();
        } catch (_) {
          // ignore
        }
      }
    })(),
  );
});
