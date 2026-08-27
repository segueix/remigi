import { chooseBestPlay, type GameState, type Meld, type Tile } from '@remigi/core';

/**
 * Els jeroglífics: cada cop que el jugador roba fitxa (o passa) havent-hi una
 * jugada que valia la pena, se'n guarda el moment sencer per resoldre'l
 * després sobre el mateix tauler. No qualsevol jugada: un jeroglífic ha de
 * tenir com a mínim dues fitxes per baixar i totes interrelacionades — posar
 * el quart color a un grup que ja hi és no és cap trencaclosques.
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
  /** La taula resultant de resoldre AQUEST jeroglífic (la resta, intacta). */
  solution: Meld[];
  /** Quantes fitxes del faristol baixava. */
  tilesUsed: number;
}

/** Un jeroglífic ha de baixar com a mínim aquestes fitxes. */
const MIN_PUZZLE_TILES = 2;

/**
 * Mira si robar ara és deixar escapar algun jeroglífic. La millor jugada es
 * busca sense limitacions (jokers, allargaments i reordenació: el mateix que
 * el nivell expert) i després es parteix en grups interrelacionats: jugades
 * de la solució que comparteixen fitxes d'una mateixa jugada de la taula
 * s'han de resoldre juntes (l'una desfà el que l'altra necessita); les que no
 * es toquen són trencaclosques independents. Els grups que baixen una sola
 * fitxa es descarten: això no és un jeroglífic, és un regal.
 *
 * Abans d'obrir no es parteix res: la sortida demana 30 punts entre totes les
 * jugades noves, així que totes s'aguanten entre elles.
 */
export function detectMissedChances(game: GameState, playerIndex: number): MissedChance[] {
  const best = chooseBestPlay(game, playerIndex, {
    allowJokers: true,
    allowExtensions: true,
    allowRearrange: true,
  });
  if (!best) return [];

  const player = game.players[playerIndex];
  const moment = {
    turn: game.turn,
    board: game.board,
    rack: player.rack,
    hasOpened: player.hasOpened,
  };

  if (!player.hasOpened) {
    return best.tilesUsed >= MIN_PUZZLE_TILES
      ? [{ ...moment, solution: best.board, tilesUsed: best.tilesUsed }]
      : [];
  }

  const boardIds = new Set(game.board.flat().map((tile) => tile.id));
  const puzzles: MissedChance[] = [];
  for (const component of solutionComponents(game.board, best.board)) {
    const rackTiles = component
      .flat()
      .filter((tile) => !boardIds.has(tile.id)).length;
    if (rackTiles < MIN_PUZZLE_TILES) continue;

    /*
     * La solució d'aquest jeroglífic: la taula d'aquell moment amb NOMÉS els
     * canvis del grup — les jugades que el grup consumeix se'n van, les seves
     * hi entren, i la resta es queda tal qual. Continua sent una taula sencera
     * legal, així que el motor la pot validar com qualsevol jugada.
     */
    const componentIds = new Set(component.flat().map((tile) => tile.id));
    const untouched = game.board.filter((meld) => !meld.some((tile) => componentIds.has(tile.id)));
    puzzles.push({
      ...moment,
      solution: [...untouched, ...component],
      tilesUsed: rackTiles,
    });
  }
  return puzzles;
}

/**
 * Parteix la taula proposada en grups de jugades interrelacionades: dues
 * jugades noves van juntes si comparteixen fitxes d'una mateixa jugada
 * original (desfer-la alimenta totes dues), i les jugades originals que la
 * proposta no toca no surten enlloc.
 */
function solutionComponents(before: Meld[], after: Meld[]): Meld[][] {
  /* De quina jugada original ve cada fitxa de la taula. */
  const sourceOf = new Map<string, number>();
  before.forEach((meld, index) => {
    for (const tile of meld) sourceOf.set(tile.id, index);
  });
  const beforeKeys = new Set(before.map(meldSetKey));

  /* Les jugades de la proposta que canvien alguna cosa. */
  const changed = after.filter((meld) => !beforeKeys.has(meldSetKey(meld)));

  /* Unió de grups: cada jugada original consumida enllaça les que en beuen. */
  const parent = changed.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  const bySource = new Map<number, number>();
  changed.forEach((meld, index) => {
    for (const tile of meld) {
      const source = sourceOf.get(tile.id);
      if (source === undefined) continue;
      const seen = bySource.get(source);
      if (seen === undefined) bySource.set(source, index);
      else parent[find(index)] = find(seen);
    }
  });

  const components = new Map<number, Meld[]>();
  changed.forEach((meld, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), meld]);
  });
  return [...components.values()];
}

function meldSetKey(meld: Meld): string {
  return meld
    .map((tile) => tile.id)
    .sort()
    .join('|');
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
