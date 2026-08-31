import { useEffect, useRef, useState } from 'react';

/**
 * El rellotge del torn: compta enrere mentre et toca jugar i, quan s'acaba,
 * avisa una sola vegada.
 *
 * Compta contra l'hora de finalització i no sumant tics, perquè un mòbil amb
 * la pantalla apagada o una pestanya de fons frenen els temporitzadors: si
 * tornes al cap d'un minut, el temps s'ha acabat de debò i el rellotge ho ha
 * de dir, no continuar per on era.
 */

/** Segons que queden fins a `endsAt`, mai negatius. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Cada quant es repinta el compte enrere. */
const TICK_MS = 200;

/**
 * @param seconds durada del torn, o `null` si es juga sense límit.
 * @param running si el rellotge ha de córrer ara mateix (és el teu torn i no
 *   hi ha res obert a sobre).
 * @param turnKey identificador del torn: quan canvia, el rellotge torna a
 *   començar.
 * @param onTimeout què passa quan s'acaba el temps. Es crida un sol cop per torn.
 * @returns els segons que queden, o `null` si el rellotge no compta.
 */
export function useTurnClock(
  seconds: number | null,
  running: boolean,
  turnKey: string,
  onTimeout: () => void,
): number | null {
  const [left, setLeft] = useState<number | null>(null);
  /* L'avís del final es llegeix quan toca, així que canviar-lo no reinicia res. */
  const timeout = useRef(onTimeout);
  useEffect(() => {
    timeout.current = onTimeout;
  });

  useEffect(() => {
    if (seconds === null || !running) {
      setLeft(null);
      return;
    }
    const endsAt = Date.now() + seconds * 1000;
    let fired = false;
    setLeft(seconds);
    const timer = setInterval(() => {
      const remaining = secondsLeft(endsAt, Date.now());
      setLeft(remaining);
      if (remaining === 0 && !fired) {
        fired = true;
        timeout.current();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [seconds, running, turnKey]);

  return left;
}
