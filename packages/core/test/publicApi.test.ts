import { describe, expect, it } from 'vitest';
import * as api from '../src/index';

/**
 * L'índex és el contracte del paquet amb l'app web. Aquests tests protegeixen
 * dues regles del projecte (vegeu AGENT.md i docs/ARQUITECTURA.md): que hi hagi
 * tot el que la web necessita, i que no s'hi coli res que depengui de Node.
 */
describe('API pública de @rummikub/core', () => {
  it('exporta tot el que necessita una partida completa', () => {
    const exported = Object.keys(api);
    for (const name of [
      'createGame',
      'applyMove',
      'currentPlayer',
      'RulesError',
      'finalScores',
      'analyzeMeld',
      'isBoardValid',
      'createTileSet',
      'decideAiMove',
      'chooseBestPlay',
      'DIFFICULTIES',
      'suggestOpponents',
      'createProfile',
      'recordGame',
      'ProfileRepository',
      'MemoryStore',
    ]) {
      expect(exported).toContain(name);
    }
  });

  it('no exporta res que depengui de Node, perquè la web no ho arrossegui', () => {
    expect(Object.keys(api)).not.toContain('JsonFileStore');
  });

  it('deixa jugar una partida sencera només amb el que exporta l’índex', () => {
    let state = api.createGame({
      seed: 5,
      players: [
        { name: 'Tu', kind: 'human' },
        { name: 'Bot', kind: 'ai', aiLevel: 'medium' },
      ],
    });
    while (state.status === 'playing' && state.turn <= 500) {
      state = api.applyMove(state, api.decideAiMove(state, state.currentPlayer));
    }
    expect(state.status).toBe('finished');
    expect(api.finalScores(state)).toHaveLength(2);
  });
});
