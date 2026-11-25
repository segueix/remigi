import { applyMove, createEngine, createRng, rackPoints, type GameState } from '@remigi/core';
import { dayEntry, rankScore, type DayEntry, type PlayerEntry } from '../cloud/ranking';
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
export function playDaily(day: string, rating: number, uid: string, attempt = 0): DailyResult {
  const plan = computeDailyPlan(day);
  let state: GameState = dailyGame(plan.seed, plan.difficulty);
  // L'intent 0 és la partida de sempre; els altres, una llavor nova del jugador.
  const who = attempt === 0 ? uid : `${uid}#${attempt}`;
  let guard = 0;
  while (state.status === 'playing' && guard++ < 2000) {
    const mover = state.currentPlayer;
    const seed = mover === 0 ? hash(`${who}:${day}:${state.turn}`) : turnSeed(plan.seed, state.turn);
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

/** Quants intents prova un jugador automàtic per no empatar amb un altre. */
export const DISTINCT_ATTEMPTS = 40;

/** La força de l'intent `attempt`: la del dia i, després, una mica amunt i avall. */
export function attemptRating(rating: number, attempt: number): number {
  if (attempt === 0) return rating;
  const step = Math.ceil(attempt / 2) * 15;
  const shifted = attempt % 2 === 1 ? rating + step : rating - step;
  return Math.min(1600, Math.max(800, shifted));
}

/**
 * La partida del dia d'un jugador automàtic sense empatar amb cap altre
 * jugador automàtic: `taken` són les puntuacions de rànquing (`rankScore`) que
 * els altres ja tenen aquell dia. Si la partida de sempre (intent 0) hi empata,
 * la torna a jugar de debò amb una llavor nova i la força una mica amunt o
 * avall, fins que en surt una amb un resultat diferent. No tria el resultat
 * més favorable: es queda el primer que no empata. Si cap dels
 * `DISTINCT_ATTEMPTS` intents no se'n surt, torna `null` i aquell dia no juga
 * (mai publica un empat amb un altre jugador automàtic).
 */
export function playDistinct(
  day: string,
  rating: number,
  uid: string,
  taken: ReadonlySet<number>,
): { result: DailyResult; rating: number; attempt: number } | null {
  for (let attempt = 0; attempt < DISTINCT_ATTEMPTS; attempt++) {
    const strength = attemptRating(rating, attempt);
    const result = playDaily(day, strength, uid, attempt);
    if (!taken.has(rankScore(result))) return { result, rating: strength, attempt };
  }
  return null;
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
