import { describe, expect, it } from 'vitest';
import { dayRanking } from './ranking';
import {
  buildPeriod,
  dayPoints,
  monthKey,
  parsePeriod,
  periodDays,
  periodRanking,
  periodTitle,
  sumPeriod,
  weekKey,
  weekStart,
  type DayStanding,
} from './period';

const result = (id: string, alias: string, won: boolean, moves: number, points: number, rivals = 0) => ({
  id,
  data: { alias, won, moves, points, rivals, score: 0, streak: 0 },
});

/** La classificació d'un dia a partir de resultats crus, com la de la fotografia. */
const standing = (day: string, rows: ReturnType<typeof result>[]): DayStanding => ({
  day,
  rows: dayRanking(rows, null).map(({ id, entry }) => ({ id, entry })),
});

describe('setmanes i mesos', () => {
  it('la setmana va de dilluns a diumenge', () => {
    expect(weekStart('2026-11-24')).toBe('2026-11-23'); // dimarts → dilluns
    expect(weekStart('2026-11-23')).toBe('2026-11-23');
    expect(weekStart('2026-11-29')).toBe('2026-11-23'); // diumenge
    expect(periodDays('setmana', '2026-11-24')).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
  });

  it('la clau és la setmana ISO (de l’any del dijous)', () => {
    expect(weekKey('2026-11-24')).toBe('2026-W48');
    expect(weekKey('2026-01-01')).toBe('2026-W01'); // dijous
    expect(weekKey('2027-01-01')).toBe('2026-W53'); // divendres: setmana de 2026
    expect(weekKey('2024-12-30')).toBe('2025-W01'); // dilluns: setmana de 2025
  });

  it('el mes natural, amb els seus dies', () => {
    expect(monthKey('2026-11-24')).toBe('2026-11');
    expect(periodDays('mes', '2026-11-24')).toHaveLength(30);
    expect(periodDays('mes', '2028-02-10')).toHaveLength(29);
    expect(periodDays('mes', '2026-12-05').at(-1)).toBe('2026-12-31');
  });

  it('els títols', () => {
    expect(periodTitle('setmana', '2026-11-23', '2026-11-29')).toBe('Setmana del 23 al 29 de novembre');
    expect(periodTitle('setmana', '2026-11-30', '2026-12-06')).toBe('Setmana del 30 de novembre al 6 de desembre');
    expect(periodTitle('setmana', '2027-03-01', '2027-03-07')).toBe('Setmana de l’1 al 7 de març');
    expect(periodTitle('setmana', '2026-03-30', '2026-04-05')).toBe('Setmana del 30 de març al 5 d’abril');
    expect(periodTitle('mes', '2026-08-01', '2026-08-31')).toBe('Agost de 2026');
  });
});

describe('els punts del dia', () => {
  it('el primer en treu 100; l’últim, una mica més de 0', () => {
    expect(dayPoints(1, 40)).toBe(100);
    expect(dayPoints(4, 40)).toBe(93);
    expect(dayPoints(40, 40)).toBe(3);
    expect(dayPoints(1, 1)).toBe(100);
    expect(dayPoints(2, 2)).toBe(50);
  });

  it('els empats comparteixen posició i punts', () => {
    const totals = sumPeriod([
      standing('2026-11-23', [
        result('a', 'Anna', true, 12, 0, 40),
        result('b', 'Pere', true, 12, 0, 40),
        result('c', 'Laia', false, 20, 15),
      ]),
    ]);
    expect(totals.map((t) => [t.id, t.entry.points])).toEqual([
      ['a', 100],
      ['b', 100],
      ['c', 33],
    ]);
  });
});

describe('la classificació del període', () => {
  const week: DayStanding[] = [
    standing('2026-11-23', [
      result('a', 'Anna', true, 10, 0),
      result('b', 'Pere', true, 14, 0),
      result('c', 'Laia', false, 20, 8),
      result('d', 'Jordi', false, 20, 30),
    ]),
    standing('2026-11-24', [
      result('b', 'Pere Nou', true, 9, 0),
      result('a', 'Anna', false, 18, 4),
      result('c', 'Laia', false, 18, 12),
    ]),
  ];

  it('suma tots els dies jugats (qui no juga un dia, no en suma)', () => {
    const rows = sumPeriod(week);
    // Dia 1 (4 jugadors): 100, 75, 50, 25. Dia 2 (3 jugadors): 100, 67, 33.
    expect(rows.map((r) => [r.id, r.entry.points, r.entry.days])).toEqual([
      ['b', 175, 2],
      ['a', 167, 2],
      ['c', 83, 2],
      ['d', 25, 1],
    ]);
    // L'àlies, el del dia més recent.
    expect(rows[0].entry.alias).toBe('Pere Nou');
    expect(rows[0].entry).toMatchObject({ wins: 2, moves: 23 });
  });

  it('desempat: més victòries, després menys jugades a les victòries', () => {
    const rows = sumPeriod([
      standing('2026-11-23', [result('a', 'Anna', true, 10, 0), result('b', 'Pere', false, 20, 5)]),
      standing('2026-11-24', [result('b', 'Pere', true, 12, 0), result('a', 'Anna', false, 20, 5)]),
      standing('2026-11-25', [result('c', 'Laia', true, 15, 0), result('d', 'Jordi', false, 15, 5)]),
      standing('2026-11-26', [result('d', 'Jordi', true, 15, 0), result('c', 'Laia', true, 16, 0)]),
    ]);
    // Tots quatre: 150 punts. Laia, 2 victòries; Anna i Pere i Jordi, 1: Anna (10) > Pere (12) > Jordi (15).
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('el document: fins a quin dia compta, i és final l’últim dia', () => {
    const doc = buildPeriod('setmana', '2026-11-24', week);
    expect(doc).toMatchObject({ key: '2026-W48', from: '2026-11-23', to: '2026-11-29', until: '2026-11-24', final: false, count: 4 });
    // Un dia de fora del període (o posterior a `until`) no hi compta.
    const other = standing('2026-11-30', [result('d', 'Jordi', true, 5, 0)]);
    expect(buildPeriod('setmana', '2026-11-24', [...week, other]).rows).toEqual(doc.rows);
    expect(buildPeriod('setmana', '2026-11-29', week).final).toBe(true);
    expect(buildPeriod('mes', '2026-11-30', week)).toMatchObject({ key: '2026-11', final: true });
  });

  it('es llegeix igual que es desa, amb la teva fila a sota si no ets al top', () => {
    const doc = buildPeriod('setmana', '2026-11-24', week);
    const snap = parsePeriod(JSON.parse(JSON.stringify(doc)), 1000)!;
    expect(snap).toMatchObject({ kind: 'setmana', until: '2026-11-24', final: false, updatedAt: 1000 });
    expect(snap.rows.map((r) => r.id)).toEqual(['b', 'a', 'c', 'd']);

    const top2 = periodRanking(snap, 'd', 2);
    expect(top2.map((r) => [r.id, r.place, r.gap ?? false])).toEqual([
      ['b', 1, false],
      ['a', 2, false],
      ['d', 4, true],
    ]);
    expect(periodRanking(snap, 'a', 2).filter((r) => r.you)).toHaveLength(1);
    expect(periodRanking(snap, null, 2)).toHaveLength(2);
  });

  it('un document sense forma no es llegeix', () => {
    expect(parsePeriod(null, 0)).toBeNull();
    expect(parsePeriod({ kind: 'any', from: '2026-11-23', to: '2026-11-29', until: '2026-11-24', rows: [] }, 0)).toBeNull();
    const snap = parsePeriod(
      { kind: 'mes', from: '2026-11-01', to: '2026-11-30', until: '2026-11-02', rows: [{ i: 'x', a: 'X', s: -1, d: 1, w: 0, m: 0 }] },
      0,
    );
    expect(snap?.rows).toEqual([]);
  });
});
