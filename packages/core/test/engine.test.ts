import { describe, expect, it } from 'vitest';
import { decideAiMove } from '../src/ai/aiPlayer';
import { chooseBestPlay } from '../src/ai/solver';
import { applyMove, createGame } from '../src/core/game';
import { createRng } from '../src/core/random';
import type { GameState } from '../src/core/types';
import * as engineApi from '../src/engine';
import { createEngine } from '../src/engine/engine';
import { ENGINE_VERSION } from '../src/engine/version';
import { makeState, t } from './helpers';

/** Estat amb una jugada evident a la mà del jugador 0, que ja ha obert. */
function stateWithObviousPlay(aiLevel: string): GameState {
  const state = makeState({
    racks: [[t('red', 9), t('blue', 9), t('black', 9), t('orange', 2)], []],
    hasOpened: [true, true],
  });
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, aiLevel } : p)) };
}

/**
 * Estat que l'heurística voraç no sap resoldre: cal partir l'escala de la
 * taula per alliberar el 4 vermell i fer grup amb els dos 4 de la mà. Només
 * la reordenació de l'expert hi troba jugada (vegeu rearrange.test.ts).
 */
function stateNeedingRearrange(aiLevel: string): GameState {
  const state = makeState({
    racks: [[t('blue', 4), t('black', 4)], []],
    board: [
      [t('red', 1), t('red', 2), t('red', 3), t('red', 4), t('red', 5), t('red', 6), t('red', 7)],
    ],
    hasOpened: [true, true],
  });
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, aiLevel } : p)) };
}

const constantRng = (value: number) => () => value;

describe('el motor com a peça independent', () => {
  it('s’instancia sense cap dependència d’interfície i diu la seva versió', () => {
    const engine = createEngine();
    expect(engine.version).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('decideix una jugada d’una partida real i el motor de regles l’accepta', () => {
    const state = createGame({
      seed: 12,
      players: [
        { name: 'A', kind: 'ai', aiLevel: 'expert' },
        { name: 'B', kind: 'ai', aiLevel: 'medium' },
      ],
    });
    const decision = createEngine({ seed: 13 }).play(state);

    expect(decision.engineVersion).toBe(ENGINE_VERSION);
    expect(decision.level).toBe('expert');
    expect(decision.thinkingTimeMs).toBeGreaterThanOrEqual(0);
    expect(decision.nodes).toBeGreaterThanOrEqual(0);
    expect(() => applyMove(state, decision.move)).not.toThrow();
  });

  it('l’API pública del motor no arrossega res de la UI ni de Node', () => {
    const exported = Object.keys(engineApi);
    for (const name of ['createEngine', 'ENGINE_VERSION', 'createGame', 'applyMove', 'finalScores', 'DIFFICULTIES', 'createRng']) {
      expect(exported).toContain(name);
    }
    // Ni persistència, ni res que depengui de Node o del navegador.
    expect(exported).not.toContain('JsonFileStore');
    expect(exported).not.toContain('ProfileRepository');
  });
});

describe('determinisme', () => {
  it('mateixa llavor + mateix estat + mateixa configuració = mateixa jugada', () => {
    const state = stateWithObviousPlay('medium');
    const first = createEngine({ seed: 99 }).play(state);
    const second = createEngine({ seed: 99 }).play(state);
    expect(second.move).toEqual(first.move);
    expect(second.tilesPlayed).toBe(first.tilesPlayed);
  });

  it('una partida sencera es reprodueix idèntica amb la mateixa llavor', () => {
    const play = () => {
      let state = createGame({
        seed: 31,
        players: [
          { name: 'A', kind: 'ai', aiLevel: 'advanced' },
          { name: 'B', kind: 'ai', aiLevel: 'easy' },
        ],
      });
      const engine = createEngine({ seed: 32 });
      const moves: string[] = [];
      while (state.status === 'playing' && state.turn <= 1000) {
        const { move } = engine.play(state);
        moves.push(JSON.stringify(move));
        state = applyMove(state, move);
      }
      return { moves, status: state.status };
    };
    const first = play();
    const second = play();
    expect(first.status).toBe('finished');
    expect(second.moves).toEqual(first.moves);
  });

  it('produeix exactament el mateix que decideAiMove amb el mateix RNG', () => {
    // La garantia de la refactorització: el motor és una porta, no una IA nova.
    for (const level of ['rookie', 'easy', 'medium', 'advanced', 'expert']) {
      let state = createGame({
        seed: 77,
        players: [
          { name: 'A', kind: 'ai', aiLevel: level },
          { name: 'B', kind: 'ai', aiLevel: 'medium' },
        ],
      });
      const engine = createEngine({ seed: 78 });
      const rng = createRng(78);
      for (let turn = 0; turn < 30 && state.status === 'playing'; turn++) {
        const viaEngine = engine.play(state);
        const direct = decideAiMove(state, state.currentPlayer, rng);
        expect(viaEngine.move).toEqual(direct);
        state = applyMove(state, direct);
      }
    }
  });
});

describe('els nivells es comporten com abans', () => {
  it('el novell, quan s’equivoca, roba tot i tenir jugada', () => {
    const decision = createEngine({ rng: constantRng(0) }).play(stateWithObviousPlay('rookie'));
    expect(decision.move.type).toBe('draw');
    expect(decision.foundPlay).toBe(true); // l'error humà simulat, visible al diagnòstic
    expect(decision.tilesPlayed).toBe(0);
  });

  it('el novell juga la jugada que té quan no s’equivoca', () => {
    const decision = createEngine({ rng: constantRng(0.99) }).play(stateWithObviousPlay('rookie'));
    expect(decision.move.type).toBe('play');
    expect(decision.tilesPlayed).toBe(3);
  });

  it('l’expert no s’equivoca mai: sempre juga si pot', () => {
    for (const roll of [0, 0.5, 0.99]) {
      const decision = createEngine({ rng: constantRng(roll) }).play(stateWithObviousPlay('expert'));
      expect(decision.move.type).toBe('play');
    }
  });

  it('el nivell es pot demanar per opció sense tocar l’estat', () => {
    const state = stateWithObviousPlay('expert');
    const decision = createEngine({ rng: constantRng(0) }).play(state, { level: 'rookie' });
    expect(decision.level).toBe('rookie');
    expect(decision.move.type).toBe('draw'); // amb rng 0, el novell s'equivoca
  });
});

describe('diagnòstic de la cerca', () => {
  it('marca la reordenació quan és la que troba la jugada', () => {
    const decision = createEngine().play(stateNeedingRearrange('expert'));
    expect(decision.move.type).toBe('play');
    expect(decision.rearrangeUsed).toBe(true);
    expect(decision.nodes).toBeGreaterThan(0);
    expect(decision.searchLimited).toBe(false);
    expect(decision.tilesPlayed).toBe(2);
  });

  it('amb el sostre de nodes esgotat ho diu i cau a l’heurística voraç', () => {
    const decision = createEngine().play(stateNeedingRearrange('expert'), { maxNodes: 1 });
    expect(decision.searchLimited).toBe(true);
    expect(decision.rearrangeUsed).toBe(false);
    expect(decision.move.type).toBe('draw'); // la voraç no veu res en aquesta posició
  });

  it('els nivells sense reordenació no l’engeguen', () => {
    const decision = createEngine({ rng: constantRng(0.99) }).play(stateNeedingRearrange('medium'));
    expect(decision.nodes).toBe(0);
    expect(decision.rearrangeUsed).toBe(false);
  });
});

describe('anàlisi de posicions', () => {
  it('troba el mateix que el cercador a força màxima i és determinista', () => {
    const state = stateNeedingRearrange('rookie'); // el nivell del jugador no hi fa res
    const engine = createEngine();
    const analysis = engine.analyze(state);
    const direct = chooseBestPlay(state, 0, {
      allowJokers: true,
      allowExtensions: true,
      allowRearrange: true,
    });
    expect(analysis.bestPlay).toEqual(direct);
    expect(analysis.bestPlay?.tilesUsed).toBe(2);
    expect(analysis.level).toBe('expert');
    expect(engine.analyze(state).bestPlay).toEqual(analysis.bestPlay);
  });

  it('quan només queda robar ho diu sense inventar-se res', () => {
    const state = makeState({ racks: [[t('red', 2), t('blue', 7)], []], hasOpened: [true, true] });
    const analysis = createEngine().analyze(state);
    expect(analysis.bestPlay).toBeNull();
    expect(analysis.foundPlay).toBe(false);
  });

  it('pot limitar-se a les capacitats d’un nivell', () => {
    const analysis = createEngine().analyze(stateNeedingRearrange('rookie'), { level: 'medium' });
    expect(analysis.bestPlay).toBeNull(); // el mitjà no reordena: no veu la jugada
    expect(analysis.level).toBe('medium');
  });
});
