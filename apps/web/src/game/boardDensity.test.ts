import { describe, expect, it } from 'vitest';
import { boardScale, countBoardTiles } from './boardDensity';

describe('quantes fitxes hi ha a la taula', () => {
  it('les compta de totes les jugades', () => {
    expect(countBoardTiles([])).toBe(0);
    expect(countBoardTiles([[1, 2, 3], [1, 2, 3, 4]].map((m) => m.map(String)))).toBe(7);
  });
});

describe('l’escala de les fitxes de la taula', () => {
  it('amb la taula poc plena, mida natural', () => {
    expect(boardScale(0)).toBe(1);
    expect(boardScale(22)).toBe(1);
  });

  it('a partir d’aquí, cada fitxa nova les empetiteix una mica', () => {
    expect(boardScale(23)).toBeCloseTo(0.99, 5);
    expect(boardScale(42)).toBeCloseTo(0.82, 5);
  });

  it('no baixa mai del mínim que encara es llegeix', () => {
    expect(boardScale(70)).toBeGreaterThanOrEqual(0.6);
    expect(boardScale(106)).toBe(0.6);
    expect(boardScale(1000)).toBe(0.6);
  });

  it('mai creix, per moltes fitxes que hi hagi', () => {
    let previous = boardScale(0);
    for (let tiles = 1; tiles <= 106; tiles++) {
      const scale = boardScale(tiles);
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });
});
