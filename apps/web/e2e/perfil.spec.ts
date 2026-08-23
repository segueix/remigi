import { expect, test } from '@playwright/test';
import { PROFILE_KEY, comencaDeZero, jugaContra, obreMenu, robaFinsAlFinal, tancaMenu } from './ajudants';

const habilitat = (page: import('@playwright/test').Page) =>
  page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null')?.rating, PROFILE_KEY);

test('el perfil es conserva en tancar i reobrir', async ({ page }) => {
  await comencaDeZero(page, 'Anna');
  await expect(page.locator('.player .player-nom').first()).toHaveText('Anna');
  expect(await habilitat(page)).toBe(1100);

  await page.reload();
  await expect(page.locator('.player .player-nom').first()).toHaveText('Anna');
});

test('els oponents proposats pugen amb l’habilitat', async ({ page }) => {
  await comencaDeZero(page);
  await obreMenu(page);
  await expect(page.locator('.suggestion')).toContainText('Novell, Fàcil');
  await tancaMenu(page);

  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    localStorage.setItem(clau, JSON.stringify({ ...perfil, rating: 1600 }));
  }, PROFILE_KEY);
  await page.reload();
  await obreMenu(page);
  await expect(page.locator('.suggestion')).toContainText('Avançat, Expert');
});

test('cada partida mou l’habilitat i queda a l’historial', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 2);
  expect(await robaFinsAlFinal(page)).toBe(true);

  const desprésDeJugar = await habilitat(page);
  expect(desprésDeJugar).not.toBe(1100);

  // Del final de la partida s'entra directament a l'historial.
  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(page.locator('.stats')).toContainText(String(desprésDeJugar));
  await expect(page.locator('.history li')).toHaveCount(1);

  // I d'allà es torna a la taula.
  await page.getByRole('button', { name: 'Torna a la partida' }).click();
  await expect(page.getByRole('button', { name: 'Una altra partida' })).toBeVisible();
});

test('una partida a mitges es continua sola en tornar a obrir', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 1);

  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: /Robar fitxa|Passar torn/ }).click();
    await page.waitForTimeout(60);
  }
  const torn = await page.locator('.turn-line').textContent();
  const fitxes = await page.locator('.rack .tile').count();

  // Es tanca la pestanya i es torna a obrir: la partida és exactament on era.
  await page.reload();
  await expect(page.locator('.turn-line')).toHaveText(torn!);
  await expect(page.locator('.rack .tile')).toHaveCount(fitxes);
});

test('reiniciar el perfil demana confirmació i torna a començar de zero', async ({ page }) => {
  await comencaDeZero(page, 'Anna');
  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    localStorage.setItem(clau, JSON.stringify({ ...perfil, rating: 1600 }));
  }, PROFILE_KEY);
  await page.reload();

  // El reinici viu a l'historial.
  await obreMenu(page);
  await page.getByRole('button', { name: 'Historial' }).click();
  await page.getByRole('button', { name: 'Reinicia el perfil' }).click();
  await expect(page.getByText(/Segur que vols esborrar/)).toBeVisible();
  await page.getByRole('button', { name: 'Sí, esborra’l' }).click();

  // El perfil es torna a crear de zero, amb el nom de casa i l'habilitat inicial.
  await expect
    .poll(async () =>
      page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY),
    )
    .toMatchObject({ name: 'Jugador', rating: 1100, gamesPlayed: 0 });
});
