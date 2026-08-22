/**
 * Simulador de partides IA contra IA per validar el motor i mesurar els canvis:
 *
 *   npm run simulate                     # 20 partides Expert vs Mitjà vs Novell
 *   npm run simulate -- --games 200      # més partides
 *   npm run simulate -- --seed 7         # una altra llavor inicial
 *   npm run simulate -- --no-rearrange   # expert sense reordenació de taula
 *   npm run simulate -- --duel 200       # expert nou contra expert antic
 *
 * A cada torn es comprova l'invariant de conservació: sac + taula + mans = 106,
 * i es mesura el temps que triga a decidir cada jugada.
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

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function countTiles(state: GameState): number {
  return (
    state.bag.length +
    state.board.reduce((sum, meld) => sum + meld.length, 0) +
    state.players.reduce((sum, player) => sum + player.rack.length, 0)
  );
}

interface Timing {
  /** Mil·lisegons de cada decisió del jugador que ens interessa mesurar. */
  samples: number[];
}

/** Juga una partida sencera i retorna l'estat final. */
function playGame(
  seed: number,
  names: string[],
  levels: string[],
  rearrangeFor: boolean[],
  timing: Timing,
  measuredPlayer: number,
): GameState {
  let state = createGame({
    seed,
    players: names.map((name, i) => ({ name, kind: 'ai' as const, aiLevel: levels[i] })),
  });
  const rng = createRng(seed + 1);

  while (state.status === 'playing' && state.turn <= MAX_TURNS) {
    const player = state.currentPlayer;
    const overrides = rearrangeFor[player] ? undefined : { rearrangesTable: false };
    const started = performance.now();
    const move = decideAiMove(state, player, rng, { overrides });
    if (player === measuredPlayer) timing.samples.push(performance.now() - started);

    state = applyMove(state, move);
    if (countTiles(state) !== TOTAL_TILES) {
      throw new Error(`S'ha trencat la conservació de fitxes al torn ${state.turn}`);
    }
  }
  if (state.status !== 'finished') {
    throw new Error(`La partida amb llavor ${seed} no ha acabat en ${MAX_TURNS} torns`);
  }
  return state;
}

function summariseTiming(timing: Timing): string {
  if (timing.samples.length === 0) return 'sense mesures';
  const sorted = [...timing.samples].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return `mitjana ${mean.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · pitjor ${sorted.at(-1)!.toFixed(1)} ms`;
}

/** Expert amb reordenació contra expert sense, a igualtat de repartiment. */
function duel(games: number, baseSeed: number): void {
  const timing: Timing = { samples: [] };
  const timingOld: Timing = { samples: [] };
  const wins = { nou: 0, antic: 0 };

  for (let i = 0; i < games; i++) {
    // Es juguen les dues meitats bescanviant la posició, perquè començar
    // primer no decideixi la comparativa.
    const seed = baseSeed + i * 1000;
    const newFirst = i % 2 === 0;
    const state = playGame(
      seed,
      newFirst ? ['Expert nou', 'Expert antic'] : ['Expert antic', 'Expert nou'],
      ['expert', 'expert'],
      newFirst ? [true, false] : [false, true],
      newFirst ? timing : timingOld,
      0,
    );
    const winner = state.players.find((p) => p.id === state.winnerId)!.name;
    if (winner === 'Expert nou') wins.nou++;
    else wins.antic++;
  }

  console.log(`Duel a ${games} partides (mateix repartiment, alternant qui comença):`);
  const percent = (n: number) => ((100 * n) / games).toFixed(0);
  console.log(`  Expert amb reordenació:  ${String(wins.nou).padStart(3)} victòries (${percent(wins.nou)}%)`);
  console.log(`  Expert sense reordenació:${String(wins.antic).padStart(3)} victòries (${percent(wins.antic)}%)`);
  console.log(`  Temps de decisió amb reordenació: ${summariseTiming(timing)}`);
  console.log(`  Temps de decisió sense:           ${summariseTiming(timingOld)}`);
}

function main(): void {
  const baseSeed = argValue('seed', 42);
  const duelGames = argValue('duel', 0);
  if (duelGames > 0) return duel(duelGames, baseSeed);

  const games = argValue('games', 20);
  const rearrange = !hasFlag('no-rearrange');
  const wins = new Map<string, number>();
  const timing: Timing = { samples: [] };
  let totalTurns = 0;

  for (let i = 0; i < games; i++) {
    const state = playGame(
      baseSeed + i * 1000,
      ['Expert', 'Mitjà', 'Novell'],
      ['expert', 'medium', 'rookie'],
      [rearrange, true, true],
      timing,
      0,
    );
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

  console.log(
    `Resultats de ${games} partides (Expert${rearrange ? '' : ' SENSE reordenació'} vs Mitjà vs Novell):`,
  );
  for (const name of ['Expert', 'Mitjà', 'Novell']) {
    const count = wins.get(name) ?? 0;
    console.log(
      `  ${name.padEnd(8)} ${String(count).padStart(3)} victòries (${((100 * count) / games).toFixed(0)}%)`,
    );
  }
  console.log(`Mitjana de torns per partida: ${(totalTurns / games).toFixed(1)}`);
  console.log(`Temps de decisió de l'expert: ${summariseTiming(timing)}`);
}

main();
