import { useRef, useState, type ReactNode } from 'react';
import { botPersona, isPersonName } from '../game/bots';
import {
  bestFor,
  challengeInsights,
  challengeStandings,
  isDone,
  type Challenge,
  type ChallengeRecord,
  type StandingRow,
} from '../repte/challenge';
import { ordinal, signed } from '../ui/format';

interface Props {
  challenge: Challenge;
  playerName: string;
  /** Els reptes acabats, per al rècord a batre. */
  history: readonly ChallengeRecord[];
}

/** L'avatar de cadascú: el teu, amb la inicial; els rivals, amb el seu degradat. */
function Avatar({ row, big = false }: { row: StandingRow; big?: boolean }) {
  const persona = row.you ? null : botPersona(row.name);
  const classes = ['player-color', 'carrusel-avatar'];
  if (big) classes.push('gran');
  if (persona && isPersonName(row.name)) classes.push('inicials');
  return (
    <span
      className={classes.join(' ')}
      aria-hidden="true"
      style={persona ? { background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` } : undefined}
    >
      {persona ? persona.emoji : (row.name.trim().charAt(0) || 'T').toUpperCase()}
    </span>
  );
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
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const played = challenge.games.length;
  const last = challenge.games[played - 1];
  if (!last) return null;

  const known = challenge.rivals.length > 0 && challenge.games.some((game) => game.scores);
  const standings = challengeStandings(challenge, playerName);
  const rows = known ? standings : standings.filter((row) => row.you);
  const done = isDone(challenge);
  const record = bestFor(history, challenge.config);

  /* 1. La partida */
  const byGame = [...rows].sort((a, b) => (b.last ?? -Infinity) - (a.last ?? -Infinity));
  const winnerRow = rows.find((row) => row.seat === last.winner) ?? (last.won ? rows.find((row) => row.you) : undefined);
  const maxAbs = Math.max(1, ...byGame.map((row) => Math.abs(row.last ?? 0)));

  /* 2. El repte: podi pel total (els tres primers) i la resta a sota. */
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium;

  const slides: { title: string; body: ReactNode }[] = [
    {
      title: `Resultat de la partida ${played}`,
      body: (
        <>
          {winnerRow && (
            <div className={winnerRow.you ? 'carrusel-guanyador jo' : 'carrusel-guanyador'}>
              <Avatar row={winnerRow} big />
              <strong>{winnerRow.you ? 'Has guanyat!' : `Guanya ${winnerRow.name}`}</strong>
              <span className="muted small">{last.blocked ? 'Partida bloquejada' : 'Sense fitxes'}{last.turns ? ` · ${last.turns} torns` : ''}</span>
            </div>
          )}
          <ul className="carrusel-barres">
            {byGame.map((row) => {
              const points = row.last ?? 0;
              const width = `${(Math.abs(points) / maxAbs) * 50}%`;
              return (
                <li key={row.seat} className={row.you ? 'jo' : undefined}>
                  <Avatar row={row} />
                  <span className="carrusel-nom">{row.you ? 'Tu' : row.name}</span>
                  <span className="carrusel-eix" aria-hidden="true">
                    <span className={points >= 0 ? 'barra positiva' : 'barra negativa'} style={{ width }} />
                  </span>
                  <span className={`carrusel-punts ${sign(points)}`}>{row.last === null ? '—' : signed(points)}</span>
                </li>
              );
            })}
          </ul>
        </>
      ),
    },
    {
      title: done ? 'Resultat del repte' : played === 1 ? 'El repte, després d’1 partida' : `El repte, després de ${played} partides`,
      body: (
        <>
          <ol className={`carrusel-podi n${podium.length}`}>
            {podiumOrder.map((row) => (
              <li key={row.seat} className={`podi-${row.place}${row.you ? ' jo' : ''}`}>
                <Avatar row={row} big={row.place === 1} />
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

  const goTo = (index: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setPage(index);
  };

  return (
    <div className="carrusel" role="region" aria-roledescription="carrusel" aria-label="Resultat de la partida i del repte">
      <div
        className="carrusel-pista"
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (index !== page) setPage(Math.min(slides.length - 1, Math.max(0, index)));
        }}
      >
        {slides.map((slide, i) => (
          <section
            key={slide.title}
            className="carrusel-diapo"
            role="group"
            aria-roledescription="pàgina"
            aria-label={`${i + 1} de ${slides.length}: ${slide.title}`}
          >
            <h3 className="carrusel-titol">{slide.title}</h3>
            {slide.body}
          </section>
        ))}
      </div>
      <div className="carrusel-punts-nav" role="tablist" aria-label="Pàgines">
        {slides.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            role="tab"
            className="carrusel-punt"
            aria-selected={page === i}
            aria-label={`Pàgina ${i + 1}: ${slide.title}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
