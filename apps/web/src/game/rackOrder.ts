import { isJoker, type Tile } from '@remigi/core';

/**
 * L'ordre del faristol és **cosa de la interfície**, no del motor: quines
 * fitxes tens és una regla del joc, però com les tens escampades davant teu
 * només ho veus tu. Per això aquí l'ordre és una llista d'identificadors que
 * viu a la pantalla de partida (i es desa amb la partida), i no dins de
 * l'estat del joc ni de l'esborrany del torn.
 *
 * Amb això, ordenar el faristol a mà (arrossegant una fitxa fins al seu lloc,
 * o tocant on la vols) sobreviu al canvi de torn, a robar i a reprendre la
 * partida: mentre la fitxa hi sigui, es queda on la vas deixar.
 */
export type RackOrder = readonly string[];

/** Ordre dels colors quan s'ordena de cop: el mateix de sempre a tot arreu. */
const COLOR_ORDER = ['red', 'blue', 'black', 'orange'];

/** Criteris d'ordenació automàtica que ofereix el faristol. */
export type SortBy = 'numero' | 'color';

/**
 * Les fitxes del faristol en l'ordre triat pel jugador. Les que no són a la
 * llista —la que acabes de robar, o una que torna de la taula— van al final,
 * conservant entre elles l'ordre que portaven: així una fitxa nova apareix
 * sempre a la dreta, que és on se la busca.
 */
export function orderRack(rack: readonly Tile[], order: RackOrder): Tile[] {
  const position = new Map(order.map((id, index) => [id, index]));
  /* Les desconegudes comparteixen posició, i l'ordenació estable les deixa com estaven. */
  const last = order.length + rack.length;
  return [...rack].sort(
    (a, b) => (position.get(a.id) ?? last) - (position.get(b.id) ?? last),
  );
}

/**
 * Deixa una fitxa al forat `gap` del faristol (0 = davant de tot, `n` = al
 * final), i retorna l'ordre nou sencer.
 *
 * Serveix tant per moure una fitxa que ja hi és com per col·locar-n'hi una que
 * torna de la taula: en tots dos casos es treu d'on fos i s'insereix al forat.
 * Quan la fitxa venia d'abans del forat, el forat es desplaça una posició
 * enrere en treure-la — si no, deixar-la «just a la dreta» no la mouria mai.
 */
export function placeInRack(
  rack: readonly Tile[],
  order: RackOrder,
  tileId: string,
  gap: number,
): string[] {
  const ids = orderRack(rack, order).map((tile) => tile.id);
  const from = ids.indexOf(tileId);
  const rest = ids.filter((id) => id !== tileId);
  const target = from >= 0 && from < gap ? gap - 1 : gap;
  const clamped = Math.max(0, Math.min(target, rest.length));
  return [...rest.slice(0, clamped), tileId, ...rest.slice(clamped)];
}

/**
 * Ordena el faristol de cop per número o per color. No és cap «mode»: escriu
 * l'ordre manual d'una vegada, i a partir d'aquí el jugador el continua
 * retocant fitxa a fitxa des d'on ha quedat.
 */
export function sortRack(rack: readonly Tile[], by: SortBy): string[] {
  return [...rack]
    .sort((a, b) => {
      // Els jokers sempre al final, que és on són més fàcils de trobar.
      if (isJoker(a) || isJoker(b)) return Number(isJoker(a)) - Number(isJoker(b));
      return by === 'numero'
        ? a.value - b.value || COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color)
        : COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) || a.value - b.value;
    })
    .map((tile) => tile.id);
}

/**
 * Neteja l'ordre que ve d'una partida desada: ha de ser una llista de cadenes
 * i prou. Si ve malmesa, el faristol es veu en l'ordre del motor i no passa
 * res més.
 */
export function validRackOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string');
}
