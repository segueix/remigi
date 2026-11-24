import { isDayKey } from '../dia/daily';
import { RANKING_SIZE, cleanAlias, placeRows, type DayEntry, type RankRow } from './ranking';

/**
 * Els rànquings setmanal i mensual de la partida del dia.
 *
 * El `score` del dia només serveix per ordenar els jugadors d'un mateix dia
 * (una derrota val més d'un milió, i 12 jugades d'un dilluns no valen el que
 * 12 d'un dissabte). Per això cada dia es converteix en **punts del dia**
 * segons la posició, i es sumen tots els dies del període:
 *
 *     punts = round(100 × (N − posició + 1) / N)
 *
 * amb N jugadors aquell dia (els empats comparteixen posició). El primer en
 * treu 100 i l'últim una mica més de 0, hi jugui la gent que hi jugui i sigui
 * el dia de la setmana que sigui. Desempat: més victòries i, després, menys
 * jugades sumades a les victòries.
 *
 * - Setmana: de dilluns a diumenge (setmana ISO, `AAAA-Www`), el cicle sencer
 *   de dificultats de la partida del dia.
 * - Mes: el mes natural (`AAAA-MM`).
 *
 * Es fa a partir de les classificacions finals de cada dia (les que tanca la
 * tasca programada l'endemà a partir de les 6 h): el període compta fins ahir
 * i s'actualitza cada matí. La tasca el desa en un sol document
 * (`setmana/{AAAA-Www}`, `mes/{AAAA-MM}`), que és l'única lectura de qui el
 * mira. Els jugadors automàtics hi compten com al rànquing del dia.
 */

export type PeriodKind = 'setmana' | 'mes';

export const PERIOD_KINDS: readonly PeriodKind[] = ['setmana', 'mes'];

/** Punts que dona el primer del dia. */
export const DAY_TOP_POINTS = 100;

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(day: string, n: number): string {
  const date = toDate(day);
  date.setUTCDate(date.getUTCDate() + n);
  return toKey(date);
}

/** El dilluns de la setmana d'un dia. */
export function weekStart(day: string): string {
  const monday0 = (toDate(day).getUTCDay() + 6) % 7;
  return addDays(day, -monday0);
}

/** La setmana ISO d'un dia: `2026-W48` (la setmana és de l'any del seu dijous). */
export function weekKey(day: string): string {
  const thursday = toDate(addDays(weekStart(day), 3));
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 / 7) + 1;
  return `${year}-W${pad(week)}`;
}

/** El mes d'un dia: `2026-11`. */
export function monthKey(day: string): string {
  return day.slice(0, 7);
}

export function periodKey(kind: PeriodKind, day: string): string {
  return kind === 'setmana' ? weekKey(day) : monthKey(day);
}

/** Tots els dies del període que conté `day`, en ordre. */
export function periodDays(kind: PeriodKind, day: string): string[] {
  if (kind === 'setmana') {
    const monday = weekStart(day);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  const [y, m] = day.split('-').map(Number);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

/** Els punts del dia de qui queda en la posició `place` d'entre `count` jugadors. */
export function dayPoints(place: number, count: number): number {
  if (count <= 0 || place < 1) return 0;
  return Math.round((DAY_TOP_POINTS * (count - Math.min(place, count) + 1)) / count);
}

export interface PeriodEntry {
  alias: string;
  /** Suma dels punts del dia. */
  points: number;
  /** Dies jugats del període. */
  days: number;
  /** Partides guanyades. */
  wins: number;
  /** Jugades sumades de les partides guanyades (el segon desempat: menys, millor). */
  moves: number;
}

/** La classificació final d'un dia, ja ordenada per `score` (de `parseSnapshot` o `dayRanking`). */
export interface DayStanding {
  day: string;
  rows: readonly { id: string; entry: DayEntry }[];
}

/** Un sol número per ordenar (menys, millor): punts, després victòries, després menys jugades. */
function periodOrder(entry: PeriodEntry): number {
  return -(entry.points * 1e9 + entry.wins * 1e6 - Math.min(entry.moves, 999_999));
}

/** Suma els dies (en qualsevol ordre) i ordena: la part pura del càlcul. */
export function sumPeriod(standings: readonly DayStanding[]): { id: string; entry: PeriodEntry }[] {
  const totals = new Map<string, PeriodEntry & { lastDay: string }>();
  for (const { day, rows } of standings) {
    const placed = placeRows([...rows].sort((a, b) => a.entry.score - b.entry.score), (e) => e.score, null);
    for (const row of placed) {
      const total = totals.get(row.id) ?? { alias: row.entry.alias, points: 0, days: 0, wins: 0, moves: 0, lastDay: '' };
      total.points += dayPoints(row.place, placed.length);
      total.days += 1;
      if (row.entry.won) {
        total.wins += 1;
        total.moves += row.entry.moves;
      }
      // L'àlies del dia més recent.
      if (day >= total.lastDay) {
        total.alias = row.entry.alias;
        total.lastDay = day;
      }
      totals.set(row.id, total);
    }
  }
  return [...totals.entries()]
    .map(([id, { lastDay: _lastDay, ...entry }]) => ({ id, entry }))
    .sort((a, b) => periodOrder(a.entry) - periodOrder(b.entry) || a.entry.alias.localeCompare(b.entry.alias, 'ca'));
}

/** Una fila del document, amb noms curts perquè ocupi poc. */
interface PeriodRow {
  i: string;
  a: string;
  s: number;
  d: number;
  w: number;
  m: number;
}

/**
 * El document del període (`setmana/{clau}` o `mes/{clau}`), amb els dies
 * tancats fins a `until` (inclòs). `final` quan `until` és l'últim dia.
 */
export function buildPeriod(kind: PeriodKind, until: string, standings: readonly DayStanding[]) {
  const days = periodDays(kind, until);
  const counted = standings.filter((s) => days.includes(s.day) && s.day <= until);
  const rows: PeriodRow[] = sumPeriod(counted).map(({ id, entry }) => ({
    i: id,
    a: entry.alias,
    s: entry.points,
    d: entry.days,
    w: entry.wins,
    m: entry.moves,
  }));
  return {
    kind,
    key: periodKey(kind, until),
    from: days[0],
    to: days[days.length - 1],
    until,
    final: until === days[days.length - 1],
    count: rows.length,
    rows,
  };
}

export interface PeriodSnapshot {
  kind: PeriodKind;
  from: string;
  to: string;
  /** L'últim dia que hi compta. */
  until: string;
  final: boolean;
  updatedAt: number;
  rows: { id: string; entry: PeriodEntry }[];
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** El document tal com ve de Firestore, comprovat (null si no té forma). */
export function parsePeriod(value: unknown, updatedAt: number | null): PeriodSnapshot | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== 'setmana' && v.kind !== 'mes') return null;
  if (!isDayKey(v.from) || !isDayKey(v.to) || !isDayKey(v.until) || !Array.isArray(v.rows)) return null;
  const rows = v.rows
    .map((row) => {
      if (typeof row !== 'object' || row === null) return null;
      const r = row as Partial<Record<keyof PeriodRow, unknown>>;
      if (typeof r.i !== 'string' || typeof r.a !== 'string') return null;
      if (!isCount(r.s) || !isCount(r.d) || !isCount(r.w) || !isCount(r.m)) return null;
      return { id: r.i, entry: { alias: cleanAlias(r.a), points: r.s, days: r.d, wins: r.w, moves: r.m } };
    })
    .filter((row): row is { id: string; entry: PeriodEntry } => row !== null)
    .sort((a, b) => periodOrder(a.entry) - periodOrder(b.entry));
  return { kind: v.kind, from: v.from, to: v.to, until: v.until, final: v.final === true, updatedAt: updatedAt ?? 0, rows };
}

/** El top (`size` files) i, si no hi ets, la teva fila a sota, separada. */
export function periodRanking(
  snapshot: PeriodSnapshot,
  you: string | null,
  size: number = RANKING_SIZE,
): RankRow<PeriodEntry>[] {
  const placed = placeRows(snapshot.rows, periodOrder, you);
  const top = placed.slice(0, size);
  const mine = placed.find((row) => row.you);
  if (mine && !top.includes(mine)) top.push({ ...mine, gap: true });
  return top;
}

const MONTHS = [
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
];

/** «de novembre», «d’abril». */
function ofMonth(month: number): string {
  const name = MONTHS[month - 1];
  return /^[aeiou]/.test(name) ? `d’${name}` : `de ${name}`;
}

/** «23 de novembre». */
export function dayText(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${ofMonth(m)}`;
}

/** «Setmana del 23 al 29 de novembre», «Novembre de 2026». */
export function periodTitle(kind: PeriodKind, from: string, to: string): string {
  if (kind === 'mes') {
    const [y, m] = from.split('-').map(Number);
    const name = MONTHS[m - 1];
    return `${name[0].toUpperCase()}${name.slice(1)} de ${y}`;
  }
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm] = to.split('-').map(Number);
  const start = fm === tm ? String(fd) : dayText(from);
  // «de l’1», «del 23».
  const del = fd === 1 || fd === 11 ? 'de l’' : 'del ';
  const al = Number(to.slice(8)) === 1 || Number(to.slice(8)) === 11 ? 'a l’' : 'al ';
  return `Setmana ${del}${start} ${al}${dayText(to)}`;
}
