import {
  finalScores,
  marginFromPoints,
  recordGame,
  type DifficultyKey,
  type GameState,
  type PlayerProfile,
} from '@remigi/core';

/**
 * Tancament del cicle adaptatiu: convertir el resultat d'una partida en el
 * perfil actualitzat del jugador.
 *
 * Es manté a part de la interfície perquè és la peça que fa que els oponents
 * s'adaptin, i convé poder-la provar sense navegador.
 */

/** El jugador humà sempre és el primer de la taula (vegeu `newGameState`). */
export function humanWon(game: GameState): boolean {
  return game.status === 'finished' && game.winnerId === game.players[0]?.id;
}

/**
 * Perfil resultant després d'una partida acabada. Els rivals que es passen han
 * de ser els que s'han jugat de debò: són els que determinen quant puja o baixa
 * l'habilitat. El marge de la puntuació final hi afegeix el matís entre guanyar
 * per poc i guanyar de pallissa.
 */
export function profileAfterGame(
  profile: PlayerProfile,
  game: GameState,
  opponents: DifficultyKey[],
  date?: Date,
  adaptive = true,
  opponentRatings?: number[],
): PlayerProfile {
  const mine = finalScores(game).find((score) => score.playerId === game.players[0]?.id);
  const margin = mine ? marginFromPoints(mine.points, humanWon(game) ? opponents.length : 1) : undefined;
  return recordGame(profile, opponents, { won: humanWon(game), margin, adaptive, opponentRatings }, date);
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
  calibrated?: boolean;
}

export function ratingChange(before: PlayerProfile, after: PlayerProfile): RatingChange {
  return { before: before.rating, after: after.rating, delta: after.rating - before.rating,
    calibrated: before.adaptiveCalibrating === true && after.adaptiveCalibrating === false };
}
