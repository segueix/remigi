import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from '../src/engine/version';

/**
 * L'artefacte del motor: el mateix empaquetat que fa `npm run build:engine`
 * (mateixa entrada, mateixes opcions), però en memòria, perquè el test no
 * depengui d'haver executat el build abans. Es comprova que el fitxer resultant
 * és autocontingut, que no arrossega res de React, del DOM ni de Node, i que
 * un cop carregat com a mòdul de debò sap jugar una partida sencera tot sol.
 */
async function bundleEngine(): Promise<string> {
  const result = await build({
    entryPoints: [new URL('../src/engine/index.ts', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
  });
  expect(result.errors).toEqual([]);
  expect(result.outputFiles).toHaveLength(1);
  return result.outputFiles[0].text;
}

describe("l'artefacte remigi-engine.js", () => {
  it('s’empaqueta autocontingut, sense React, sense DOM i sense Node', async () => {
    const code = await bundleEngine();

    // Autocontingut: cap import per resoldre en temps d'execució.
    expect(code).not.toMatch(/^import /m);
    expect(code).not.toMatch(/\brequire\(/);

    // Res de la interfície ni de cap entorn concret.
    for (const forbidden of [/\breact\b/i, /\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bnode:/]) {
      expect(code).not.toMatch(forbidden);
    }
  });

  it('carregat com a mòdul, exposa la versió i juga una partida sencera', async () => {
    const code = await bundleEngine();
    const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
    const engine = (await import(/* @vite-ignore */ url)) as typeof import('../src/engine');

    expect(engine.ENGINE_VERSION).toBe(ENGINE_VERSION);

    let state = engine.createGame({
      seed: 8,
      players: [
        { name: 'Expert', kind: 'ai', aiLevel: 'expert' },
        { name: 'Novell', kind: 'ai', aiLevel: 'rookie' },
      ],
    });
    const player = engine.createEngine({ seed: 9 });
    while (state.status === 'playing' && state.turn <= 1000) {
      const decision = player.play(state);
      expect(decision.engineVersion).toBe(ENGINE_VERSION);
      state = engine.applyMove(state, decision.move);
    }
    expect(state.status).toBe('finished');
    expect(engine.finalScores(state)).toHaveLength(2);
  });
});
