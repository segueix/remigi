import { describe, expect, it } from 'vitest';
import { dayEntry } from './ranking';
import { buildSnapshot, parseSnapshot, snapshotDue, snapshotHoursText, snapshotRanking } from './snapshot';

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

describe('quan toca refer la fotografia', () => {
  // Diumenge 22 de novembre de 2026: a Barcelona el dia comença a les 23 h UTC del 21.
  const dayStart = Date.UTC(2026, 10, 21, 23);
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 22, h, m);

  it('abans de la primera hora (8 h UTC) no en toca cap', () => {
    expect(snapshotDue(null, at(7, 59), dayStart)).toBe(false);
  });

  it('passada una hora, toca si no n’hi ha o la que hi ha és d’abans', () => {
    expect(snapshotDue(null, at(8, 17), dayStart)).toBe(true);
    expect(snapshotDue(at(7, 30), at(8, 17), dayStart)).toBe(true);
    expect(snapshotDue(at(8, 18), at(9, 17), dayStart)).toBe(false);
  });

  it('una execució que arriba tard fa la que ha quedat pendent', () => {
    // La de les 14 h no ha arribat: la de les 16 h la fa.
    expect(snapshotDue(at(8, 18), at(16, 17), dayStart)).toBe(true);
    expect(snapshotDue(at(16, 18), at(20, 59), dayStart)).toBe(false);
    expect(snapshotDue(at(16, 18), at(21, 47), dayStart)).toBe(true);
  });

  it('just passada la mitjanit de Barcelona, la de les 21 h UTC és del dia d’abans', () => {
    const nextStart = Date.UTC(2026, 10, 22, 23);
    expect(snapshotDue(null, Date.UTC(2026, 10, 22, 23, 30), nextStart)).toBe(false);
  });
});
