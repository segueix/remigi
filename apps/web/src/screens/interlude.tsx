import { useEffect, useRef, useState } from 'react';
import { resyncCountdown, startCountdown, tickCountdown } from '../lliga/countdown';
import {
  composeNew,
  jinglePlayer,
  pauseMusic,
  registerPiece,
  resumeMusic,
  stopMusic,
} from '../musica/musica';
import { safeStorage, useMusicPrefs } from '../musica/useMusicPrefs';

/**
 * Les peces comunes de les pantalles de relax entre partides (la lliga i el
 * repte): el compte enrere (30 segons al repte, un minut a la lliga) i la
 * música composta en aquell moment, com a les lligues ràpides d'El Tauler.
 */

/** Els segons de relax entre partida i partida del repte. */
export const INTERLUDE_SECONDS = 30;

/** Entre jornada i jornada de la lliga, un minut. */
export const LEAGUE_INTERLUDE_SECONDS = 60;

/**
 * La música dura una mica més que el descans (32 s per a 30, 64 s per a 60),
 * perquè no se senti repetir-se abans no comenci la partida.
 */
export const musicSecondsFor = (seconds: number) => Math.round(seconds * 1.07);

/**
 * El compte enrere: només corre amb l'app a la vista (amb la pestanya amagada
 * es queda quiet, i la música també), perquè cap partida no comenci sense
 * ningú davant. En canviar la visibilitat es torna a prendre el temps: si el
 * mòbil ha suspès els temporitzadors en segon pla, l'estona amagada no es
 * descompta (vegeu `countdown.ts`). A zero crida `onDone` una sola vegada.
 */
export function useInterludeCountdown(onDone: () => void, seconds: number = INTERLUDE_SECONDS) {
  const [left, setLeft] = useState(seconds * 1000);
  const clock = useRef(startCountdown(seconds * 1000, performance.now()));
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    clock.current = startCountdown(seconds * 1000, performance.now());
    let done = false;
    const onVisibility = () => {
      clock.current = resyncCountdown(clock.current, performance.now());
      if (document.hidden) pauseMusic();
      else resumeMusic();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => {
      const hidden = document.hidden;
      if (hidden) pauseMusic();
      else resumeMusic();
      clock.current = tickCountdown(clock.current, performance.now(), hidden);
      setLeft(clock.current.left);
      if (clock.current.left <= 0 && !done) {
        done = true;
        clearInterval(timer);
        onDoneRef.current();
      }
    }, 200);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [seconds]);

  return {
    seconds: Math.max(0, Math.ceil(left / 1000)),
    /** Segons passats des del principi: la música hi comença si ha trigat a compondre's. */
    elapsed: () => Math.max(0, (seconds * 1000 - clock.current.left) / 1000),
  };
}

/**
 * La música: una peça nova cada vegada (`composeNew`), en bucle fins que
 * comença la partida o se surt. Si generar-la triga una mica, comença pel punt
 * on va el compte enrere: el bucle no té final que s'hagi de fer coincidir.
 */
export function useInterludeMusic(elapsed: () => number, seconds: number = INTERLUDE_SECONDS) {
  const [music, setMusic] = useMusicPrefs();
  const [playing, setPlaying] = useState<string | null>(null);
  const musicOn = music.on && music.volume > 0;
  const volume = useRef(music.volume);
  volume.current = music.volume;
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    if (!musicOn) return;
    let cancelled = false;
    void jinglePlayer()
      .then(({ R, player }) => {
        if (cancelled || !player.supported()) return;
        const store = safeStorage();
        const spec = composeNew(R, store, Math.random, musicSecondsFor(seconds));
        return player
          .play(spec, { volume: volume.current, startedAt: () => elapsedRef.current() })
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
  }, [musicOn, seconds]);

  return {
    musicOn,
    playing,
    toggle: () => setMusic({ ...music, on: !musicOn, volume: music.volume > 0 ? music.volume : 60 }),
  };
}

/** «comença en 27», gran. */
export function InterludeCountdown({ seconds }: { seconds: number }) {
  return (
    <p className="interludi-compte" role="timer" aria-label={`Comença en ${seconds} segons`}>
      <span className="muted">comença en</span>
      <strong>{seconds}</strong>
    </p>
  );
}

/** La peça que sona (o que s'està component) i el botó per silenciar-la. */
export function InterludeMusic({
  musicOn,
  playing,
  toggle,
}: {
  musicOn: boolean;
  playing: string | null;
  toggle(): void;
}) {
  return (
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
      <button type="button" className="link" onClick={toggle}>
        {musicOn ? 'Silencia' : 'Posa música'}
      </button>
    </p>
  );
}

/** La partida o la jornada que toca, gran i en un requadre. */
export function InterludeBox({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="interludi-jornada">
      <span id="interludi-titol" className="interludi-jornada-text">
        {label}
      </span>
      <span className="interludi-jornada-num">
        {value}
        <small>/{total}</small>
      </span>
    </div>
  );
}
