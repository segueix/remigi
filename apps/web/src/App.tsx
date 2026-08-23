import type { GameState } from '@rummikub/core';
import { useState } from 'react';
import type { GameSetup } from './game/useGame';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { StatsScreen } from './screens/StatsScreen';
import type { SavedGame } from './state/savedGame';
import { useProfile } from './state/useProfile';
import { useSavedGame } from './state/useSavedGame';

export type Screen = 'home' | 'game' | 'stats';

/**
 * Navegació mínima amb estat local: no hi ha enllaços profunds ni URL per
 * compartir, així que un router seria pes de més.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [setup, setSetup] = useState<GameSetup | null>(null);
  const [resume, setResume] = useState<GameState | undefined>();
  const [resumeOwners, setResumeOwners] = useState<SavedGame['owners']>();
  const profile = useProfile();
  const savedGame = useSavedGame();

  if (profile.loading || savedGame.loading) {
    return (
      <main className="app">
        <p className="muted">Carregant…</p>
      </main>
    );
  }

  function startGame(next: GameSetup) {
    setSetup(next);
    setResume(undefined);
    setResumeOwners(undefined);
    setScreen('game');
  }

  function continueGame() {
    if (!savedGame.saved) return;
    setSetup(savedGame.saved.setup);
    setResume(savedGame.saved.game);
    setResumeOwners(savedGame.saved.owners);
    setScreen('game');
  }

  /** En tornar a l'inici es torna a mirar si hi ha partida per continuar. */
  function goHome() {
    setScreen('home');
    savedGame.refresh();
  }

  return (
    /* La partida ocupa tota la pantalla, com un joc; la resta és una pàgina. */
    <main className={screen === 'game' ? 'app app-joc' : 'app'}>
      <header className="app-header">
        <h1 onClick={goHome}>Rummikub</h1>
        {profile.profile && (
          <nav>
            <button className="link" onClick={goHome} disabled={screen === 'home'}>
              Inici
            </button>
            <button className="link" onClick={() => setScreen('stats')} disabled={screen === 'stats'}>
              Estadístiques
            </button>
          </nav>
        )}
      </header>

      {screen === 'home' && (
        <HomeScreen
          handle={profile}
          savedGame={savedGame.saved}
          onPlay={startGame}
          onContinue={continueGame}
        />
      )}
      {screen === 'game' && setup && (
        <GameScreen
          setup={setup}
          resume={resume}
          resumeOwners={resumeOwners}
          profile={profile}
          savedGame={savedGame}
          onExit={goHome}
        />
      )}
      {screen === 'stats' && <StatsScreen handle={profile} />}
    </main>
  );
}
