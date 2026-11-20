import { useState } from 'react';
import type { CloudHandle } from '../cloud/useCloud';
import { PlayerAvatar } from '../components/PlayerAvatar';
import {
  DAILY_OPPONENTS,
  bestResult,
  bestStreak,
  currentStreak,
  dailyWins,
  dayNumber,
  recentSquares,
  resultFor,
  resultText,
  shareText,
  streakText,
  type DailyResult,
  type DailyState,
} from '../dia/daily';
import { whatsappUrl } from '../lliga/champion';
import { DiaRanking } from './DiaRanking';

interface Props {
  state: DailyState;
  today: string;
  /** Hi ha la partida d'avui a mitges (per dir «continua»). */
  hasSavedGame: boolean;
  /** Els rivals d'avui, els mateixos per a tothom. */
  rivals: string[];
  playerName: string;
  /** La sessió amb Google, per als rànquings. */
  cloud: CloudHandle;
  /** Canvia quan s'ha pujat un resultat: els rànquings es tornen a carregar. */
  rankingVersion: number;
  onPlay(): void;
  onHome(): void;
  onProfile(): void;
}

export function gameUrl(): string {
  try {
    return `${window.location.origin}${window.location.pathname}`;
  } catch {
    return 'https://segueix.github.io/remigi/';
  }
}

/** Data llegible: «20/11/2026». */
const shortDate = (day: string) => day.split('-').reverse().join('/');

/**
 * La partida del dia: una sola partida al dia, igual per a tothom. Aquí es veu
 * si ja l'has jugada (i com t'ha anat), la ratxa de dies número 1 i els últims
 * resultats; i es comparteix el resultat.
 */
export function DiaScreen({
  state,
  today,
  hasSavedGame,
  rivals,
  playerName,
  cloud,
  rankingVersion,
  onPlay,
  onHome,
  onProfile,
}: Props) {
  const todayResult = resultFor(state, today);
  const streak = currentStreak(state, today);
  const best = bestResult(state);

  return (
    <section className="card pantalla-mode dia">
      <div className="franja-fitxes" aria-hidden="true" />
      <div className="row mode-cap">
        <h2>Partida del dia #{dayNumber(today)}</h2>
        <div className="row mode-cap-accions">
          <button type="button" className="secondary mode-perfil" onClick={onProfile} aria-label="El teu perfil i la configuració">
            <PlayerAvatar name={playerName} />
            <span>Perfil</span>
          </button>
          <button type="button" className="secondary" onClick={onHome}>
            ← Inici
          </button>
        </div>
      </div>

      <p className="muted">
        Avui tothom juga amb <strong>les mateixes fitxes</strong>: la mateixa mà i el sac en el
        mateix ordre, contra els mateixos {DAILY_OPPONENTS} rivals de nivell Mitjà. Comences tu.
        Si guanyes, compten les <strong>jugades</strong> que has fet (menys, millor); si no, els{' '}
        <strong>punts que et queden a la mà</strong>. Només compta un cop al dia, i la partida
        canvia a mitjanit, hora de Barcelona.
      </p>

      <dl className="rajoles">
        <div className="rajola rajola-a">
          <dt>Ratxa</dt>
          <dd>
            {streak}
            <small> {streak === 1 ? 'dia' : 'dies'}</small>
          </dd>
        </div>
        <div className="rajola rajola-b">
          <dt>Millor ratxa</dt>
          <dd>{bestStreak(state)}</dd>
        </div>
        <div className="rajola rajola-c">
          <dt>Número 1</dt>
          <dd>
            {dailyWins(state)}
            <small>/{state.results.length}</small>
          </dd>
        </div>
      </dl>
      <p className="dia-quadrets" aria-label="Els últims set dies">
        {recentSquares(state, today)}
      </p>

      {todayResult ? (
        <div className="dia-avui">
          <p className={todayResult.won ? 'dia-resultat guanyada' : 'dia-resultat'}>
            <span aria-hidden="true">{todayResult.won ? '🏆' : '🧩'}</span> {resultText(todayResult)}
          </p>
          <p className="muted small">
            {streakText(streak)}. Demà hi ha una partida nova.
            {best && best.day !== today && <> El teu millor dia: {resultText(best)} ({shortDate(best.day)}).</>}
          </p>
          <ShareButtons state={state} result={todayResult} />
        </div>
      ) : (
        <div className="dia-avui">
          {rivals.length > 0 && (
            <p className="muted small">
              Rivals d’avui: <strong>{rivals.join(' i ')}</strong>.
            </p>
          )}
          {streak > 0 && (
            <p className="small">
              Portes <strong>{streak}</strong> {streak === 1 ? 'dia' : 'dies'} seguits de número 1: guanya avui
              per allargar la ratxa!
            </p>
          )}
          <div className="row">
            <button type="button" onClick={onPlay}>
              {hasSavedGame ? 'Continua la partida del dia' : 'Juga la partida del dia'}
            </button>
          </div>
        </div>
      )}

      <DiaRanking cloud={cloud} today={today} alias={playerName} version={rankingVersion} />

      {state.results.length > 0 && (
        <details className="repte-historial">
          <summary>Dies jugats ({state.results.length})</summary>
          <ul>
            {state.results.slice(0, 30).map((r) => (
              <li key={r.day}>
                <span>
                  #{dayNumber(r.day)} · {shortDate(r.day)} {r.won && <span aria-label="número 1">👑</span>}
                </span>
                <span className={r.won ? 'punts points-positive' : 'punts points-negative'}>{resultText(r)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Compartir el resultat: el menú del mòbil si n'hi ha, i si no WhatsApp; i copiar-lo. */
export function ShareButtons({ state, result }: { state: DailyState; result: DailyResult }) {
  const [note, setNote] = useState<string | null>(null);
  const text = shareText(state, result, gameUrl());

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Resultat copiat. Enganxa’l on vulguis!');
    } catch {
      setNote('No s’ha pogut copiar el resultat.');
    }
  };

  return (
    <div className="dia-compartir">
      <div className="row">
        <button type="button" onClick={() => void share()}>
          Comparteix el resultat
        </button>
        <button type="button" className="secondary" onClick={() => void copy()}>
          Copia
        </button>
      </div>
      {note && (
        <p className="muted small" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
