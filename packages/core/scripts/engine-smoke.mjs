/**
 * Prova de fum de l'artefacte generat: carrega dist/remigi-engine.js amb Node
 * pelat (sense TypeScript, sense Vite, sense React) i hi juga dues vegades la
 * mateixa partida sencera Expert contra Mitjà. Comprova que la partida acaba,
 * que les fitxes es conserven i que amb la mateixa llavor el resultat és
 * exactament el mateix. Surt amb codi d'error si res no quadra.
 *
 *   npm run build:engine && node scripts/engine-smoke.mjs
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const artifact = pathToFileURL(join(packageRoot, 'dist', 'remigi-engine.js')).href;

const { ENGINE_VERSION, TOTAL_TILES, applyMove, createEngine, createGame, finalScores } =
  await import(artifact);

function playGame(seed) {
  let state = createGame({
    seed,
    players: [
      { name: 'Expert', kind: 'ai', aiLevel: 'expert' },
      { name: 'Mitjà', kind: 'ai', aiLevel: 'medium' },
    ],
  });
  const engine = createEngine({ seed: seed + 1 });
  let decisions = 0;

  while (state.status === 'playing' && state.turn <= 1000) {
    const decision = engine.play(state);
    decisions++;
    state = applyMove(state, decision.move);
    const tiles =
      state.bag.length +
      state.board.reduce((sum, meld) => sum + meld.length, 0) +
      state.players.reduce((sum, player) => sum + player.rack.length, 0);
    if (tiles !== TOTAL_TILES) throw new Error(`Conservació trencada al torn ${state.turn}`);
  }
  if (state.status !== 'finished') throw new Error('La partida no ha acabat');
  return { decisions, turns: state.turn, scores: finalScores(state).map((s) => `${s.name} ${s.points}`) };
}

const first = playGame(2026);
const second = playGame(2026);
if (JSON.stringify(first) !== JSON.stringify(second)) {
  throw new Error(
    `El motor no és determinista: ${JSON.stringify(first)} != ${JSON.stringify(second)}`,
  );
}

console.log(`remigi-engine v${ENGINE_VERSION} funciona sol amb Node:`);
console.log(`  partida de ${first.turns} torns i ${first.decisions} decisions, dues vegades idèntica`);
console.log(`  puntuació: ${first.scores.join(' · ')}`);
