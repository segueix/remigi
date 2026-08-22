import type { Rng } from '../core/random';
import type { GameState, Move } from '../core/types';
import { difficultyByKey, type AiParams } from './difficulty';
import { chooseBestPlay } from './solver';

/** Paràmetres d'IA del jugador (segons el seu `aiLevel`, o el nivell per defecte). */
export function aiParamsForPlayer(state: GameState, playerIndex: number): AiParams {
  return difficultyByKey(state.players[playerIndex].aiLevel);
}

/**
 * Decideix el moviment d'un jugador IA. El nivell de dificultat limita el
 * cercador (jokers, extensions) i hi afegeix una probabilitat d'error humà:
 * "no veure" la jugada i robar fitxa.
 *
 * `rng` permet passar un generador amb llavor perquè les partides siguin
 * reproduïbles; per defecte fa servir Math.random.
 */
export function decideAiMove(
  state: GameState,
  playerIndex: number,
  rng: Rng = Math.random,
): Move {
  const params = aiParamsForPlayer(state, playerIndex);
  const best = chooseBestPlay(state, playerIndex, {
    allowJokers: params.usesJokers,
    allowExtensions: params.extendsBoard,
  });
  if (!best) return { type: 'draw' };
  if (rng() < params.mistakeRate) return { type: 'draw' };
  return { type: 'play', board: best.board };
}
