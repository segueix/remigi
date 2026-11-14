import { DIFFICULTIES } from '@remigi/core';
import { bestFor, challengeTotal, challengeWins, type ChallengeState } from '../repte/challenge';
import { ordinal, signed } from '../ui/format';
import { RepteStandings } from './RepteStandings';
import {
  InterludeBox,
  InterludeCountdown,
  InterludeMusic,
  useInterludeCountdown,
  useInterludeMusic,
} from './interlude';

/** Com ha anat la partida que s'acaba de jugar. */
export interface LastGame {
  points: number;
  won: boolean;
  /** Posició a la taula (1 = guanyador) i quants jugadors hi havia. */
  place: number;
  players: number;
  /** Punts i fitxes que li quedaven a cadascú, per cadires (tu primer). */
  scores: number[];
  tilesLeft: number[];
  /** Cadira del guanyador, si la partida s'ha bloquejat i quants torns ha durat. */
  winner: number;
  blocked: boolean;
  turns: number;
}

interface Props {
  /** El repte, amb la partida que s'acaba de jugar ja apuntada. */
  state: ChallengeState;
  /** El teu nom, per a la classificació. */
  playerName: string;
  last: LastGame;
  /** Comença la partida següent (a zero, o amb «Juga ara»). */
  onPlayNow(): void;
  /** Atura el compte i va a la pantalla del repte. */
  onChallenge(): void;
  onHome(): void;
}

/**
 * Entre partida i partida del repte, com entre jornades de la lliga: el
 * resultat en curt, la partida que toca (gran), 30 segons de relax amb música
 * composta en aquell moment i el marcador del repte (total, victòries i el
 * rècord a batre). A zero comença sola la partida següent; «Juga ara» no
 * espera; «Repte» i «Inici» l'aturen. L'última partida acaba amb el resum.
 */
export function RepteInterlude({ state, playerName, last, onPlayNow, onChallenge, onHome }: Props) {
  const countdown = useInterludeCountdown(onPlayNow);
  const music = useInterludeMusic(countdown.elapsed);
  const current = state.current;
  if (!current) return null;

  const played = current.games.length;
  const total = challengeTotal(current);
  const wins = challengeWins(current);
  const record = bestFor(state.history, current.config);
  const tone = last.won ? 'guanya' : last.place === last.players ? 'perd' : 'mig';

  return (
    <section className="card interludi repte" aria-labelledby="interludi-titol">
      <div className="franja-fitxes" aria-hidden="true" />
      <p className={`interludi-resultat ${tone}`}>
        {last.won ? 'Victòria' : `${ordinal(last.place)} de ${last.players}`} · {signed(last.points)}
      </p>

      <InterludeBox label="Partida" value={played + 1} total={current.config.games} />

      <InterludeCountdown seconds={countdown.seconds} />

      <dl className="interludi-marcador">
        <div>
          <dt>Total del repte</dt>
          <dd className={total >= 0 ? 'points-positive' : 'points-negative'}>{signed(total)}</dd>
        </div>
        <div>
          <dt>Victòries</dt>
          <dd>
            {wins}
            <small>/{played}</small>
          </dd>
        </div>
        <div>
          <dt>Rècord</dt>
          <dd>{record ? signed(record.total) : '—'}</dd>
        </div>
      </dl>
      {/* Qui ha guanyat la partida, els punts de tothom i el total del repte. */}
      <RepteStandings challenge={current} playerName={playerName} />

      <p className="muted small interludi-seguent">
        Següent:{' '}
        {current.rivals.length > 0 ? (
          <>
            contra <strong>{listCa(current.rivals)}</strong>, nivell{' '}
          </>
        ) : (
          <>
            {current.config.opponents} {current.config.opponents === 1 ? 'rival' : 'rivals'} de nivell{' '}
          </>
        )}
        <strong>{DIFFICULTIES[current.config.level].label}</strong>
      </p>

      <InterludeMusic {...music} />

      <div className="row interludi-accions">
        <button type="button" onClick={onPlayNow}>
          Juga ara
        </button>
        <button type="button" className="secondary" onClick={onChallenge}>
          Repte
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          Inici
        </button>
      </div>
    </section>
  );
}

/** «A», «A i B», «A, B i C». */
function listCa(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}`;
}
