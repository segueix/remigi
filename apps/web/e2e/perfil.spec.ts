import { expect, test } from '@playwright/test';
import { PROFILE_KEY, comencaDeZero, jugaContra, robaFinsAlFinal } from './ajudants';

const habilitat = (page: import('@playwright/test').Page) =>
  page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null')?.rating, PROFILE_KEY);

test('el perfil es conserva en tancar i reobrir', async ({ page }) => {
  await comencaDeZero(page, 'Anna');
  await expect(page.getByRole('heading', { name: 'Hola, Anna!' })).toBeVisible();
  expect(await habilitat(page)).toBe(1100);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Anna!' })).toBeVisible();
});

test('els oponents proposats pugen amb l’habilitat', async ({ page }) => {
  await comencaDeZero(page);
  await expect(page.locator('.suggestion')).toContainText('Novell, Fàcil');

  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    localStorage.setItem(clau, JSON.stringify({ ...perfil, rating: 1600 }));
  }, PROFILE_KEY);
  await page.reload();
  await expect(page.locator('.suggestion')).toContainText('Avançat, Expert');
});

test('cada partida mou l’habilitat i queda a l’historial', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 2);
  expect(await robaFinsAlFinal(page)).toBe(true);

  const desprésDeJugar = await habilitat(page);
  expect(desprésDeJugar).not.toBe(1100);

  await page.getByRole('button', { name: 'Torna a l’inici' }).click();
  await page.getByRole('button', { name: 'Estadístiques' }).click();
  await expect(page.locator('.stats')).toContainText(String(desprésDeJugar));
  await expect(page.locator('.history li')).toHaveCount(1);
});

test('una partida a mitges es pot continuar després', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 1);

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /Robar fitxa|Passar torn/ }).click();
    await page.waitForTimeout(60);
  }
  const torn = await page.locator('.turn-line').textContent();
  const fitxes = await page.locator('.rack .tile').count();

  await page.reload();
  await page.getByRole('button', { name: 'Continua la partida' }).click();
  await expect(page.locator('.turn-line')).toHaveText(torn!);
  await expect(page.locator('.rack .tile')).toHaveCount(fitxes);
});

test('reiniciar el perfil demana confirmació i esborra tot', async ({ page }) => {
  await comencaDeZero(page);
  await page.getByRole('button', { name: 'Reinicia el perfil' }).click();
  await expect(page.getByText(/Segur que vols esborrar/)).toBeVisible();

  await page.getByRole('button', { name: 'Sí, esborra’l' }).click();
  await expect(page.getByPlaceholder('El teu nom')).toBeVisible();
  expect(await page.evaluate((clau) => localStorage.getItem(clau), PROFILE_KEY)).toBeNull();
});
