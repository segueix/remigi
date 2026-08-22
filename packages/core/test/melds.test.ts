import { describe, expect, it } from 'vitest';
import { analyzeMeld, isValidMeld, meldPoints } from '../src/core/melds';
import { joker, t } from './helpers';

describe('grups (mateix número, colors diferents)', () => {
  it('accepta un grup de 3 i un de 4', () => {
    expect(analyzeMeld([t('red', 5), t('blue', 5), t('black', 5)])).toMatchObject({
      valid: true,
      kind: 'group',
      points: 15,
    });
    expect(meldPoints([t('red', 5), t('blue', 5), t('black', 5), t('orange', 5)])).toBe(20);
  });

  it('rebutja colors repetits i mides fora de rang', () => {
    expect(isValidMeld([t('red', 5, 'a'), t('red', 5, 'b'), t('blue', 5)])).toBe(false);
    expect(isValidMeld([t('red', 5), t('blue', 5)])).toBe(false);
  });

  it('accepta jokers dins del grup', () => {
    expect(analyzeMeld([t('red', 9), t('blue', 9), joker('a'), t('orange', 9)])).toMatchObject({
      valid: true,
      kind: 'group',
      points: 36,
    });
  });
});

describe('escales (mateix color, números consecutius)', () => {
  it('accepta una escala simple i en compta els punts', () => {
    expect(analyzeMeld([t('red', 3), t('red', 4), t('red', 5)])).toMatchObject({
      valid: true,
      kind: 'run',
      points: 12,
    });
  });

  it('rebutja colors barrejats i salts de número', () => {
    expect(isValidMeld([t('red', 3), t('blue', 4), t('red', 5)])).toBe(false);
    expect(isValidMeld([t('red', 3), t('red', 5), t('red', 6)])).toBe(false);
  });

  it('el joker val el número de la posició on és', () => {
    expect(meldPoints([t('red', 4), joker('a'), t('red', 6)])).toBe(15);
    // Davant del 12 el joker fa d'11 i l'escala és vàlida...
    expect(isValidMeld([joker('a'), t('red', 12), t('red', 13)])).toBe(true);
    // ...però després del 13 faria de 14 i no ho és.
    expect(isValidMeld([t('red', 12), t('red', 13), joker('a')])).toBe(false);
  });

  it('una jugada ambigua es puntua amb la millor interpretació', () => {
    // [8, joker, joker] pot ser grup (24) o escala 8-9-10 (27): guanya l'escala.
    expect(meldPoints([t('red', 8), joker('a'), joker('b')])).toBe(27);
  });
});

describe('casos límit', () => {
  it('rebutja jugades de menys de 3 fitxes o només de jokers', () => {
    expect(analyzeMeld([t('red', 1), t('red', 2)]).valid).toBe(false);
    expect(analyzeMeld([]).valid).toBe(false);
  });
});
