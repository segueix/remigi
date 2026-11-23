import { expect, test } from '@playwright/test';

test('a l’inici, la marca «Remigi» és a baix a la dreta del feltre i no toca les targetes', async ({ page }) => {
  // Hora fixa: a mitjanit canvia la partida del dia i el bàner es redibuixa
  // enmig de les mesures (el CI hi va fallar a les 00 h).
  await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
  await page.goto('./');
  const taula = (await page.locator('.inici-taula').boundingBox())!;
  const marca = (await page.locator('.inici-taula .marca-taula').boundingBox())!;
  // Enganxada a la cantonada de baix a la dreta del feltre.
  expect(taula.x + taula.width - (marca.x + marca.width)).toBeLessThan(30);
  expect(taula.y + taula.height - (marca.y + marca.height)).toBeLessThan(30);
  // I cap targeta de mode no se li encavalca.
  const cards = await page.locator('.mode-card').all();
  expect(cards).toHaveLength(3);
  // Ordre: el faristol de Remigi, el bàner de la partida del dia i, a sota, les tres targetes.
  const faristol = (await page.locator('.inici-faristol').boundingBox())!;
  const bàner = (await page.locator('.dia-boto').boundingBox())!;
  expect(faristol.y + faristol.height).toBeLessThanOrEqual(bàner.y);
  for (const card of cards) expect((await card.boundingBox())!.y).toBeGreaterThan(bàner.y + bàner.height - 1);
  for (const card of [...cards, page.locator('.dia-boto')]) {
    const b = (await card.boundingBox())!;
    expect(b.y + b.height <= marca.y || b.x + b.width <= marca.x).toBe(true);
  }
});
