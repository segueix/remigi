import { useState } from 'react';
import { DayPlace } from '../components/DayPlace';
import { DailyIcon, ShareIcon } from '../components/icons';
import { gameUrl } from '../ui/gameUrl';
import {
  dayNumber,
  resultFor,
  resultText,
  shareText,
  type DailyResult,
  type DailyState,
} from '../dia/daily';
import { whatsappUrl } from '../lliga/champion';
import { DiaRanking } from './DiaRanking';

interface Props {
  state: DailyState;
  today: string;
  playerName: string;
  /** Canvia quan s'ha pujat un resultat: els rànquings es tornen a carregar. */
  rankingVersion: number;
  onPlay(): void;
  onHome(): void;
}

/**
 * La partida del dia, un cop jugada: a dalt, la teva posició al rànquing; el
 * teu resultat amb el botó de compartir-lo («Em superes?»); i el rànquing.
 * (Per jugar-la, el bàner de l'inici porta directament a la partida.)
 */
export function DiaScreen({ state, today, playerName, rankingVersion, onPlay, onHome }: Props) {
  const todayResult = resultFor(state, today);

  return (
    <section className="card pantalla-mode dia">
      <div className="franja-fitxes" aria-hidden="true" />
      <div className="row mode-cap">
        <h2>Partida del dia #{dayNumber(today)}</h2>
        <button type="button" className="secondary" onClick={onHome}>
          ← Inici
        </button>
      </div>

      {todayResult ? (
        <>
          <DailyResultCard state={state} result={todayResult} header={false} />
          <p className="muted small">Demà, a mitjanit (hora de Barcelona), hi ha una partida nova.</p>
        </>
      ) : (
        <>
          <div className="row">
            <button type="button" onClick={onPlay}>
              Juga la partida del dia
            </button>
          </div>
        </>
      )}

      <DiaRanking today={today} alias={playerName} mine={todayResult} version={rankingVersion} />
    </section>
  );
}

/** «12 de novembre», per al peu de la targeta. */
function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  const months = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  const month = months[m - 1] ?? '';
  return `${d} ${/^[aeiou]/.test(month) ? 'd’' : 'de '}${month}`;
}

/**
 * El resultat de la partida del dia, amb l'estil del bàner de l'inici: negre,
 * amb la franja dels quatre colors de les fitxes, la xifra que compta dins
 * d'una fitxa del Remigi (blava si has guanyat: jugades; vermella si no:
 * punts a la mà), la teva posició al rànquing i el botó per reptar la gent.
 */
export function DailyResultCard({
  state,
  result,
  header = true,
}: {
  state: DailyState;
  result: DailyResult;
  /** El títol de la targeta (a la pantalla del dia ja hi és a dalt). */
  header?: boolean;
}) {
  return (
    <div className={result.won ? 'dia-targeta guanyada' : 'dia-targeta'}>
      {header && (
      <div className="dia-targeta-cap">
        <span className="dia-targeta-icona" aria-hidden="true">
          <DailyIcon />
        </span>
        <span>
          <strong>Partida del dia #{dayNumber(result.day)}</strong>
          <span className="dia-targeta-data">{shortDay(result.day)}</span>
        </span>
      </div>
      )}

      <div className="dia-targeta-resultat">
        <span className={result.won ? 'dia-fitxa blava' : 'dia-fitxa vermella'} aria-hidden="true">
          {result.won ? result.moves : result.points}
        </span>
        <span className="dia-targeta-text">
          <strong className="dia-resultat">{result.won ? '🏆 Has guanyat!' : 'No ha pogut ser'}</strong>
          <span>{result.won ? `en ${result.moves === 1 ? '1 jugada' : `${result.moves} jugades`}` : `${resultText(result)}`}</span>
        </span>
      </div>

      <DayPlace result={result} />

      <ShareButton state={state} result={result} />
    </div>
  );
}

/**
 * Compartir el resultat i reptar: «Em superes?». El menú de compartir del
 * mòbil (WhatsApp, Telegram…) o, a l'ordinador, WhatsApp. L'enllaç obre
 * directament la partida del dia.
 */
export function ShareButton({ state, result }: { state: DailyState; result: DailyResult }) {
  const [note, setNote] = useState<string | null>(null);
  const text = shareText(state, result, gameUrl());

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, title: 'Partida del dia · Remigi' });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      window.open(whatsappUrl(text), '_blank', 'noopener,noreferrer');
    } catch {
      setNote('No s’ha pogut obrir WhatsApp.');
    }
  };

  return (
    <div className="dia-compartir">
      <button type="button" className="dia-compartir-boto" onClick={() => void share()}>
        <ShareIcon />
        <span>
          Comparteix <span className="dia-compartir-repte">· Em superes?</span>
        </span>
      </button>
      {note && (
        <p className="small" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
