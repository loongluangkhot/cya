import { useEffect, useState } from 'react';
import { socket } from './socket';
import Landing from './components/Landing';
import Room from './components/Room';
import {
  applyThemeToDocument,
  loadStoredTheme,
  persistTheme,
} from './themes';
import { loadStoredBackground, persistBackground } from './backgrounds';
import type { BackgroundId, CharacterId, ThemeId } from './types';

interface Me {
  name: string;
  character: CharacterId;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(loadStoredTheme);
  const [background, setBackground] = useState<BackgroundId>(loadStoredBackground);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    persistBackground(background);
  }, [background]);

  useEffect(() => {
    if (!me) return;
    function onConnect() {
      if (!me) return;
      socket.emit('join', { name: me.name, character: me.character });
    }
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [me]);

  function handleJoin(name: string, character: CharacterId) {
    setMe({ name, character });
    if (!socket.connected) socket.connect();
    else socket.emit('join', { name, character });
  }

  function handleCharacterChange(newCharacter: CharacterId) {
    setMe((m) => (m ? { ...m, character: newCharacter } : m));
    socket.emit('updateCharacter', { character: newCharacter });
  }

  function handleNameChange(newName: string) {
    const trimmed = newName.trim().slice(0, 20);
    if (!trimmed) return;
    setMe((m) => (m ? { ...m, name: trimmed } : m));
    socket.emit('updateName', { name: trimmed });
  }

  if (!me) {
    return <Landing onJoin={handleJoin} theme={theme} onThemeChange={setTheme} />;
  }
  return (
    <Room
      name={me.name}
      onNameChange={handleNameChange}
      character={me.character}
      onCharacterChange={handleCharacterChange}
      theme={theme}
      onThemeChange={setTheme}
      background={background}
      onBackgroundChange={setBackground}
    />
  );
}
