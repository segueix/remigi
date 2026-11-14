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
 * El temps que queda d'un torn: de quin torn és (`key`), amb quina durada
 * (`seconds`) i quants mil·lisegons hi queden. Es desa a part (`saveClock`)
 * perquè, en tornar a una partida deixada a mitges, el torn continuï amb el
 * temps que tenia i no torni a començar.
 */
export interface ClockState {
  key: string;
  seconds: number;
  leftMs: number;
}

const CLOCK_KEY = 'remigi:rellotge:';

export function loadClock(slot: string): ClockState | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CLOCK_KEY + slot) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const c = value as Partial<ClockState>;
    if (typeof c.key !== 'string' || !Number.isFinite(c.seconds) || !Number.isFinite(c.leftMs)) return null;
    return { key: c.key, seconds: c.seconds as number, leftMs: c.leftMs as number };
  } catch {
    return null;
  }
}

export function saveClock(slot: string, clock: ClockState): void {
  try {
    localStorage.setItem(CLOCK_KEY + slot, JSON.stringify(clock));
  } catch {
    // Sense emmagatzematge, el torn continua igual (però no es recordarà).
  }
}

/**
 * Mil·lisegons amb què comença (o continua) un torn: els desats, si són
 * d'aquest mateix torn i amb aquesta mateixa durada; si no, el torn sencer.
 */
export function startingBudget(seconds: number, key: string, saved: ClockState | null): number {
  if (saved && saved.key === key && saved.seconds === seconds) {
    return Math.min(seconds * 1000, Math.max(0, saved.leftMs));
  }
  return seconds * 1000;
}

/**
 * @param seconds durada del torn, o `null` si es juga sense límit.
 * @param running si el rellotge ha de córrer ara mateix (és el teu torn i no
 *   hi ha res obert a sobre). Quan s'atura (el menú obert, una altra
 *   pantalla) el torn es queda amb el temps que tenia i continua per allà.
 * @param turnKey identificador del torn: quan canvia, el rellotge torna a
 *   començar.
 * @param onTimeout què passa quan s'acaba el temps. Es crida un sol cop per torn.
 * @param saved el temps desat d'una partida represa (només compta si és d'aquest torn).
 * @param onSave rep el temps que queda cada segon i en aturar-se, per desar-lo.
 * @returns els segons que queden, o `null` si el rellotge no compta.
 */
export function useTurnClock(
  seconds: number | null,
  running: boolean,
  turnKey: string,
  onTimeout: () => void,
  saved: ClockState | null = null,
  onSave?: (clock: ClockState) => void,
): number | null {
  const [left, setLeft] = useState<number | null>(null);
  /* L'avís del final es llegeix quan toca, així que canviar-lo no reinicia res. */
  const timeout = useRef(onTimeout);
  const save = useRef(onSave);
  useEffect(() => {
    timeout.current = onTimeout;
    save.current = onSave;
  });
  /* El que queda del torn en curs, encara que el rellotge estigui aturat. */
  const budget = useRef<ClockState | null>(null);
  /* El desat només val per al primer torn que es veu (el de la represa). */
  const initial = useRef(saved);

  useEffect(() => {
    if (seconds === null) {
      budget.current = null;
      setLeft(null);
      return;
    }
    if (!budget.current || budget.current.key !== turnKey || budget.current.seconds !== seconds) {
      budget.current = { key: turnKey, seconds, leftMs: startingBudget(seconds, turnKey, initial.current) };
      initial.current = null;
    }
    if (!running) {
      setLeft(null);
      return;
    }
    const endsAt = Date.now() + budget.current.leftMs;
    let fired = false;
    let lastSecond = -1;
    const tick = () => {
      const leftMs = Math.max(0, endsAt - Date.now());
      budget.current = { key: turnKey, seconds, leftMs };
      const remaining = secondsLeft(endsAt, Date.now());
      setLeft(remaining);
      if (remaining !== lastSecond) {
        lastSecond = remaining;
        save.current?.(budget.current);
      }
      if (remaining === 0 && !fired) {
        fired = true;
        timeout.current();
      }
    };
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(timer);
      budget.current = { key: turnKey, seconds, leftMs: Math.max(0, endsAt - Date.now()) };
      save.current?.(budget.current);
    };
  }, [seconds, running, turnKey]);

  return left;
}
