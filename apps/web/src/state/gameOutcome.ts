import {
  recordGame,
  type DifficultyKey,
  type GameState,
  type PlayerProfile,
} from '@rummikub/core';

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
 * l'habilitat.
 */
export function profileAfterGame(
  profile: PlayerProfile,
  game: GameState,
  opponents: DifficultyKey[],
  date?: Date,
): PlayerProfile {
  return recordGame(profile, opponents, humanWon(game), date);
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

export function ratingChange(before: PlayerProfile, after: PlayerProfile): RatingChange {
  return { before: before.rating, after: after.rating, delta: after.rating - before.rating };
}
