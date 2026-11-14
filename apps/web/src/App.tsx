import { finalScores, randomSeed, type GameState } from '@remigi/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameMode, GameSetup } from './game/useGame';
import { readElTaulerHome } from './lliga/elTaulerHome';
import {
  YOU,
  closeSeason,
  createSeason,
  placementRating,
  difficultyForRating,
  upcomingTier,
  isFinished,
  parseLeagueState,
  rankOf,
  recordRound,
  tablePoints,
  movementText,
  yourTable,
  type LeagueConfig,
  type LeagueSeason,
  type LeagueState,
} from './lliga/league';
import type { LeagueHome } from './lliga/localitats';
import { loadRadio } from './musica/musica';
import {
  abandonChallenge,
  addGame,
  challengeTotal,
  isDone,
  parseChallengeState,
  startChallenge,
  withRivals,
  type Challenge,
  type ChallengeConfig,
  type ChallengeState,
} from './repte/challenge';
import { pickPersonas } from './game/bots';
import { GameScreen, type ModeFinish } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LeagueInterlude } from './screens/LeagueInterlude';
import { RepteInterlude, type LastGame } from './screens/RepteInterlude';
import { RepteCarousel } from './screens/RepteCarousel';
import { LligaScreen } from './screens/LligaScreen';
import { MusicScreen } from './screens/MusicScreen';
import { RepteScreen } from './screens/RepteScreen';
import { StatsScreen } from './screens/StatsScreen';
import {
  DEFAULT_FREE_PLAY,
  FREE_PLAY_KEY,
  parseFreePlay,
  prefsFromSetup,
  setupFromPrefs,
  type FreePlayPrefs,
} from './state/freePlay';
import { humanWon } from './state/gameOutcome';
import {
  parseProfileTransferUrl,
  stripProfileTransferParams,
  type ProfileProgress,
} from './state/profileTransfer';
import type { SavedGame } from './state/savedGame';
import { usePersisted } from './state/usePersisted';
import { useProfile } from './state/useProfile';
import { useSavedGames } from './state/useSavedGame';
import { useTileStyle } from './state/useTileStyle';
import { leaguePoints, ordinal, signed } from './ui/format';

/** Pantalles: l'inici amb les tres maneres de jugar, la partida i les del repte i la lliga. */
export type View = 'home' | 'game' | 'repte' | 'lliga' | 'musica';

export const CHALLENGE_KEY = 'remigi:repte';
export const LEAGUE_KEY = 'remigi:lliga';

/** La partida que es juga ara: es torna a muntar (clau nova) a cada partida que comença. */
interface Play {
  key: number;
  mode: GameMode;
  setup: GameSetup;
  saved: SavedGame | null;
  /** Què diu a dalt a la dreta durant el repte i la lliga. */
  label?: string;
}

/*
 * Es desa dins d'un embolcall (`{ prefs }`) perquè `null` vol dir «encara no
 * se n'ha triat cap» i no es pot confondre amb «carregant».
 */
const parseFreePlayBox = (raw: string | null): { prefs: FreePlayPrefs | null } => {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== 'object' || value === null || !('prefs' in value)) return { prefs: null };
    const prefs = (value as { prefs: unknown }).prefs;
    return { prefs: prefs ? parseFreePlay(JSON.stringify(prefs)) : null };
  } catch {
    return { prefs: null };
  }
};

const challengeSession = (challenge: Challenge) => `${challenge.startedAt}#${challenge.games.length}`;
const leagueSession = (season: LeagueSeason) => `${season.seed}#${season.played}`;

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Com t'ha anat una partida acabada: punts, si l'has guanyada i en quina posició has quedat. */
function lastGameOf(game: GameState): LastGame {
  const scores = finalScores(game);
  const mine = scores.find((score) => score.playerId === game.players[0]?.id)?.points ?? 0;
  const place = [...scores].sort((a, b) => b.points - a.points).findIndex((score) => score.points === mine) + 1;
  // Per cadires: tu primer i després els rivals, en l'ordre de la partida.
  const byId = new Map(scores.map((score) => [score.playerId, score.points]));
  const winner = Math.max(0, game.players.findIndex((player) => player.id === game.winnerId));
  return {
    points: mine,
    won: humanWon(game),
    place: Math.max(1, place),
    players: scores.length,
    scores: game.players.map((player) => byId.get(player.id) ?? 0),
    tilesLeft: game.players.map((player) => player.rack.length),
    winner,
    blocked: (game.players[winner]?.rack.length ?? 0) > 0,
    turns: game.turn,
  };
}

/**
 * En obrir l'app surten les tres maneres de jugar: a l'esquerra el joc lliure
 * (la partida de sempre), al mig el repte i a la dreta la lliga. Cada mode té
 * la seva partida a mitges, i es reprèn en tornar-hi.
 */
export function App() {
  const [view, setView] = useState<View>('home');
  const [statsOpen, setStatsOpen] = useState(false);
  const [play, setPlay] = useState<Play | null>(null);
  const [finish, setFinish] = useState<ModeFinish | null>(null);
  const playKey = useRef(0);
  const profile = useProfile();
  const savedGames = useSavedGames();
  const [tileStyle, setTileStyle] = useTileStyle();
  const freePlay = usePersisted(FREE_PLAY_KEY, parseFreePlayBox);
  const challenge = usePersisted(CHALLENGE_KEY, parseChallengeState);
  const league = usePersisted(LEAGUE_KEY, parseLeagueState);
  const elTaulerHome = useMemo(() => (typeof window === 'undefined' ? null : readElTaulerHome(safeLocalStorage())), []);
  const [pendingProgress, setPendingProgress] = useState<ProfileProgress | null>(() =>
    typeof window === 'undefined' ? null : parseProfileTransferUrl(window.location.href),
  );

  /*
   * El perfil es crea sol la primera vegada, amb un nom de casa. El nom es
   * canvia quan es vulgui des del menú del jugador.
   */
  const { loading: profileLoading, profile: loadedProfile, setName } = profile;
  useEffect(() => {
    if (!profileLoading && !loadedProfile) void setName('Jugador');
  }, [profileLoading, loadedProfile, setName]);

  /*
   * Les preferències del joc lliure. Si no se n'han desat mai però hi ha una
   * partida lliure a mitges (d'abans que existissin), es dedueixen d'aquella.
   */
  const freePrefs: FreePlayPrefs =
    freePlay.value?.prefs ??
    (savedGames.saved.lliure ? prefsFromSetup(savedGames.saved.lliure.setup) : DEFAULT_FREE_PLAY);

  const launch = useCallback((mode: GameMode, setup: GameSetup, saved: SavedGame | null, label?: string) => {
    playKey.current += 1;
    setPlay({ key: playKey.current, mode, setup, saved, label });
    setFinish(null);
    setStatsOpen(false);
    setView('game');
  }, []);

  const goTo = useCallback(
    (next: Exclude<View, 'game'>) => {
      setPlay(null);
      setFinish(null);
      setStatsOpen(false);
      savedGames.refresh();
      setView(next);
    },
    [savedGames],
  );

  /* ---------- Joc lliure ---------- */

  const saveFreeSetup = useCallback(
    (setup: GameSetup) => {
      freePlay.update({ prefs: prefsFromSetup(setup) });
    },
    [freePlay],
  );

  const startFree = useCallback(async () => {
    const current = profile.profile;
    if (!current) return;
    const saved = await savedGames.load('lliure');
    /*
     * Sempre amb els rivals i el nivell que el jugador havia triat: la partida
     * a mitges, si n'hi ha, i si no una de nova amb les seves preferències (en
     * automàtic, al nivell on el va deixar l'última partida lliure).
     */
    const setup = saved ? { ...saved.setup, mode: 'lliure' as const } : setupFromPrefs(freePrefs, current);
    saveFreeSetup(setup);
    launch('lliure', setup, saved);
  }, [profile.profile, savedGames, freePrefs, saveFreeSetup, launch]);

  /* ---------- Repte ---------- */

  const playChallenge = useCallback(async () => {
    const current = challenge.get()?.current;
    const player = profile.profile;
    if (!current || isDone(current) || !player) return;
    const session = challengeSession(current);
    // El compositor de la música d'entre partides es baixa mentre es juga.
    void loadRadio().catch(() => {});
    const label = `Repte · partida ${current.games.length + 1} de ${current.config.games} · ${signed(challengeTotal(current))} punts`;
    const saved = await savedGames.load('repte');
    if (saved && saved.setup.session === session) {
      launch('repte', saved.setup, saved, label);
      return;
    }
    const { level, opponents } = current.config;
    // Els rivals del repte són sempre els mateixos (els d'abans no en tenien: se'ls tria ara).
    let rivals = current.rivals;
    if (rivals.length !== opponents) {
      const names = pickPersonas(opponents).map((persona) => persona.name);
      rivals = challenge.update((state) => withRivals(state, names))?.current?.rivals ?? names;
    }
    launch(
      'repte',
      {
        mode: 'repte',
        playerName: player.name,
        opponents: Array.from({ length: opponents }, () => level),
        opponentNames: rivals,
        auto: false,
        session,
      },
      null,
      label,
    );
  }, [challenge, profile.profile, savedGames, launch]);

  const beginChallenge = useCallback(
    (config: ChallengeConfig) => {
      // Els rivals del repte es trien ara i són els mateixos a totes les partides.
      const rivals = pickPersonas(config.opponents).map((persona) => persona.name);
      challenge.update((state) => startChallenge(state, config, new Date(), rivals));
      savedGames.clear('repte');
      void playChallenge();
    },
    [challenge, savedGames, playChallenge],
  );

  const quitChallenge = useCallback(() => {
    challenge.update(abandonChallenge);
    savedGames.clear('repte');
  }, [challenge, savedGames]);

  const challengeFinish = useCallback(
    (state: ChallengeState, lastGame?: LastGame): ModeFinish | null => {
      const current = state.current;
      if (!current || current.games.length === 0) return null;
      const done = isDone(current);
      return {
        body: (
          <div className="final-repte">
            <p className="final-mode-titol">
              Repte · partida {current.games.length} de {current.config.games}
            </p>
            <RepteCarousel challenge={current} playerName={profile.profile?.name ?? 'Tu'} history={state.history} />
          </div>
        ),
        primary: done
          ? { label: 'Resultat del repte', run: () => goTo('repte') }
          : {
              label: `Següent partida (${current.games.length + 1} de ${current.config.games})`,
              run: () => void playChallenge(),
            },
        /*
         * Com a la lliga: entre partida i partida, 30 segons de relax amb
         * música i la següent comença sola. L'última partida acaba amb el
         * resum de sempre i el resultat del repte.
         */
        interlude:
          done || !lastGame ? undefined : (
            <RepteInterlude
              state={state}
              playerName={profile.profile?.name ?? 'Tu'}
              onPlayNow={() => void playChallenge()}
              onChallenge={() => goTo('repte')}
              onHome={() => goTo('home')}
            />
          ),
      };
    },
    [goTo, playChallenge, profile.profile],
  );

  /* ---------- Lliga ---------- */

  const playRound = useCallback(async () => {
    const season = league.get()?.season;
    const player = profile.profile;
    if (!season || isFinished(season) || !player) return;
    // El compositor de la música d'entre jornades es baixa mentre es juga.
    void loadRadio().catch(() => {});
    const session = leagueSession(season);
    const label = `${season.name} · jornada ${season.played + 1}/${season.config.rounds}`;
    const saved = await savedGames.load('lliga');
    if (saved && saved.setup.session === session) {
      launch('lliga', saved.setup, saved, label);
      return;
    }
    const rivals = yourTable(season);
    launch(
      'lliga',
      {
        mode: 'lliga',
        playerName: player.name,
        opponents: rivals.map((rival) => difficultyForRating(rival.rating)),
        opponentRatings: rivals.map((rival) => rival.rating),
        opponentNames: rivals.map((rival) => rival.name),
        auto: false,
        session,
      },
      null,
      label,
    );
  }, [league, profile.profile, savedGames, launch]);

  const startSeason = useCallback(
    (config: LeagueConfig) => {
      // La primera temporada es col·loca pel nivell (de la Catalana C a la A).
      const rating = placementRating(profile.profile);
      league.update((state) => {
        const tier = upcomingTier(state.career, rating);
        return {
          career: { ...state.career, config, tier, bestTier: Math.max(state.career.bestTier, tier) },
          season: createSeason({
            tier,
            config,
            home: state.career.home,
            seed: randomSeed(),
            exclude: state.career.recentNames,
          }),
        };
      });
      savedGames.clear('lliga');
    },
    [league, savedGames, profile.profile],
  );

  const abandonSeason = useCallback(() => {
    league.update((state) => ({ ...state, season: null }));
    savedGames.clear('lliga');
  }, [league, savedGames]);

  const setHome = useCallback(
    (home: LeagueHome | null) => {
      league.update((state) => {
        const career = { ...state.career, home: home ?? state.career.home, homeAsked: true };
        let season = state.season;
        /*
         * Una temporada que encara no ha començat es torna a sortejar amb el
         * lloc nou: noms de la lliga i dels rivals del lloc on jugues.
         */
        if (home && season && season.played === 0) {
          season = createSeason({
            tier: season.tier,
            config: season.config,
            home,
            seed: randomSeed(),
            exclude: state.career.recentNames,
          });
          savedGames.clear('lliga');
        }
        return { career, season };
      });
    },
    [league, savedGames],
  );

  const leagueFinish = useCallback(
    (state: LeagueState): ModeFinish | null => {
      const season = state.season;
      if (!season || season.played === 0) return null;
      const result = season.results.find((r) => r.round === season.played - 1 && r.ids.includes(YOU));
      if (!result) return null;
      const me = result.ids.indexOf(YOU);
      const place = [...result.scores].sort((a, b) => b - a).indexOf(result.scores[me]) + 1;
      const done = isFinished(season);
      const record = done ? state.career.seasons[0] : undefined;
      return {
        body: (
          <div className="final-lliga">
            <p className="final-mode-titol">
              {season.name} · jornada {season.played} de {season.config.rounds}
            </p>
            <p>
              Has quedat <strong>{ordinal(place)}</strong> de {result.ids.length} a la taula:{' '}
              {tablePoints(result.scores)[me] > 0 ? (
                <>
                  <strong>+{leaguePoints(tablePoints(result.scores)[me])} punts</strong> de lliga.
                </>
              ) : (
                <>cap punt de lliga.</>
              )}
            </p>
            <p>
              Classificació: <strong>{ordinal(rankOf(season))}</strong> de {season.config.players}
              {done ? ' · temporada acabada' : ''}.
            </p>
            {record && (
              <p className="final-lliga-moviment">
                {movementText(record.tier, record.nextTier, record.movement, state.career.home)}
              </p>
            )}
          </div>
        ),
        primary: {
          label: done ? 'Veure el final de la temporada' : 'Veure la classificació',
          run: () => goTo('lliga'),
        },
        /*
         * Entre jornada i jornada, 30 segons de relax amb música i la següent
         * comença sola. L'última jornada acaba amb el resum de sempre i el
         * final de la temporada.
         */
        interlude: done ? undefined : (
          <LeagueInterlude
            season={season}
            playerName={profile.profile?.name ?? 'Tu'}
            onPlayNow={() => void playRound()}
            onStandings={() => goTo('lliga')}
            onHome={() => goTo('home')}
          />
        ),
      };
    },
    [goTo, playRound, profile.profile],
  );

  /* ---------- Final de partida ---------- */

  /*
   * Cada partida acabada del repte o la lliga s'apunta un sol cop: la sessió
   * de la partida ha de ser la partida o la jornada que toca ara mateix.
   */
  const onFinished = useCallback(
    (game: GameState, setup: GameSetup) => {
      if (setup.mode === 'repte') {
        const current = challenge.get()?.current;
        if (!current || isDone(current) || setup.session !== challengeSession(current)) return;
        const last = lastGameOf(game);
        // La puntuació de tothom només si la partida és dels rivals del repte.
        const sameRivals =
          current.rivals.length > 0 &&
          game.players.length === current.rivals.length + 1 &&
          current.rivals.every((name, i) => game.players[i + 1]?.name === name);
        const extra = sameRivals
          ? { scores: last.scores, tilesLeft: last.tilesLeft, winner: last.winner, blocked: last.blocked, turns: last.turns }
          : {};
        const next = challenge.update((state) => addGame(state, { points: last.points, won: last.won, ...extra }));
        if (next) setFinish(challengeFinish(next, last));
      } else if (setup.mode === 'lliga') {
        const state = league.get();
        const season = state?.season;
        if (!state || !season || isFinished(season) || setup.session !== leagueSession(season)) return;
        const byId = new Map(finalScores(game).map((score) => [score.playerId, score.points]));
        const scores = game.players.map((player) => byId.get(player.id) ?? 0);
        const played = recordRound(season, scores);
        const career = isFinished(played) ? closeSeason(state.career, played) : state.career;
        const next = league.update({ career, season: played });
        if (next) setFinish(leagueFinish(next));
      }
    },
    [challenge, league, challengeFinish, leagueFinish],
  );

  if (
    profile.loading ||
    savedGames.loading ||
    !profile.profile ||
    !freePlay.value ||
    !challenge.value ||
    !league.value
  ) {
    return (
      <main className="app">
        <p className="muted">Carregant…</p>
      </main>
    );
  }

  const inGame = view === 'game' && play !== null;
  const classes = [inGame && !statsOpen ? 'app app-joc' : 'app'];
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
       * La partida no es desmunta en anar a l'historial: es continua veient
       * exactament on era en tornar. Per això l'historial es pinta a sobre.
       */}
      {inGame && play && (
        <div style={{ display: statsOpen ? 'none' : 'contents' }}>
          <GameScreen
            key={play.key}
            setup={play.setup}
            resume={play.saved?.game}
            resumeOwners={play.saved?.owners}
            resumeMisses={play.saved?.misses}
            resumeRackOrder={play.saved?.rackOrder}
            resumeRackSortBy={play.saved?.rackSortBy}
            resumeDraft={play.saved?.draft}
            resumeDrawnTileId={play.saved?.drawnTileId}
            profile={profile}
            savedGame={savedGames.forMode(play.mode)}
            onHistory={() => setStatsOpen(true)}
            tileStyle={tileStyle}
            onTileStyle={setTileStyle}
            mode={play.mode}
            onHome={() => goTo('home')}
            onFinished={onFinished}
            finish={finish}
            modeLabel={play.label}
            onFreeSetup={saveFreeSetup}
          />
        </div>
      )}

      {!statsOpen && view === 'home' && (
        <HomeScreen
          profile={profile.profile}
          freePrefs={freePrefs}
          savedFree={savedGames.saved.lliure}
          savedRepte={savedGames.saved.repte !== null}
          savedLliga={savedGames.saved.lliga !== null}
          challenge={challenge.value}
          league={league.value}
          onFree={() => void startFree()}
          onChallenge={() => setView('repte')}
          onLeague={() => setView('lliga')}
          onHistory={() => setStatsOpen(true)}
          onMusic={() => setView('musica')}
        />
      )}

      {!statsOpen && view === 'musica' && <MusicScreen onHome={() => goTo('home')} />}

      {!statsOpen && view === 'repte' && (
        <RepteScreen
          state={challenge.value}
          hasSavedGame={
            savedGames.saved.repte !== null &&
            challenge.value.current !== null &&
            savedGames.saved.repte.setup.session === challengeSession(challenge.value.current)
          }
          onStart={beginChallenge}
          onPlay={() => void playChallenge()}
          onAbandon={quitChallenge}
          onHome={() => goTo('home')}
          onProfile={() => setStatsOpen(true)}
          playerName={profile.profile.name}
        />
      )}

      {!statsOpen && view === 'lliga' && (
        <LligaScreen
          state={league.value}
          playerName={profile.profile.name}
          hasSavedGame={
            savedGames.saved.lliga !== null &&
            league.value.season !== null &&
            savedGames.saved.lliga.setup.session === leagueSession(league.value.season)
          }
          elTaulerHome={elTaulerHome}
          playerRating={placementRating(profile.profile)}
          calibrating={profile.profile.adaptiveCalibrating === true}
          onStartSeason={startSeason}
          onPlayRound={() => void playRound()}
          onAbandonSeason={abandonSeason}
          onSetHome={setHome}
          onHome={() => goTo('home')}
          onProfile={() => setStatsOpen(true)}
        />
      )}

      {statsOpen && (
        <StatsScreen
          handle={profile}
          onBack={() => setStatsOpen(false)}
          backLabel={inGame ? 'Torna a la partida' : 'Torna'}
          tileStyle={tileStyle}
          onTileStyle={setTileStyle}
        />
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
