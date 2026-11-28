import { applyMove, createEngine, createRng, rackPoints, type GameState } from '@remigi/core';
import { dayEntry, type DayEntry, type PlayerEntry } from '../cloud/ranking';
import { humanMoves, msUntilNextDay, previousDay, turnSeed, type DailyResult } from '../dia/daily';
import { computeDailyPlan, dailyGame } from '../dia/plan';

/**
 * Jugadors automàtics de la partida del dia (vegeu docs/JUGADORS-AUTOMATICS.md).
 *
 * Cada un juga cada dia la mateixa partida del dia que tothom (mateixa barreja,
 * mateixos rivals, que juguen igual), amb el motor fent de jugador a la força
 * que li toca aquell dia, i en publica el resultat i la ratxa al rànquing.
 * Tot és determinista per jugador i dia: si la tasca s'executa dues vegades,
 * surt el mateix.
 */
export interface BotConfig {
  /** Nom curt per a la configuració i els registres. */
  key: string;
  /** El nom que surt a la classificació. */
  alias: string;
  /** Identificador del document a Firestore (com un uid de Google, 28 caràcters). */
  uid: string;
  /** Força mitjana (800 Novell … 1600 Expert). */
  rating: number;
  /** Quant pot variar cada dia, amunt o avall. */
  spread: number;
  /** Probabilitat de no jugar un dia (0 … 1). */
  skipRate: number;
  /** Franja per publicar, hora de Barcelona («08:00», «12:00»). */
  from: string;
  to: string;
  /** Si és fals, ja no juga. */
  active: boolean;
  /**
   * Com es mou la força mitjana amb els dies (opcional; sense, és `rating`
   * cada dia). Vegeu `BotCurve`.
   */
  curve?: BotCurve;
  /**
   * Com reacciona al resultat del dia abans (opcional; sense, no reacciona).
   * Vegeu `BotAdapt`.
   */
  adapt?: BotAdapt;
}

/**
 * La corba de la força mitjana, abans del marge de cada dia:
 *
 * - `aprenent`: comença a `from` el dia `start` i s'acosta a `rating` (la
 *   meitat del camí en `halfLife` dies). Abans de `start`, `from`.
 * - `ones`: puja i baixa al voltant de `rating`, ±`amplitude`, amb un cicle de
 *   `period` dies (bones i males temporades). El punt del cicle depèn de l'uid.
 * - `setmana`: `rating` més un ajust per a cada dia de la setmana (`offsets`,
 *   de diumenge a dissabte).
 */
export type BotCurve =
  | { kind: 'aprenent'; start: string; from: number; halfLife: number }
  | { kind: 'ones'; period: number; amplitude: number }
  | { kind: 'setmana'; offsets: [number, number, number, number, number, number, number] };

/**
 * La reacció al dia abans (només si el dia abans va jugar; si no hi va jugar,
 * res): `win` punts per cada victòria de la ratxa que porta, `loss` punts si
 * el dia abans va perdre; el total, com a molt ±`max`.
 */
export interface BotAdapt {
  win: number;
  loss: number;
  max: number;
}

export interface BotDay {
  plays: boolean;
  /** La força d'aquell dia. */
  rating: number;
  /** Minut del dia (hora de Barcelona) a partir del qual publica. */
  publishAt: number;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2 ** 31;
}

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

const DAY_MS = 86_400_000;
const dayIndex = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** La força mitjana d'un dia segons la corba (sense el marge ni la reacció). */
export function curveRating(bot: BotConfig, day: string): number {
  const curve = bot.curve;
  if (!curve) return bot.rating;
  if (curve.kind === 'aprenent') {
    const t = Math.max(0, dayIndex(day) - dayIndex(curve.start));
    return bot.rating - (bot.rating - curve.from) * 0.5 ** (t / Math.max(1, curve.halfLife));
  }
  if (curve.kind === 'ones') {
    const period = Math.max(2, curve.period);
    const phase = (dayIndex(day) + (hash(bot.uid) % period)) / period;
    return bot.rating + curve.amplitude * Math.sin(2 * Math.PI * phase);
  }
  return bot.rating + (curve.offsets[new Date(dayIndex(day) * DAY_MS).getUTCDay()] ?? 0);
}

/**
 * La reacció al resultat del dia abans de `day`, segons la fitxa del jugador
 * (`previous`). Si no va jugar el dia abans (o no hi ha fitxa), 0.
 */
export function adaptDelta(bot: BotConfig, day: string, previous: PlayerEntry | null | undefined): number {
  if (!bot.adapt || !previous || previous.lastDay !== previousDay(day)) return 0;
  const { win, loss, max } = bot.adapt;
  const delta = previous.streak > 0 ? win * previous.streak : loss;
  return Math.max(-max, Math.min(max, delta));
}

/**
 * Què fa un jugador automàtic un dia: si juga, a quina força i a quina hora
 * publica. La força és la de la corba més el marge del dia i, si es dona la
 * fitxa (`previous`), la reacció al dia abans.
 */
export function botDay(bot: BotConfig, day: string, previous?: PlayerEntry | null): BotDay {
  const rng = createRng(hash(`${bot.uid}:${day}`));
  const plays = bot.active && rng() >= bot.skipRate;
  const base = curveRating(bot, day) + adaptDelta(bot, day, previous);
  const rating = Math.min(1600, Math.max(800, Math.round(base + (rng() * 2 - 1) * bot.spread)));
  const from = minutesOf(bot.from);
  const to = Math.max(from + 1, minutesOf(bot.to));
  const publishAt = from + Math.floor(rng() * (to - from));
  return { plays, rating, publishAt };
}

/**
 * Què li falta publicar a un jugador automàtic, segons el que ja consta a la
 * seva fitxa (`jugadors/{uid}`, l'últim dia que va publicar):
 *
 * - `yesterday`: ahir li tocava jugar i no va publicar (les execucions
 *   programades de GitHub poden arribar hores tard o no arribar): ho fa ara,
 *   perquè no se salti cap dia que li toca;
 * - `today`: avui li toca, ja ha passat la seva hora i encara no ha publicat.
 *
 * Amb `now` (manual, «no esperis l'hora»), publica avui encara que no sigui
 * l'hora. Els dies es comparen com a text (AAAA-MM-DD).
 */
export function botPending(
  bot: BotConfig,
  day: string,
  minute: number,
  previous: PlayerEntry | null,
  now = false,
): { yesterday: boolean; today: boolean } {
  const last = previous?.lastDay ?? '';
  const yesterdayKey = previousDay(day);
  const plan = botDay(bot, day);
  return {
    yesterday: botDay(bot, yesterdayKey).plays && last < yesterdayKey,
    today: plan.plays && (now || minute >= plan.publishAt) && last < day,
  };
}

/** El minut del dia ara mateix, hora de Barcelona. */
export function barcelonaMinute(now: Date = new Date()): number {
  return Math.max(0, 1440 - Math.ceil(msUntilNextDay(now) / 60_000));
}

/**
 * Juga la partida del dia com a jugador 0 (el lloc del jugador humà), a la
 * força donada. Els rivals juguen exactament com a l'app (força del dia, una
 * llavor per torn); el jugador automàtic, amb una llavor seva per torn.
 */
export function playDaily(day: string, rating: number, uid: string): DailyResult {
  const plan = computeDailyPlan(day);
  let state: GameState = dailyGame(plan.seed, plan.difficulty);
  let guard = 0;
  while (state.status === 'playing' && guard++ < 2000) {
    const mover = state.currentPlayer;
    const seed = mover === 0 ? hash(`${uid}:${day}:${state.turn}`) : turnSeed(plan.seed, state.turn);
    const decision = createEngine({ seed }).play(state, {
      playerIndex: mover,
      rating: mover === 0 ? rating : plan.difficulty.rating,
      rubberBanding: false,
    });
    state = applyMove(state, decision.move);
  }
  const players = state.players.length;
  return {
    day,
    won: state.winnerId === state.players[0].id,
    moves: Math.max(1, humanMoves(state.turn, players, 0)),
    points: rackPoints(state.players[0].rack),
    rivals: state.players.slice(1).reduce((sum, player) => sum + rackPoints(player.rack), 0),
  };
}

/** La ratxa nova del jugador automàtic després del resultat d'un dia. */
export function nextStreak(previous: PlayerEntry | null, result: DailyResult): { streak: number; bestStreak: number } {
  const continues = previous !== null && previous.lastDay === previousDay(result.day);
  const streak = result.won ? (continues ? previous.streak : 0) + 1 : 0;
  return { streak, bestStreak: Math.max(streak, previous?.bestStreak ?? 0) };
}

/** El que es publica a Firestore: el resultat del dia i la fitxa de la ratxa. */
export function botPublication(
  bot: BotConfig,
  result: DailyResult,
  previous: PlayerEntry | null,
): { entry: DayEntry; player: PlayerEntry } {
  const { streak, bestStreak } = nextStreak(previous, result);
  return {
    entry: dayEntry(result, bot.alias, streak),
    player: { alias: bot.alias, streak, bestStreak, lastDay: result.day },
  };
}
