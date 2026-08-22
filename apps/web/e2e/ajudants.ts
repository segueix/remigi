import { expect, type Page } from '@playwright/test';

export const PROFILE_KEY = 'rummikub:profile:local';

/** Entra al joc amb un perfil net i el nom donat. */
export async function comencaDeZero(page: Page, nom = 'Daniel'): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByPlaceholder('El teu nom').fill(nom);
  await page.getByRole('button', { name: 'Desa' }).click();
  await expect(page.getByRole('button', { name: /Comença a jugar/ })).toBeVisible();
}

/** Tria el nombre d'oponents i entra a la partida. */
export async function jugaContra(page: Page, oponents: 1 | 2 | 3): Promise<void> {
  await page.getByRole('button', { name: String(oponents), exact: true }).click();
  await page.getByRole('button', { name: /Comença (a jugar|una partida nova)/ }).click();
  await expect(page.locator('.rack .tile').first()).toBeVisible();
}

const finalPartida = (page: Page) => page.getByRole('button', { name: 'Una altra partida' });

/**
 * Porta la partida fins al final robant a cada torn. No mira de jugar bé: el
 * que es comprova és que una partida sencera acaba sense petar.
 */
export async function robaFinsAlFinal(page: Page, maxTorns = 400): Promise<boolean> {
  for (let i = 0; i < maxTorns; i++) {
    if (await finalPartida(page).isVisible().catch(() => false)) return true;
    const roba = page.getByRole('button', { name: /Robar fitxa|Passar torn/ });
    if (await roba.isEnabled().catch(() => false)) await roba.click();
    await page.waitForTimeout(20);
  }
  return finalPartida(page).isVisible();
}

/**
 * Roba fins que hi hagi jugades a la taula. Com que el jugador no fa res més que
 * robar, tot el que hi aparegui l'hi han posat els bots.
 */
export async function robaFinsQueUnBotJugui(page: Page, maxTorns = 40): Promise<boolean> {
  for (let i = 0; i < maxTorns; i++) {
    if ((await page.locator('.board .meld').count()) > 0) break;
    if (await finalPartida(page).isVisible().catch(() => false)) break;
    const roba = page.getByRole('button', { name: /Robar fitxa|Passar torn/ });
    if (await roba.isEnabled().catch(() => false)) await roba.click();
    await page.waitForTimeout(40);
  }
  if ((await page.locator('.board .meld').count()) === 0) return false;
  // Els bots poden estar jugant encara: cal esperar el torn per poder tocar res.
  await expect(page.getByRole('button', { name: /Robar fitxa|Passar torn/ })).toBeEnabled();
  return true;
}

/** Baixa un grup a la taula com a jugada nova. */
export async function baixaGrup(page: Page, fitxes: string[]): Promise<void> {
  await page.locator(`.rack .tile[aria-label="${fitxes[0]}"]`).first().click();
  await page.getByRole('button', { name: '+ Jugada nova' }).click();
  for (const fitxa of fitxes.slice(1)) {
    await page.locator(`.rack .tile[aria-label="${fitxa}"]`).first().click();
    await page.locator('.board .meld').last().click();
  }
}

/* ---------- Partides preparades ---------- */

type Fitxa = { id: string; kind: 'number'; color: string; value: number };

/** Fitxa amb l'identificador que fa servir el motor. */
export function f(color: string, value: number, copia: 'a' | 'b' = 'a'): Fitxa {
  return { id: `${color}-${value}-${copia}`, kind: 'number', color, value };
}

/**
 * Entra a una partida amb una mà i una taula concretes.
 *
 * Deixar-ho a l'atzar faria que segons quines proves no es poguessin fer (una
 * mà de 14 fitxes pot no tenir cap jugada possible), i una prova que es salta
 * sola no garanteix res. S'aprofita el mateix camí que fa servir el joc per
 * continuar una partida a mitges, així que no cal cap porta del darrere: el que
 * es prepara ha de passar la mateixa validació que qualsevol partida desada.
 */
export async function entraAmbPartida(
  page: import('@playwright/test').Page,
  partida: { rack: Fitxa[]; board?: Fitxa[][]; haObert?: boolean; autors?: [string, number][] },
): Promise<void> {
  await page.goto('./');
  await page.evaluate(
    ([dades]) => {
      localStorage.clear();
      localStorage.setItem(
        'rummikub:profile:local',
        JSON.stringify({
          id: 'local',
          name: 'Daniel',
          rating: 1100,
          gamesPlayed: 0,
          wins: 0,
          history: [],
        }),
      );
      localStorage.setItem(
        'rummikub:game',
        JSON.stringify({
          setup: { playerName: 'Daniel', opponents: ['easy'] },
          owners: dades.autors,
          game: {
            seed: 1,
            bag: [{ id: 'black-1-b', kind: 'number', color: 'black', value: 1 }],
            board: dades.board,
            players: [
              { id: 'p1', name: 'Daniel', kind: 'human', rack: dades.rack, hasOpened: dades.haObert },
              {
                id: 'p2',
                name: 'Bot 1',
                kind: 'ai',
                aiLevel: 'easy',
                rack: [{ id: 'orange-1-b', kind: 'number', color: 'orange', value: 1 }],
                hasOpened: true,
              },
            ],
            currentPlayer: 0,
            turn: 5,
            consecutivePasses: 0,
            status: 'playing',
          },
        }),
      );
    },
    [
      {
        rack: partida.rack,
        board: partida.board ?? [],
        haObert: partida.haObert ?? false,
        autors: partida.autors ?? [],
      },
    ],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continua la partida' }).click();
  await expect(page.locator('.rack .tile').first()).toBeVisible();
}
