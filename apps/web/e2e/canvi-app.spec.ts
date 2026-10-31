import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { comencaDeZero, obreMenu } from './ajudants';

/*
 * Pas a El Tauler lliscant el dit (src/appSwitch/appSwitch.ts): al mòbil,
 * lliscar cap a un costat pel mig de la pantalla fa entrar el panell «El
 * Tauler» i, passat el llindar, s'obre eltauler.cat. Els gestos són tàctils de
 * debò (CDP), com els de les fitxes. eltauler.cat se substitueix per una pàgina
 * local: no es surt a la xarxa.
 */

const TAULER = /^https:\/\/eltauler\.cat\//;

async function preparaTauler(page: Page) {
  await page.route('https://eltauler.cat/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<title>El Tauler</title>tauler' }),
  );
}

/** Un dit real: de (x0, y0) a (x1, y1) en uns quants passos. */
async function llisca(page: Page, cdp: CDPSession, [x0, y0]: number[], [x1, y1]: number[], passos = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= passos; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + ((x1 - x0) * i) / passos, y: y0 + ((y1 - y0) * i) / passos }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
}

/** Un punt del feltre de la taula que no sigui cap fitxa ni cap botó. */
async function puntDeLaTaula(page: Page): Promise<number> {
  const taula = (await page.locator('.board').boundingBox())!;
  return Math.round(taula.y + taula.height / 2);
}

test.describe('pas a El Tauler lliscant el dit', () => {
  test.skip(({ isMobile }) => !isMobile, 'el gest només hi és al mòbil');

  test.beforeEach(async ({ page }) => {
    await preparaTauler(page);
    // Sense l'avís de les primeres vegades: aquí es proven els gestos.
    await page.addInitScript(() => localStorage.setItem('remigi:avis-canvi-app', '3'));
    await comencaDeZero(page, 'Jugador');
  });

  test('lliscar cap a l’esquerra pel mig de la taula obre El Tauler', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const y = await puntDeLaTaula(page);
    await llisca(page, cdp, [320, y], [80, y + 6]);
    await expect(page).toHaveURL(TAULER);
  });

  test('lliscar cap a la dreta també', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const y = await puntDeLaTaula(page);
    await llisca(page, cdp, [70, y], [320, y - 6]);
    await expect(page).toHaveURL(TAULER);
  });

  test('a mitges el panell entra seguint el dit i, sense arribar al llindar, se’n torna', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const y = await puntDeLaTaula(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [290, 270, 250, 235]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 2 }] });
      await page.waitForTimeout(16);
    }
    const panell = page.locator('.app-switch');
    await expect(panell).toHaveClass(/is-active/);
    await expect(panell).toContainText('El Tauler');
    // Entra per la dreta (el dit va cap a l'esquerra) i encara no és a lloc.
    expect(await panell.evaluate((el) => (el as HTMLElement).style.transform)).toMatch(/^translateX\(\d/);
    await expect(panell).not.toHaveClass(/is-ready/);

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(panell).not.toHaveClass(/is-active/);
    await page.waitForTimeout(400);
    expect(page.url()).not.toMatch(TAULER);
  });

  test('un gest curt, vertical o des de la vora no fa res', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    const y = await puntDeLaTaula(page);
    await llisca(page, cdp, [260, y], [220, y]);
    await llisca(page, cdp, [200, y + 120], [215, y - 160]);
    await llisca(page, cdp, [6, y], [300, y]);
    expect(page.url()).not.toMatch(TAULER);
    await expect(page.locator('.app-switch.is-active')).toHaveCount(0);
  });

  test('damunt de les fitxes del faristol el dit és per a les fitxes', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    // La fitxa més a la dreta que encara és dins la zona del gest: així la
    // lliscada és prou llarga per canviar d'app si no fos damunt d'una fitxa.
    const finestra = page.viewportSize()!;
    const caixes = await page.locator('.rack .tile').evaluateAll((fitxes) =>
      fitxes.map((el) => {
        const b = el.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }),
    );
    const dins = caixes.filter(
      (c) => c.x <= finestra.width * 0.85 && c.y >= finestra.height * 0.2 && c.y <= finestra.height * 0.85,
    );
    expect(dins.length).toBeGreaterThan(0);
    const { x, y } = dins.reduce((a, b) => (b.x > a.x ? b : a));
    expect(x - 30).toBeGreaterThan(finestra.width * 0.6);
    await llisca(page, cdp, [x, y], [30, y]);
    expect(page.url()).not.toMatch(TAULER);
    await expect(page.locator('.app-switch.is-active')).toHaveCount(0);
  });

  test('amb el menú del jugador obert no canvia d’app', async ({ page }) => {
    await obreMenu(page);
    const cdp = await page.context().newCDPSession(page);
    const y = await puntDeLaTaula(page);
    await llisca(page, cdp, [320, y], [80, y]);
    expect(page.url()).not.toMatch(TAULER);
  });
});

test.describe('avís de les primeres vegades', () => {
  test('al mòbil, una mà que llisca i «El Tauler» uns 3 s; a la quarta obertura ja no', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'l’avís només surt al mòbil');
    await comencaDeZero(page, 'Jugador');
    const avis = page.locator('.app-switch-hint');
    await expect(avis).toHaveCount(1, { timeout: 8000 });
    await expect(avis).toContainText('El Tauler');
    await expect(avis.locator('.app-switch-hint__hand')).toHaveCount(1);
    // No tapa res: el joc continua responent a sota.
    expect(await avis.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await expect(avis).toHaveCount(0, { timeout: 5000 });
    expect(await page.evaluate(() => localStorage.getItem('remigi:avis-canvi-app'))).toBe('1');

    await page.evaluate(() => localStorage.setItem('remigi:avis-canvi-app', '3'));
    await page.reload();
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(avis).toHaveCount(0);
  });

  test('a l’ordinador no surt mai', async ({ page, isMobile }) => {
    test.skip(isMobile, 'és la comprovació d’ordinador');
    await comencaDeZero(page, 'Jugador');
    await page.waitForTimeout(2500);
    await expect(page.locator('.app-switch-hint')).toHaveCount(0);
  });
});
