import { DIFFICULTIES, adaptiveLevelLabel, type PlayerProfile, type Tile } from '@remigi/core';
import { TARGET_NAME, TARGET_URL } from '../appSwitch/appSwitch';
import { ComEsJuga } from '../components/ComEsJuga';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TileView } from '../components/TileView';
import { ChallengeIcon, DailyIcon, FreePlayIcon, LeagueIcon } from '../components/icons';
import { currentStreak, dayNumber, resultFor, resultText, type DailyState } from '../dia/daily';
import {
  difficultyForRating,
  isFinished,
  placementRating,
  rankOf,
  tierName,
  tierRating,
  upcomingTier,
  type LeagueState,
} from '../lliga/league';
import { challengeTotal, describeChallenge, isDone, type ChallengeState } from '../repte/challenge';
import type { FreePlayPrefs } from '../state/freePlay';
import type { SavedGame } from '../state/savedGame';
import { ordinal, signed } from '../ui/format';

interface Props {
  profile: PlayerProfile;
  freePrefs: FreePlayPrefs;
  /** Partides a mitges de cada mode, per dir «continua». */
  savedFree: SavedGame | null;
  savedRepte: boolean;
  savedLliga: boolean;
  challenge: ChallengeState;
  league: LeagueState;
  /** La partida del dia: el que portes fet i el dia d'avui. */
  daily: DailyState;
  today: string;
  /** La partida d'avui és a mitges. */
  savedDia: boolean;
  onDaily(): void;
  onFree(): void;
  onChallenge(): void;
  onLeague(): void;
  onHistory(): void;
  /** La música infinita (composta per l'app, la que sona entre partides del repte i jornades de la lliga). */
  onMusic(): void;
}

/** Les fitxes en ventall del faristol de l'inici: un grup de tres 13, com al Rummikub. */
const VENTALL: Tile[] = (['red', 'blue', 'orange'] as const).map((color) => ({
  id: `inici-ventall-${color}`,
  kind: 'number',
  color,
  value: 13,
}));

/**
 * La pantalla d'inici, com quan comença una partida lliure: el jugador a dalt
 * a l'esquerra (i a la dreta, El Tauler, l'app germana d'escacs), la taula de
 * feltre buida amb les tres maneres de jugar al damunt, l'una al costat de
 * l'altra, i a sota el faristol de fusta amb el nom del joc.
 * A l'esquerra el joc lliure (la partida de sempre), al mig el repte (unes
 * quantes partides a un nivell fix i se sumen els punts) i a la dreta la
 * lliga (del poble al món, com a les lligues d'escacs d'El Tauler).
 */
export function HomeScreen({
  profile,
  freePrefs,
  savedFree,
  savedRepte,
  savedLliga,
  challenge,
  league,
  daily,
  today,
  savedDia,
  onDaily,
  onFree,
  onChallenge,
  onLeague,
  onHistory,
  onMusic,
}: Props) {
  const calibrating = profile.adaptiveCalibrating === true;

  /* Joc lliure: com ho tens configurat, o la partida que tens a mitges. */
  const freeLevel =
    freePrefs.level === 'auto'
      ? `nivell automàtic (${adaptiveLevelLabel(profile)})`
      : `${DIFFICULTIES[freePrefs.level].label} (fixat)`;
  const freeStatus = savedFree
    ? `Partida a mitges · torn ${savedFree.game.turn}`
    : `${freePrefs.count} ${freePrefs.count === 1 ? 'rival' : 'rivals'} · ${freeLevel}`;

  /* Repte: el que hi ha en curs, o l'últim resultat. */
  const current = challenge.current;
  const challengeStatus = current && !isDone(current)
    ? `En curs: partida ${current.games.length + 1} de ${current.config.games} · ${signed(challengeTotal(current))} punts`
    : current
      ? `Últim: ${signed(challengeTotal(current))} punts (${describeChallenge(current.config)})`
      : 'Tria quantes partides i a quin nivell';

  /* Lliga: on ets i com vas. */
  const season = league.season;
  const nextTier = upcomingTier(league.career, placementRating(profile));
  const running = season !== null && !isFinished(season);
  /*
   * Amb la lliga començada, la targeta porta el nom de la lliga i la divisió
   * («Lliga Catalana · Divisió B») i, a sota, la jornada i la posició.
   */
  const leagueName = running && season ? season.name : null;
  const leagueStatus = running && season
    ? `Jornada ${season.played + 1}/${season.config.rounds}${season.played > 0 ? ` · ${ordinal(rankOf(season))}` : ''}`
    : `${tierName(nextTier, league.career.home)} · rivals ${DIFFICULTIES[difficultyForRating(tierRating(nextTier))].label}`;

  /* Partida del dia: si ja està feta, com ha anat; si no, la ratxa que t'hi jugues. */
  const todayResult = resultFor(daily, today);
  const streak = currentStreak(daily, today);
  const dailyStatus = todayResult
    ? `${todayResult.won ? '🏆' : '🧩'} ${resultText(todayResult)}`
    : savedDia
      ? 'A mitges: acaba-la avui'
      : 'Mateixes fitxes per a tothom';

  return (
    <section className="inici">
      <div className="franja-fitxes" aria-hidden="true" />
      {/* El jugador, a dalt a l'esquerra; El Tauler, l'app d'escacs germana, a la dreta. */}
      <header className="inici-cap">
        <button type="button" className="secondary inici-jugador" onClick={onHistory} aria-label="El teu historial">
          <PlayerAvatar name={profile.name} />
          <span className="inici-jugador-text">
            <strong>{profile.name}</strong>
            <span className="muted small">
              {calibrating ? 'calibrant el nivell' : `habilitat ${profile.rating}`}
            </span>
          </span>
        </button>
        <a className="inici-tauler" href={TARGET_URL} aria-label={`Obre ${TARGET_NAME}, els escacs`} title={`${TARGET_NAME} · escacs`}>
          <img src={`${import.meta.env.BASE_URL}eltauler-192.png`} alt="" width="44" height="44" />
        </a>
      </header>

      {/* La taula de joc, buida, amb les tres maneres de jugar al damunt. */}
      <div className="inici-taula">
        {/* La partida del dia, a dalt de la taula: una al dia, igual per a tothom. */}
        <button type="button" className="dia-boto mode-dia" onClick={onDaily} aria-label="Partida del dia">
          <span className="dia-boto-icona" aria-hidden="true">
            <DailyIcon />
          </span>
          <span className="dia-boto-text">
            <strong>Partida del dia #{dayNumber(today)}</strong>
            <span className="small">{dailyStatus}</span>
          </span>
          {streak > 0 && (
            <span className="dia-boto-ratxa" aria-label={`Ratxa de ${streak} dies número 1`}>
              🔥 {streak}
            </span>
          )}
          <span className="dia-boto-cta" aria-hidden="true">
            {todayResult ? 'Resultat' : savedDia ? 'Continua' : 'Juga'}
          </span>
        </button>
        <div className="inici-modes">
          <button type="button" className="mode-card mode-lliure" onClick={onFree} aria-label="Joc lliure">
            <span className="mode-icona" aria-hidden="true">
              <FreePlayIcon />
            </span>
            <strong className="mode-titol">Joc lliure</strong>
            <span className="mode-sub">Partida normal</span>
            <span className="mode-estat">{freeStatus}</span>
            <span className="mode-cta" aria-hidden="true">
              {savedFree ? 'Continua' : 'Juga'}
            </span>
          </button>

          <button type="button" className="mode-card mode-repte" onClick={onChallenge} aria-label="Repte">
            <span className="mode-icona" aria-hidden="true">
              <ChallengeIcon />
            </span>
            <strong className="mode-titol">Repte</strong>
            <span className="mode-sub">Unes quantes partides i sumes els punts</span>
            <span className="mode-estat">{challengeStatus}</span>
            <span className="mode-cta" aria-hidden="true">
              {current && !isDone(current) ? (savedRepte ? 'Continua' : 'Segueix') : 'Comença'}
            </span>
          </button>

          <button type="button" className="mode-card mode-lliga" onClick={onLeague} aria-label="Lliga">
            <span className="mode-icona" aria-hidden="true">
              <LeagueIcon />
            </span>
            <strong className="mode-titol">Lliga</strong>
            {leagueName ? (
              <span className="mode-sub mode-lliga-nom">{leagueName}</span>
            ) : (
              <span className="mode-sub">Del poble al món, com a El Tauler</span>
            )}
            <span className="mode-estat">{leagueStatus}</span>
            <span className="mode-cta" aria-hidden="true">
              {running ? (savedLliga ? 'Continua' : 'Segueix') : 'Obre'}
            </span>
          </button>
        </div>
        <span className="marca-taula" aria-hidden="true">
          Remigi
        </span>
      </div>

      {/*
       * El faristol de fusta, amb tres fitxes en ventall i el nom del joc en
       * blanc: que es vegi d'entrada que és un joc de fitxes com el Rummikub.
       */}
      <div className="rack inici-faristol">
        <span className="inici-ventall" aria-hidden="true">
          {VENTALL.map((tile) => (
            <TileView key={tile.id} tile={tile} />
          ))}
        </span>
        <div className="inici-nom">
          <h1>Remigi</h1>
          <p className="inici-inspirat">El precursor del Rummikub®</p>
          <p>Tria com vols jugar</p>
        </div>
      </div>

      <div className="row inici-extres">
        <button type="button" className="secondary" onClick={onMusic}>
          🎵 Música infinita
        </button>
        <button type="button" className="secondary" onClick={onHistory}>
          Historial
        </button>
      </div>

      <ComEsJuga obertPerDefecte={profile.gamesPlayed === 0 && !season && !current} />
    </section>
  );
}
