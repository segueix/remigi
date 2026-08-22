import { analyzeMeld } from './melds';
import type { Meld, Tile } from './types';

export interface BoardProblem {
  meldIndex: number;
  reason: string;
}

/** Retorna els problemes de la taula (jugades no vàlides), buit si tot és correcte. */
export function boardProblems(board: Meld[]): BoardProblem[] {
  const problems: BoardProblem[] = [];
  board.forEach((meld, meldIndex) => {
    const info = analyzeMeld(meld);
    if (!info.valid) problems.push({ meldIndex, reason: info.reason ?? 'jugada no vàlida' });
  });
  return problems;
}

export function isBoardValid(board: Meld[]): boolean {
  return boardProblems(board).length === 0;
}

export function allBoardTiles(board: Meld[]): Tile[] {
  return board.flat();
}

export function boardTileIds(board: Meld[]): Set<string> {
  return new Set(allBoardTiles(board).map((t) => t.id));
}
