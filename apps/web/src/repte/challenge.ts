import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '@remigi/core';
import { ordinal, signed } from '../ui/format';

/**
 * El repte: un nombre de partides seguides a un nivell fix, i al final se
 * sumen els punts que has fet (els de `finalScores`: el guanyador s'emporta
 * els punts que els altres tenen a la mà i els perdedors resten els seus).
 * Pur i serialitzable, com la lliga.
 */

export type ChallengeRivals = 1 | 2 | 3;

export interface ChallengeConfig {
  games: number;
  level: DifficultyKey;
  opponents: ChallengeRivals;
}

export const GAME_OPTIONS = [3, 5, 10] as const;
export const DEFAULT_CHALLENGE: ChallengeConfig = { games: 5, level: 'medium', opponents: 2 };

export interface ChallengeGame {
  /** Punts teus a la partida (positius si guanyes, negatius si no). */
  points: number;
  won: boolean;
  /**
   * Punts de tothom a la partida, en l'ordre de les cadires: tu primer i
   * després els rivals del repte (`Challenge.rivals`). Les partides d'abans
   * que el repte els apuntés no en tenen.
   */
  scores?: number[];
  /** Fitxes que li quedaven a cadascú (mateix ordre). */
  tilesLeft?: number[];
  /** Cadira del guanyador de la partida (0, tu). */
  winner?: number;
  /** Ningú no es va poder desfer de totes les fitxes. */
  blocked?: boolean;
  /** Torns que va durar. */
  turns?: number;
}

export interface Challenge {
  version: 1;
  config: ChallengeConfig;
  games: ChallengeGame[];
  /**
   * Els rivals del repte, els mateixos a totes les partides: així es pot
   * portar el compte de cadascú i jugar amb tàctica. Buit als reptes d'abans.
   */
  rivals: string[];
  startedAt: string;
}

export interface ChallengeRecord {
  config: ChallengeConfig;
  total: number;
  wins: number;
  finishedAt: string;
}

export interface ChallengeState {
  /** Repte en curs, o l'últim acabat (per ensenyar-ne el resum). */
  current: Challenge | null;
  /** Reptes acabats, el més recent primer. */
  history: ChallengeRecord[];
  /** L'última configuració triada, per proposar-la el cop següent. */
  lastConfig: ChallengeConfig;
}

export const MAX_HISTORY = 40;

export function normalizeChallengeConfig(input: Partial<ChallengeConfig> | null | undefined): ChallengeConfig {
  const games = Number(input?.games);
  const opponents = Number(input?.opponents);
  return {
    games: Number.isInteger(games) && games >= 1 && games <= 50 ? games : DEFAULT_CHALLENGE.games,
    level: DIFFICULTY_ORDER.includes(input?.level as DifficultyKey) ? (input?.level as DifficultyKey) : DEFAULT_CHALLENGE.level,
    opponents: opponents === 1 || opponents === 2 || opponents === 3 ? opponents : DEFAULT_CHALLENGE.opponents,
  };
}

export function newChallenge(config: ChallengeConfig, date = new Date(), rivals: string[] = []): Challenge {
  const clean = normalizeChallengeConfig(config);
  return { version: 1, config: clean, games: [], rivals: validRivals(rivals, clean.opponents), startedAt: date.toISOString() };
}

/** Els noms dels rivals, si n'hi ha tants com rivals per partida (si no, cap). */
function validRivals(value: unknown, count: number): string[] {
  if (!Array.isArray(value) || value.length !== count) return [];
  const names = value.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
  return names.length === count ? names.map((name) => name.slice(0, 40)) : [];
}

/** Posa rivals fixos a un repte que encara no en té (els reptes d'abans). */
export function withRivals(state: ChallengeState, rivals: string[]): ChallengeState {
  const current = state.current;
  if (!current || current.rivals.length === current.config.opponents) return state;
  const names = validRivals(rivals, current.config.opponents);
  return names.length ? { ...state, current: { ...current, rivals: names } } : state;
}

/* ---------- Classificació del repte ---------- */

export interface StandingRow {
  /** Cadira: 0 ets tu; 1… els rivals, en l'ordre del repte. */
  seat: number;
  name: string;
  you: boolean;
  /** Punts acumulats al repte. */
  total: number;
  /** Punts a l'última partida (null si no se'n sap). */
  last: number | null;
  /** Partides guanyades. */
  wins: number;
  /** Posició al repte (empats, mateixa posició). */
  place: number;
}

/**
 * La classificació del repte: tu i els rivals, amb els punts de l'última
 * partida, el total i les victòries, ordenats pel total (i, a igualtat, per
 * victòries). Els rivals només sumen les partides que porten la puntuació de
 * tothom (`scores`); les teves sumen sempre.
 */
export function challengeStandings(challenge: Challenge, playerName = 'Tu'): StandingRow[] {
  const seats = [playerName, ...challenge.rivals];
  const last = challenge.games[challenge.games.length - 1];
  const rows: StandingRow[] = seats.map((name, seat) => {
    let total = 0;
    let wins = 0;
    for (const game of challenge.games) {
      if (seat === 0) {
        total += game.points;
        if (game.won) wins++;
      } else if (game.scores && Number.isFinite(game.scores[seat])) {
        total += game.scores[seat];
        if (game.winner === seat) wins++;
      }
    }
    const lastPoints = !last ? null : seat === 0 ? last.points : last.scores?.[seat] ?? null;
    return { seat, name, you: seat === 0, total, last: lastPoints, wins, place: 0 };
  });
  const sorted = [...rows].sort((a, b) => b.total - a.total || b.wins - a.wins || a.seat - b.seat);
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    row.place = prev && prev.total === row.total && prev.wins === row.wins ? prev.place : i + 1;
  });
  return sorted;
}

/**
 * Informació per jugar amb tàctica, en frases curtes: on vas del repte i a
 * quants punts, com ha acabat l'última partida, què queda i, si no vas
 * primer, què et cal.
 */
export function challengeInsights(challenge: Challenge, standings: StandingRow[]): string[] {
  const lines: string[] = [];
  const me = standings.find((row) => row.you);
  const last = challenge.games[challenge.games.length - 1];
  if (!me || !last) return lines;
  const played = challenge.games.length;
  const left = challenge.config.games - played;
  const leader = standings[0];
  const rivals = standings.filter((row) => !row.you);
  const known = rivals.length > 0 && challenge.games.some((game) => game.scores);

  // Com ha acabat l'última partida.
  if (last.winner !== undefined && last.scores) {
    const winnerName = last.winner === 0 ? 'Tu' : challenge.rivals[last.winner - 1] ?? 'Un rival';
    const how = last.blocked
      ? 'partida bloquejada: guanya qui tenia menys punts a la mà'
      : `${last.winner === 0 ? 't’has quedat' : 's’ha quedat'} sense fitxes${last.turns ? ` en ${last.turns} torns` : ''}`;
    lines.push(`${last.winner === 0 ? 'Has guanyat la partida' : `Ha guanyat ${winnerName}`} (${how}).`);
  }
  if (last.tilesLeft && last.tilesLeft[0] > 0 && !last.won) {
    lines.push(`Et quedaven ${last.tilesLeft[0]} ${last.tilesLeft[0] === 1 ? 'fitxa' : 'fitxes'} a la mà (${signed(last.points)} punts).`);
  }

  // On vas del repte.
  if (known && played > 1) {
    if (me.place === 1) {
      const second = standings.find((row) => !row.you && row !== me);
      const gap = second ? me.total - second.total : 0;
      lines.push(gap > 0 ? `Vas primer del repte, amb ${gap} punts d’avantatge sobre ${second?.name}.` : 'Vas primer del repte, empatat.');
    } else {
      lines.push(`Vas ${ordinal(me.place)} del repte, a ${leader.total - me.total} punts de ${leader.name}.`);
    }
  }

  // El que queda, i què et cal.
  if (left > 0) {
    const wins = challenge.games.filter((game) => game.scores && game.winner !== undefined);
    const avgWin = wins.length
      ? Math.round(wins.reduce((sum, game) => sum + (game.scores?.[game.winner ?? 0] ?? 0), 0) / wins.length)
      : null;
    const queden = `${left === 1 ? 'Queda 1 partida' : `Queden ${left} partides`}`;
    lines.push(avgWin !== null ? `${queden}. Guanyar-ne una ha valgut, de mitjana, +${avgWin} punts.` : `${queden}.`);
    if (known && me.place > 1) {
      lines.push(
        'Tàctica: si veus que no guanyaràs la partida, desfés-te de les fitxes altes i dels jokers (30 punts): el que et queda a la mà resta, i el que hi queda als altres és per a qui guanya.',
      );
    } else if (known && me.place === 1) {
      lines.push('Tàctica: per mantenir el primer lloc, no cal arriscar: posa fitxes sovint i no et quedis amb jokers a la mà.');
    }
  }
  return lines;
}


export function isDone(challenge: Challenge): boolean {
  return challenge.games.length >= challenge.config.games;
}

export function challengeTotal(challenge: Pick<Challenge, 'games'>): number {
  return challenge.games.reduce((sum, game) => sum + game.points, 0);
}

export function challengeWins(challenge: Pick<Challenge, 'games'>): number {
  return challenge.games.filter((game) => game.won).length;
}

/** «5 partides · Mitjà · 2 rivals». */
export function describeChallenge(config: ChallengeConfig): string {
  return `${config.games} ${config.games === 1 ? 'partida' : 'partides'} · ${DIFFICULTIES[config.level].label} · ${
    config.opponents
  } ${config.opponents === 1 ? 'rival' : 'rivals'}`;
}

function sameConfig(a: ChallengeConfig, b: ChallengeConfig): boolean {
  return a.games === b.games && a.level === b.level && a.opponents === b.opponents;
}

/** El millor repte acabat amb aquesta mateixa configuració, si n'hi ha. */
export function bestFor(history: readonly ChallengeRecord[], config: ChallengeConfig): ChallengeRecord | null {
  return history
    .filter((record) => sameConfig(record.config, config))
    .reduce<ChallengeRecord | null>((best, record) => (!best || record.total > best.total ? record : best), null);
}

/**
 * Apunta una partida al repte en curs. Quan és l'última, el repte va a
 * l'historial en aquell mateix moment (i només llavors): així el rècord no es
 * perd encara que no es torni a obrir la pantalla del repte.
 */
export function addGame(state: ChallengeState, game: ChallengeGame, date = new Date()): ChallengeState {
  const current = state.current;
  if (!current || isDone(current)) return state;
  const next: Challenge = { ...current, games: [...current.games, game] };
  if (!isDone(next)) return { ...state, current: next };
  const record: ChallengeRecord = {
    config: next.config,
    total: challengeTotal(next),
    wins: challengeWins(next),
    finishedAt: date.toISOString(),
  };
  return { ...state, current: next, history: [record, ...state.history].slice(0, MAX_HISTORY) };
}

export function startChallenge(
  state: ChallengeState,
  config: ChallengeConfig,
  date = new Date(),
  rivals: string[] = [],
): ChallengeState {
  const clean = normalizeChallengeConfig(config);
  return { ...state, current: newChallenge(clean, date, rivals), lastConfig: clean };
}

/** Deixa el repte en curs sense apuntar-lo enlloc. */
export function abandonChallenge(state: ChallengeState): ChallengeState {
  return { ...state, current: null };
}

export function emptyChallengeState(): ChallengeState {
  return { current: null, history: [], lastConfig: { ...DEFAULT_CHALLENGE } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validGame(value: unknown): value is ChallengeGame {
  return isRecord(value) && typeof value.points === 'number' && Number.isFinite(value.points) && typeof value.won === 'boolean';
}

const numbers = (value: unknown, count: number): number[] | undefined =>
  Array.isArray(value) && value.length === count && value.every((n) => typeof n === 'number' && Number.isFinite(n))
    ? (value as number[])
    : undefined;

/** Una partida desada, amb les dades de tothom només si quadren amb els rivals del repte. */
function cleanGame(value: ChallengeGame, seats: number): ChallengeGame {
  const game: ChallengeGame = { points: value.points, won: value.won };
  if (seats < 2) return game;
  const scores = numbers(value.scores, seats);
  if (scores) {
    game.scores = scores;
    const tiles = numbers(value.tilesLeft, seats);
    if (tiles) game.tilesLeft = tiles;
    if (Number.isInteger(value.winner) && (value.winner as number) >= 0 && (value.winner as number) < seats) game.winner = value.winner;
    if (typeof value.blocked === 'boolean') game.blocked = value.blocked;
    if (Number.isInteger(value.turns) && (value.turns as number) > 0) game.turns = value.turns;
  }
  return game;
}

export function parseChallengeState(raw: string | null): ChallengeState {
  if (!raw) return emptyChallengeState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return emptyChallengeState();
    let current: Challenge | null = null;
    if (isRecord(value.current) && value.current.version === 1 && Array.isArray(value.current.games)) {
      const config = normalizeChallengeConfig(value.current.config as Partial<ChallengeConfig>);
      const rivals = validRivals(value.current.rivals, config.opponents);
      const games = value.current.games
        .filter(validGame)
        .slice(0, config.games)
        .map((game) => cleanGame(game, rivals.length ? rivals.length + 1 : 0));
      current = {
        version: 1,
        config,
        games,
        rivals,
        startedAt: typeof value.current.startedAt === 'string' ? value.current.startedAt : new Date(0).toISOString(),
      };
    }
    const history = Array.isArray(value.history)
      ? value.history
          .filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.total === 'number' && typeof r.wins === 'number')
          .map((r) => ({
            config: normalizeChallengeConfig(r.config as Partial<ChallengeConfig>),
            total: r.total as number,
            wins: r.wins as number,
            finishedAt: typeof r.finishedAt === 'string' ? r.finishedAt : new Date(0).toISOString(),
          }))
          .slice(0, MAX_HISTORY)
      : [];
    return {
      current,
      history,
      lastConfig: normalizeChallengeConfig(value.lastConfig as Partial<ChallengeConfig>),
    };
  } catch {
    return emptyChallengeState();
  }
}
