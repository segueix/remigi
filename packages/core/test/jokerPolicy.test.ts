import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine/engine';
import { applyMove } from '../src/core/game';
import { analyzeMeld } from '../src/core/melds';
import type { Meld, Tile } from '../src/core/types';
import { joker, makeState, t } from './helpers';

const engine = () => createEngine({ rng: () => 0.99 });
const spare = () => t('black', 1);
function play(rack: Tile[], board: Meld[] = [], opened = true) {
  const state = makeState({ racks: [rack, [t('blue', 1)]], board, hasOpened: [opened, true] });
  const result = engine().play(state, { level: 'expert' });
  if (result.move.type === 'play') expect(() => applyMove(state, result.move)).not.toThrow();
  return { state, ...result };
}
function expectPolicy(board: Meld[]) {
  for (const meld of board) {
    const jokers = meld.filter(t => t.kind === 'joker').length;
    expect(jokers).toBeLessThanOrEqual(analyzeMeld(meld).kind === 'group' ? 1 : meld.length - jokers);
  }
}

describe('criteris de comodins dels rivals', () => {
  it.each([false, true])('evita 13 i dos comodins (obert: %s)', opened => {
    expect(play([t('red', 13), joker(), joker('b'), spare()], [], opened).move.type).toBe('draw');
  });
  it('amb dos 13 baixa un sol comodí', () => {
    const { move } = play([t('red', 13), t('orange', 13), joker(), joker('b'), spare()]);
    expect(move.type).toBe('play');
    if (move.type === 'play') {
      expectPolicy(move.board);
      expect(move.board.flat()).toHaveLength(3);
    }
  });
  it('evita una escala amb una sola fitxa numerada i dos comodins', () => {
    const { move } = play([t('red', 5), joker(), joker('b'), spare()]);
    expect(move.type).toBe('draw');
  });
  it('permet 5, comodí, 7, comodí', () => {
    const { move } = play([t('red', 5), t('red', 7), joker(), joker('b'), spare()]);
    expect(move.type).toBe('play');
    if (move.type === 'play') {
      expectPolicy(move.board);
      expect(move.board.flat()).toHaveLength(4);
    }
  });
  it.each([false, true])('pot guanyar amb un 13 i dos comodins (obert: %s)', opened => {
    const { state, move } = play([t('red', 13), joker(), joker('b')], [], opened);
    expect(move.type).toBe('play');
    expect(applyMove(state, move).winnerId).toBe('p1');
  });
  it('pot guanyar completant un grup amb el segon comodí', () => {
    const { state, move } = play([joker('b')], [[t('red', 13), t('blue', 13), joker()]]);
    expect(applyMove(state, move).winnerId).toBe('p1');
  });
  it('no afegeix un segon comodí a un grup si no acaba', () => {
    const { move } = play([joker('b'), spare()], [[t('red', 13), t('blue', 13), joker()]]);
    expect(move.type).toBe('draw');
  });
  it('no allarga el grup de dos comodins de la captura', () => {
    const { move } = play([t('orange', 13), spare()], [[t('red', 13), joker(), joker('b')]]);
    if (move.type === 'play') expectPolicy(move.board);
  });
  it('pot deixar intacta una jugada humana amb dos comodins i jugar en una altra', () => {
    const original = [t('red', 13), joker(), joker('b')];
    const { move } = play([t('blue', 5), spare()], [original, [t('blue', 2), t('blue', 3), t('blue', 4)]]);
    expect(move.type).toBe('play');
    if (move.type === 'play') expect(move.board[0]).toEqual(original);
  });
  it('pot reutilitzar els dos comodins de la taula en dues combinacions conformes', () => {
    const { move } = play([t('blue', 13), t('red', 7), t('blue', 7), spare()], [[t('red', 13), joker(), joker('b')]]);
    expect(move.type).toBe('play');
    if (move.type === 'play') { expectPolicy(move.board); expect(move.board.flat()).toHaveLength(6); }
  });
  it('les ajudes i les regles del jugador continuen admetent dos comodins', () => {
    const state = makeState({ racks: [[t('red', 13), joker(), joker('b'), spare()], []] });
    const { bestPlay } = engine().analyze(state);
    expect(bestPlay).not.toBeNull();
    expect(() => applyMove(state, { type: 'play', board: bestPlay!.board })).not.toThrow();
  });
});
