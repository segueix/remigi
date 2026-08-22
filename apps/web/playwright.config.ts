import { defineConfig, devices } from '@playwright/test';

/**
 * Les proves de navegador s'executen contra el **build de producció servit a
 * `/rummikub/`**, que és exactament el que es publica. Així una ruta base mal
 * configurada es detecta aquí i no un cop desplegat.
 *
 * Els bots juguen sense pausa (`VITE_BOT_DELAY=0`) perquè una partida sencera
 * de prova duri segons i no minuts; és l'única diferència amb el build públic.
 */
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/rummikub/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'escriptori', use: { ...devices['Desktop Chrome'] } },
    { name: 'mòbil', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    env: { VITE_BOT_DELAY: '0' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
