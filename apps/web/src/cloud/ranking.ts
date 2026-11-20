import { isDayKey, previousDay, type DailyResult } from '../dia/daily';

/**
 * Els rànquings de la partida del dia, a Firestore. Aquí només hi ha la part
 * pura (què es desa, com s'ordena i com es valida el que torna); la connexió
 * és a `firebase.ts`.
 *
 * - `dia/{AAAA-MM-DD}/resultats/{uid}`: el resultat de cada jugador aquell
 *   dia. Es crea un sol cop i no es pot canviar (`firestore.rules`).
 * - `jugadors/{uid}`: l'àlies i la ratxa de cada jugador, per al rànquing de
 *   ratxes.
 *
 * Al rànquing només hi surt l'àlies (el nom del jugador a Remigi), mai el nom
 * ni el correu del compte de Google.
 */

/** Màxim de caràcters de l'àlies (el mateix límit hi ha a les regles). */
export const MAX_ALIAS = 24;

/** Quantes files porta cada rànquing. */
export const RANKING_SIZE = 50;

/**
 * Un sol número per ordenar el rànquing del dia (menys, millor): les
 * victòries per jugades (sempre per sota de 1000) i, després, les derrotes
 * per punts a la mà. Així Firestore ordena per un sol camp i no cal cap índex.
 */
export function rankScore(result: Pick<DailyResult, 'won' | 'moves' | 'points'>): number {
  return result.won ? Math.min(result.moves, 999) : 1000 + result.points;
}

export function cleanAlias(name: string): string {
  const alias = name.replace(/\s+/g, ' ').trim().slice(0, MAX_ALIAS);
  return alias || 'Jugador';
}

export interface DayEntry {
  alias: string;
  won: boolean;
  moves: number;
  points: number;
  score: number;
  /** La ratxa que portava en acabar la partida. */
  streak: number;
}

export interface PlayerEntry {
  alias: string;
  streak: number;
  bestStreak: number;
  /** Últim dia que va jugar la partida del dia. */
  lastDay: string;
}

/** Què es desa d'un resultat del dia. */
export function dayEntry(result: DailyResult, alias: string, streak: number): DayEntry {
  return {
    alias: cleanAlias(alias),
    won: result.won,
    moves: result.moves,
    points: result.points,
    score: rankScore(result),
    streak,
  };
}

const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** Una fila del rànquing del dia tal com ve de Firestore (o null si no té forma). */
export function parseDayEntry(value: unknown): DayEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.alias !== 'string' || typeof v.won !== 'boolean') return null;
  if (!isCount(v.moves, 999) || !isCount(v.points, 2000) || !isCount(v.score, 3000) || !isCount(v.streak, 100_000)) {
    return null;
  }
  return { alias: cleanAlias(v.alias), won: v.won, moves: v.moves, points: v.points, score: v.score, streak: v.streak };
}

export function parsePlayerEntry(value: unknown): PlayerEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.alias !== 'string' || !isDayKey(v.lastDay)) return null;
  if (!isCount(v.streak, 100_000) || !isCount(v.bestStreak, 100_000)) return null;
  return { alias: cleanAlias(v.alias), streak: v.streak, bestStreak: v.bestStreak, lastDay: v.lastDay };
}

/**
 * La ratxa que encara és viva avui: la de qui ha jugat avui o ahir. Qui fa
 * més dies que no juga, l'ha perduda encara que no hagi tornat a desar-la.
 */
export function liveStreak(entry: PlayerEntry, today: string): number {
  return entry.lastDay === today || entry.lastDay === previousDay(today) ? entry.streak : 0;
}

export interface RankRow<T> {
  id: string;
  place: number;
  entry: T;
  you: boolean;
}

/** Posa la posició (els empats comparteixen posició) i marca la teva fila. */
export function placeRows<T>(
  rows: readonly { id: string; entry: T }[],
  key: (entry: T) => number,
  you: string | null,
): RankRow<T>[] {
  const out: RankRow<T>[] = [];
  rows.forEach(({ id, entry }, i) => {
    const prev = out[i - 1];
    const place = prev && key(prev.entry) === key(entry) ? prev.place : i + 1;
    out.push({ id, place, entry, you: id === you });
  });
  return out;
}

/** El rànquing del dia: per `score`, de menys a més. */
export function dayRanking(rows: readonly { id: string; data: unknown }[], you: string | null): RankRow<DayEntry>[] {
  const parsed = rows
    .map(({ id, data }) => ({ id, entry: parseDayEntry(data) }))
    .filter((row): row is { id: string; entry: DayEntry } => row.entry !== null)
    .sort((a, b) => a.entry.score - b.entry.score);
  return placeRows(parsed, (e) => e.score, you);
}

/** El rànquing de ratxes vives, de més a menys (sense les ratxes a zero). */
export function streakRanking(
  rows: readonly { id: string; data: unknown }[],
  today: string,
  you: string | null,
): RankRow<PlayerEntry>[] {
  const parsed = rows
    .map(({ id, data }) => ({ id, entry: parsePlayerEntry(data) }))
    .filter((row): row is { id: string; entry: PlayerEntry } => row.entry !== null)
    .map(({ id, entry }) => ({ id, entry: { ...entry, streak: liveStreak(entry, today) } }))
    .filter(({ entry }) => entry.streak > 0)
    .sort((a, b) => b.entry.streak - a.entry.streak);
  return placeRows(parsed, (e) => -e.streak, you);
}
