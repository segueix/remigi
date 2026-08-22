import react from '@vitejs/plugin-react';
// De `vitest/config` i no de `vite`, perquè la config porta l'apartat `test`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // @rummikub/core és un paquet del workspace que publica codi font TypeScript
  // (el seu `main` apunta a src/index.ts). Vite el tracta com a codi del
  // projecte gràcies a l'enllaç simbòlic de npm workspaces, així que el
  // transpila igual que la resta de fonts i no cal cap àlies.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
