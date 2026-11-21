import { dayRanking, parseDayEntry, placeRows, type DayEntry, type RankRow } from './ranking';

/**
 * La fotografia de la classificació d'un dia (`classificacio/{dia}`): tots els
 * resultats en un sol document, que la tasca programada refà a les 9, 15 i
 * 22 h de Barcelona (la de les 9 h també tanca la del dia anterior). Qui
 * obre la classificació en llegeix només aquest document: una lectura,
 * hi hagi els jugadors que hi hagi.
 *
 * Mentre hi ha pocs jugadors (`LIVE_LIMIT`), la classificació es llegeix en
 * directe i sencera, que també surt barat.
 */

/** Fins a quants jugadors la classificació es llegeix en directe i sencera. */
export const LIVE_LIMIT = 50;

/**
 * Les hores (UTC) en què la tasca programada refà la fotografia: les 9, 15 i
 * 22 h de Barcelona a l'hivern, una hora més tard a l'estiu (GitHub programa
 * en UTC, i així no cal executar-la dos cops).
 */
export const SNAPSHOT_UTC_HOURS = [8, 14, 21] as const;

/** Aquestes hores a Barcelona, avui (o el dia donat): «9, 15 i 22». */
export function snapshotHoursText(now: Date = new Date()): string {
  const hours = SNAPSHOT_UTC_HOURS.map((h) => {
    const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 2));
    return snapshotHourText(at.getTime()).replace(' h', '');
  });
  return hours.slice(0, -1).join(', ') + ' i ' + hours[hours.length - 1];
}

/** Una fila de la fotografia, amb noms curts perquè el document ocupi poc. */
interface SnapshotRow {
  i: string;
  a: string;
  w: boolean;
  m: number;
  p: number;
  r: number;
  k: number;
}

export interface Snapshot {
  /** Quan es va fer (ms des de 1970). */
  updatedAt: number;
  /** És la classificació final del dia (feta l'endemà). */
  final: boolean;
  /** Tots els resultats, ordenats. */
  rows: { id: string; entry: DayEntry }[];
}

/** El document de la fotografia, a partir dels resultats del dia (els de Firestore). */
export function buildSnapshot(results: readonly { id: string; data: unknown }[], final: boolean) {
  const rows: SnapshotRow[] = dayRanking(results, null).map(({ id, entry }) => ({
    i: id,
    a: entry.alias,
    w: entry.won,
    m: entry.moves,
    p: entry.points,
    r: entry.rivals,
    k: entry.streak,
  }));
  return { final, count: rows.length, rows };
}

/** El document tal com ve de Firestore, comprovat (null si no té forma). */
export function parseSnapshot(value: unknown, updatedAt: number | null): Snapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as { final?: unknown; rows?: unknown };
  if (!Array.isArray(v.rows)) return null;
  const rows = v.rows
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null;
      const r = row as Partial<SnapshotRow>;
      const entry = parseDayEntry({ alias: r.a, won: r.w, moves: r.m, points: r.p, rivals: r.r, streak: r.k, score: 0 });
      return entry && typeof r.i === 'string' ? { id: r.i, entry } : null;
    })
    .filter((row): row is { id: string; entry: DayEntry } => row !== null)
    .sort((a, b) => a.entry.score - b.entry.score);
  return { updatedAt: updatedAt ?? 0, final: v.final === true, rows };
}

/**
 * La classificació de la fotografia, amb la teva fila: si ja hi ets, la de la
 * fotografia; si has jugat després, el teu resultat hi entra al lloc que li
 * toca, marcat com a provisional (sense cap lectura més).
 */
export function snapshotRanking(
  snapshot: Snapshot,
  you: string | null,
  mine: DayEntry | null,
): { rows: RankRow<DayEntry>[]; provisional: boolean } {
  const rows = [...snapshot.rows];
  let provisional = false;
  if (you && mine && !rows.some((row) => row.id === you)) {
    rows.push({ id: you, entry: mine });
    rows.sort((a, b) => a.entry.score - b.entry.score);
    provisional = true;
  }
  return { rows: placeRows(rows, (e) => e.score, you), provisional };
}

/** «15 h»: l'hora (Barcelona) en què es va fer la fotografia. */
export function snapshotHourText(updatedAt: number): string {
  try {
    const hour = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', hour: 'numeric', hourCycle: 'h23' }).format(
      new Date(updatedAt),
    );
    return `${Number(hour)} h`;
  } catch {
    return '';
  }
}
