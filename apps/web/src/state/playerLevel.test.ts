import { STARTING_RATING } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { playerLevelKey, playerLevelLabel } from './playerLevel';

describe('el nivell amb nom del jugador', () => {
  it('és el nivell de bot més proper a la seva habilitat', () => {
    expect(playerLevelKey(700)).toBe('rookie');
    expect(playerLevelKey(1000)).toBe('easy');
    expect(playerLevelKey(1250)).toBe('medium');
    expect(playerLevelKey(1450)).toBe('advanced');
    expect(playerLevelKey(2100)).toBe('expert');
  });

  it('en cas d’empat exacte es queda el més fluix, com fa el motor', () => {
    // 1100 és a 100 punts de Fàcil (1000) i de Mitjà (1200).
    expect(playerLevelKey(1100)).toBe('easy');
  });

  it('qui comença de zero ja té un nom de nivell', () => {
    expect(typeof playerLevelLabel(STARTING_RATING)).toBe('string');
    expect(playerLevelLabel(STARTING_RATING).length).toBeGreaterThan(0);
  });
});
