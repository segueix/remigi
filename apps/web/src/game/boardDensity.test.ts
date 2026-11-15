import { describe, expect, it } from 'vitest';
import { GROW_MARGIN, MIN_SCALE, largestFittingScale, stableScale, TILE_SCALES } from './boardDensity';

describe('els passos de mida de les fitxes', () => {
  it('van de la natural cap avall, sense passar del mínim que es llegeix bé', () => {
    expect(TILE_SCALES[0]).toBe(1);
    const mesPetita = TILE_SCALES[TILE_SCALES.length - 1];
    // Dos terços de la natural: ja no es baixa fins a la meitat.
    expect(mesPetita).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(mesPetita).toBeLessThanOrEqual(0.7);
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

describe('una mida estable durant la partida', () => {
  // Una taula on hi cap tot fins a una mida (`room`): com més plena, més petita.
  const taula = (room: number) => (scale: number) => scale <= room + 1e-9;

  it('en començar, la natural si hi cap', () => {
    expect(stableScale(TILE_SCALES, null, taula(1))).toBe(1);
    expect(stableScale(TILE_SCALES, null, taula(0.8))).toBe(0.79);
  });

  it('si ja no hi cap, s’encongeix el mínim imprescindible', () => {
    expect(stableScale(TILE_SCALES, 0.85, taula(0.8))).toBe(0.79);
  });

  it('no torna a créixer per un pèl de lloc: moure una fitxa no fa ballar la mida', () => {
    // A 0,79 hi cap, i a 0,82 també (just): no val la pena tornar a créixer.
    expect(stableScale(TILE_SCALES, 0.79, taula(0.83))).toBe(0.79);
    // Ni tan sols si el pas següent hi cabria, però no amb el marge de sobres.
    expect(stableScale(TILE_SCALES, 0.79, taula(0.82 + GROW_MARGIN - 0.01))).toBe(0.79);
  });

  it('creix quan hi ha lloc de sobres (la taula es buida)', () => {
    expect(stableScale(TILE_SCALES, 0.7, taula(1 + GROW_MARGIN))).toBe(1);
    // Amb lloc per a 0,85 amb marge, creix fins a 0,85 i no més.
    expect(stableScale(TILE_SCALES, 0.7, taula(0.85 + GROW_MARGIN))).toBe(0.85);
  });

  it('una seqüència de torns: la mida només baixa a poc a poc, sense pujades i baixades', () => {
    // La taula es va omplint, amb petites anades i vingudes (una fitxa que es
    // mou, una jugada desfeta): la mida no rebota.
    const espais = [1.2, 0.95, 0.97, 0.9, 0.93, 0.88, 0.86, 0.9, 0.84, 0.8, 0.83, 0.78, 0.8, 0.74, 0.76, 0.72];
    let mida: number | null = null;
    const mides: number[] = [];
    for (const espai of espais) {
      mida = stableScale(TILE_SCALES, mida, taula(espai));
      mides.push(mida);
    }
    for (let i = 1; i < mides.length; i++) expect(mides[i]).toBeLessThanOrEqual(mides[i - 1]);
    expect(Math.min(...mides)).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it('per molt plena que sigui, no baixa del mínim (llavors la taula es desplaça)', () => {
    expect(stableScale(TILE_SCALES, 0.7, () => false)).toBe(TILE_SCALES[TILE_SCALES.length - 1]);
    expect(stableScale(TILE_SCALES, TILE_SCALES[TILE_SCALES.length - 1], () => false)).toBe(
      TILE_SCALES[TILE_SCALES.length - 1],
    );
    // Una mida desada fora de la llista (d'una versió d'abans) es porta al marge.
    expect(stableScale(TILE_SCALES, 0.52, taula(0.6))).toBe(TILE_SCALES[TILE_SCALES.length - 1]);
  });
});
