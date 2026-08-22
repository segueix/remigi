import { JOKER_PENALTY_POINTS } from './constants';
import { isJoker } from './tiles';
import type { GameState, Tile } from './types';

/** Valor d'una fitxa quan es queda a la mà: el seu número; un joker, 30. */
export function tilePoints(tile: Tile): number {
  return isJoker(tile) ? JOKER_PENALTY_POINTS : tile.value;
}

export function rackPoints(rack: Tile[]): number {
  return rack.reduce((sum, tile) => sum + tilePoints(tile), 0);
}

export interface PlayerScore {
  playerId: string;
  name: string;
  points: number;
}

/**
 * Puntuació final de la partida: cada perdedor resta els punts que li queden a la
 * mà i el guanyador suma els punts de tots els altres (menys els seus propis, si
 * la partida ha quedat bloquejada i encara té fitxes).
 */
export function finalScores(state: GameState): PlayerScore[] {
  const pending = state.players.map((p) => rackPoints(p.rack));
  const totalPending = pending.reduce((a, b) => a + b, 0);
  return state.players.map((player, i) => ({
    playerId: player.id,
    name: player.name,
    points:
      player.id === state.winnerId ? totalPending - 2 * pending[i] : -pending[i],
  }));
}
