import { expect, test } from '@playwright/test';
import {
  PROFILE_KEY,
  avanca,
  comencaDeZero,
  jugaContra,
  obreMenu,
  robaFinsAlFinal,
  tancaMenu,
} from './ajudants';

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
  await expect(page.locator('.suggestion')).toContainText('Novell, Novell');
  await tancaMenu(page);

  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    // Simula un perfil antic, que encara no tenia el mig graó adaptatiu:
    // en aquest cas el nivell s'ha de reconstruir a partir de l'Elo.
    delete perfil.adaptiveStep;
    delete perfil.adaptiveCalibrating;
    localStorage.setItem(clau, JSON.stringify({ ...perfil, rating: 1600 }));
  }, PROFILE_KEY);
  await page.reload();
  await obreMenu(page);
  await expect(page.locator('.suggestion')).toContainText('Expert, Expert');
});

test('el nivell es pot canviar manualment des del menú', async ({ page }) => {
  await comencaDeZero(page);
  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    localStorage.setItem(
      clau,
      JSON.stringify({ ...perfil, adaptiveStep: 4, adaptiveCalibrating: false, rating: 1200 }),
    );
  }, PROFILE_KEY);
  await page.reload();
  await obreMenu(page);

  await page.getByRole('button', { name: 'Canvia manualment' }).click();
  await page.getByLabel('Habilitat').fill('1375');
  await page.getByLabel('Partides jugades').fill('22');
  await page.getByLabel('Victòries').fill('12');
  await page.getByRole('button', { name: 'Desa nivell' }).click();

  await expect(page.locator('.menu-habilitat')).toContainText('1375');
  await expect
    .poll(async () =>
      page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY),
    )
    .toMatchObject({ rating: 1375, gamesPlayed: 22, wins: 12 });
});

test('un enllaç de eltauler.cat permet importar el nivell amb un toc', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./?nivell=1460&partides=31&victories=18');

  await expect(page.getByRole('dialog', { name: 'Importa aquest nivell de Remigi?' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('1460');
  await page.getByRole('button', { name: 'Importa nivell' }).click();

  await expect(page.getByRole('dialog', { name: 'Importa aquest nivell de Remigi?' })).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY),
    )
    .toMatchObject({ rating: 1460, gamesPlayed: 31, wins: 18 });
  expect(page.url()).not.toContain('nivell=');
  expect(page.url()).not.toContain('partides=');
});

test('cada partida mou l’habilitat i queda a l’historial', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 2);
  expect(await robaFinsAlFinal(page)).toBe(true);

  const desprésDeJugar = await habilitat(page);
  expect(desprésDeJugar).not.toBe(1100);

  // El sistema s'adapta: el final anuncia els rivals de la partida següent.
  await expect(page.locator('.seguents-rivals')).toContainText('pròxims rivals');

  // El resum es pot tancar per inspeccionar exactament com ha quedat la partida.
  await page.getByRole('button', { name: 'Veure tauler final' }).click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.locator('.turn-line')).toContainText('Partida acabada');
  await expect(page.getByRole('button', { name: 'Veure resultat final' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avançar' })).toHaveCount(0);

  // I es pot tornar al resultat sense perdre l'estat final del tauler.
  await page.getByRole('button', { name: 'Veure resultat final' }).click();
  await expect(page.getByRole('button', { name: 'Una altra partida' })).toBeVisible();

  // Del final de la partida s'entra directament a l'historial.
  await page.getByRole('button', { name: 'Historial' }).click();
  const perfilFinal = await page.evaluate(
    (clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'),
    PROFILE_KEY,
  );
  if (perfilFinal?.adaptiveCalibrating) {
    await expect(page.locator('.stat-habilitat')).toContainText('Calibrant');
    await expect(page.locator('.stats')).not.toContainText(String(desprésDeJugar));
  } else {
    await expect(page.locator('.stats')).toContainText(String(desprésDeJugar));
  }
  await expect(page.locator('.history li')).toHaveCount(1);

  // I d'allà es torna a la taula.
  await page.getByRole('button', { name: 'Torna a la partida' }).click();
  await expect(page.getByRole('button', { name: 'Una altra partida' })).toBeVisible();
});

test('es pot reiniciar només el nivell i tornar a la calibració de Novell', async ({ page }) => {
  await comencaDeZero(page, 'Anna');
  await page.evaluate((clau) => {
    const perfil = JSON.parse(localStorage.getItem(clau)!);
    localStorage.setItem(
      clau,
      JSON.stringify({
        ...perfil,
        rating: 1400,
        gamesPlayed: 12,
        wins: 7,
        adaptiveStep: 6,
        adaptiveCalibrating: false,
      }),
    );
  }, PROFILE_KEY);
  await page.reload();

  await obreMenu(page);
  await expect(page.locator('.nivell-seccio')).toContainText('Nivell i rivals');
  await page.getByRole('button', { name: 'Reinicia nivell i torna a calibrar' }).click();
  await expect(page.getByText('Vols tornar a començar la calibració des de Novell?')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, reinicia el nivell' }).click();

  await expect(page.locator('.menu-habilitat')).toContainText('Calibrant el teu nivell');
  await expect(page.locator('.menu-habilitat')).not.toContainText('1100');
  await expect(page.locator('.suggestion')).toContainText('Novell, Novell');
  await expect
    .poll(async () =>
      page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY),
    )
    .toMatchObject({
      name: 'Anna',
      rating: 1100,
      gamesPlayed: 12,
      wins: 7,
      adaptiveStep: 0,
      adaptiveCalibrating: true,
    });
});

test('una partida a mitges es continua sola en tornar a obrir', async ({ page }) => {
  await comencaDeZero(page);
  await jugaContra(page, 1);

  for (let i = 0; i < 4; i++) {
    await avanca(page).click();
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
