import type { GameState } from '@remigi/core';

/**
 * Quan els bots s'ajusten a com et va (el *rubber banding* del motor,
 * docs/IA-ADAPTATIVA.md § 5).
 *
 * - Si el jugador ha activat «Ajusta la dificultat durant la partida», sempre.
 * - **A la lliga, també mentre el jugador humà encara no ha fet la sortida
 *   inicial** (els 30 punts). Els rivals de les lligues altes són Experts i
 *   acaben en ~9 rondes: a la Mundial A, una partida de cada ~37 s'acabava
 *   sense que el jugador hagués pogut ni obrir. Només mentre no ha obert, els
 *   rivals es relaxen (més errades, menys reordenacions); en obrir, tornen a la
 *   seva força de lliga. Mesurat a 1.200 partides contra 3 Experts: les
 *   partides sense obrir baixen del 2,7% al 0,2% sense canviar la durada, les
 *   victòries ni els punts de la resta de la partida (a diferència de
 *   l'ajust permanent, que fa guanyar més i allarga les partides).
 *
 * Només mira el que ja és a l'estat de la partida (`hasOpened`): no cal desar
 * res, i una partida desada i represa s'ajusta igual.
 */
export function botsAdaptThisTurn(
  setup: { mode?: string; adaptDuringGame?: boolean },
  state: GameState,
): boolean {
  if (setup.adaptDuringGame) return true;
  if (setup.mode !== 'lliga') return false;
  return state.players.some((player) => player.kind === 'human' && !player.hasOpened);
}
