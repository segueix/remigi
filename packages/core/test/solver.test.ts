import { describe, expect, it } from 'vitest';
import { chooseBestPlay, findRackMelds } from '../src/ai/solver';
import { joker, makeState, t } from './helpers';

describe('cerca de jugades a la mà', () => {
  it('troba grups i escales, també amb jokers omplint forats', () => {
    const rack = [t('red', 7), t('blue', 7), t('black', 7), t('orange', 2), t('orange', 4), joker('a')];
    const melds = findRackMelds(rack, true);
    const asIds = melds.map((c) => c.meld.map((x) => x.id).sort().join(','));
    // El grup de 7 sense joker...
    expect(asIds).toContain('black-7-a,blue-7-a,red-7-a');
    // ...i l'escala 2-[joker]-4 amb el joker fent de 3.
    expect(asIds).toContain('joker-a,orange-2-a,orange-4-a');
  });

  it('sense permís per a jokers, no els fa servir', () => {
    const rack = [t('orange', 2), t('orange', 4), joker('a')];
    expect(findRackMelds(rack, false)).toHaveLength(0);
  });
});

describe('millor jugada del torn', () => {
  it('sense 30 punts a la mà, no proposa sortida (ha de robar)', () => {
    const state = makeState({ racks: [[t('red', 5), t('blue', 5), t('black', 5)], []] });
    expect(chooseBestPlay(state, 0, { allowJokers: true, allowExtensions: true })).toBeNull();
  });

  it('proposa una sortida vàlida quan arriba als 30 punts', () => {
    const rack = [t('red', 11), t('blue', 11), t('black', 11), t('orange', 4)];
    const state = makeState({ racks: [rack, []] });
    const play = chooseBestPlay(state, 0, { allowJokers: true, allowExtensions: true });
    expect(play).not.toBeNull();
    expect(play!.points).toBeGreaterThanOrEqual(30);
    expect(play!.board).toHaveLength(1);
  });

  it('amb la taula oberta, també allarga jugades existents', () => {
    const board = [[t('red', 1), t('red', 2), t('red', 3)]];
    const state = makeState({ racks: [[t('red', 4), t('blue', 9)], []], board, hasOpened: [true, true] });
    const play = chooseBestPlay(state, 0, { allowJokers: true, allowExtensions: true });
    expect(play).not.toBeNull();
    expect(play!.tilesUsed).toBe(1);
    expect(play!.board[0].map((x) => x.id)).toEqual(['red-1-a', 'red-2-a', 'red-3-a', 'red-4-a']);
  });

  it('sense extensions permeses, un nivell baix no allarga la taula', () => {
    const board = [[t('red', 1), t('red', 2), t('red', 3)]];
    const state = makeState({ racks: [[t('red', 4), t('blue', 9)], []], board, hasOpened: [true, true] });
    expect(chooseBestPlay(state, 0, { allowJokers: true, allowExtensions: false })).toBeNull();
  });
});
