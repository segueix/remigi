import { createGame, type GameState } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { botsAdaptThisTurn } from './botAdjustment';

function table(opened: boolean[]): GameState {
  const state = createGame({
    seed: 3,
    players: opened.map((_, i) =>
      i === 0
        ? { name: 'Jo', kind: 'human' as const }
        : { name: `Rival ${i}`, kind: 'ai' as const, aiLevel: 'expert' },
    ),
  });
  return { ...state, players: state.players.map((p, i) => ({ ...p, hasOpened: opened[i] })) };
}

describe('quan els bots s’ajusten a com et va', () => {
  it('a la lliga, mentre no has obert', () => {
    expect(botsAdaptThisTurn({ mode: 'lliga' }, table([false, false, false, false]))).toBe(true);
    // Que els rivals ja hagin obert no hi canvia res: compta el jugador.
    expect(botsAdaptThisTurn({ mode: 'lliga' }, table([false, true, true, true]))).toBe(true);
  });

  it('a la lliga, un cop has obert, els rivals tornen a la seva força', () => {
    expect(botsAdaptThisTurn({ mode: 'lliga' }, table([true, false, false, false]))).toBe(false);
    expect(botsAdaptThisTurn({ mode: 'lliga' }, table([true, true, true, true]))).toBe(false);
  });

  it('la casella «Ajusta la dificultat durant la partida» ho manté sempre', () => {
    const opened = table([true, true, true]);
    expect(botsAdaptThisTurn({ mode: 'lliga', adaptDuringGame: true }, opened)).toBe(true);
    expect(botsAdaptThisTurn({ mode: 'lliure', adaptDuringGame: true }, opened)).toBe(true);
    expect(botsAdaptThisTurn({ adaptDuringGame: true }, opened)).toBe(true);
  });

  it('fora de la lliga, no ajusta si no ho has demanat', () => {
    const unopened = table([false, false, false]);
    expect(botsAdaptThisTurn({ mode: 'lliure' }, unopened)).toBe(false);
    expect(botsAdaptThisTurn({ mode: 'repte' }, unopened)).toBe(false);
    // Partides desades velles, sense mode.
    expect(botsAdaptThisTurn({}, unopened)).toBe(false);
    expect(botsAdaptThisTurn({ adaptDuringGame: false }, unopened)).toBe(false);
  });

  it('sense cap humà a la taula, no hi ha res a ajustar', () => {
    const state = createGame({
      seed: 4,
      players: [
        { name: 'A', kind: 'ai', aiLevel: 'expert' },
        { name: 'B', kind: 'ai', aiLevel: 'expert' },
      ],
    });
    expect(botsAdaptThisTurn({ mode: 'lliga' }, state)).toBe(false);
  });
});
