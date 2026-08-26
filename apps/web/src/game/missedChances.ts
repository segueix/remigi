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
