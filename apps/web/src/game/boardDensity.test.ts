import { describe, expect, it } from 'vitest';
import { largestFittingScale, TILE_SCALES } from './boardDensity';

describe('els passos de mida de les fitxes', () => {
  it('van de la natural cap avall, sense passar del mínim llegible', () => {
    expect(TILE_SCALES[0]).toBe(1);
    expect(TILE_SCALES[TILE_SCALES.length - 1]).toBeCloseTo(0.61, 2);
    expect(TILE_SCALES.every((scale, i) => i === 0 || scale < TILE_SCALES[i - 1])).toBe(true);
  });

  it('cada pas és petit: encongir no ha de saltar a la vista', () => {
    for (let i = 1; i < TILE_SCALES.length; i++) {
      expect(TILE_SCALES[i - 1] - TILE_SCALES[i]).toBeLessThanOrEqual(0.031);
    }
  });
});

describe('quina mida hi cap', () => {
  it('amb espai de sobres, la natural: no s’encongeix res', () => {
    const provades: number[] = [];
    const escala = largestFittingScale(TILE_SCALES, (scale) => {
      provades.push(scale);
      return true;
    });
    expect(escala).toBe(1);
    // I no s'ha provat res més: la primera que hi cap ja val.
    expect(provades).toEqual([1]);
  });

  it('encongeix just un pas si amb un n’hi ha prou', () => {
    // La taula no dona per a la mida natural, però sí per a la següent.
    const escala = largestFittingScale(TILE_SCALES, (scale) => scale <= TILE_SCALES[1]);
    expect(escala).toBe(TILE_SCALES[1]);
  });

  it('amb la taula plena de gom a gom, la mínima (i la taula ja es desplaça)', () => {
    const escala = largestFittingScale(TILE_SCALES, () => false);
    expect(escala).toBe(TILE_SCALES[TILE_SCALES.length - 1]);
  });

  it('torna a créixer quan la taula es buida', () => {
    // Mateixa taula, dos moments: plena (només hi cap la petita) i buida.
    const plena = largestFittingScale(TILE_SCALES, (scale) => scale <= 0.7);
    const buida = largestFittingScale(TILE_SCALES, () => true);
    expect(plena).toBeLessThan(buida);
    expect(buida).toBe(1);
  });
});
