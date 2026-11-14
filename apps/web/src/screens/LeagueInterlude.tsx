import { DIFFICULTIES } from '@remigi/core';
import { botPersona } from '../game/bots';
import {
  YOU,
  difficultyForRating,
  standings,
  tablePoints,
  yourTable,
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
