import { describe, expect, it } from 'vitest';
import { applyMove, createGame, createRng, decideAiMove, type GameState } from '../src';

/**
 * Invariants de partides senceres simulades: es juguen milers de torns amb
 * tots els nivells de cervell (reordenació completa inclosa) i es comprova,
 * moviment a moviment, que el joc no regala ni perd mai cap fitxa.
 *
 * És la xarxa de seguretat contra els «glitchs» de percepció: si aquestes
 * proves passen, robar dona sempre exactament una fitxa i qualsevol cosa
 * estranya que es vegi a la pantalla és de la interfície, no del motor.
 */

const allIds = (state: GameState): string[] => [
  ...state.bag.map((tile) => tile.id),
  ...state.board.flat().map((tile) => tile.id),
  ...state.players.flatMap((player) => player.rack.map((tile) => tile.id)),
];

describe('invariants de partida sencera', () => {
  it('robar dona exactament una fitxa, i cap fitxa no es duplica ni es perd', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rng = createRng(seed * 977);
      let game = createGame({
        seed,
        players: [
          // El primer juga amb el cervell per defecte: el que importa és el motor.
          { name: 'Humà', kind: 'human' },
          { name: 'Bot expert', kind: 'ai', aiLevel: 'expert' },
          { name: 'Bot mitjà', kind: 'ai', aiLevel: 'medium' },
        ],
      });

      const total = [...allIds(game)].sort().join('|');
      expect(new Set(allIds(game)).size).toBe(allIds(game).length);

      let turns = 0;
      while (game.status === 'playing' && turns < 1000) {
        const mover = game.currentPlayer;
        const before = game;
        const move = decideAiMove(game, mover, rng);
        game = applyMove(game, move);

        if (move.type === 'draw') {
          // Amb sac: una fitxa i només una, al faristol de qui roba. Sense: cap.
          const expected = before.bag.length > 0 ? 1 : 0;
          expect(game.players[mover].rack.length).toBe(
            before.players[mover].rack.length + expected,
          );
          expect(game.bag.length).toBe(before.bag.length - expected);
          // Els faristols de la resta no es toquen ni d'una fitxa.
          game.players.forEach((player, index) => {
            if (index !== mover) {
              expect(player.rack.map((tile) => tile.id)).toEqual(
                before.players[index].rack.map((tile) => tile.id),
              );
            }
          });
        }

        // Conservació global: les mateixes 106 fitxes, sense repetits, sempre.
        const ids = allIds(game);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort().join('|')).toBe(total);
        turns++;
      }

      // Les partides acaben (victòria o bloqueig), no s'encallen.
      expect(game.status).toBe('finished');
    }
  });
});
