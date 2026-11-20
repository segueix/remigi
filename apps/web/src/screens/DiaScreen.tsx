import { useState } from 'react';
import { DayPlace } from '../components/DayPlace';
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

      <DayPlace day={today} />

      {todayResult ? (
        <div className="dia-avui">
          <p className={todayResult.won ? 'dia-resultat guanyada' : 'dia-resultat'}>
            <span aria-hidden="true">{todayResult.won ? '🏆' : '🧩'}</span> {resultText(todayResult)}
          </p>
          <ShareButton state={state} result={todayResult} />
          <p className="muted small">Demà, a mitjanit (hora de Barcelona), hi ha una partida nova.</p>
        </div>
      ) : (
        <div className="row">
          <button type="button" onClick={onPlay}>
            Juga la partida del dia
          </button>
        </div>
      )}

      <DiaRanking today={today} alias={playerName} version={rankingVersion} />
    </section>
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
        📣 Comparteix: em superes?
      </button>
      {note && (
        <p className="muted small" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
