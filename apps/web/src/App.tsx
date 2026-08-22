import { useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useProfile } from './state/useProfile';

export type Screen = 'home' | 'game' | 'stats';

/**
 * Navegació mínima amb estat local: encara no cal un router, perquè no hi ha
 * enllaços profunds ni URL per compartir. Si a la Fase 5 fa falta historial del
 * navegador, aquí és on s'hi posaria.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const handle = useProfile();

  if (handle.loading) {
    return (
      <main className="app">
        <p className="muted">Carregant el perfil…</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1 onClick={() => setScreen('home')}>Rummikub</h1>
        {handle.profile && (
          <nav>
            <button className="link" onClick={() => setScreen('home')} disabled={screen === 'home'}>
              Inici
            </button>
            <button className="link" onClick={() => setScreen('stats')} disabled={screen === 'stats'}>
              Estadístiques
            </button>
          </nav>
        )}
      </header>

      {screen === 'home' && <HomeScreen handle={handle} onPlay={() => setScreen('game')} />}
      {screen === 'game' && <GameScreen handle={handle} onExit={() => setScreen('home')} />}
      {screen === 'stats' && <StatsScreen handle={handle} />}
    </main>
  );
}
