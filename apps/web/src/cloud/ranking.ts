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

/**
 * Quantes files porta cada rànquing: el top 10 (i, a sota, la teva posició si
 * no hi ets). Cada fila és una lectura de Firestore.
 */
export const RANKING_SIZE = 10;

/** El desempat es compta fins aquí (amb més punts als rivals ja no cal distingir). */
export const MAX_RIVAL_POINTS = 999;

/**
 * Un sol número per ordenar el rànquing del dia (menys, millor), perquè
 * Firestore ordeni per un sol camp i no calgui cap índex:
 *
 * - victòria: `jugades × 1000 + (999 − punts dels rivals)`: primer menys
 *   jugades i, amb les mateixes, qui deixa els rivals amb més punts a la mà;
 * - derrota: `1.000.000 + punts a la mà × 1000 + jugades`: sempre per sota de
 *   qualsevol victòria, primer menys punts i després menys jugades.
 */
export function rankScore(result: Pick<DailyResult, 'won' | 'moves' | 'points' | 'rivals'>): number {
  const moves = Math.min(result.moves, 999);
  if (result.won) return moves * 1000 + (MAX_RIVAL_POINTS - Math.min(result.rivals ?? 0, MAX_RIVAL_POINTS));
  return 1_000_000 + Math.min(result.points, 2000) * 1000 + moves;
}

/** La puntuació d'abans del desempat (per a les regles antigues de Firestore). */
export function legacyScore(result: Pick<DailyResult, 'won' | 'moves' | 'points'>): number {
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
  /** Punts que els quedaven als rivals (el desempat; 0 als resultats d'abans). */
  rivals: number;
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
    rivals: Math.min(result.rivals ?? 0, MAX_RIVAL_POINTS),
    score: rankScore(result),
    streak,
  };
}

/** El mateix resultat amb el format d'abans del desempat (sense `rivals`). */
export function legacyDayEntry(entry: DayEntry): Omit<DayEntry, 'rivals'> {
  const { rivals: _rivals, ...rest } = entry;
  return { ...rest, score: legacyScore(entry) };
}

const isCount = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** Una fila del rànquing del dia tal com ve de Firestore (o null si no té forma). */
export function parseDayEntry(value: unknown): DayEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.alias !== 'string' || typeof v.won !== 'boolean') return null;
  if (!isCount(v.moves, 999) || !isCount(v.points, 2000) || !isCount(v.streak, 100_000)) return null;
  // Els resultats d'abans del desempat no porten `rivals`: hi compten com a 0.
  const rivals = isCount(v.rivals, MAX_RIVAL_POINTS) ? v.rivals : 0;
  const entry = { won: v.won, moves: v.moves, points: v.points, rivals };
  // La puntuació es torna a calcular aquí: així els dos formats s'ordenen igual.
  return { alias: cleanAlias(v.alias), ...entry, score: rankScore(entry), streak: v.streak };
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
  /** La teva fila afegida sota el top (no hi eres): va separada. */
  gap?: boolean;
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
