/**
 * Les fitxes de la taula s'empetiteixen **només quan no hi caben**, i just el
 * que calgui.
 *
 * Jugar bé demana veure la taula sencera —la fitxa que et falta pot ser a
 * qualsevol escala—, però encongir-les abans d'hora fa el joc més petit del
 * compte i deixa mig feltre buit. Per això no es compten fitxes: es **mesura**
 * si el que hi ha desborda la taula, i es baixa un pas de no res fins que hi
 * cap tot. Quan la taula es buida, les fitxes tornen a créixer soles.
 *
 * La mesura es fa sobre el feltre de debò (`scrollHeight` contra
 * `clientHeight`), que és l'única manera de saber si hi cap: com s'escampen
 * les jugades depèn de l'amplada, dels salts de línia i de la pantalla de
 * cadascú.
 */

/**
 * Per sota d'això no s'empetiteixen més: deixarien de llegir-se. Amb les mides
 * de partida d'ara, la meitat encara deixa la fitxa de la taula com era abans
 * de fer-les grosses, que és el mínim que s'havia comprovat que es llegeix.
 */
const MIN_SCALE = 0.5;

/** Un pas del 3 % es nota poc i deixa la taula ben plena. */
const STEP = 0.03;

/** Passos de mida que es proven, del natural cap avall. */
export const TILE_SCALES: readonly number[] = buildScales();

function buildScales(): number[] {
  const scales: number[] = [];
  for (let scale = 1; scale >= MIN_SCALE - 0.0001; scale -= STEP) {
    scales.push(Math.round(scale * 100) / 100);
  }
  return scales;
}

/**
 * La mida més gran de la llista que hi cap. Si no hi cap ni la més petita, es
 * queda amb aquesta: a partir d'aquí, el que toca és desplaçar la taula.
 *
 * `fits` es demana de gran a petit i s'atura al primer que hi cap, que és el
 * que es vol: encongir el mínim imprescindible.
 */
export function largestFittingScale(
  scales: readonly number[],
  fits: (scale: number) => boolean,
): number {
  for (const scale of scales) {
    if (fits(scale)) return scale;
  }
  return scales[scales.length - 1];
}

/**
 * Marge d'un píxel: les mesures del navegador són enteres i arrodonir avall
 * faria encongir la taula per no res.
 */
const SLACK_PX = 1;

/** Prova una mida a la taula de debò i diu si tot hi cap sense desplaçar-se. */
function fitsAt(board: HTMLElement, scale: number): boolean {
  board.style.setProperty('--densitat', String(scale));
  return (
    board.scrollHeight <= board.clientHeight + SLACK_PX &&
    board.scrollWidth <= board.clientWidth + SLACK_PX
  );
}

/**
 * Ajusta la mida de les fitxes a l'espai que hi ha ara mateix i la deixa
 * aplicada. Retorna la mida triada (per a les proves).
 */
export function fitBoardTiles(board: HTMLElement): number {
  const scale = largestFittingScale(TILE_SCALES, (candidate) => fitsAt(board, candidate));
  board.style.setProperty('--densitat', String(scale));
  return scale;
}

export { MIN_SCALE, STEP };
