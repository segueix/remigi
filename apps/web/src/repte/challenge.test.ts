import { describe, expect, it } from 'vitest';
import {
  abandonChallenge,
  addGame,
  bestFor,
  challengeTotal,
  describeChallenge,
  emptyChallengeState,
  isDone,
  normalizeChallengeConfig,
  parseChallengeState,
  startChallenge,
} from './challenge';

const CONFIG = { games: 3, level: 'expert' as const, opponents: 2 as const };

describe('el repte', () => {
  it('suma els punts de totes les partides i acaba quan toca', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 60, won: true });
    state = addGame(state, { points: -25, won: false });
    expect(isDone(state.current!)).toBe(false);
    expect(state.history).toHaveLength(0);
    state = addGame(state, { points: -10, won: false });
    expect(isDone(state.current!)).toBe(true);
    expect(challengeTotal(state.current!)).toBe(25);
    expect(state.history[0]).toMatchObject({ total: 25, wins: 1, config: CONFIG });
  });

  it('un cop acabat, no admet més partides ni torna a apuntar el rècord', () => {
    let state = startChallenge(emptyChallengeState(), { ...CONFIG, games: 1 });
    state = addGame(state, { points: 40, won: true });
    const again = addGame(state, { points: 99, won: true });
    expect(again).toBe(state);
    expect(again.history).toHaveLength(1);
  });

  it('recorda el millor resultat de cada configuració', () => {
    let state = emptyChallengeState();
    for (const points of [10, 80, -5]) {
      state = startChallenge(state, { ...CONFIG, games: 1 });
      state = addGame(state, { points, won: points > 0 });
    }
    state = startChallenge(state, { ...CONFIG, games: 1, level: 'rookie' });
    state = addGame(state, { points: 300, won: true });
    expect(bestFor(state.history, { ...CONFIG, games: 1 })?.total).toBe(80);
    expect(bestFor(state.history, CONFIG)).toBeNull();
  });

  it('es pot abandonar sense deixar rastre a l’historial', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 10, won: true });
    state = abandonChallenge(state);
    expect(state.current).toBeNull();
    expect(state.history).toHaveLength(0);
    expect(state.lastConfig).toEqual(CONFIG);
  });

  it('es desa i es recupera, i descarta el que no quadra', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 10, won: true });
    expect(parseChallengeState(JSON.stringify(state))).toEqual(state);
    expect(parseChallengeState('{malmès')).toEqual(emptyChallengeState());
    expect(normalizeChallengeConfig({ games: 0, level: 'déu' as never, opponents: 7 as never })).toEqual({
      games: 5,
      level: 'medium',
      opponents: 2,
    });
  });

  it('es descriu en curt', () => {
    expect(describeChallenge(CONFIG)).toBe('3 partides · Expert · 2 rivals');
  });
});
