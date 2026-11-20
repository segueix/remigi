import {
  ENGINE_VERSION,
  applyMove,
  createEngine,
  createGame,
  difficultyByRating,
  type DifficultyKey,
  type GameState,
} from '@remigi/core';
import { daySeed, isDayKey, turnSeed } from './daily';

/**
 * La dificultat de la partida del dia segons el dia de la setmana (a
 * Barcelona), igual per a tothom: de la més suau el dilluns a la més dura el
 * dissabte; el diumenge, taula de quatre. Sense Expert: trencaria la ratxa de
 * gairebé tothom cada setmana.
 *
 * I una garantia: **sempre es pot obrir**. Abans de la sortida inicial el
 * jugador només pot obrir o robar, i els rivals juguen sempre igual davant de
 * la mateixa taula; per tant, el camí fins a la sortida és el mateix per a
 * tothom i es pot simular per endavant. D'entre unes quantes barreges del dia
 * es tria la primera amb què la sortida (30 punts) és possible com a molt al
 * teu torn `MAX_OPENING_TURN`. No ha de ser al primer: es pot obrir, però no ve
 * regalat.
 */

export interface DailyDifficulty {
  /** 0 = diumenge … 6 = dissabte (com `Date.getDay`). */
  weekday: number;
  /** «Dilluns». */
  dayName: string;
  /** Rivals a la taula. */
  opponents: 2 | 3;
  /** Força de cada rival (800 Novell … 1600 Expert). */
  rating: number;
  /** «Fàcil», «Mitjà», «Avançat»… */
  label: string;
  /** D'1 a 5, per pintar-ho d'un cop d'ull. */
  stars: number;
}

const WEEK: Omit<DailyDifficulty, 'weekday' | 'dayName'>[] = [
  { opponents: 3, rating: 1350, label: 'Taula de 4', stars: 4 }, // diumenge
  { opponents: 2, rating: 1000, label: 'Fàcil', stars: 1 }, // dilluns
  { opponents: 2, rating: 1100, label: 'Suau', stars: 2 }, // dimarts
  { opponents: 2, rating: 1200, label: 'Mitjà', stars: 3 }, // dimecres
  { opponents: 2, rating: 1250, label: 'Mitjà+', stars: 3 }, // dijous
  { opponents: 2, rating: 1300, label: 'Exigent', stars: 4 }, // divendres
  { opponents: 2, rating: 1400, label: 'Avançat', stars: 5 }, // dissabte
];

const DAY_NAMES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'];

/** El dia de la setmana d'una data `AAAA-MM-DD` (0 = diumenge). */
export function weekdayOf(day: string): number {
  if (!isDayKey(day)) return 3;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dailyDifficulty(day: string): DailyDifficulty {
  const weekday = weekdayOf(day);
  return { weekday, dayName: DAY_NAMES[weekday], ...WEEK[weekday] };
}

/** El nivell (per a l'etiqueta del rival) que correspon a la força del dia. */
export function difficultyKeyOf(difficulty: DailyDifficulty): DifficultyKey {
  return difficultyByRating(difficulty.rating).key;
}

/** La sortida ha de ser possible com a molt en aquest torn teu. */
export const MAX_OPENING_TURN = 3;

/** Barreges que es proven com a molt (la primera que compleix, guanya). */
export const SEED_TRIES = 12;

/** La barreja candidata `k` del dia (la 0 és la de sempre, `daySeed`). */
export function candidateSeed(day: string, k: number): number {
  const base = daySeed(day);
  return k === 0 ? base : ((base ^ Math.imul(k, 0x9e3779b1)) >>> 0) % 2 ** 31;
}

/** La partida del dia tal com la crea `newGameState` (comença el jugador). */
export function dailyGame(seed: number, difficulty: DailyDifficulty): GameState {
  const key = difficultyKeyOf(difficulty);
  return createGame({
    seed,
    firstPlayer: 0,
    players: [
      { name: 'Tu', kind: 'human' },
      ...Array.from({ length: difficulty.opponents }, (_, i) => ({
        name: `Rival ${i + 1}`,
        kind: 'ai' as const,
        aiLevel: key,
      })),
    ],
  });
}

/** Motor per mirar si hi ha sortida (sense atzar: l'anàlisi és determinista). */
const analyst = createEngine();

/**
 * En quin torn teu es pot fer la sortida inicial si robes fins llavors (null
 * si no es pot fins passat `MAX_OPENING_TURN`). Els rivals juguen exactament
 * com a la partida de debò: la força del dia i una llavor per torn.
 */
export function openingTurn(seed: number, difficulty: DailyDifficulty): number | null {
  let state = dailyGame(seed, difficulty);
  let turns = 0;
  while (state.status === 'playing') {
    if (state.currentPlayer === 0) {
      turns++;
      if (analyst.analyze(state, { playerIndex: 0 }).bestPlay) return turns;
      if (turns >= MAX_OPENING_TURN) return null;
      state = applyMove(state, { type: 'draw' });
    } else {
      // Si el jugador obre en aquest torn, la partida continua igual que aquí:
      // els rivals reben la mateixa taula i la mateixa llavor del torn.
      const decision = createEngine({ seed: turnSeed(seed, state.turn) }).play(state, {
        playerIndex: state.currentPlayer,
        rating: difficulty.rating,
        rubberBanding: false,
      });
      state = applyMove(state, decision.move);
    }
  }
  return null;
}

export interface DailyPlan {
  day: string;
  difficulty: DailyDifficulty;
  /** La barreja triada. */
  seed: number;
  /** En quin torn teu es pot obrir (null si cap barreja ho permetia: la del dia, igualment). */
  openingTurn: number | null;
}

/** La primera barreja del dia amb la qual es pot obrir a temps. */
export function computeDailyPlan(day: string): DailyPlan {
  const difficulty = dailyDifficulty(day);
  for (let k = 0; k < SEED_TRIES; k++) {
    const seed = candidateSeed(day, k);
    const turn = openingTurn(seed, difficulty);
    if (turn !== null) return { day, difficulty, seed, openingTurn: turn };
  }
  return { day, difficulty, seed: candidateSeed(day, 0), openingTurn: null };
}

const PLAN_KEY = 'remigi:dia:pla';

/**
 * El pla del dia, calculat un sol cop per aparell i desat (la simulació costa
 * una mica). Va lligat a la versió del motor: si el motor canvia, es refà.
 */
export function dailyPlan(day: string): DailyPlan {
  const key = `${day}|${ENGINE_VERSION}`;
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    const saved = raw ? (JSON.parse(raw) as { key?: string; seed?: unknown; openingTurn?: unknown }) : null;
    if (saved?.key === key && typeof saved.seed === 'number') {
      return {
        day,
        difficulty: dailyDifficulty(day),
        seed: saved.seed,
        openingTurn: typeof saved.openingTurn === 'number' ? saved.openingTurn : null,
      };
    }
  } catch {
    // Sense emmagatzematge, es calcula cada cop.
  }
  const plan = computeDailyPlan(day);
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify({ key, seed: plan.seed, openingTurn: plan.openingTurn }));
  } catch {
    // Igual que a dalt.
  }
  return plan;
}
