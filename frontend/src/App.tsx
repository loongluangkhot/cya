import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Landing from './components/Landing';
import RoomEntry from './components/RoomEntry';
import {
  applyThemeToDocument,
  loadStoredTheme,
  persistTheme,
} from './themes';
import { loadStoredBackground, persistBackground } from './backgrounds';
import type { BackgroundId, ThemeId } from './types';

function NotFound() {
  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="title">cya</h1>
        <p className="subtitle">that page doesn't exist</p>
        <Link to="/" className="btn-primary">back home</Link>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(loadStoredTheme);
  const [background, setBackground] = useState<BackgroundId>(loadStoredBackground);

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    persistBackground(background);
  }, [background]);

  return (
    <Routes>
      <Route
        path="/"
        element={<Landing theme={theme} onThemeChange={setTheme} />}
      />
      <Route
        path="/r/:roomId"
        element={
          <RoomEntry
            theme={theme}
            onThemeChange={setTheme}
            background={background}
            onBackgroundChange={setBackground}
          />
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
