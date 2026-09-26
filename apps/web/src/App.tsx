import { suggestOpponents } from '@remigi/core';
import { useEffect, useState } from 'react';
import type { GameSetup } from './game/useGame';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import {
  parseProfileTransferUrl,
  stripProfileTransferParams,
  type ProfileProgress,
} from './state/profileTransfer';
import { useProfile } from './state/useProfile';
import { useTileStyle } from './state/useTileStyle';
import { useSavedGame } from './state/useSavedGame';

export type Screen = 'game' | 'stats';

/**
 * L'app entra directament a la taula de joc: si hi ha una partida a mig jugar
 * es continua, i si no se'n reparteix una de nova amb els rivals que toquen
 * per l'habilitat del perfil. Tot el que abans era la pantalla d'inici (nom,
 * rivals, historial, com es juga) viu ara al menú del teu jugador.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>('game');
  const profile = useProfile();
  const savedGame = useSavedGame();
  const [tileStyle, setTileStyle] = useTileStyle();
  const [pendingProgress, setPendingProgress] = useState<ProfileProgress | null>(() =>
    typeof window === 'undefined' ? null : parseProfileTransferUrl(window.location.href),
  );

  /*
   * El perfil es crea sol la primera vegada, amb un nom de casa: demanar-lo
   * abans de deixar jugar era la primera pantalla, i ja no hi és. El nom es
   * canvia quan es vulgui des del menú del jugador.
   */
  const { loading: profileLoading, profile: loadedProfile, setName } = profile;
  useEffect(() => {
    if (!profileLoading && !loadedProfile) void setName('Jugador');
  }, [profileLoading, loadedProfile, setName]);

  if (profile.loading || savedGame.loading || !profile.profile) {
    return (
      <main className="app">
        <p className="muted">Carregant…</p>
      </main>
    );
  }

  const setup: GameSetup = savedGame.saved?.setup ?? {
    playerName: profile.profile.name,
    opponents: suggestOpponents(profile.profile, 2),
    auto: true,
  };

  const classes = [screen === 'game' ? 'app app-joc' : 'app'];
  if (tileStyle === 'invers') classes.push('fitxes-inverses');

  function clearTransferUrl() {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', stripProfileTransferParams(window.location.href));
    }
    setPendingProgress(null);
  }

  async function importProgress() {
    if (!pendingProgress) return;
    await profile.setProgress(pendingProgress);
    clearTransferUrl();
  }

  return (
    <main className={classes.join(' ')}>
      {/*
       * La partida no es desmunta mai en anar a l'historial: es continua veient
       * exactament on era en tornar (i els bots poden acabar la seva jugada
       * mentrestant). Per això l'historial es pinta a sobre, no al lloc.
       */}
      <div style={{ display: screen === 'game' ? 'contents' : 'none' }}>
        <GameScreen
          setup={setup}
          resume={savedGame.saved?.game}
          resumeOwners={savedGame.saved?.owners}
          resumeMisses={savedGame.saved?.misses}
          resumeRackOrder={savedGame.saved?.rackOrder}
          resumeRackSortBy={savedGame.saved?.rackSortBy}
          profile={profile}
          savedGame={savedGame}
          onHistory={() => setScreen('stats')}
          tileStyle={tileStyle}
          onTileStyle={setTileStyle}
        />
      </div>
      {screen === 'stats' && (
        <StatsScreen handle={profile} onBack={() => setScreen('game')} />
      )}

      {pendingProgress && (
        <>
          <div className="menu-fons importa-nivell-fons" aria-hidden="true" />
          <section
            className="importa-nivell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="importa-nivell-titol"
          >
            <h2 id="importa-nivell-titol">Importa aquest nivell de Remigi?</h2>
            <p>
              {pendingProgress.adaptiveCalibrating ? (
                <strong>Calibració del nivell en curs</strong>
              ) : (
                <>
                  Habilitat <strong>{pendingProgress.rating}</strong>
                </>
              )}{' '}
              · <strong>{pendingProgress.gamesPlayed}</strong>{' '}
              {pendingProgress.gamesPlayed === 1 ? 'partida' : 'partides'} ·{' '}
              <strong>{pendingProgress.wins}</strong>{' '}
              {pendingProgress.wins === 1 ? 'victòria' : 'victòries'}
            </p>
            <p className="muted small">
              Substitueix aquests totals en aquest aparell. L’historial detallat no viatja
              dins de l’enllaç.
            </p>
            <div className="row importa-nivell-accions">
              <button type="button" onClick={() => void importProgress()}>
                Importa nivell
              </button>
              <button type="button" className="secondary" onClick={clearTransferUrl}>
                Cancel·la
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
