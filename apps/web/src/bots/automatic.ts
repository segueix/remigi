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

/** Què fa un jugador automàtic un dia: si juga, a quina força i a quina hora publica. */
export function botDay(bot: BotConfig, day: string): BotDay {
  const rng = createRng(hash(`${bot.uid}:${day}`));
  const plays = bot.active && rng() >= bot.skipRate;
  const rating = Math.min(1600, Math.max(800, Math.round(bot.rating + (rng() * 2 - 1) * bot.spread)));
  const from = minutesOf(bot.from);
  const to = Math.max(from + 1, minutesOf(bot.to));
  const publishAt = from + Math.floor(rng() * (to - from));
  return { plays, rating, publishAt };
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
