import { describe, expect, it } from 'vitest';
import { secondsLeft, startingBudget } from './useTurnClock';

describe('els segons que queden del torn', () => {
  const start = 1_000_000;

  it('compta enrere fins a zero', () => {
    expect(secondsLeft(start + 30_000, start)).toBe(30);
    expect(secondsLeft(start + 30_000, start + 10_500)).toBe(20);
    expect(secondsLeft(start + 30_000, start + 30_000)).toBe(0);
  });

  it('arrodoneix cap amunt: mentre en quedi un bocí, encara queda un segon', () => {
    expect(secondsLeft(start + 30_000, start + 29_100)).toBe(1);
  });

  /*
   * Amb la pestanya de fons el navegador frena els temporitzadors: en tornar-hi
   * el temps s'ha acabat de debò, i el rellotge ho ha de dir de seguida en
   * comptes de continuar per on era.
   */
  it('amb el temps passat de llarg, zero (mai negatiu)', () => {
    expect(secondsLeft(start + 30_000, start + 120_000)).toBe(0);
  });
});

describe('el temps desat d’un torn deixat a mitges', () => {
  const saved = { key: '7:0', seconds: 60, leftMs: 41_500 };

  it('continua amb el que quedava si és el mateix torn i la mateixa durada', () => {
    expect(startingBudget(60, '7:0', saved)).toBe(41_500);
  });

  it('un altre torn o una altra durada comencen sencers', () => {
    expect(startingBudget(60, '9:0', saved)).toBe(60_000);
    expect(startingBudget(30, '7:0', saved)).toBe(30_000);
    expect(startingBudget(60, '7:0', null)).toBe(60_000);
  });

  it('mai més del torn sencer ni menys de zero', () => {
    expect(startingBudget(60, '7:0', { ...saved, leftMs: 999_999 })).toBe(60_000);
    expect(startingBudget(60, '7:0', { ...saved, leftMs: -5 })).toBe(0);
  });
});
