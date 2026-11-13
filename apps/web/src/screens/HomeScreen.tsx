import { DIFFICULTIES, adaptiveLevelLabel, type PlayerProfile } from '@remigi/core';
import { ComEsJuga } from '../components/ComEsJuga';
import { ChallengeIcon, FreePlayIcon, LeagueIcon } from '../components/icons';
import { isFinished, rankOf, tierName, tierRating, difficultyForRating, type LeagueState } from '../lliga/league';
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
  onFree(): void;
  onChallenge(): void;
  onLeague(): void;
  onHistory(): void;
}

/**
 * La pantalla d'inici: tres maneres de jugar, l'una al costat de l'altra.
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
  onFree,
  onChallenge,
  onLeague,
  onHistory,
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
  const leagueStatus = season && !isFinished(season)
    ? `${season.name} · jornada ${season.played + 1}/${season.config.rounds}${season.played > 0 ? ` · ${ordinal(rankOf(season))}` : ''}`
    : `${tierName(league.career.tier, league.career.home)} · rivals ${DIFFICULTIES[difficultyForRating(tierRating(league.career.tier))].label}`;

  return (
    <section className="inici">
      <div className="franja-fitxes" aria-hidden="true" />
      <header className="inici-cap">
        <div>
          <h1>Remigi</h1>
          <p className="muted">Tria com vols jugar</p>
        </div>
        <button type="button" className="secondary inici-jugador" onClick={onHistory} aria-label="El teu historial">
          <span className="player-color" aria-hidden="true">
            {profile.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <span className="inici-jugador-text">
            <strong>{profile.name}</strong>
            <span className="muted small">
              {calibrating ? 'calibrant el nivell' : `habilitat ${profile.rating}`}
            </span>
          </span>
        </button>
      </header>

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
          <span className="mode-sub">Del poble al món, com a El Tauler</span>
          <span className="mode-estat">{leagueStatus}</span>
          <span className="mode-cta" aria-hidden="true">
            {season && !isFinished(season) ? (savedLliga ? 'Continua' : 'Segueix') : 'Obre'}
          </span>
        </button>
      </div>

      <ComEsJuga obertPerDefecte={profile.gamesPlayed === 0 && !season && !current} />
    </section>
  );
}
