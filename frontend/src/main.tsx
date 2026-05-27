import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/app.css';

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

const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
