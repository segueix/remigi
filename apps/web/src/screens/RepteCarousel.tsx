import { Carousel, type Slide } from '../components/Carousel';
import { Avatar, ResultBars } from '../components/ResultBars';
import {
  bestFor,
  challengeInsights,
  challengeStandings,
  isDone,
  type Challenge,
  type ChallengeRecord,
} from '../repte/challenge';
import { ordinal, signed } from '../ui/format';

interface Props {
  challenge: Challenge;
  playerName: string;
  /** Els reptes acabats, per al rècord a batre. */
  history: readonly ChallengeRecord[];
}

const sign = (n: number) => (n >= 0 ? 'points-positive' : 'points-negative');

/**
 * El final d'una partida del repte, simple i molt visual: tres pàgines que es
 * passen fent lliscar el dit (o tocant els tres punts de sota).
 *
 * 1. **La partida**: qui l'ha guanyada, en gran, i una barra per jugador amb
 *    els punts (a la dreta si en guanya, a l'esquerra si en perd).
 * 2. **El repte**: el podi pel total acumulat, amb les victòries de cadascú.
 * 3. **Tàctica**: la informació per jugar amb tàctica i el rècord a batre.
 */
export function RepteCarousel({ challenge, playerName, history }: Props) {
  const played = challenge.games.length;
  const last = challenge.games[played - 1];
  if (!last) return null;

  const known = challenge.rivals.length > 0 && challenge.games.some((game) => game.scores);
  const standings = challengeStandings(challenge, playerName);
  const rows = known ? standings : standings.filter((row) => row.you);
  const done = isDone(challenge);
  const record = bestFor(history, challenge.config);

  /* 1. La partida */
  const bars = rows.map((row) => ({ key: String(row.seat), name: row.name, you: row.you, points: row.last }));
  const winner = bars.find((bar) => Number(bar.key) === last.winner) ?? (last.won ? bars.find((bar) => bar.you) : undefined);

  /* 2. El repte: podi pel total (els tres primers) i la resta a sota. */
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium;

  const slides: Slide[] = [
    {
      title: `Resultat de la partida ${played}`,
      body: (
        <ResultBars
          rows={bars}
          winner={winner}
          detail={`${last.blocked ? 'Partida bloquejada' : 'Sense fitxes'}${last.turns ? ` · ${last.turns} torns` : ''}`}
        />
      ),
    },
    {
      title: done ? 'Resultat del repte' : played === 1 ? 'El repte, després d’1 partida' : `El repte, després de ${played} partides`,
      body: (
        <>
          <ol className={`carrusel-podi n${podium.length}`}>
            {podiumOrder.map((row) => (
              <li key={row.seat} className={`podi-${row.place}${row.you ? ' jo' : ''}`}>
                <Avatar name={row.name} you={row.you} big={row.place === 1} />
                <span className="podi-nom">{row.you ? 'Tu' : row.name}</span>
                <span className={`podi-total ${sign(row.total)}`}>{signed(row.total)}</span>
                <span className="podi-graó">
                  <strong>{ordinal(row.place)}</strong>
                  <span className="podi-victories" title="Partides guanyades">
                    {row.wins > 0 ? `🏆×${row.wins}` : '—'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {rest.map((row) => (
            <p key={row.seat} className={row.you ? 'carrusel-resta jo' : 'carrusel-resta'}>
              {ordinal(row.place)} · {row.you ? 'Tu' : row.name} · <span className={sign(row.total)}>{signed(row.total)}</span>
            </p>
          ))}
          {!known && <p className="muted small">Aquest repte va començar sense els punts dels rivals: només hi ha els teus.</p>}
        </>
      ),
    },
    {
      title: 'Tàctica',
      body: (
        <ul className="carrusel-info">
          {challengeInsights(challenge, standings).map((line) => (
            <li key={line.text}>
              <span className="carrusel-icona" aria-hidden="true">
                {line.icon}
              </span>
              <span>{line.text}</span>
            </li>
          ))}
          {record && (
            <li>
              <span className="carrusel-icona" aria-hidden="true">
                🎯
              </span>
              <span>Rècord a batre en aquest repte: {signed(record.total)}.</span>
            </li>
          )}
        </ul>
      ),
    },
  ];

  return <Carousel slides={slides} label="Resultat de la partida i del repte" />;
}
