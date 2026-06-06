import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { loadIdentity } from './identity';
import { applyTheme, loadTheme } from './themes';
import './styles/app.css';

// Apply persisted theme. The inline script in index.html already does
// this synchronously before paint, but this is the React-side source of
// truth and covers cases where the inline tag was stripped.
applyTheme(loadTheme());

// One-shot migration: clear keys from the pre-redesign client. Identity now
// lives under `cya:identity:v2`; theme/background no longer exist.
(function migrateLegacyStorage() {
  const MIGRATION_KEY = 'cya:migration:v2';
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    ['cya:me', 'cya-theme', 'cya-background'].forEach((k) => {
      localStorage.removeItem(k);
    });
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // ignore — private mode etc.
  }
})();

// One-shot migration: the in-room music popup's 3-state placement
// (`'corner' | 'wall' | 'off'`) was replaced by a boolean visibility
// flag + a separate rect record. The old `cya:yt:room:v1` key has no
// reader anymore; drop it so storage doesn't accumulate dead entries.
(function migrateRoomVideoPlacement() {
  const MIGRATION_KEY = 'cya:migration:room-video:v1';
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    localStorage.removeItem('cya:yt:room:v1');
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // ignore — private mode etc.
  }
})();

// One-shot migration: mugshot + music popup keys were renamed to a
// shared `cya:<feature>:{rect|popup|opt-in}:v1` shape. Copy values
// over so users keep their toggles and rect; drop the old keys.
(function migratePopupKeyNames() {
  const MIGRATION_KEY = 'cya:migration:popups-align:v1';
  const renames: Array<[string, string]> = [
    ['cya:mug:board:v1', 'cya:mug:popup:v1'],
    ['cya:yt:room-on:v1', 'cya:yt:popup:v1'],
    ['cya:yt:room:rect:v1', 'cya:yt:rect:v1'],
    ['cya:yt:enabled:v1', 'cya:yt:opt-in:v1'],
  ];
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    for (const [oldKey, newKey] of renames) {
      const val = localStorage.getItem(oldKey);
      if (val !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, val);
      }
      localStorage.removeItem(oldKey);
    }
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch {
    // ignore — private mode etc.
  }
})();

// Identity migration: a pre-clientId record gets a clientId minted +
// persisted *before* any React component reads it. Without this, each
// component (App's useStoredState, RoomEntry's loadIdentity) would
// independently mint a different clientId on each render — defeating
// the entire reconnect-grace mechanism for upgraded users.
loadIdentity();

// Service worker for Web Push. Registered in both dev and prod — our
// SW doesn't cache anything (push handler only), so the usual "stale
// asset" worry from caching SWs doesn't apply. Scope is explicit so
// it isn't silently broken if the app ever moves to a subpath. If
// registration fails (e.g. file 404, http-not-https in some setups),
// the app falls back to the in-tab Notification API path.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Non-fatal — useMessageNotifications detects this and uses
        // the in-tab fallback instead.
      });
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
