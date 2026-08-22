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
 * Una jugada que ja hi era i no ha canviat es queda amb l'autor que tenia; una
 * de nova, o una de modificada (que és una clau nova), passa a ser de qui acaba
 * de jugar. És justament el que es vol veure: el marc segueix l'últim que hi ha
 * posat les mans.
 *
 * Les jugades d'autor desconegut —les d'una partida represa, que es carrega
 * sense aquesta informació— es queden sense autor en comptes d'atribuir-se a
 * qui passava per allà.
 */
export function updateOwners(
  previous: MeldOwners,
  previousBoard: readonly Meld[],
  nextBoard: readonly Meld[],
  playerIndex: number,
): MeldOwners {
  const before = new Set(previousBoard.map(meldKey));
  const owners = new Map<string, number>();
  for (const meld of nextBoard) {
    const key = meldKey(meld);
    if (!before.has(key)) {
      owners.set(key, playerIndex);
      continue;
    }
    const kept = previous.get(key);
    if (kept !== undefined) owners.set(key, kept);
  }
  return owners;
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
 * Només en tenen els bots: les jugades de l'humà i les d'autor desconegut van
 * sense marc, que és el que demana el joc —si toques una jugada d'un bot, deixa
 * de ser seva i perd el color.
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
    return player && player.kind === 'ai' ? { slot, name: player.name } : null;
  });
}
