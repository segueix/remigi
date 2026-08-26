import { chooseBestPlay, type GameState, type Meld, type Tile } from '@remigi/core';

/**
 * Oportunitats perdudes: cada cop que el jugador roba fitxa (o passa) havent-hi
 * una jugada possible, se'n guarda el moment sencer. Serveix per al repàs de
 * després de la partida: tornar a posar aquella taula i aquell faristol i
 * deixar que el jugador la busqui (el quiz), o ensenyar-la-hi.
 */
export interface MissedChance {
  /** Torn de la partida en què va passar. */
  turn: number;
  /** La taula tal com era en aquell moment. */
  board: Meld[];
  /** El faristol del jugador en aquell moment. */
  rack: Tile[];
  /** Si ja havia fet la sortida inicial: canvia què compta com a jugada. */
  hasOpened: boolean;
  /** La taula resultant de la millor jugada que es va trobar. */
  solution: Meld[];
  /** Quantes fitxes del faristol baixava aquella jugada. */
  tilesUsed: number;
}

/**
 * Mira si robar ara és perdre una oportunitat: la millor jugada possible amb la
 * mà del jugador, o null si robar és l'única sortida. Busca sense limitacions
 * (jokers, allargaments i reordenació de taula: el mateix que el nivell
 * expert), perquè el repàs no s'ha de deixar perdre res.
 */
export function detectMissedChance(game: GameState, playerIndex: number): MissedChance | null {
  const best = chooseBestPlay(game, playerIndex, {
    allowJokers: true,
    allowExtensions: true,
    allowRearrange: true,
  });
  if (!best) return null;

  const player = game.players[playerIndex];
  return {
    turn: game.turn,
    board: game.board,
    rack: player.rack,
    hasOpened: player.hasOpened,
    solution: best.board,
    tilesUsed: best.tilesUsed,
  };
}

/** Fitxes de la solució que venien del faristol: les que es podien baixar. */
export function solutionTileIds(miss: MissedChance): Set<string> {
  const before = new Set(miss.board.flat().map((tile) => tile.id));
  return new Set(
    miss.solution
      .flat()
      .map((tile) => tile.id)
      .filter((id) => !before.has(id)),
  );
}

/** Identitat d'una oportunitat: les fitxes del faristol que baixava. */
export function missKey(miss: MissedChance): string {
  return [...solutionTileIds(miss)].sort().join('|');
}

/**
 * Afegeix una oportunitat només si diu res de nou. Robar torn rere torn amb la
 * mateixa jugada a la mà apuntaria el mateix error cada vegada i el repàs es
 * faria pesat: es guarda el primer cop, i els torns següents només si la
 * jugada possible ja no és la mateixa (perquè s'hi ha sumat una altra errada,
 * o la taula ha canviat el que es podia fer).
 */
export function addMiss(current: MissedChance[], miss: MissedChance): MissedChance[] {
  const key = missKey(miss);
  return current.some((existing) => missKey(existing) === key) ? current : [...current, miss];
}

/**
 * De quina jugada és cada fitxa, amb la jugada identificada pel conjunt de
 * fitxes que la formen. Serveix per corregir un intent del quiz: una fitxa
 * està «ben col·locada» si a l'intent té exactament les mateixes companyes
 * que a la solució.
 */
export function meldKeysByTile(melds: Meld[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const meld of melds) {
    const key = meld
      .map((tile) => tile.id)
      .sort()
      .join('|');
    for (const tile of meld) keys.set(tile.id, key);
  }
  return keys;
}

/**
 * Fitxes de la taula que la jugada recol·locava. Una fitxa «no es mou» si la
 * seva jugada d'origen sobreviu sencera dins de la mateixa jugada nova (encara
 * que s'hi afegeixin fitxes); si la jugada d'on venia s'ha desfet o repartit,
 * totes les seves fitxes compten com a mogudes, que és el que es veu quan es
 * desfà un grup damunt la taula de debò.
 */
export function movedBoardTileIds(before: Meld[], after: Meld[]): Set<string> {
  const originalMeldOf = new Map<string, Set<string>>();
  for (const meld of before) {
    const ids = new Set(meld.map((tile) => tile.id));
    for (const id of ids) originalMeldOf.set(id, ids);
  }

  const moved = new Set<string>();
  for (const meld of after) {
    const ids = new Set(meld.map((tile) => tile.id));
    for (const id of ids) {
      const original = originalMeldOf.get(id);
      if (!original) continue; // venia del faristol, no de la taula
      if (![...original].every((companion) => ids.has(companion))) moved.add(id);
    }
  }
  return moved;
}

/**
 * Una partida d'un sol jugador i sense sac, congelada al moment de
 * l'oportunitat. El quiz hi valida els intents amb el mateix `applyMove` de
 * sempre: cap regla duplicada, els errors surten amb les paraules del motor.
 */
export function stateFromMiss(miss: MissedChance, playerName: string): GameState {
  return {
    seed: 0,
    bag: [],
    board: miss.board.map((meld) => [...meld]),
    players: [
      { id: 'quiz', name: playerName, kind: 'human', rack: [...miss.rack], hasOpened: miss.hasOpened },
    ],
    currentPlayer: 0,
    turn: miss.turn,
    consecutivePasses: 0,
    status: 'playing',
  };
}

/**
 * Les oportunitats que tenen forma d'oportunitat; la resta es descarta sense
 * fer soroll. Com amb els autors de les jugades (savedGame.ts): és informació
 * de repàs, i si ve malmesa val més perdre-la que no pas la partida.
 */
export function validMisses(value: unknown): MissedChance[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MissedChance => {
    if (typeof item !== 'object' || item === null) return false;
    const miss = item as Partial<MissedChance>;
    return (
      typeof miss.turn === 'number' &&
      typeof miss.hasOpened === 'boolean' &&
      typeof miss.tilesUsed === 'number' &&
      isMelds(miss.board) &&
      Array.isArray(miss.rack) &&
      isMelds(miss.solution)
    );
  });
}

function isMelds(value: unknown): value is Meld[] {
  return Array.isArray(value) && value.every((meld) => Array.isArray(meld));
}
