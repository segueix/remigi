import {
  INITIAL_MELD_POINTS,
  analyzeMeld,
  isValidMeld,
  type GameState,
  type Meld,
  type Move,
  type Tile,
} from '@remigi/core';

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
  | {
      kind: 'rack';
      /**
       * Forat del faristol on deixar-la (0 = davant de tot). És **cosa de la
       * vista**: l'esborrany només mira quines fitxes tens a la mà, no en quin
       * ordre les tens escampades (vegeu `rackOrder.ts`), i per això aquí
       * s'ignora.
       */
      index?: number;
    }
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
  /*
   * Cap posició no fa la jugada vàlida. Si el que hi ha és material d'escala
   * (mateix color, valors sense repetir), s'endreça igualment per valor: una
   * escala a mig fer amb una o dues fitxes mai no pot ser «vàlida», però el 5
   * ha de quedar abans del 7 encara que el 6 arribi més tard.
   */
  return tidyRun([...meld, tile]) ?? [...meld, tile];
}

/**
 * Endreça material d'escala: números del mateix color ordenats per valor, amb
 * els jokers omplint els forats d'esquerra a dreta i els que sobren al final
 * (o al principi, si l'escala ja acaba en 13). Retorna null si allò no és
 * material d'escala (colors barrejats o valors repetits): llavors l'ordre no
 * vol dir res i no s'ha de tocar.
 */
function tidyRun(meld: Meld): Meld | null {
  const numbers = meld.filter((t): t is Tile & { kind: 'number' } => t.kind === 'number');
  const jokers = meld.filter((t) => t.kind === 'joker');
  if (numbers.length === 0) return null;
  if (!numbers.every((t) => t.color === numbers[0].color)) return null;
  const sorted = [...numbers].sort((a, b) => a.value - b.value);
  if (new Set(sorted.map((t) => t.value)).size !== sorted.length) return null;

  const pending = [...jokers];
  const arranged: Meld = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    let gap = sorted[i].value - sorted[i - 1].value - 1;
    while (gap > 0 && pending.length > 0) {
      arranged.push(pending.shift()!);
      gap--;
    }
    arranged.push(sorted[i]);
  }
  // Els jokers que sobren allarguen l'escala per on es pugui.
  const last = sorted[sorted.length - 1].value;
  while (pending.length > 0) {
    if (last + (arranged.length - arranged.indexOf(sorted[sorted.length - 1])) <= 13) {
      arranged.push(pending.shift()!);
    } else {
      arranged.unshift(pending.shift()!);
    }
  }
  return arranged;
}

/**
 * Mou una fitxa a una destinació. Si la fitxa no es pot moure (no existeix, o
 * és de la taula i es vol tornar al faristol), retorna el mateix esborrany.
 */
/**
 * Busca la millor jugada on una fitxa pot entrar amb un doble toc.
 *
 * Es prioritza una jugada que quedi completament vàlida. Si encara no hi ha
 * tres fitxes, també s'accepta una jugada parcial coherent (dos números
 * consecutius del mateix color, o dues fitxes del mateix número amb colors
 * diferents). Això permet construir 1-2-3 amb dobles tocs successius.
 */
export function findAutoMeldIndex(draft: TurnDraft, tileId: string): number | null {
  const tile = findTile(draft, tileId);
  if (!tile) return null;

  const sourceIndex = draft.board.findIndex((meld) => meld.some((candidate) => candidate.id === tileId));
  let partial: number | null = null;

  for (let index = 0; index < draft.board.length; index++) {
    if (index === sourceIndex) continue;
    const inserted = insertIntoMeld(draft.board[index], tile);
    // Una inserció que partiria l'escala en dues és una operació explícita, no
    // una destinació automàtica de doble toc.
    if (inserted.length !== 1) continue;
    if (isValidMeld(inserted[0])) return index;
    if (partial === null && isPlausibleOpenMeld(inserted[0])) partial = index;
  }
  return partial;
}

function isPlausibleOpenMeld(meld: Meld): boolean {
  if (meld.length === 0 || meld.length > 2) return false;
  const numbers = meld.filter(
    (tile): tile is Extract<Tile, { kind: 'number' }> => tile.kind === 'number',
  );
  if (numbers.length === 0) return false;
  if (numbers.length !== meld.length) return true; // un joker pot completar qualsevol dels dos patrons

  const sameValue = numbers.every((tile) => tile.value === numbers[0].value);
  const differentColors = new Set(numbers.map((tile) => tile.color)).size === numbers.length;
  if (sameValue && differentColors) return true;

  const sameColor = numbers.every((tile) => tile.color === numbers[0].color);
  const values = numbers.map((tile) => tile.value).sort((a, b) => a - b);
  return sameColor && new Set(values).size === values.length && values[values.length - 1] - values[0] === values.length - 1;
}

/**
 * Si es treu una fitxa de dins d'una escala, les dues bandes passen a ser dues
 * jugades independents. Així 1-2-3-4-5-6-7 menys el 4 es converteix en
 * 1-2-3 i 5-6-7, en lloc de quedar enganxat com 1-2-3-5-6-7.
 */
function removeFromMeld(meld: Meld, tileId: string): Meld[] {
  const tileIndex = meld.findIndex((tile) => tile.id === tileId);
  if (tileIndex < 0) return [meld];

  const info = analyzeMeld(meld);
  if (info.valid && info.kind === 'run' && tileIndex > 0 && tileIndex < meld.length - 1) {
    return [meld.slice(0, tileIndex), meld.slice(tileIndex + 1)];
  }

  const remaining = meld.filter((tile) => tile.id !== tileId);
  return remaining.length > 0 ? [remaining] : [];
}

/**
 * Afegir una còpia repetida al mig d'una escala la parteix en les dues
 * escales que defineixen les dues còpies. Ex.: 1-2-3-4-5 + un altre 3 dona
 * 1-2-3 i 3-4-5; 1-2-3 + un altre 2 dona 1-2 i 2-3.
 */
function insertIntoMeld(meld: Meld, tile: Tile): Meld[] {
  const info = analyzeMeld(meld);
  if (info.valid && info.kind === 'run' && tile.kind === 'number') {
    const allNumbersSameColor = meld.every(
      (candidate) => candidate.kind === 'number' && candidate.color === tile.color,
    );
    if (allNumbersSameColor) {
      const duplicateIndex = meld.findIndex(
        (candidate) =>
          candidate.kind === 'number' &&
          candidate.color === tile.color &&
          candidate.value === tile.value,
      );
      if (duplicateIndex > 0 && duplicateIndex < meld.length - 1) {
        return [
          meld.slice(0, duplicateIndex + 1),
          [tile, ...meld.slice(duplicateIndex + 1)],
        ];
      }
    }
  }
  return [insertSmart(meld, tile)];
}

/**
 * Mou una fitxa a una destinació. Si la fitxa no es pot moure (no existeix, o
 * és de la taula i es vol tornar al faristol), retorna el mateix esborrany.
 */
export function moveTile(draft: TurnDraft, tileId: string, destination: Destination): TurnDraft {
  const tile = findTile(draft, tileId);
  if (!tile) return draft;
  if (destination.kind === 'rack' && draft.locked.has(tileId)) return draft;

  const removedFrom = draft.board.findIndex((meld) => meld.some((candidate) => candidate.id === tileId));
  // Tornar a deixar una fitxa exactament a la mateixa jugada no ha de partir-la
  // ni reconstruir-la: és la mateixa operació.
  if (destination.kind === 'meld' && removedFrom === destination.index) return draft;

  const rack = draft.rack.filter((candidate) => candidate.id !== tileId);
  const replacements =
    removedFrom >= 0 ? removeFromMeld(draft.board[removedFrom], tileId) : [];
  const board =
    removedFrom >= 0
      ? draft.board.flatMap((meld, index) => (index === removedFrom ? replacements : [meld]))
      : [...draft.board];

  if (destination.kind === 'rack') {
    return { ...draft, board, rack: [...rack, tile] };
  }
  if (destination.kind === 'new') {
    return { ...draft, board: [...board, [tile]], rack };
  }

  const target = adjustIndex(destination.index, removedFrom, replacements.length);
  if (target < 0 || target >= board.length) return draft;
  const inserted = insertIntoMeld(board[target], tile);
  return {
    ...draft,
    board: [...board.slice(0, target), ...inserted, ...board.slice(target + 1)],
    rack,
  };
}

/**
 * L'índex de destinació es refereix a la taula d'abans de treure la fitxa.
 * La jugada d'origen pot desaparèixer (-1 posició), quedar igual o partir-se
 * en dues (+1 posició).
 */
function adjustIndex(index: number, removedFrom: number, replacementCount: number): number {
  if (removedFrom < 0 || index <= removedFrom) return index;
  return index + replacementCount - 1;
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
