import { describe, expect, it } from 'vitest';
import { applyMove } from '../src/core/game';
import { finalScores, rackPoints, tilePoints } from '../src/core/scoring';
import { joker, makeState, t } from './helpers';

describe('punts de les fitxes pendents', () => {
  it('una fitxa numerada val el seu número i el joker en penalitza 30', () => {
    expect(tilePoints(t('red', 7))).toBe(7);
    expect(tilePoints(joker('a'))).toBe(30);
  });

  it('una mà buida no penalitza', () => {
    expect(rackPoints([])).toBe(0);
    expect(rackPoints([t('red', 13), t('blue', 2), joker('a')])).toBe(45);
  });
});

describe('puntuació final', () => {
  it('en una victòria neta, els punts de la taula sumen zero', () => {
    const state = makeState({
      racks: [[], [t('red', 4)], [t('blue', 6), joker('a')]],
      hasOpened: [true, true, true],
    });
    const finished = { ...state, status: 'finished' as const, winnerId: 'p1' };
    const scores = finalScores(finished);
    expect(scores.map((s) => s.points)).toEqual([40, -4, -36]);
    expect(scores.reduce((sum, s) => sum + s.points, 0)).toBe(0);
  });

  it('en una partida bloquejada, el guanyador no es penalitza les fitxes pròpies', () => {
    // Sac buit i tothom passa: guanya qui té menys punts pendents (p2, amb 3).
    const state = makeState({ racks: [[t('red', 9)], [t('blue', 3)]], hasOpened: [true, true] });
    const blocked = applyMove(applyMove(state, { type: 'draw' }), { type: 'draw' });
    expect(blocked.status).toBe('finished');
    expect(blocked.winnerId).toBe('p2');
    // p2 cobra els 9 punts de p1; els seus 3 propis no li resten.
    expect(finalScores(blocked)).toEqual([
      { playerId: 'p1', name: 'Jugador 1', points: -9 },
      { playerId: 'p2', name: 'Jugador 2', points: 9 },
    ]);
  });

  /**
   * Invariant del marcador: el que perden uns és exactament el que guanya
   * l'altre, tant en victòria neta com en bloqueig. Sense això, encadenar
   * rondes aniria acumulant un desquadrament.
   */
  it('la puntuació sempre suma zero, guanyi qui guanyi i com sigui', () => {
    const racks = [
      [[], [t('red', 4)], [joker('a')]],
      [[t('red', 1)], [t('blue', 12), t('black', 8)], []],
      [[t('red', 9)], [t('blue', 3)], [t('black', 5), joker('b')]],
    ];
    for (const rack of racks) {
      for (const winner of ['p1', 'p2', 'p3']) {
        const state = { ...makeState({ racks: rack }), status: 'finished' as const, winnerId: winner };
        expect(finalScores(state).reduce((sum, s) => sum + s.points, 0)).toBe(0);
      }
    }
  });
});
