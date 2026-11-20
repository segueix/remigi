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

/**
 * La ratxa que ve del compte de Google (d'un altre aparell): no hi ha
 * l'historial dia a dia, només la ratxa que hi havia l'últim dia jugat.
 */
export interface CarriedStreak {
  streak: number;
  bestStreak: number;
  /** L'últim dia jugat que la ratxa ja compta. */
  lastDay: string;
}

export interface DailyState {
  version: 1;
  /** Partides del dia jugades, la més recent primer. */
  results: DailyResult[];
  carried?: CarriedStreak;
}

export const EMPTY_DAILY: DailyState = { version: 1, results: [] };

/* ---------- Dates ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * La partida del dia canvia a mitjanit **de Barcelona**, per a tothom igual:
 * qui jugui des d'una altra zona horària té la mateixa partida al mateix
 * moment.
 */
export const DAY_TIME_ZONE = 'Europe/Madrid';

/** L'hora de Barcelona d'un instant: data i hora, minut i segon. */
function barcelonaParts(date: Date): { day: string; seconds: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: DAY_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = `${get('year')}-${get('month')}-${get('day')}`;
    if (!isDayKey(day)) return null;
    return { day, seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')) };
  } catch {
    return null;
  }
}

/** El dia de la partida (`AAAA-MM-DD`, hora de Barcelona; si el navegador no ho sap, la local). */
export function dayKey(date: Date = new Date()): string {
  return (
    barcelonaParts(date)?.day ??
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  );
}

/** Mil·lisegons que falten per a la partida següent (mitjanit de Barcelona). */
export function msUntilNextDay(date: Date = new Date()): number {
  const parts = barcelonaParts(date);
  const seconds = parts ? parts.seconds : date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  return Math.max(0, (86_400 - seconds) * 1000 - date.getMilliseconds());
}

/** «5 h 20 min», «12 min» o «menys d'1 min». */
export function countdownText(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'menys d’1 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
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
  // La ratxa d'un altre aparell continua on s'atura la d'aquí.
  const carried = state.carried;
  if (carried && carried.lastDay === day && !byDay.has(day)) streak += carried.streak;
  return streak;
}

/**
 * Afegeix la ratxa del compte, si és d'un dia que aquí no consta (si ja hi
 * consta, la d'aquí és la bona).
 */
export function withCarried(state: DailyState, carried: CarriedStreak | null): DailyState {
  if (!carried || !isDayKey(carried.lastDay) || state.results.some((r) => r.day >= carried.lastDay)) return state;
  return { ...state, carried };
}

/** La millor ratxa de tots els temps (comptant la que ve d'un altre aparell). */
export function bestStreak(state: DailyState): number {
  const days = [...state.results].sort((a, b) => (a.day < b.day ? -1 : 1));
  const carried = state.carried;
  let best = carried?.bestStreak ?? 0;
  let run = carried?.streak ?? 0;
  let prev: string | null = carried?.lastDay ?? null;
  for (const r of days) {
    run = r.won ? (prev !== null && run > 0 && daysBetween(prev, r.day) === 1 ? run + 1 : 1) : 0;
    prev = r.day;
    best = Math.max(best, run);
  }
  return Math.max(best, run);
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
export function resultText(result: Pick<DailyResult, 'won' | 'moves' | 'points'>): string {
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
    'Mateixes fitxes per a tothom. Em superes? 🎲',
    dailyInviteUrl(url),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/** L'enllaç que obre directament la partida del dia. */
export function dailyInviteUrl(base: string): string {
  try {
    const url = new URL(base);
    url.searchParams.set('partida', 'dia');
    return url.toString();
  } catch {
    return base;
  }
}

/** La invitació a la partida del dia (per sumar-hi gent). */
export function inviteText(day: string, url: string, streak = 0): string {
  return [
    `🎲 Partida del dia #${dayNumber(day)} al Remigi`,
    'Avui tothom juga amb les mateixes fitxes. Qui guanya en menys jugades?',
    streak > 0 ? `Jo porto ${plural(streak, 'dia', 'dies')} seguits de número 1 🔥. M’atrapes?` : 'T’hi apuntes?',
    dailyInviteUrl(url),
  ].join('\n');
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

export function validCarried(value: unknown): CarriedStreak | null {
  if (typeof value !== 'object' || value === null) return null;
  const c = value as Partial<CarriedStreak>;
  const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100_000;
  if (!isDayKey(c.lastDay) || !ok(c.streak) || !ok(c.bestStreak)) return null;
  return { streak: c.streak as number, bestStreak: c.bestStreak as number, lastDay: c.lastDay };
}

/** Llegeix l'estat desat; si ve malmès, es queda amb el que es pot aprofitar. */
export function parseDailyState(raw: string | null): DailyState {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== 'object' || value === null) return EMPTY_DAILY;
    const list = (value as { results?: unknown }).results;
    if (!Array.isArray(list)) return EMPTY_DAILY;
    const results = list.map(validResult).filter((r): r is DailyResult => r !== null);
    const state = results.reduce<DailyState>((acc, r) => recordResult(acc, r), EMPTY_DAILY);
    return withCarried(state, validCarried((value as { carried?: unknown }).carried));
  } catch {
    return EMPTY_DAILY;
  }
}
