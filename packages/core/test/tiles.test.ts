import { describe, expect, it } from 'vitest';
import { COLORS, TOTAL_TILES } from '../src/core/constants';
import { createTileSet, isJoker, isNumberTile, shuffledBag } from '../src/core/tiles';

describe('joc de fitxes', () => {
  it('té 106 fitxes: 2 còpies de cada color i número, més 2 jokers', () => {
    const tiles = createTileSet();
    expect(TOTAL_TILES).toBe(106);
    expect(tiles).toHaveLength(106);
    expect(tiles.filter(isJoker)).toHaveLength(2);
    for (const color of COLORS) {
      expect(tiles.filter((tile) => isNumberTile(tile) && tile.color === color)).toHaveLength(26);
    }
  });

  it('no repeteix cap identificador', () => {
    const ids = createTileSet().map((tile) => tile.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('barreja de manera reproduïble segons la llavor', () => {
    const a = shuffledBag(7).map((tile) => tile.id);
    const b = shuffledBag(7).map((tile) => tile.id);
    const c = shuffledBag(8).map((tile) => tile.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(c).size).toBe(106);
  });
});
