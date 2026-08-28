/**
 * Build del motor: empaqueta l'API pública (src/engine/index.ts) amb totes les
 * seves dependències internes en un únic fitxer executable per Node o per un
 * Web Worker, sense React, sense DOM i sense res del navegador:
 *
 *   dist/remigi-engine.js     el motor, ESM autocontingut
 *   dist/remigi-engine.d.ts   els tipus públics (reexporta dist/types/)
 *
 * És reproduïble: mateix codi font i mateixa versió d'esbuild, mateix fitxer.
 * La plataforma «neutral» fa de xarxa de seguretat: si mai el motor importés
 * un mòdul de Node o del navegador, el build fallaria aquí mateix.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outFile = join(packageRoot, 'dist', 'remigi-engine.js');

const versionSource = readFileSync(join(packageRoot, 'src', 'engine', 'version.ts'), 'utf8');
const version = /ENGINE_VERSION = '([^']+)'/.exec(versionSource)?.[1];
if (!version) throw new Error("No s'ha trobat ENGINE_VERSION a src/engine/version.ts");

await build({
  entryPoints: [join(packageRoot, 'src', 'engine', 'index.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  banner: {
    js: `// remigi-engine v${version} — generat amb «npm run build:engine»; no editar a mà.`,
  },
});

// Els tipus públics: declaracions de tot el que l'entrada arrossega…
const tsc = spawnSync(
  process.execPath,
  [join(packageRoot, '..', '..', 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(packageRoot, 'tsconfig.engine.json')],
  { stdio: 'inherit' },
);
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

// …i un embolcall al costat del .js perquè TypeScript els trobi tot sol.
mkdirSync(join(packageRoot, 'dist'), { recursive: true });
writeFileSync(
  join(packageRoot, 'dist', 'remigi-engine.d.ts'),
  `// Tipus públics de remigi-engine v${version} (generat; no editar a mà).\nexport * from './types/engine/index.js';\n`,
);

console.log(`remigi-engine v${version} → ${outFile}`);
