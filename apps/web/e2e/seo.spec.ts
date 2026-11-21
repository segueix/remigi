import { expect, test } from '@playwright/test';

/*
 * La pàgina per a qui cerca el Rummikub en català: es publica tal qual (fora
 * de l'app), en català, amb l'avís de marca, i el service worker no la desa
 * com si fos la pàgina del joc.
 */
test('la pàgina «Rummikub en català» és en català, enllaça al joc i porta l’avís de marca', async ({ page }) => {
  await page.goto('./rummy-en-catala/');
  // Als títols, «de la família del rummy» (sense la marca); al text, el Rummikub com a comparació.
  await expect(page).toHaveTitle(/família del rummy/);
  await expect(page).not.toHaveTitle(/Rummikub/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
  await expect(page.locator('h1')).toContainText('família del rummy');
  await expect(page.locator('main')).toContainText('Rummikub en català');
  await expect(page.locator('footer')).toContainText('marca registrada');
  await page.getByRole('link', { name: 'Juga al Remigi ara' }).click();
  await expect(page.locator('.mode-card').first()).toBeVisible();
});

test('el service worker no desa una altra pàgina com si fos la del joc', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.goto('./rummy-en-catala/');
  await expect(page.locator('h1')).toContainText('família del rummy');
  // Sense connexió, la pàgina del joc continua sent el joc.
  await context.setOffline(true);
  await page.goto('./');
  await expect(page.locator('.mode-card').first()).toBeVisible();
  await context.setOffline(false);
});

test('l’adreça antiga (amb «rummikub») porta a la nova, i no s’indexa', async ({ page }) => {
  await page.goto('./rummikub-en-catala/');
  await expect(page).toHaveURL(/\/rummy-en-catala\/$/);
  await expect(page.locator('h1')).toContainText('família del rummy');
});
