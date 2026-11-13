import { DIFFICULTIES } from '@remigi/core';
import { useEffect, useRef, useState } from 'react';
import { botPersona } from '../game/bots';
import {
  YOU,
  difficultyForRating,
  standings,
  tablePoints,
  yourTable,
  type LeagueSeason,
} from '../lliga/league';
import {
  composeNew,
  jinglePlayer,
  pauseMusic,
  registerPiece,
  resumeMusic,
  stopMusic,
} from '../musica/musica';
import { safeStorage, useMusicPrefs } from '../musica/useMusicPrefs';
import { leaguePoints, ordinal, signed } from '../ui/format';

/** Els segons de relax entre jornada i jornada, com a les lligues ràpides d'El Tauler. */
export const INTERLUDE_SECONDS = 30;

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
  const [music, setMusic] = useMusicPrefs();
  const [left, setLeft] = useState(INTERLUDE_SECONDS * 1000);
  const [playing, setPlaying] = useState<string | null>(null);
  const clock = useRef({ left: INTERLUDE_SECONDS * 1000, last: performance.now() });
  const onPlayNowRef = useRef(onPlayNow);
  onPlayNowRef.current = onPlayNow;

  useEffect(() => {
    clock.current = { left: INTERLUDE_SECONDS * 1000, last: performance.now() };
    let done = false;
    const timer = setInterval(() => {
      const now = performance.now();
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (hidden) pauseMusic();
      else {
        resumeMusic();
        clock.current.left -= Math.max(0, now - clock.current.last);
      }
      clock.current.last = now;
      setLeft(clock.current.left);
      if (clock.current.left <= 0 && !done) {
        done = true;
        clearInterval(timer);
        onPlayNowRef.current();
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  /*
   * La música: una peça nova cada vegada, en bucle fins que comença la partida
   * (o s'atura). Si generar-la triga una mica, comença pel punt on va el
   * compte enrere: el bucle no té final que s'hagi de fer coincidir.
   */
  const musicOn = music.on && music.volume > 0;
  const volume = useRef(music.volume);
  volume.current = music.volume;
  useEffect(() => {
    if (!musicOn) return;
    let cancelled = false;
    void jinglePlayer()
      .then(({ R, player }) => {
        if (cancelled || !player.supported()) return;
        const store = safeStorage();
        const spec = composeNew(R, store);
        return player
          .play(spec, {
            volume: volume.current,
            startedAt: () => Math.max(0, (INTERLUDE_SECONDS * 1000 - clock.current.left) / 1000),
          })
          .then((ok) => {
            if (!ok) return;
            if (cancelled) {
              player.stop(true);
              return;
            }
            registerPiece(store, spec);
            setPlaying(R.jingleTitle(spec));
          });
      })
      .catch(() => {
        // Sense àudio (o sense el compositor), la pausa es fa igual en silenci.
      });
    return () => {
      cancelled = true;
      stopMusic(true);
      setPlaying(null);
    };
  }, [musicOn]);

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
  const seconds = Math.max(0, Math.ceil(left / 1000));

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

      <div className="interludi-jornada">
        <span id="interludi-titol" className="interludi-jornada-text">
          Jornada
        </span>
        <span className="interludi-jornada-num">
          {round + 1}
          <small>/{season.config.rounds}</small>
        </span>
      </div>

      <p className="interludi-compte" role="timer" aria-label={`Comença en ${seconds} segons`}>
        <span className="muted">comença en</span>
        <strong>{seconds}</strong>
      </p>

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

      <p className="interludi-musica small">
        {musicOn ? (
          playing ? (
            <span title="Peça composta ara mateix per l’app: cada vegada n’és una de nova">🎵 Sona: {playing}</span>
          ) : (
            <span className="muted">🎵 Component la música…</span>
          )
        ) : (
          <span className="muted">Sense música</span>
        )}
        <button
          type="button"
          className="link"
          onClick={() => setMusic({ ...music, on: !musicOn, volume: music.volume > 0 ? music.volume : 60 })}
        >
          {musicOn ? 'Silencia' : 'Posa música'}
        </button>
      </p>

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
