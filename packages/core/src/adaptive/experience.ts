import { DIFFICULTIES, type DifficultyKey } from '../ai/difficulty';
import { updateRating } from './rating';

/** Valoració amb què comença tot jugador nou (entre 'easy' i 'medium'). */
export const STARTING_RATING = 1100;

/** Quantes partides es guarden a l'historial del perfil. */
const HISTORY_LIMIT = 50;

export interface GameRecord {
  /** Data ISO de la partida. */
  date: string;
  /** Nivells dels oponents IA. */
  opponents: DifficultyKey[];
  won: boolean;
  /** Valoració del jugador després de la partida. */
  ratingAfter: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  history: GameRecord[];
}

export function createProfile(id: string, name: string): PlayerProfile {
  return { id, name, rating: STARTING_RATING, gamesPlayed: 0, wins: 0, history: [] };
}

/**
 * Factor K de l'Elo: els primers cops es mou de pressa perquè el sistema trobi
 * aviat el nivell del jugador; amb l'experiència es va estabilitzant.
 */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40;
  if (gamesPlayed < 30) return 24;
  return 16;
}

/**
 * Registra el resultat d'una partida al perfil i retorna el perfil actualitzat
 * (el d'entrada no es modifica). La valoració s'actualitza contra la mitjana
 * dels oponents de la partida.
 */
export function recordGame(
  profile: PlayerProfile,
  opponents: DifficultyKey[],
  won: boolean,
  date: Date = new Date(),
): PlayerProfile {
  const opponentRatings = opponents.map((key) => DIFFICULTIES[key].rating);
  const averageOpponent =
    opponentRatings.reduce((a, b) => a + b, 0) / Math.max(1, opponentRatings.length);
  const rating = updateRating(profile.rating, averageOpponent, won ? 1 : 0, kFactor(profile.gamesPlayed));
  const record: GameRecord = {
    date: date.toISOString(),
    opponents,
    won,
    ratingAfter: rating,
  };
  return {
    ...profile,
    rating,
    gamesPlayed: profile.gamesPlayed + 1,
    wins: profile.wins + (won ? 1 : 0),
    history: [...profile.history, record].slice(-HISTORY_LIMIT),
  };
}
