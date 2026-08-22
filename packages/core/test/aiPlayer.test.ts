import { describe, expect, it } from 'vitest';
import { aiParamsForPlayer, decideAiMove } from '../src/ai/aiPlayer';
import type { GameState } from '../src/core/types';
import { makeState, t } from './helpers';

/** Estat amb una jugada evident a la mà del jugador 0, que ja ha obert. */
function stateWithObviousPlay(aiLevel: string): GameState {
  const state = makeState({
    racks: [[t('red', 9), t('blue', 9), t('black', 9), t('orange', 2)], []],
    hasOpened: [true, true],
  });
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, aiLevel } : p)) };
}

/** RNG fals: sempre retorna el mateix valor, per controlar els errors "humans". */
const constantRng = (value: number) => () => value;

describe('paràmetres de la IA', () => {
  it('agafa el nivell del jugador i cau al nivell per defecte si no en té', () => {
    expect(aiParamsForPlayer(stateWithObviousPlay('rookie'), 0).key).toBe('rookie');
    const noLevel = makeState({ racks: [[], []] });
    expect(aiParamsForPlayer(noLevel, 0).key).toBe('medium');
  });
});

describe('decisió de moviment', () => {
  it('juga la jugada que té quan no s’equivoca', () => {
    const move = decideAiMove(stateWithObviousPlay('rookie'), 0, constantRng(0.99));
    expect(move.type).toBe('play');
  });

  it('el nivell novell, quan s’equivoca, roba tot i tenir jugada', () => {
    expect(decideAiMove(stateWithObviousPlay('rookie'), 0, constantRng(0)).type).toBe('draw');
  });

  it('l’expert no s’equivoca mai: sempre juga si pot', () => {
    for (const roll of [0, 0.5, 0.99]) {
      expect(decideAiMove(stateWithObviousPlay('expert'), 0, constantRng(roll)).type).toBe('play');
    }
  });

  it('roba quan no té cap jugada possible', () => {
    const state = makeState({ racks: [[t('red', 2), t('blue', 7)], []], hasOpened: [true, true] });
    expect(decideAiMove(state, 0, constantRng(0.99)).type).toBe('draw');
  });

  it('sense haver obert, no juga si no arriba als 30 punts', () => {
    const state = makeState({ racks: [[t('red', 5), t('blue', 5), t('black', 5)], []] });
    expect(decideAiMove(state, 0, constantRng(0.99)).type).toBe('draw');
  });
});
