import react from '@vitejs/plugin-react';
// De `vitest/config` i no de `vite`, perquè la config porta l'apartat `test`.
import { defineConfig } from 'vitest/config';

/**
 * A GitHub Pages el joc no penja de l'arrel del domini sinó de
 * `/rummikub/`, així que el build necessita saber-ho per generar bé les rutes
 * dels fitxers. En desenvolupament sempre és l'arrel.
 *
 * `BASE_PATH` permet publicar-lo en una altra ruta sense tocar el codi.
 */
const BASE_PATH = process.env.BASE_PATH ?? '/rummikub/';

export default defineConfig(({ command, isPreview }) => ({
  // També a `preview`, que serveix el build de producció: si allà es servís des
  // de l'arrel, les rutes dels fitxers no lligarien i les proves de navegador
  // no estarien comprovant el que es publica de debò.
  base: command === 'build' || isPreview ? BASE_PATH : '/',
  plugins: [react()],
  // @rummikub/core és un paquet del workspace que publica codi font TypeScript
  // (el seu `main` apunta a src/index.ts). Vite el tracta com a codi del
  // projecte gràcies a l'enllaç simbòlic de npm workspaces, així que el
  // transpila igual que la resta de fonts i no cal cap àlies.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
