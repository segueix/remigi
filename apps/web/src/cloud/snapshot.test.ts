import { describe, expect, it } from 'vitest';
import { dayEntry } from './ranking';
import { buildSnapshot, parseSnapshot, snapshotHoursText, snapshotRanking } from './snapshot';

const row = (id: string, alias: string, won: boolean, moves: number, points: number, rivals?: number) => ({
  id,
  data: { alias, won, moves, points, ...(rivals === undefined ? {} : { rivals }), score: 0, streak: 0 },
});

describe('la fotografia de la classificació', () => {
  const results = [
    row('c', 'Laia', false, 20, 12),
    row('a', 'Anna', true, 12, 0, 80),
    row('b', 'Pere', true, 12, 0, 40),
  ];

  it('desa tots els resultats ordenats, i es llegeix igual', () => {
    const built = buildSnapshot(results, false);
    expect(built.count).toBe(3);
    const snap = parseSnapshot(JSON.parse(JSON.stringify(built)), 1000)!;
    expect(snap.rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(snap.final).toBe(false);
  });

  it('la teva fila: si ja hi ets, la de la fotografia; si has jugat després, provisional al seu lloc', () => {
    const snap = parseSnapshot(buildSnapshot(results, false), 0)!;
    const amb = snapshotRanking(snap, 'b', null);
    expect(amb.provisional).toBe(false);
    expect(amb.rows.find((r) => r.you)?.place).toBe(2);
    const mine = dayEntry({ day: '2026-11-22', won: true, moves: 10, points: 0, rivals: 5 }, 'Tu', 0);
    const nova = snapshotRanking(snap, 'z', mine);
    expect(nova.provisional).toBe(true);
    expect(nova.rows[0]).toMatchObject({ id: 'z', place: 1, you: true });
    expect(nova.rows).toHaveLength(4);
  });

  it('les hores, a Barcelona: 9, 15 i 22 a l’hivern; 10, 16 i 23 a l’estiu', () => {
    expect(snapshotHoursText(new Date(Date.UTC(2026, 11, 1)))).toBe('9, 15 i 22');
    expect(snapshotHoursText(new Date(Date.UTC(2026, 6, 1)))).toBe('10, 16 i 23');
  });

  it('descarta el que no té forma', () => {
    expect(parseSnapshot(null, 0)).toBeNull();
    expect(parseSnapshot({ rows: [{ i: 'x', a: 'X', w: 'sí' }] }, 0)?.rows).toEqual([]);
  });
});
