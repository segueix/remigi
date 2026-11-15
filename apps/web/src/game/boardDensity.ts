/**
 * La mida de les fitxes de la taula: **estable**, i petita només si no hi ha
 * més remei.
 *
 * Jugar bé demana veure la taula sencera —la fitxa que et falta pot ser a
 * qualsevol escala—, però una fitxa que ara és gran, ara és petita i després
 * torna a créixer cansa més que no ajuda. Per això la mida es regeix per
 * quatre normes:
 *
 * 1. **Només s'empetiteix quan no hi cap**, i just el que calgui. No es compten
 *    fitxes: es mesura si el que hi ha desborda el feltre.
 * 2. **No torna a créixer de seguida**: només quan hi ha lloc de sobres
 *    (`GROW_MARGIN`). Moure una fitxa d'una jugada a una altra, o desfer el
 *    que s'acaba de fer, no fa ballar la mida.
 * 3. **Els avisos no compten**: la pista de sota la taula, un error o el botó
 *    de tornar la fitxa al faristol apareixen i desapareixen durant el torn i
 *    li prenen alçada. La mida es calcula com si no hi fossin (vegeu
 *    `MEASURING_CLASS`); mentre es veuen, si la taula és plena, es desplaça.
 * 4. **Té un mínim que encara es llegeix bé** (`MIN_SCALE`). Per sota no es
 *    baixa: a partir d'aquí, la taula es desplaça.
 *
 * La mesura es fa sobre el feltre de debò (`scrollHeight` contra
 * `clientHeight`), que és l'única manera de saber si hi cap: com s'escampen
 * les jugades depèn de l'amplada, dels salts de línia i de la pantalla de
 * cadascú.
 */

/**
 * Per sota d'això no s'empetiteixen: dos terços de la mida natural. Al mòbil
 * la fitxa encara fa uns 28 px d'ample i el número es llegeix bé. Abans
 * baixaven fins a la meitat, i a aquella mida costava de jugar.
 */
const MIN_SCALE = 0.67;

/** Un pas del 3 % es nota poc i deixa la taula ben plena. */
const STEP = 0.03;

/**
 * Lloc de sobres que cal per tornar a créixer: les fitxes només es fan més
 * grosses si encara hi cabrien un 9 % més grosses que la mida nova.
 */
const GROW_MARGIN = 0.09;

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
 * La mida que toca ara, sabent la que hi havia (`current`):
 *
 * - si a la mida d'ara no hi cap, la més gran de les més petites que hi càpiga
 *   (o el mínim);
 * - si hi cap, es queda igual, tret que hi hagi lloc de sobres: llavors creix
 *   fins a la més gran que encara deixaria `margin` de marge.
 *
 * Sense mida anterior (taula acabada de muntar) es comença per la natural.
 */
export function stableScale(
  scales: readonly number[],
  current: number | null,
  fits: (scale: number) => boolean,
  margin: number = GROW_MARGIN,
): number {
  const smallest = scales[scales.length - 1];
  const now = current !== null && Number.isFinite(current)
    ? Math.min(scales[0], Math.max(smallest, current))
    : null;
  if (now === null) return largestFittingScale(scales, fits);

  if (!fits(now)) {
    // Cal encongir: el mínim imprescindible (i, al mínim, ja no es baixa més).
    const smaller = scales.filter((scale) => scale < now);
    return smaller.length > 0 ? largestFittingScale(smaller, fits) : smallest;
  }
  // Hi cap. Només creix si hi ha lloc de sobres.
  for (const scale of scales) {
    if (scale <= now) break;
    if (fits(scale + margin)) return scale;
  }
  return now;
}

/**
 * Marge d'un píxel: les mesures del navegador són enteres i arrodonir avall
 * faria encongir la taula per no res.
 */
const SLACK_PX = 1;

/**
 * Mentre es mesura, la partida porta aquesta classe i el CSS treu del flux els
 * avisos que van i venen (la pista, l'error, el botó de tornar la fitxa al
 * faristol i qualsevol `[data-efimer]`): així el feltre té l'alçada de sempre
 * i la mida no depèn de si ara n'hi ha cap a la vista. Es posa i es treu dins
 * del mateix efecte de disposició: el navegador no arriba a pintar-ho mai.
 */
export const MEASURING_CLASS = 'mesurant-taula';

/** Prova una mida a la taula de debò i diu si tot hi cap sense desplaçar-se. */
function fitsAt(board: HTMLElement, scale: number): boolean {
  board.style.setProperty('--densitat', String(scale));
  return (
    board.scrollHeight <= board.clientHeight + SLACK_PX &&
    board.scrollWidth <= board.clientWidth + SLACK_PX
  );
}

/**
 * Ajusta la mida de les fitxes a l'espai que hi ha i la deixa aplicada.
 * Retorna la mida triada (per a les proves).
 */
export function fitBoardTiles(board: HTMLElement): number {
  const raw = board.style.getPropertyValue('--densitat');
  const current = raw === '' ? null : Number(raw);
  const game = board.closest('.game') ?? board.parentElement;
  game?.classList.add(MEASURING_CLASS);
  let scale: number;
  try {
    scale = stableScale(TILE_SCALES, current, (candidate) => fitsAt(board, candidate));
  } finally {
    game?.classList.remove(MEASURING_CLASS);
  }
  board.style.setProperty('--densitat', String(scale));
  return scale;
}

export { GROW_MARGIN, MIN_SCALE, STEP };
