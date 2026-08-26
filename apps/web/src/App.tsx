import { suggestOpponents } from '@remigi/core';
import { useEffect, useState } from 'react';
import type { GameSetup } from './game/useGame';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
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
    </main>
  );
}
