import { describe, expect, it } from 'vitest';
import { DEFAULT_TURN_SECONDS, readTurnSeconds } from './useTurnSeconds';

describe('el temps per torn desat', () => {
  it('sense res desat, el d’entrada', () => {
    expect(readTurnSeconds(null)).toBe(DEFAULT_TURN_SECONDS);
  });

  it('les durades del menú', () => {
    expect(readTurnSeconds('30')).toBe(30);
    expect(readTurnSeconds('60')).toBe(60);
    expect(readTurnSeconds('120')).toBe(120);
  });

  it('«cap» vol dir sense límit', () => {
    expect(readTurnSeconds('cap')).toBeNull();
  });

  it('una durada raonable que no és del menú es respecta', () => {
    expect(readTurnSeconds('45')).toBe(45);
  });

  it('el que no té sentit cau al valor per defecte', () => {
    expect(readTurnSeconds('0')).toBe(DEFAULT_TURN_SECONDS);
    expect(readTurnSeconds('-30')).toBe(DEFAULT_TURN_SECONDS);
    expect(readTurnSeconds('99999')).toBe(DEFAULT_TURN_SECONDS);
    expect(readTurnSeconds('30.5')).toBe(DEFAULT_TURN_SECONDS);
    expect(readTurnSeconds('molta estona')).toBe(DEFAULT_TURN_SECONDS);
    expect(readTurnSeconds('')).toBe(DEFAULT_TURN_SECONDS);
  });
});
