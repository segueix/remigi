import { describe, expect, it } from 'vitest';
import { decideAiMove } from '../src/ai/aiPlayer';
import { TOTAL_TILES } from '../src/core/constants';
import { applyMove, createGame } from '../src/core/game';
import { createRng } from '../src/core/random';
import type { GameState } from '../src/core/types';

function countTiles(state: GameState): number {
  return (
    state.bag.length +
    state.board.reduce((sum, meld) => sum + meld.length, 0) +
    state.players.reduce((sum, player) => sum + player.rack.length, 0)
  );
}

describe('partides senceres IA contra IA', () => {
  it.each([11, 22, 33])('la partida amb llavor %i acaba i conserva les 106 fitxes', (seed) => {
    let state = createGame({
      seed,
      players: [
        { name: 'Expert', kind: 'ai', aiLevel: 'expert' },
        { name: 'Mitjà', kind: 'ai', aiLevel: 'medium' },
        { name: 'Novell', kind: 'ai', aiLevel: 'rookie' },
      ],
    });
    const rng = createRng(seed + 1);
    while (state.status === 'playing' && state.turn <= 1000) {
      state = applyMove(state, decideAiMove(state, state.currentPlayer, rng));
      expect(countTiles(state)).toBe(TOTAL_TILES);
    }
    expect(state.status).toBe('finished');
    expect(state.winnerId).toBeDefined();
  });
});
