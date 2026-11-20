import { expect, test, type Browser, type Page } from '@playwright/test';
import { avanca } from './ajudants';

/**
 * La partida del dia: la mateixa per a tothom (mateixa mà, mateix sac i
 * mateixos rivals), es juga un sol cop al dia i compta per jugades si guanyes
 * o pels punts que et queden a la mà si no.
 */

async function obreNet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
    localStorage.setItem('remigi:temps-torn', 'cap');
  });
  await page.goto('./');
}

/** Obre la partida del dia en un navegador net i torna el faristol inicial. */
async function faristolDelDia(browser: Browser): Promise<{ rack: string; rivals: string[] }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await obreNet(page);
  await page.getByRole('button', { name: 'Partida del dia', exact: true }).click();
  await page.getByRole('button', { name: 'Juga la partida del dia' }).click();
  await expect(page.locator('.rack .tile').first()).toBeVisible();
  const rack = (await page.locator('.rack .tile').allTextContents()).sort().join(',');
  const rivals = (await page.locator('.player .player-nom').allTextContents()).slice(1).map((n) => n.trim());
  await context.close();
  return { rack, rivals };
}

test('la partida del dia té les mateixes fitxes i els mateixos rivals a tots els aparells', async ({ browser }) => {
  const a = await faristolDelDia(browser);
  const b = await faristolDelDia(browser);
  expect(a.rack.split(',')).toHaveLength(14);
  expect(b.rack).toBe(a.rack);
  expect(b.rivals).toEqual(a.rivals);
  expect(a.rivals).toHaveLength(2);
});

test('la partida del dia es juga un cop: resultat per jugades o punts, i es pot compartir', async ({ page }) => {
  await obreNet(page);
  const banner = page.getByRole('button', { name: 'Partida del dia', exact: true });
  await expect(banner).toContainText('Partida del dia #');
  await expect(banner).toContainText('Juga');
  await banner.click();

  await expect(page.locator('.dia h2')).toContainText('Partida del dia #');
  await page.getByRole('button', { name: 'Juga la partida del dia' }).click();
  await expect(page.locator('.nivell-mode')).toContainText('Partida del dia #');
  await expect(page.locator('.player')).toHaveCount(3);

  // Roba fins que s'acaba la partida.
  for (let i = 0; i < 500; i++) {
    if (await page.locator('.final-dia').isVisible().catch(() => false)) break;
    await avanca(page)
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  const final = page.locator('.final-dia');
  await expect(final).toBeVisible();
  await expect(final.locator('.dia-resultat')).toHaveText(/(Guanyada en \d+ jugad(a|es)|\d+ punts? a la mà)/);
  await expect(final.getByRole('button', { name: 'Comparteix el resultat' })).toBeVisible();

  // Ja està feta: la pantalla del dia ensenya el resultat i no deixa tornar-hi.
  await page.getByRole('button', { name: 'Veure la partida del dia' }).click();
  await expect(page.locator('.dia .dia-resultat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Juga la partida del dia' })).toHaveCount(0);
  await expect(page.locator('.dia .rajola-c dd')).toContainText('/1');

  // I en tornar a obrir l'app, també.
  await page.reload();
  await expect(banner).toContainText('Resultat');
});

test('l’enllaç d’invitació obre la partida del dia, i s’hi pot convidar', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
  });
  await page.goto('./?partida=dia');
  await expect(page.locator('.dia h2')).toContainText('Partida del dia #');
  // L'adreça queda neta: recarregar no hi torna.
  expect(page.url()).not.toContain('partida=dia');
  await expect(page.locator('.dia').getByRole('button', { name: '📣 Convida amics' })).toBeVisible();
  await page.getByRole('button', { name: '← Inici' }).click();
  // A l'inici, convidar i entrar amb Google, a la vista.
  await expect(page.getByRole('button', { name: '📣 Convida amics' })).toBeVisible();
  await expect(page.locator('.inici-cap .inici-google')).toBeVisible();
});
