import type { Meld } from '@remigi/core';

/**
 * Qui ha posat cada fitxa de la taula: només els bots, i només l'últim
 * moviment que ha tocat la taula.
 *
 * El motor no ho desa: per a ell una fitxa a la taula és una fitxa i prou, i
 * `packages/core` es manté pur. Però quines fitxes acaba de posar un bot és
 * informació útil per seguir la partida, així que es dedueix aquí comparant
 * la taula d'abans i la de després de cada moviment.
 *
 * La clau és **l'identificador de la fitxa**: el marc marca fitxes concretes,
 * no jugades senceres — un bot que allarga una escala només marca la fitxa
 * que hi ha afegit — i segueix la fitxa encara que la taula es reordeni o el
 * jugador la mogui durant el seu torn (continua sent la que el bot va posar).
 */
export type TileOwners = ReadonlyMap<string, number>;

/**
 * Recalcula les marques després d'un moviment del jugador `playerIndex`.
 *
 * Només es marca **l'últim moviment amb fitxes**: les que acaba de posar un
 * bot substitueixen totes les marques d'abans. Les jugades del jugador humà
 * (sempre al lloc 0) no es marquen: el seu moviment només neteja, que ell ja
 * sap què acaba de fer. Robar o passar no toca la taula i no esborra res.
 */
export function updateOwners(
  previous: TileOwners,
  previousBoard: readonly Meld[],
  nextBoard: readonly Meld[],
  playerIndex: number,
): TileOwners {
  const before = new Set(previousBoard.flat().map((tile) => tile.id));
  const added = nextBoard
    .flat()
    .map((tile) => tile.id)
    .filter((id) => !before.has(id));
  if (added.length === 0) return previous;
  if (playerIndex === 0) return new Map();
  return new Map(added.map((id) => [id, playerIndex]));
}
