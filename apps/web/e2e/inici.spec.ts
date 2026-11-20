import { expect, test } from '@playwright/test';

test('a l’inici, la marca «Remigi» és a baix a la dreta del feltre i no toca les targetes', async ({ page }) => {
  await page.goto('./');
  const taula = (await page.locator('.inici-taula').boundingBox())!;
  const marca = (await page.locator('.inici-taula .marca-taula').boundingBox())!;
  // Enganxada a la cantonada de baix a la dreta del feltre.
  expect(taula.x + taula.width - (marca.x + marca.width)).toBeLessThan(30);
  expect(taula.y + taula.height - (marca.y + marca.height)).toBeLessThan(30);
  // I cap targeta de mode no se li encavalca.
  const cards = await page.locator('.mode-card').all();
  expect(cards).toHaveLength(3);
  // Ni el bàner de la partida del dia, que va sota les tres targetes.
  const bàner = (await page.locator('.dia-boto').boundingBox())!;
  for (const card of cards) expect((await card.boundingBox())!.y).toBeLessThan(bàner.y);
  for (const card of [...cards, page.locator('.dia-boto')]) {
    const b = (await card.boundingBox())!;
    expect(b.y + b.height <= marca.y || b.x + b.width <= marca.x).toBe(true);
  }
});
