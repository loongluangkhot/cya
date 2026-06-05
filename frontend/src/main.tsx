import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
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
