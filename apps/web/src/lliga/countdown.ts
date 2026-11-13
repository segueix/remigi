/**
 * El compte enrere de la pantalla entre jornades (`LeagueInterlude`), pur per
 * poder-lo provar. Només corre amb l'app a la vista:
 *
 * - amb la pestanya amagada, els tocs no descompten res;
 * - en canviar la visibilitat es torna a prendre el temps (`resync`), perquè
 *   l'estona amagada no es carregui al compte;
 * - i cap toc no descompta més d'un segon: si el navegador ha suspès els
 *   temporitzadors (el mòbil en segon pla) i el primer toc arriba després, el
 *   salt no s'enduu la pausa sencera.
 */
export interface Countdown {
  /** Mil·lisegons que queden. */
  left: number;
  /** Quan es va comptar per última vegada (`performance.now()`). */
  last: number;
}

/** Els tocs són cada 200 ms: un pas més llarg vol dir que s'han aturat. */
export const MAX_STEP_MS = 1000;

export function startCountdown(ms: number, now: number): Countdown {
  return { left: ms, last: now };
}

export function tickCountdown(countdown: Countdown, now: number, hidden: boolean): Countdown {
  const step = hidden ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - countdown.last));
  return { left: countdown.left - step, last: now };
}

/** L'app s'ha amagat o ha tornat: el temps es compta a partir d'ara. */
export function resyncCountdown(countdown: Countdown, now: number): Countdown {
  return { ...countdown, last: now };
}
