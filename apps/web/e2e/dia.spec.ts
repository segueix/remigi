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
  // El bàner porta directament a la partida.
  await page.getByRole('button', { name: 'Partida del dia', exact: true }).click();
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
  // 2 rivals entre setmana; 3 el diumenge (taula de quatre).
  expect([2, 3]).toContain(a.rivals.length);
});

test('la partida del dia es juga un cop: resultat per jugades o punts, i es pot compartir', async ({ page }) => {
  await obreNet(page);
  const banner = page.locator('.dia-boto');
  const juga = page.getByRole('button', { name: 'Partida del dia', exact: true });
  await expect(banner).toContainText('Partida del dia #');
  await expect(juga).toHaveText('Juga');
  await juga.click();

  // Directament a la partida, sense cap pantalla entremig.
  await expect(page.locator('.nivell-mode')).toContainText('Partida del dia #');
  // 2 rivals entre setmana, 3 el diumenge.
  expect([3, 4]).toContain(await page.locator('.player').count());

  // Roba fins que s'acaba la partida.
  for (let i = 0; i < 500; i++) {
    if (await page.locator('.final-dia').isVisible().catch(() => false)) break;
    await avanca(page)
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  const final = page.locator('.final-dia');
  await expect(final).toBeVisible();
  await expect(final.locator('.dia-targeta-text')).toHaveText(/(Has guanyat!en \d+ jugad(a|es)|No ha pogut ser\d+ punts? a la mà)/);
  await expect(final.getByRole('button', { name: 'Comparteix · Em superes?' })).toBeVisible();
  // Sense compte, on s'entra per sortir al rànquing.
  await expect(final.locator('.dia-posicio')).toContainText('Entra amb Google a dalt de l’inici');

  // Ja està feta: el rànquing ensenya el resultat i no deixa tornar-hi.
  await page.getByRole('button', { name: 'Veure el rànquing' }).click();
  await expect(page.locator('.dia .dia-targeta')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Juga la partida del dia' })).toHaveCount(0);

  // I en tornar a obrir l'app, el bàner porta al resultat, no a una altra partida.
  await page.reload();
  await expect(juga).toHaveText('Resultat');
  await juga.click();
  await expect(page.locator('.dia .dia-targeta')).toBeVisible();
});

test('l’enllaç compartit obre directament la partida del dia; a dalt de l’inici, entrar amb Google', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
  });
  await page.goto('./?partida=dia');
  await expect(page.locator('.nivell-mode')).toContainText('Partida del dia #');
  // L'adreça queda neta: recarregar no hi torna.
  expect(page.url()).not.toContain('partida=dia');
  await page.goto('./');
  await expect(page.locator('.inici-cap .inici-google')).toHaveText('Entra amb Google');
});

test('el bàner explica com funciona i porta a la classificació (avui, ahir i ratxes)', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
  });
  await page.goto('./');
  const info = page.getByRole('button', { name: 'Com funciona' });
  await info.click();
  await expect(page.locator('#dia-info')).toContainText('mateixes fitxes inicials');
  await expect(page.locator('#dia-info')).toContainText('sense rellotge');
  await info.click();
  await expect(page.locator('#dia-info')).toHaveCount(0);
  await page.getByRole('button', { name: 'Classificació' }).click();
  await expect(page.locator('.dia h2')).toContainText('Partida del dia #');
  await expect(page.getByRole('tab')).toHaveText(['Avui', 'Ahir', 'Ratxes']);
  // Les hores d'actualització es diuen sempre, també en directe (o sense connexió, l'error).
  await expect(page.locator('.dia-ranking-nota, .dia-ranking p.muted').first()).toContainText(/(s’actualitz|No s’ha pogut)/);
});

test('la partida del dia no té rellotge encara que el joc lliure en tingui', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
    localStorage.setItem('remigi:temps-torn', '60');
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Partida del dia', exact: true }).click();
  await expect(page.locator('.rack .tile').first()).toBeVisible();
  await expect(page.locator('.rellotge-torn')).toHaveCount(0);
});
