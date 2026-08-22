import { describe, expect, it } from 'vitest';
import { allBoardTiles, boardProblems, boardTileIds, isBoardValid } from '../src/core/board';
import { joker, t } from './helpers';

describe('validació de la taula', () => {
  it('una taula buida és vàlida', () => {
    expect(isBoardValid([])).toBe(true);
    expect(boardProblems([])).toEqual([]);
  });

  it('accepta una taula amb grups i escales correctes', () => {
    const board = [
      [t('red', 1), t('blue', 1), t('black', 1)],
      [t('orange', 5), t('orange', 6), joker('a')],
    ];
    expect(isBoardValid(board)).toBe(true);
  });

  it('assenyala quina jugada falla i per què', () => {
    const board = [
      [t('red', 1), t('blue', 1), t('black', 1)],
      [t('red', 4), t('red', 6), t('red', 8)],
      [t('blue', 2), t('blue', 3)],
    ];
    const problems = boardProblems(board);
    expect(problems.map((p) => p.meldIndex)).toEqual([1, 2]);
    expect(problems[0].reason).toBeTruthy();
    expect(isBoardValid(board)).toBe(false);
  });

  it('enumera les fitxes de la taula i els seus identificadors', () => {
    const board = [
      [t('red', 1), t('blue', 1), t('black', 1)],
      [t('orange', 5), t('orange', 6), t('orange', 7)],
    ];
    expect(allBoardTiles(board)).toHaveLength(6);
    expect(boardTileIds(board).has('orange-6-a')).toBe(true);
    expect(boardTileIds(board).has('orange-9-a')).toBe(false);
  });
});
