import type { Meld, PlayerState } from '@rummikub/core';

/**
 * Qui ha tocat cada jugada de la taula per últim cop.
 *
 * El motor no ho desa: per a ell una jugada són tres fitxes vàlides i prou, i
 * `packages/core` es manté pur. Però qui les hi ha posat és informació útil per
 * seguir la partida, així que es dedueix aquí comparant la taula d'abans i la
 * de després de cada moviment.
 *
 * La clau és **la jugada mateixa** —els identificadors de les seves fitxes,
 * ordenats— i no la posició: la taula es reordena sencera a cada jugada, i una
 * jugada que no ha canviat ha de conservar el seu autor encara que hagi canviat
 * de lloc. Com que cada fitxa té un identificador únic, dues jugades no poden
 * compartir clau mai.
 */
export type MeldOwners = ReadonlyMap<string, number>;

/** Identitat d'una jugada: les seves fitxes, sense importar-ne l'ordre. */
export function meldKey(meld: Meld): string {
  return meld
    .map((tile) => tile.id)
    .sort()
    .join(' ');
}

/**
 * Recalcula els autors després d'un moviment del jugador `playerIndex`.
 *
 * Només es marca **l'últim moviment**: les jugades noves o modificades (que
 * són claus noves) passen a ser de qui acaba de jugar, i totes les marques
 * anteriors s'esborren. Així el marc respon a la pregunta que importa —«què
 * ha canviat des que no miro?»— en comptes d'anar acumulant colors per tota
 * la taula.
 *
 * Un moviment que no toca la taula (robar o passar) no esborra res: l'últim
 * moviment amb fitxes continua sent el d'abans, i el seu marc es queda.
 */
export function updateOwners(
  previous: MeldOwners,
  previousBoard: readonly Meld[],
  nextBoard: readonly Meld[],
  playerIndex: number,
): MeldOwners {
  const before = new Set(previousBoard.map(meldKey));
  const changed = nextBoard.filter((meld) => !before.has(meldKey(meld)));
  if (changed.length === 0) return previous;
  return new Map(changed.map((meld) => [meldKey(meld), playerIndex]));
}

/** Bot autor d'una jugada: el número que li dona color. */
export interface MeldAuthor {
  /** Índex del jugador, que també és el número de bot (l'humà és sempre el 0). */
  slot: number;
  name: string;
}

/**
 * Autor de cada jugada de la taula, alineat per posició i llest per pintar.
 *
 * En tenen els bots i també el jugador humà (les jugades que acabes de baixar
 * es marquen amb el teu color); les d'autor desconegut van sense marc. Tocar
 * una jugada durant el torn li canvia la clau, així que perd el marc a
 * l'instant, com sempre.
 */
export function meldAuthors(
  board: readonly Meld[],
  owners: MeldOwners,
  players: readonly PlayerState[],
): (MeldAuthor | null)[] {
  return board.map((meld) => {
    const slot = owners.get(meldKey(meld));
    if (slot === undefined) return null;
    const player = players[slot];
    return player ? { slot, name: player.name } : null;
  });
}
