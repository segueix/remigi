import {
  INITIAL_MELD_POINTS,
  analyzeMeld,
  isValidMeld,
  type GameState,
  type Meld,
  type Move,
  type Tile,
} from '@rummikub/core';

/**
 * Còpia de treball del torn del jugador humà.
 *
 * Mentre dura el torn, l'usuari mou fitxes lliurement entre el seu faristol i la
 * taula, i la taula **pot quedar temporalment invàlida** (és normal: per partir
 * una escala en dues cal passar per estats intermedis). El motor no s'assabenta
 * de res fins que es prem «Acabar jugada»: aleshores rep la taula sencera i
 * decideix. Aquí no es dupliquen les regles del joc; només s'impedeix el que ni
 * tan sols té sentit intentar (endur-se cap al faristol una fitxa que ja era a
 * la taula abans del torn).
 */
export interface TurnDraft {
  board: Meld[];
  rack: Tile[];
  /** Fitxes que ja eren a la taula quan ha començat el torn: no es poden agafar. */
  locked: ReadonlySet<string>;
}

export type Destination =
  | { kind: 'rack' }
  | { kind: 'meld'; index: number }
  /** Una jugada nova, al final de la taula. */
  | { kind: 'new' };

export function startTurn(state: GameState, playerIndex: number): TurnDraft {
  return {
    board: state.board.map((meld) => [...meld]),
    rack: [...state.players[playerIndex].rack],
    locked: new Set(state.board.flat().map((tile) => tile.id)),
  };
}

/** Fitxes que el jugador ha posat a la taula durant aquest torn. */
export function playedTileIds(draft: TurnDraft): Set<string> {
  return new Set(
    draft.board
      .flat()
      .map((tile) => tile.id)
      .filter((id) => !draft.locked.has(id)),
  );
}

export function hasChanges(draft: TurnDraft): boolean {
  return playedTileIds(draft).size > 0;
}

/**
 * Insereix la fitxa a la posició que fa vàlida la jugada, si n'hi ha cap. Per
 * exemple, un 6 vermell entra sol a l'esquerra de [7,8,9] i a la dreta de
 * [3,4,5]. Si cap posició no la fa vàlida, va al final i l'usuari veurà la
 * jugada marcada com a incorrecta.
 */
export function insertSmart(meld: Meld, tile: Tile): Meld {
  for (let i = 0; i <= meld.length; i++) {
    const candidate = [...meld.slice(0, i), tile, ...meld.slice(i)];
    if (isValidMeld(candidate)) return candidate;
  }
  return [...meld, tile];
}

/**
 * Mou una fitxa a una destinació. Si la fitxa no es pot moure (no existeix, o
 * és de la taula i es vol tornar al faristol), retorna el mateix esborrany.
 */
export function moveTile(draft: TurnDraft, tileId: string, destination: Destination): TurnDraft {
  const tile = findTile(draft, tileId);
  if (!tile) return draft;
  if (destination.kind === 'rack' && draft.locked.has(tileId)) return draft;

  const rack = draft.rack.filter((t) => t.id !== tileId);
  // Es treu la fitxa de la taula i s'eliminen les jugades que quedin buides.
  // Compte: treure-la pot desplaçar els índexs de les jugades següents.
  const withoutTile = draft.board.map((meld) => meld.filter((t) => t.id !== tileId));
  const removedFrom = withoutTile.findIndex((meld, i) => meld.length !== draft.board[i].length);
  const emptied = removedFrom >= 0 && withoutTile[removedFrom].length === 0;
  const board = withoutTile.filter((meld) => meld.length > 0);

  if (destination.kind === 'rack') {
    return { ...draft, board, rack: [...rack, tile] };
  }
  if (destination.kind === 'new') {
    return { ...draft, board: [...board, [tile]], rack };
  }

  const target = adjustIndex(destination.index, removedFrom, emptied);
  if (target < 0 || target >= board.length) return draft;
  return {
    ...draft,
    board: board.map((meld, i) => (i === target ? insertSmart(meld, tile) : meld)),
    rack,
  };
}

/** L'índex de destinació es refereix a la taula d'abans de treure la fitxa. */
function adjustIndex(index: number, removedFrom: number, emptied: boolean): number {
  return emptied && removedFrom >= 0 && index > removedFrom ? index - 1 : index;
}

function findTile(draft: TurnDraft, tileId: string): Tile | undefined {
  return draft.rack.find((t) => t.id === tileId) ?? draft.board.flat().find((t) => t.id === tileId);
}

/** Índexs de les jugades que ara mateix no són vàlides. */
export function invalidMeldIndexes(draft: TurnDraft): Set<number> {
  const invalid = new Set<number>();
  draft.board.forEach((meld, index) => {
    if (!isValidMeld(meld)) invalid.add(index);
  });
  return invalid;
}

/**
 * Punts de les jugades noves, que és el que compta per a la sortida inicial de
 * 30 punts. Les jugades que contenen fitxes que ja eren a la taula no hi
 * sumen: el motor no deixa tocar la taula abans d'obrir.
 */
export function openingPoints(draft: TurnDraft): number {
  return draft.board
    .filter((meld) => meld.every((tile) => !draft.locked.has(tile.id)))
    .reduce((sum, meld) => sum + analyzeMeld(meld).points, 0);
}

export function missingOpeningPoints(draft: TurnDraft): number {
  return Math.max(0, INITIAL_MELD_POINTS - openingPoints(draft));
}

export function toMove(draft: TurnDraft): Move {
  return { type: 'play', board: draft.board };
}
