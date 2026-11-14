import { DIFFICULTIES } from '@remigi/core';
import { Carousel } from '../components/Carousel';
import { Avatar, ResultBars } from '../components/ResultBars';
import { botPersona } from '../game/bots';
import {
  YOU,
  difficultyForRating,
  leagueInsights,
  standings,
  tablePoints,
  yourTable,
  yourTableResult,
  zoneOf,
  type LeagueSeason,
} from '../lliga/league';
import { leaguePoints, ordinal, signed } from '../ui/format';
import {
  InterludeBox,
  InterludeCountdown,
  InterludeMusic,
  useInterludeCountdown,
  useInterludeMusic,
} from './interlude';

interface Props {
  /** La temporada, amb la jornada que s'acaba de jugar ja apuntada. */
  season: LeagueSeason;
  playerName: string;
  /** Comença la jornada següent (a zero, o amb «Juga ara»). */
  onPlayNow(): void;
  onStandings(): void;
  onHome(): void;
}

/**
 * Entre jornada i jornada de la lliga: com a les lligues de 30 s, 1 i 2 minuts
 * d'El Tauler, en acabar una partida no surt el resum llarg sinó una pantalla
 * amb poc text i 30 segons de relax amb música composta en aquell moment. El
 * resultat en curt, la jornada que toca (gran), el compte enrere, i la teva
 * posició cara a cara amb la dels rivals de la jornada següent. A zero
 * comença sola; «Juga ara» no espera; «Classificació» i «Inici» l'aturen.
 *
 * El compte enrere només corre amb l'app a la vista: amb la pestanya amagada
 * es queda quiet (i la música també), perquè cap partida no comenci sense
 * ningú davant.
 */
export function LeagueInterlude({ season, playerName, onPlayNow, onStandings, onHome }: Props) {
  const countdown = useInterludeCountdown(onPlayNow);
  const music = useInterludeMusic(countdown.elapsed);

  const round = season.played; // jornada que s'acaba de jugar (des d'1)
  const mine = season.results.find((result) => result.round === round - 1 && result.ids.includes(YOU));
  const me = mine ? mine.ids.indexOf(YOU) : -1;
  const place = mine ? [...mine.scores].sort((a, b) => b - a).indexOf(mine.scores[me]) + 1 : 0;
  const gained = mine ? tablePoints(mine.scores)[me] : 0;
  const tone = !mine ? 'mig' : place === 1 ? 'guanya' : place === mine.ids.length ? 'perd' : 'mig';

  const table = standings(season, playerName);
  const rankOf = (id: string) => table.findIndex((row) => row.id === id) + 1;
  const myRow = table.find((row) => row.id === YOU);
  const next = yourTable(season);

  // La teva partida de la jornada que s'acaba de jugar.
  const tableRows = yourTableResult(season, round - 1, playerName);
  const winnerRow = tableRows.reduce<(typeof tableRows)[number] | undefined>(
    (best, row) => (!best || row.score > best.score ? row : best),
    undefined,
  );

  // La classificació en curt: els de dalt i els del teu voltant.
  const ranked = table.map((row, i) => ({ ...row, rank: i + 1 }));
  const myRank = rankOf(YOU);
  const keep = new Set<number>([1, 2, 3, myRank - 1, myRank, myRank + 1, ranked.length]);
  const compact: ((typeof ranked)[number] | null)[] = [];
  ranked.forEach((row) => {
    if (!keep.has(row.rank)) return;
    const prev = compact[compact.length - 1];
    if (prev && prev.rank !== row.rank - 1) compact.push(null);
    compact.push(row);
  });

  return (
    <section className="card interludi lliga" aria-labelledby="interludi-titol">
      <div className="franja-fitxes" aria-hidden="true" />
      {mine && (
        <p className={`interludi-resultat ${tone}`}>
          {ordinal(place)} de {mine.ids.length} ·{' '}
          {gained === 0 ? 'cap punt' : `+${leaguePoints(gained)} ${gained === 1 ? 'punt' : 'punts'}`} ·{' '}
          {signed(mine.scores[me])}
        </p>
      )}

      <InterludeBox label="Jornada" value={round + 1} total={season.config.rounds} />

      <InterludeCountdown seconds={countdown.seconds} />

      {/*
        * La part principal és la de sempre (on ets i contra qui jugues la
        * jornada següent); fent lliscar el dit cap al costat, o tocant els tres
        * punts, hi ha la teva partida i la classificació amb la tàctica.
        */}
      <Carousel
        label="Jornada de lliga: la propera taula, la teva partida i la classificació"
        slides={[
          {
            title: `Jornada ${round + 1}: la teva taula`,
            body: (
            <div className="interludi-cares">
              <div className="interludi-pos tu">
                <span className="interludi-pos-num">{ordinal(rankOf(YOU))}</span>
                <span className="interludi-pos-nom">Tu</span>
                <span className="muted small">{leaguePoints(myRow?.points ?? 0)} pts</span>
              </div>
              <span className="interludi-vs" aria-hidden="true">
                contra
              </span>
              <ul className="interludi-rivals">
                {next.map((rival) => {
                  const persona = botPersona(rival.name);
                  const row = table.find((r) => r.id === rival.id);
                  return (
                    <li key={rival.id} className="interludi-pos">
                      <span
                        className="player-color lliga-avatar"
                        aria-hidden="true"
                        style={{ background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` }}
                      >
                        {persona.emoji}
                      </span>
                      <span className="interludi-rival-text">
                        <strong>{rival.name}</strong>
                        <span className="muted small">
                          {ordinal(rankOf(rival.id))} · {leaguePoints(row?.points ?? 0)} pts ·{' '}
                          {DIFFICULTIES[difficultyForRating(rival.rating)].label} {rival.rating}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            ),
          },
          {
            title: `La teva partida de la jornada ${round}`,
            body: tableRows.length ? (
              <ResultBars
                rows={tableRows.map((row) => ({
                  key: row.id,
                  name: row.name,
                  you: row.you,
                  points: row.score,
                  note: `${row.leaguePoints === 0 ? '0' : `+${leaguePoints(row.leaguePoints)}`} ${row.leaguePoints === 1 ? 'pt' : 'pts'} de lliga`,
                }))}
                winner={winnerRow ? { key: winnerRow.id, name: winnerRow.name, you: winnerRow.you, points: winnerRow.score } : undefined}
              />
            ) : (
              <p className="muted small">Aquesta jornada no tenies taula.</p>
            ),
          },
          {
            title: `La lliga després de ${round} ${round === 1 ? 'jornada' : 'jornades'}`,
            body: (
              <>
                <ol className="carrusel-classificacio">
                  {compact.map((row, i) =>
                    row === null ? (
                      <li key={`buit-${i}`} className="buit" aria-hidden="true">
                        ⋯
                      </li>
                    ) : (
                      <li
                        key={row.id}
                        className={[
                          row.id === YOU ? 'jo' : '',
                          zoneOf(season.tier, row.rank, season.config.players) === 'up' ? 'zona-puja' : '',
                          zoneOf(season.tier, row.rank, season.config.players) === 'down' ? 'zona-baixa' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <span className="classif-pos">{row.rank}</span>
                        <Avatar name={row.name} you={row.id === YOU} />
                        <span className="classif-nom">{row.id === YOU ? 'Tu' : row.name}</span>
                        <span className="classif-punts">{leaguePoints(row.points)} pts</span>
                      </li>
                    ),
                  )}
                </ol>
                <ul className="carrusel-info">
                  {leagueInsights(season, playerName).map((line) => (
                    <li key={line.text}>
                      <span className="carrusel-icona" aria-hidden="true">
                        {line.icon}
                      </span>
                      <span>{line.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
        ]}
      />

      <InterludeMusic {...music} />

      <div className="row interludi-accions">
        <button type="button" onClick={onPlayNow}>
          Juga ara
        </button>
        <button type="button" className="secondary" onClick={onStandings}>
          Classificació
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          Inici
        </button>
      </div>
    </section>
  );
}
