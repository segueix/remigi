/**
 * Simulador de partides IA contra IA per validar el motor abans de tenir la web:
 *
 *   npm run simulate                    # 20 partides Expert vs Mitjà vs Novell
 *   npm run simulate -- --games 100     # més partides
 *   npm run simulate -- --seed 7        # una altra llavor inicial
 *
 * A cada torn es comprova l'invariant de conservació: sac + taula + mans = 106.
 * Si els nivells estan ben ordenats, l'expert ha de guanyar clarament més sovint
 * que el novell.
 */
import { decideAiMove } from '../ai/aiPlayer';
import { TOTAL_TILES } from '../core/constants';
import { applyMove, createGame } from '../core/game';
import { createRng } from '../core/random';
import { finalScores } from '../core/scoring';
import type { GameState } from '../core/types';

const MAX_TURNS = 1000;

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function countTiles(state: GameState): number {
  return (
    state.bag.length +
    state.board.reduce((sum, meld) => sum + meld.length, 0) +
    state.players.reduce((sum, player) => sum + player.rack.length, 0)
  );
}

function playGame(seed: number): GameState {
  let state = createGame({
    seed,
    players: [
      { name: 'Expert', kind: 'ai', aiLevel: 'expert' },
      { name: 'Mitjà', kind: 'ai', aiLevel: 'medium' },
      { name: 'Novell', kind: 'ai', aiLevel: 'rookie' },
    ],
  });
  const rng = createRng(seed + 1);
  while (state.status === 'playing' && state.turn <= MAX_TURNS) {
    state = applyMove(state, decideAiMove(state, state.currentPlayer, rng));
    if (countTiles(state) !== TOTAL_TILES) {
      throw new Error(`S'ha trencat la conservació de fitxes al torn ${state.turn}`);
    }
  }
  if (state.status !== 'finished') {
    throw new Error(`La partida amb llavor ${seed} no ha acabat en ${MAX_TURNS} torns`);
  }
  return state;
}

function main(): void {
  const games = argValue('games', 20);
  const baseSeed = argValue('seed', 42);

  const wins = new Map<string, number>();
  let totalTurns = 0;

  for (let i = 0; i < games; i++) {
    const state = playGame(baseSeed + i * 1000);
    const winner = state.players.find((p) => p.id === state.winnerId);
    if (winner) wins.set(winner.name, (wins.get(winner.name) ?? 0) + 1);
    totalTurns += state.turn;

    if (i === 0) {
      console.log(`Exemple (llavor ${state.seed}), puntuació final:`);
      for (const score of finalScores(state)) {
        console.log(`  ${score.name.padEnd(8)} ${score.points >= 0 ? '+' : ''}${score.points}`);
      }
      console.log('');
    }
  }

  console.log(`Resultats de ${games} partides (Expert vs Mitjà vs Novell):`);
  for (const name of ['Expert', 'Mitjà', 'Novell']) {
    const count = wins.get(name) ?? 0;
    const percent = ((100 * count) / games).toFixed(0);
    console.log(`  ${name.padEnd(8)} ${String(count).padStart(3)} victòries (${percent}%)`);
  }
  console.log(`Mitjana de torns per partida: ${(totalTurns / games).toFixed(1)}`);
}

main();
