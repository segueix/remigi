import type { GameState, JokerTile, Meld, NumberTile, Tile, TileColor } from '../src/core/types';

/** Fitxa numerada de proves amb id estable. */
export function t(color: TileColor, value: number, copy = 'a'): NumberTile {
  return { id: `${color}-${value}-${copy}`, kind: 'number', color, value };
}

export function joker(copy = 'a'): JokerTile {
  return { id: `joker-${copy}`, kind: 'joker' };
}

/** Estat de partida artificial per provar regles concretes. */
export function makeState(options: {
  racks: Tile[][];
  board?: Meld[];
  bag?: Tile[];
  hasOpened?: boolean[];
  currentPlayer?: number;
}): GameState {
  return {
    seed: 1,
    bag: options.bag ?? [],
    board: options.board ?? [],
    players: options.racks.map((rack, i) => ({
      id: `p${i + 1}`,
      name: `Jugador ${i + 1}`,
      kind: 'ai',
      rack,
      hasOpened: options.hasOpened?.[i] ?? false,
    })),
    currentPlayer: options.currentPlayer ?? 0,
    turn: 1,
    consecutivePasses: 0,
    status: 'playing',
  };
}
