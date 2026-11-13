import { createProfile } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { normalizeFreePlay, parseFreePlay, prefsFromSetup, setupFromPrefs } from './freePlay';

describe('les preferències del joc lliure', () => {
  it('es dedueixen de la partida: rivals fixats', () => {
    const prefs = prefsFromSetup({ playerName: 'Anna', opponents: ['expert', 'expert', 'expert'], auto: false });
    expect(prefs).toEqual({ count: 3, level: 'expert', adaptDuringGame: false });
  });

  it('es dedueixen de la partida: automàtic', () => {
    const prefs = prefsFromSetup({ playerName: 'Anna', opponents: ['easy'], auto: true, adaptDuringGame: true });
    expect(prefs).toEqual({ count: 1, level: 'auto', adaptDuringGame: true });
  });

  it('la partida nova conserva els rivals fixats tal qual', () => {
    const profile = createProfile('local', 'Anna');
    const setup = setupFromPrefs({ count: 3, level: 'advanced', adaptDuringGame: false }, profile);
    expect(setup.opponents).toEqual(['advanced', 'advanced', 'advanced']);
    expect(setup.auto).toBe(false);
    expect(setup.mode).toBe('lliure');
  });

  it('en automàtic, la força surt de l’habilitat on la va deixar l’última partida', () => {
    const profile = { ...createProfile('local', 'Anna'), rating: 1340, adaptiveCalibrating: false };
    const setup = setupFromPrefs({ count: 2, level: 'auto', adaptDuringGame: false }, profile);
    expect(setup.opponentRatings).toEqual([1340, 1340]);
    expect(setup.auto).toBe(true);
  });

  it('descarta valors desats que no tenen sentit', () => {
    expect(parseFreePlay('{"count":7,"level":"déu"}')).toEqual({ count: 2, level: 'auto', adaptDuringGame: false });
    expect(parseFreePlay('no')).toBeNull();
    expect(normalizeFreePlay({ count: 1, level: 'rookie' }).level).toBe('rookie');
  });
});
