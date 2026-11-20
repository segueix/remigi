import { describe, expect, it } from 'vitest';
import {
  MAX_ALIAS,
  cleanAlias,
  dayEntry,
  dayRanking,
  liveStreak,
  parseDayEntry,
  rankScore,
  streakRanking,
  type PlayerEntry,
} from './ranking';

describe('rànquing del dia', () => {
  it('les victòries van per jugades i sempre per davant de les derrotes', () => {
    expect(rankScore({ won: true, moves: 9, points: 0 })).toBe(9);
    expect(rankScore({ won: true, moves: 40, points: 0 })).toBeLessThan(rankScore({ won: false, moves: 5, points: 1 }));
    expect(rankScore({ won: false, moves: 20, points: 23 })).toBe(1023);
  });

  it('el que es desa porta l’àlies net i el score', () => {
    const entry = dayEntry({ day: '2026-11-20', won: true, moves: 12, points: 0 }, '  Anna   Puig  ', 3);
    expect(entry).toEqual({ alias: 'Anna Puig', won: true, moves: 12, points: 0, score: 12, streak: 3 });
  });

  it('l’àlies no passa del límit i mai no queda buit', () => {
    expect(cleanAlias('x'.repeat(40))).toHaveLength(MAX_ALIAS);
    expect(cleanAlias('   ')).toBe('Jugador');
  });

  it('ordena, comparteix posició als empats i marca la teva fila', () => {
    const rows = [
      { id: 'c', data: { alias: 'C', won: false, moves: 20, points: 12, score: 1012, streak: 0 } },
      { id: 'a', data: { alias: 'A', won: true, moves: 9, points: 0, score: 9, streak: 2 } },
      { id: 'b', data: { alias: 'B', won: true, moves: 9, points: 0, score: 9, streak: 1 } },
      { id: 'x', data: { alias: 'Trampós', won: 'sí' } },
    ];
    const ranking = dayRanking(rows, 'c');
    expect(ranking.map((r) => [r.id, r.place])).toEqual([
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ]);
    expect(ranking.find((r) => r.id === 'c')?.you).toBe(true);
  });

  it('descarta files sense forma', () => {
    expect(parseDayEntry(null)).toBeNull();
    expect(parseDayEntry({ alias: 'A', won: true, moves: -1, points: 0, score: 0, streak: 0 })).toBeNull();
  });
});

describe('rànquing de ratxes', () => {
  const player = (streak: number, lastDay: string): PlayerEntry => ({ alias: 'P', streak, bestStreak: streak, lastDay });

  it('una ratxa només és viva si ha jugat avui o ahir', () => {
    expect(liveStreak(player(4, '2026-11-20'), '2026-11-20')).toBe(4);
    expect(liveStreak(player(4, '2026-11-19'), '2026-11-20')).toBe(4);
    expect(liveStreak(player(4, '2026-11-18'), '2026-11-20')).toBe(0);
  });

  it('ordena de més a menys i treu les ratxes mortes', () => {
    const rows = [
      { id: 'a', data: player(3, '2026-11-20') },
      { id: 'b', data: player(9, '2026-11-10') },
      { id: 'c', data: player(5, '2026-11-19') },
    ];
    expect(streakRanking(rows, '2026-11-20', null).map((r) => [r.id, r.entry.streak, r.place])).toEqual([
      ['c', 5, 1],
      ['a', 3, 2],
    ]);
  });
});
