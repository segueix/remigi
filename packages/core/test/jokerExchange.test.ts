import { describe, expect, it } from 'vitest';
import { RulesError, applyMove } from '../src/core/game';
import { joker, makeState, t } from './helpers';

/**
 * L'intercanvi de joker (agafar un joker de la taula posant-hi la fitxa que
 * representava) no necessita cap regla pròpia al motor: surt sol de com està
 * plantejat el moviment de jugar, que valida la taula sencera resultant. Aquests
 * tests ho fixen perquè cap canvi futur no ho trenqui sense adonar-se'n.
 */
function expectRulesError(fn: () => unknown, code: string): void {
  try {
    fn();
    expect.fail(`s'esperava un RulesError amb codi ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(RulesError);
    expect((error as RulesError).code).toBe(code);
  }
}

describe('intercanvi de joker', () => {
  // A la taula, el joker fa de 6 vermell.
  const board = [[t('red', 5), joker('a'), t('red', 7)]];

  it('es pot recuperar posant-hi la fitxa de debò i jugant-lo el mateix torn', () => {
    const rack = [t('red', 6), t('blue', 5), t('black', 5)];
    const state = makeState({ racks: [rack, []], board, hasOpened: [true, true] });

    const next = applyMove(state, {
      type: 'play',
      board: [
        [t('red', 5), t('red', 6), t('red', 7)],
        [t('blue', 5), t('black', 5), joker('a')],
      ],
    });

    expect(next.players[0].rack).toHaveLength(0);
    expect(next.status).toBe('finished');
    // El joker segueix a la taula, en una jugada nova.
    expect(next.board.flat().map((tile) => tile.id)).toContain('joker-a');
  });

  it('no es pot quedar a la mà per a un altre torn', () => {
    const state = makeState({
      racks: [[t('red', 6)], []],
      board,
      hasOpened: [true, true],
    });
    expectRulesError(
      () => applyMove(state, { type: 'play', board: [[t('red', 5), t('red', 6), t('red', 7)]] }),
      'TILE_REMOVED',
    );
  });

  it('no deixa la jugada d’origen coixa en endur-se’n el joker', () => {
    // Es treu el joker i es posa en un grup, però l'escala es queda amb dues.
    const state = makeState({
      racks: [[t('blue', 9), t('black', 9)], []],
      board,
      hasOpened: [true, true],
    });
    expectRulesError(
      () =>
        applyMove(state, {
          type: 'play',
          board: [
            [t('red', 5), t('red', 7)],
            [t('blue', 9), t('black', 9), joker('a')],
          ],
        }),
      'INVALID_MELD',
    );
  });

  it('qui encara no ha obert no pot tocar el joker de la taula', () => {
    const rack = [t('red', 6), t('blue', 5), t('black', 5)];
    const state = makeState({ racks: [rack, []], board, hasOpened: [false, true] });
    expectRulesError(
      () =>
        applyMove(state, {
          type: 'play',
          board: [
            [t('red', 5), t('red', 6), t('red', 7)],
            [t('blue', 5), t('black', 5), joker('a')],
          ],
        }),
      'REARRANGE_BEFORE_OPENING',
    );
  });
});
