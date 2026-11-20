import { applyMove, createEngine } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { turnSeed } from './daily';
import {
  MAX_OPENING_TURN,
  candidateSeed,
  computeDailyPlan,
  dailyDifficulty,
  dailyGame,
  openingTurn,
  weekdayOf,
} from './plan';

describe('la dificultat segons el dia de la setmana', () => {
  it('va del dilluns suau al dissabte avançat; el diumenge, taula de quatre', () => {
    expect(weekdayOf('2026-11-23')).toBe(1); // dilluns
    expect(dailyDifficulty('2026-11-23')).toMatchObject({ dayName: 'Dilluns', opponents: 2, rating: 1000 });
    expect(dailyDifficulty('2026-11-28')).toMatchObject({ dayName: 'Dissabte', opponents: 2, rating: 1400 });
    expect(dailyDifficulty('2026-11-29')).toMatchObject({ dayName: 'Diumenge', opponents: 3 });
    // Mai Expert.
    for (let d = 23; d <= 29; d++) expect(dailyDifficulty(`2026-11-${d}`).rating).toBeLessThan(1600);
  });

  it('la barreja 0 és la de sempre i les altres són diferents', () => {
    expect(candidateSeed('2026-11-23', 0)).not.toBe(candidateSeed('2026-11-23', 1));
  });
});

describe('sempre es pot obrir', () => {
  it('cada dia d’una setmana es tria una barreja amb sortida a temps, i és la mateixa a tot arreu', () => {
    const started = Date.now();
    for (let d = 23; d <= 29; d++) {
      const day = `2026-11-${d}`;
      const plan = computeDailyPlan(day);
      expect(plan.openingTurn).not.toBeNull();
      expect(plan.openingTurn!).toBeLessThanOrEqual(MAX_OPENING_TURN);
      expect(computeDailyPlan(day).seed).toBe(plan.seed);
    }
    // Una setmana sencera en pocs segons: un dia, una fracció.
    expect(Date.now() - started).toBeLessThan(20_000);
  }, 30_000);

  it('a la partida de debò, robant fins aquell torn, la sortida hi és', () => {
    const plan = computeDailyPlan('2026-11-28');
    let state = dailyGame(plan.seed, plan.difficulty);
    const analyst = createEngine();
    let turns = 0;
    for (;;) {
      if (state.currentPlayer === 0) {
        turns++;
        if (turns === plan.openingTurn) break;
        state = applyMove(state, { type: 'draw' });
      } else {
        const move = createEngine({ seed: turnSeed(plan.seed, state.turn) }).play(state, {
          playerIndex: state.currentPlayer,
          rating: plan.difficulty.rating,
          rubberBanding: false,
        }).move;
        state = applyMove(state, move);
      }
    }
    expect(analyst.analyze(state, { playerIndex: 0 }).bestPlay).not.toBeNull();
  }, 30_000);

  it('hi ha barreges en què no es pot obrir a temps (per això se’n proven unes quantes)', () => {
    const difficulty = dailyDifficulty('2026-11-28');
    const turns = Array.from({ length: 30 }, (_, k) => openingTurn(candidateSeed('2026-11-28', k), difficulty));
    expect(turns.some((t) => t === null || t > 1)).toBe(true);
  }, 60_000);
});
