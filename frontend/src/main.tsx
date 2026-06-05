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

// Service worker for Web Push. Production-only — in dev the SW would
// cache Vite output and obscure real changes. Scope is explicit so it
// isn't silently broken if the app ever moves to a subpath.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // SW failures are non-fatal — the app works fine without push.
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
