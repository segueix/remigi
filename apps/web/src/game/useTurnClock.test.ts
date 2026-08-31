import { describe, expect, it } from 'vitest';
import { secondsLeft } from './useTurnClock';

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
