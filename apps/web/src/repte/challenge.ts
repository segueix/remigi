import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '@remigi/core';

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
}

export interface Challenge {
  version: 1;
  config: ChallengeConfig;
  games: ChallengeGame[];
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

export function newChallenge(config: ChallengeConfig, date = new Date()): Challenge {
  return { version: 1, config: normalizeChallengeConfig(config), games: [], startedAt: date.toISOString() };
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

export function startChallenge(state: ChallengeState, config: ChallengeConfig, date = new Date()): ChallengeState {
  const clean = normalizeChallengeConfig(config);
  return { ...state, current: newChallenge(clean, date), lastConfig: clean };
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

export function parseChallengeState(raw: string | null): ChallengeState {
  if (!raw) return emptyChallengeState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return emptyChallengeState();
    let current: Challenge | null = null;
    if (isRecord(value.current) && value.current.version === 1 && Array.isArray(value.current.games)) {
      const config = normalizeChallengeConfig(value.current.config as Partial<ChallengeConfig>);
      const games = value.current.games.filter(validGame).slice(0, config.games);
      current = {
        version: 1,
        config,
        games,
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
