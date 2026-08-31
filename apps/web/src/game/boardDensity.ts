/**
 * Com més plena està la taula, més petites es veuen les fitxes.
 *
 * A la pantalla d'un mòbil, una partida avançada té tantes jugades que les
 * últimes queden fora de la vista, i jugar bé demana veure-les **totes**
 * alhora: una fitxa que et falta pot ser a qualsevol escala. Per això la mida
 * de les fitxes de la taula no és fixa, sinó que va baixant a mesura que
 * n'apareixen de noves, fins a un mínim on encara es llegeixen.
 *
 * L'escala es calcula del nombre de fitxes que hi ha a la taula i no de
 * l'espai que ocupen: així el canvi és gradual i previsible (una fitxa nova,
 * un pas), i no depèn de mesures del navegador que farien ballar la mida a
 * cada moviment.
 */

/**
 * Fitxes que hi caben a mida natural abans de començar a empetitir-les. Amb
 * la taula d'un mòbil vertical hi caben totes sense retallar res, i
 * empetitir-les abans d'hora només faria el joc més petit del compte.
 */
const COMFORTABLE = 22;

/** Quant s'encongeix la fitxa per cada fitxa de més. */
const STEP = 0.009;

/** Per sota d'això no s'empetiteixen més, o deixarien de llegir-se. */
const MIN_SCALE = 0.6;

/** Fitxes que hi ha ara mateix sobre el feltre. */
export function countBoardTiles(board: readonly { length: number }[]): number {
  return board.reduce((total, meld) => total + meld.length, 0);
}

/**
 * L'escala de les fitxes de la taula, d'1 (buida) a `MIN_SCALE` (plena).
 * S'arrodoneix al centèsim perquè el valor que va al CSS sigui curt i estable.
 */
export function boardScale(tileCount: number): number {
  if (tileCount <= COMFORTABLE) return 1;
  const scale = 1 - (tileCount - COMFORTABLE) * STEP;
  return Math.max(MIN_SCALE, Math.round(scale * 100) / 100);
}
