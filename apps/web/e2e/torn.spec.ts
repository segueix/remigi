import { expect, test } from '@playwright/test';
import { avanca, comencaDeZero, entraAmbPartida, f, jugaContra, obreMenu } from './ajudants';

/**
 * El torn del jugador: el faristol que es col·loca a mà, el botó únic
 * d'avançar, el rellotge de la taula i què passa quan s'acaba el temps.
 */

/**
 * Les fitxes del faristol, en l'ordre en què es veuen. El parèntesi del nom
 * («acabada de robar») no hi entra: aquí es mira l'ordre, no les marques.
 */
const etiquetes = (page: import('@playwright/test').Page) =>
  page
    .locator('.rack .tile')
    .evaluateAll((tiles) =>
      tiles.map((tile) => (tile.getAttribute('aria-label') ?? '').replace(/ \(.*\)$/, '')),
    );

test.describe('el faristol es col·loca a mà', () => {
  const ma = [f('red', 1), f('blue', 2), f('black', 3), f('orange', 4), f('red', 5)];

  test('tocar una fitxa i després una altra la deixa just abans', async ({ page }) => {
    await entraAmbPartida(page, { rack: ma, haObert: true });
    expect(await etiquetes(page)).toEqual(['1 vermell', '2 blau', '3 negre', '4 groc', '5 vermell']);

    // La primera se'n va a davant de la quarta.
    await page.locator('.rack .tile[aria-label="1 vermell"]').click();
    await page.locator('.rack .tile[aria-label="4 groc"]').click();
    expect(await etiquetes(page)).toEqual(['2 blau', '3 negre', '1 vermell', '4 groc', '5 vermell']);

    // I no s'ha mogut res més: la fitxa continua sent teva, no ha baixat.
    await expect(page.locator('.board .meld')).toHaveCount(0);
    await expect(page.locator('.rack .tile')).toHaveCount(5);
  });

  test('l’ordre es manté quan acaba el torn i quan es continua la partida', async ({ page }) => {
    await entraAmbPartida(page, { rack: ma, haObert: true });
    await page.locator('.rack .tile[aria-label="5 vermell"]').click();
    await page.locator('.rack .tile[aria-label="1 vermell"]').click();
    const ordre = await etiquetes(page);
    expect(ordre[0]).toBe('5 vermell');

    // Avançar roba i passa el torn; en tornar, el faristol continua igual
    // (amb la fitxa robada al final, que és on se la busca).
    await avanca(page).click();
    await expect(page.locator('.turn-line')).toContainText('et toca a tu');
    const després = await etiquetes(page);
    expect(després.slice(0, ordre.length)).toEqual(ordre);
    await expect(page.locator('.rack .tile.drawn').last()).toBeVisible();

    // I sobreviu a tancar la pestanya: va desat amb la partida.
    await page.reload();
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    expect(await etiquetes(page)).toEqual(després);
  });

  test('ordenar de cop és un cop de mà, no un mode', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('black', 9), f('red', 2), f('blue', 5), f('red', 7)],
      haObert: true,
    });

    await page.getByRole('button', { name: 'per número' }).click();
    expect(await etiquetes(page)).toEqual(['2 vermell', '5 blau', '7 vermell', '9 negre']);

    await page.getByRole('button', { name: 'per color' }).click();
    expect(await etiquetes(page)).toEqual(['2 vermell', '7 vermell', '5 blau', '9 negre']);

    // I després d'ordenar es continua col·locant a mà des d'on ha quedat.
    await page.locator('.rack .tile[aria-label="9 negre"]').click();
    await page.locator('.rack .tile[aria-label="2 vermell"]').click();
    expect(await etiquetes(page)).toEqual(['9 negre', '2 vermell', '7 vermell', '5 blau']);
  });

  test('arrossegar una fitxa dins del faristol la deixa on la deixes', async ({ page }) => {
    await entraAmbPartida(page, { rack: ma, haObert: true });
    const origen = page.locator('.rack .tile[aria-label="1 vermell"]');
    const desti = page.locator('.rack .tile[aria-label="3 negre"]');
    const a = (await origen.boundingBox())!;
    const b = (await desti.boundingBox())!;

    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    // Per la meitat dreta de la tercera: la fitxa hi ha d'entrar just després.
    await page.mouse.move(b.x + b.width - 2, b.y + b.height / 2, { steps: 10 });
    await expect(page.locator('.rack-lloc.cau-abans, .rack-lloc.cau-despres')).toHaveCount(1);
    await page.mouse.up();

    expect(await etiquetes(page)).toEqual(['2 blau', '3 negre', '1 vermell', '4 groc', '5 vermell']);
  });
});

test.describe('el rellotge del torn', () => {
  test('es veu a la taula i el menú en canvia la durada', async ({ page }) => {
    await entraAmbPartida(page, { rack: [f('red', 1), f('blue', 2)], temps: '120' });

    const rellotge = page.locator('.rellotge-torn');
    await expect(rellotge).toBeVisible();
    // Compta enrere de debò.
    await expect.poll(async () => Number(await rellotge.innerText())).toBeLessThan(120);

    await obreMenu(page);
    await page.getByRole('button', { name: '30 s' }).click();
    await page.locator('.menu-fons').click({ position: { x: 5, y: 5 } });
    await expect.poll(async () => Number(await rellotge.innerText())).toBeLessThanOrEqual(30);

    // I sense límit no hi ha rellotge que valgui.
    await obreMenu(page);
    await page.getByRole('button', { name: 'sense límit' }).click();
    await page.locator('.menu-fons').click({ position: { x: 5, y: 5 } });
    await expect(rellotge).toHaveCount(0);
  });

  test('quan s’acaba el temps, es desfà el que no has validat i robes', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('red', 12), f('blue', 12), f('black', 12)],
      haObert: true,
      temps: '5',
    });

    // Una fitxa a la taula, sense acabar la jugada.
    await page.locator('.rack .tile[aria-label="12 vermell"]').click();
    await page.getByRole('button', { name: '+ Jugada nova' }).click();
    await expect(page.locator('.board .meld .tile')).toHaveCount(1);
    await expect(page.locator('.rack .tile')).toHaveCount(2);

    // S'acaba el temps: la taula queda com estava i tens una fitxa més.
    await expect(page.locator('.avis-temps')).toContainText('S’ha acabat el temps', {
      timeout: 15_000,
    });
    await expect(page.locator('.board .meld')).toHaveCount(0);
    await expect(page.locator('.rack .tile')).toHaveCount(4);
    await expect(page.locator('.rack .tile.drawn')).toHaveCount(1);
  });
});

test.describe('la taula plena', () => {
  test('les fitxes només s’empetiteixen quan ja no hi caben', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a l’ordinador la taula té lloc de sobres i no s’encongeix mai');

    /*
     * Nou jugades de tres fitxes: en un mòbil vertical encara hi caben totes
     * de mida natural, i encongir-les aquí només faria el joc més petit del
     * compte. En baixar-n'hi més, la taula ja no dona de si i les fitxes es
     * fan un pèl més petites perquè no en quedi cap fora de la vista.
     */
    const taula = page.locator('.board');
    const desborda = () =>
      taula.evaluate((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    const midaFitxa = async () => (await taula.locator('.tile').first().boundingBox())!.width;

    const jugades = [];
    for (const color of ['red', 'blue', 'black']) {
      for (const desde of [1, 5, 9]) {
        jugades.push([f(color, desde, 'b'), f(color, desde + 1, 'b'), f(color, desde + 2, 'b')]);
      }
    }
    const ma = [1, 2, 3, 4].map((v) => f('orange', v));
    await entraAmbPartida(page, { rack: ma, board: jugades, haObert: true });
    await expect(taula.locator('.tile')).toHaveCount(27);

    const gran = await midaFitxa();
    expect(await desborda()).toBe(false);

    // Quatre fitxes més, cadascuna en una jugada nova: ara ja no hi caben.
    for (const fitxa of ma) {
      await page.locator(`.rack .tile[aria-label="${fitxa.value} groc"]`).first().click();
      await page.getByRole('button', { name: '+ Jugada nova' }).click();
    }
    await expect(taula.locator('.tile')).toHaveCount(31);

    const petita = await midaFitxa();
    expect(petita).toBeLessThan(gran);
    // Encongides just el que calia: tot es veu i continuen essent fitxes.
    expect(await desborda()).toBe(false);
    expect(petita).toBeGreaterThan(gran * 0.6);
  });
});

test.describe('el torn dels rivals', () => {
  test('la taula diu què acaba de fer cadascun', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);

    // Avançar sense posar res: roben els rivals i la taula ho explica.
    await avanca(page).click();
    const avis = page.locator('.ultima-jugada');
    await expect(avis).toBeVisible();
    await expect(avis).toContainText(/ha (robat|baixat|recol·locat)/);

    // Porta el color del rival que ha mogut, com les seves fitxes.
    const bot = await avis.getAttribute('data-bot');
    expect(Number(bot)).toBeGreaterThan(0);
  });
});
