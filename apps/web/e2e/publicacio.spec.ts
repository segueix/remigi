import { expect, test } from '@playwright/test';

/**
 * El que ha de complir el build tal com es publica: rutes correctes sota
 * `/rummikub/`, dades d'instal·lació com a aplicació, i poder jugar sense
 * connexió un cop visitat.
 */

test('tots els fitxers pengen de la ruta publicada', async ({ page }) => {
  const fallits: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) fallits.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Rummikub' })).toBeVisible();

  const src = await page.locator('script[type=module]').first().getAttribute('src');
  expect(src, 'el codi ha de penjar de /rummikub/').toContain('/rummikub/assets/');
  expect(fallits, fallits.join(' | ')).toHaveLength(0);
});

test('es pot instal·lar com a aplicació', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifestUrl = new URL(href!, page.url()).toString();
  const resposta = await request.get(manifestUrl);
  expect(resposta.ok()).toBe(true);

  const manifest = await resposta.json();
  expect(manifest.name).toBe('Rummikub');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  // Les icones han d'existir de debò, no només estar declarades.
  for (const icona of manifest.icons) {
    const imatge = await request.get(new URL(icona.src, manifestUrl).toString());
    expect(imatge.ok(), `falta la icona ${icona.src}`).toBe(true);
    expect(imatge.headers()['content-type']).toContain('image/png');
  }
});

test('registra el service worker i deixa jugar sense connexió', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 15_000,
  });

  // Es visita una vegada amb connexió perquè es desi la pàgina...
  await page.getByPlaceholder('El teu nom').fill('Daniel');
  await page.getByRole('button', { name: 'Desa' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Daniel!' })).toBeVisible();

  // ...i llavors es talla i s'ha de poder tornar a obrir igualment.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Daniel!' })).toBeVisible();
  await page.getByRole('button', { name: /Comença a jugar/ }).click();
  await expect(page.locator('.rack .tile')).toHaveCount(14);

  await context.setOffline(false);
});
