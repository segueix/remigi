import { createRng, type DifficultyKey } from '@remigi/core';

/**
 * La partida del dia: cada dia, una partida igual per a tothom. Les catorze
 * fitxes que tens a la mà són les mateixes, i la resta del sac surt en el
 * mateix ordre (la llavor surt de la data). Els rivals, també: mateixos noms,
 * mateix nivell, i el motor els fa jugar amb una llavor per torn, de manera
 * que davant de la mateixa taula fan la mateixa jugada.
 *
 * Es juga un sol cop al dia. Si guanyes, compta en **quantes jugades** (els
 * teus torns: menys és millor); si no, **quants punts et queden a la mà**
 * (menys és millor). Qualsevol victòria val més que qualsevol derrota.
 * La ratxa són els dies seguits que has quedat número 1 de la taula.
 *
 * Pur i serialitzable, com el repte i la lliga.
 */

/** Rivals de la partida del dia: sempre dos (taula de tres), de nivell Mitjà. */
export const DAILY_OPPONENTS = 2;
export const DAILY_LEVEL: DifficultyKey = 'medium';

/** El primer dia de la partida del dia: el número 1. */
export const FIRST_DAY = '2026-11-20';

/** Els dies que es guarden a l'historial (un any llarg). */
export const MAX_RESULTS = 400;

export interface DailyResult {
  /** Dia de la partida (`AAAA-MM-DD`, hora local). */
  day: string;
  /** Has quedat número 1 de la taula. */
  won: boolean;
  /** Les teves jugades (torns teus, robar inclòs) fins al final de la partida. */
  moves: number;
  /** Punts que et quedaven a la mà (0 si has guanyat sense fitxes). */
  points: number;
}

export interface DailyState {
  version: 1;
  /** Partides del dia jugades, la més recent primer. */
  results: DailyResult[];
}

export const EMPTY_DAILY: DailyState = { version: 1, results: [] };

/* ---------- Dates ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** El dia (hora local del jugador) en format `AAAA-MM-DD`. */
export function dayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Dies de calendari d'un dia a l'altre (positiu si `to` és després). */
function daysBetween(from: string, to: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

/** El dia anterior, en el mateix format. */
export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** El número de la partida del dia (#1 el primer dia). */
export function dayNumber(key: string): number {
  return Math.max(1, daysBetween(FIRST_DAY, key) + 1);
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/* ---------- La partida ---------- */

/**
 * La llavor del dia (FNV-1a de la data): la mateixa a tots els aparells, i per
 * tant el mateix repartiment i el mateix ordre del sac.
 */
export function daySeed(key: string): number {
  let hash = 0x811c9dc5;
  for (const char of `remigi:dia:${key}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 2 ** 31;
}

/**
 * La llavor del motor per a un torn dels rivals: amb la mateixa taula, el
 * mateix rival fa la mateixa jugada a tots els aparells (i també en reprendre
 * una partida desada, que no ha de canviar res).
 */
export function turnSeed(seed: number, turn: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 31) + Math.imul(turn, 0x85ebca6b)) >>> 0;
}

/** Un generador per triar els noms dels rivals del dia (els mateixos per a tothom). */
export function dayRng(key: string): () => number {
  return createRng(daySeed(key) ^ 0x5bd1e995);
}

/**
 * Quants torns ha fet el jugador 0 (tu) en una partida de `players` jugadors
 * que ha començat `firstPlayer` i ara és al torn `turn` (l'últim torn jugat,
 * si s'ha acabat: el motor no avança el torn en acabar).
 */
export function humanMoves(turn: number, players: number, firstPlayer: number): number {
  let count = 0;
  for (let t = 1; t <= turn; t++) if ((firstPlayer + t - 1) % players === 0) count++;
  return count;
}

/** El jugador que va començar, deduït del torn i de qui juga ara. */
export function firstPlayerOf(turn: number, currentPlayer: number, players: number): number {
  return (((currentPlayer - (turn - 1)) % players) + players) % players;
}

/* ---------- Resultats ---------- */

/**
 * Compara dos resultats: negatiu si `a` és millor. Una victòria sempre és
 * millor que una derrota; entre victòries, menys jugades; entre derrotes,
 * menys punts a la mà (i, si empaten, menys jugades).
 */
export function compareResults(a: DailyResult, b: DailyResult): number {
  if (a.won !== b.won) return a.won ? -1 : 1;
  if (a.won) return a.moves - b.moves;
  return a.points - b.points || a.moves - b.moves;
}

/** Afegeix el resultat d'un dia. Cada dia compta un sol cop: el primer. */
export function recordResult(state: DailyState, result: DailyResult): DailyState {
  if (state.results.some((r) => r.day === result.day)) return state;
  const results = [result, ...state.results].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return { ...state, results: results.slice(0, MAX_RESULTS) };
}

export function resultFor(state: DailyState, day: string): DailyResult | null {
  return state.results.find((r) => r.day === day) ?? null;
}

/**
 * La ratxa: dies seguits que has quedat número 1. Compta fins avui si ja l'has
 * jugada; si encara no, fins ahir (no la perds fins que s'acaba el dia).
 */
export function currentStreak(state: DailyState, today: string): number {
  const byDay = new Map(state.results.map((r) => [r.day, r]));
  let day = byDay.has(today) ? today : previousDay(today);
  let streak = 0;
  while (byDay.get(day)?.won) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

/** La millor ratxa de tots els temps. */
export function bestStreak(state: DailyState): number {
  const days = [...state.results].sort((a, b) => (a.day < b.day ? -1 : 1));
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const r of days) {
    run = r.won ? (prev !== null && run > 0 && daysBetween(prev, r.day) === 1 ? run + 1 : 1) : 0;
    prev = r.day;
    best = Math.max(best, run);
  }
  return best;
}

/** La millor partida del dia que has fet mai. */
export function bestResult(state: DailyState): DailyResult | null {
  return [...state.results].sort(compareResults)[0] ?? null;
}

export function dailyWins(state: DailyState): number {
  return state.results.filter((r) => r.won).length;
}

/* ---------- Textos ---------- */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «Guanyada en 12 jugades» o «23 punts a la mà». */
export function resultText(result: DailyResult): string {
  return result.won
    ? `Guanyada en ${plural(result.moves, 'jugada', 'jugades')}`
    : `${plural(result.points, 'punt', 'punts')} a la mà`;
}

export function streakText(streak: number): string {
  return streak > 0 ? `🔥 ${plural(streak, 'dia', 'dies')} seguits número 1` : 'Cap ratxa en marxa';
}

/** Els últims dies com a quadrets: 🟩 número 1, 🟥 no, ⬜ no jugada. */
export function recentSquares(state: DailyState, today: string, days = 7): string {
  const byDay = new Map(state.results.map((r) => [r.day, r]));
  const squares: string[] = [];
  let day = today;
  for (let i = 0; i < days; i++) {
    const r = byDay.get(day);
    squares.unshift(r ? (r.won ? '🟩' : '🟥') : '⬜');
    day = previousDay(day);
  }
  return squares.join('');
}

/** El missatge per compartir el resultat (WhatsApp o el menú del mòbil). */
export function shareText(state: DailyState, result: DailyResult, url: string): string {
  const streak = currentStreak(state, result.day);
  return [
    `Remigi · Partida del dia #${dayNumber(result.day)}`,
    `${result.won ? '🏆' : '🧩'} ${resultText(result)}`,
    streak > 0 ? streakText(streak) : null,
    recentSquares(state, result.day),
    'Mateixes fitxes per a tothom. Ho fas millor? 🎲',
    url,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/* ---------- Desat ---------- */

function validResult(value: unknown): DailyResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Partial<DailyResult>;
  if (!isDayKey(r.day) || typeof r.won !== 'boolean') return null;
  const moves = Number(r.moves);
  const points = Number(r.points);
  if (!Number.isInteger(moves) || moves < 0 || !Number.isInteger(points) || points < 0) return null;
  return { day: r.day, won: r.won, moves, points };
}

/** Llegeix l'estat desat; si ve malmès, es queda amb el que es pot aprofitar. */
export function parseDailyState(raw: string | null): DailyState {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== 'object' || value === null) return EMPTY_DAILY;
    const list = (value as { results?: unknown }).results;
    if (!Array.isArray(list)) return EMPTY_DAILY;
    const results = list.map(validResult).filter((r): r is DailyResult => r !== null);
    return results.reduce<DailyState>((state, r) => recordResult(state, r), EMPTY_DAILY);
  } catch {
    return EMPTY_DAILY;
  }
}
