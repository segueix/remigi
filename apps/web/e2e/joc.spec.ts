import { expect, test } from '@playwright/test';
import type { Meld } from '@rummikub/core';
import { meldKey } from '../src/game/meldOwners';
import {
  baixaGrup,
  comencaDeZero,
  entraAmbPartida,
  f,
  jugaContra,
  obreMenu,
  robaFinsAlFinal,
  robaFinsQueUnBotJugui,
} from './ajudants';

test.describe('una partida sencera', () => {
  for (const oponents of [1, 2, 3] as const) {
    test(`s'acaba jugant contra ${oponents} oponent(s)`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

      await comencaDeZero(page);
      await jugaContra(page, oponents);
      await expect(page.locator('.player')).toHaveCount(oponents + 1);
      await expect(page.locator('.rack .tile')).toHaveCount(14);

      expect(await robaFinsAlFinal(page)).toBe(true);
      await expect(page.locator('.scores li')).toHaveCount(oponents + 1);
      // El resultat compta per a l'habilitat.
      await expect(page.locator('.rating-change')).toContainText(/\d+ → \d+/);
      expect(errors, errors.join(' | ')).toHaveLength(0);
    });
  }
});

test.describe('qui mana és el motor', () => {
  test.beforeEach(async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 1);
  });

  test('rebutja una jugada de menys de tres fitxes', async ({ page }) => {
    await page.locator('.rack .tile').first().click();
    await page.getByRole('button', { name: '+ Jugada nova' }).click();
    await expect(page.locator('.meld.invalid')).toHaveCount(1);

    await page.getByRole('button', { name: 'Acabar jugada' }).click();
    await expect(page.locator('.error')).toContainText('com a mínim 3 fitxes');
  });

  test('rebutja una sortida inicial de menys de 30 punts', async ({ page }) => {
    // Tres 3: un grup vàlid, però només 9 punts.
    await entraAmbPartida(page, { rack: [f('red', 3), f('blue', 3), f('black', 3)] });
    await baixaGrup(page, ['3 vermell', '3 blau', '3 negre']);

    await expect(page.locator('.meld.invalid')).toHaveCount(0);
    await page.getByRole('button', { name: 'Acabar jugada' }).click();
    await expect(page.locator('.error')).toContainText('30 punts');
    await expect(page.locator('.error')).toContainText('9');
  });

  test('accepta una sortida inicial de 30 punts o més', async ({ page }) => {
    // Tres 12: 36 punts, de sobres per obrir.
    await entraAmbPartida(page, {
      rack: [f('red', 12), f('blue', 12), f('black', 12), f('orange', 5)],
    });
    await baixaGrup(page, ['12 vermell', '12 blau', '12 negre']);
    await expect(page.locator('.meld.invalid')).toHaveCount(0);

    await page.getByRole('button', { name: 'Acabar jugada' }).click();
    await expect(page.locator('.error')).toHaveCount(0);
    await expect(page.locator('.rack .tile')).toHaveCount(1);
    await expect(page.locator('.player').first()).not.toContainText('sense obrir');
  });

  test('no deixa endur-se al faristol una fitxa que ja era a la taula', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('orange', 7), f('blue', 2)],
      board: [[f('red', 7), f('blue', 7), f('black', 7)]],
      haObert: true,
    });

    await page.locator('.board .meld .tile').first().click();
    await page.locator('.rack').click();
    await expect(page.locator('.rack .tile')).toHaveCount(2);
    await expect(page.locator('.board .meld .tile')).toHaveCount(3);
  });

  test('deixa completar un grup de la taula amb una fitxa de la mà', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('orange', 7), f('blue', 2)],
      board: [[f('red', 7), f('blue', 7), f('black', 7)]],
      haObert: true,
    });

    await page.locator('.rack .tile[aria-label="7 taronja"]').click();
    await page.locator('.board .meld').first().click();
    await expect(page.locator('.board .meld .tile')).toHaveCount(4);
    await expect(page.locator('.meld.invalid')).toHaveCount(0);

    await page.getByRole('button', { name: 'Acabar jugada' }).click();
    await expect(page.locator('.error')).toHaveCount(0);
    await expect(page.locator('.rack .tile')).toHaveCount(1);
  });

  test('«Desfer canvis» retorna el torn a com estava', async ({ page }) => {
    const abans = await page.locator('.rack .tile').count();
    await page.locator('.rack .tile').first().click();
    await page.getByRole('button', { name: '+ Jugada nova' }).click();
    await expect(page.locator('.rack .tile')).toHaveCount(abans - 1);

    await page.getByRole('button', { name: 'Desfer canvis' }).click();
    await expect(page.locator('.rack .tile')).toHaveCount(abans);
    await expect(page.locator('.board .meld')).toHaveCount(0);
  });
});

test.describe('moure fitxes', () => {
  test('arrossegar del faristol a la taula', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 1);

    const fitxa = page.locator('.rack .tile').first();
    const caixa = (await fitxa.boundingBox())!;
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y - 40, { steps: 5 });
    await expect(page.locator('.drag-layer')).toHaveCount(1);

    const taula = (await page.locator('.board').boundingBox())!;
    await page.mouse.move(taula.x + taula.width / 2, taula.y + taula.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('.board .meld .tile')).toHaveCount(1);
    // L'arrossegament no ha de comptar a més com un clic.
    await expect(page.locator('.tile.selected')).toHaveCount(0);
  });

});

test.describe('amb el dit', () => {
  test.skip(({ isMobile }) => !isMobile, 'només té sentit al projecte de mòbil');

  test('lliscar desplaça la taula i mantenir premut arrossega la fitxa', async ({ page }) => {
    // Una taula ben plena, que no capiga a la pantalla: el desplaçament hi és
    // imprescindible per arribar a les jugades de baix.
    const grups: ReturnType<typeof f>[][] = [];
    for (let v = 1; v <= 13; v++) grups.push([f('red', v), f('blue', v), f('black', v)]);
    for (let v = 2; v <= 13; v++) grups.push([f('red', v, 'b'), f('blue', v, 'b'), f('black', v, 'b')]);
    await entraAmbPartida(page, {
      rack: [f('orange', 5), f('orange', 6)],
      board: grups,
      haObert: true,
    });

    const taula = page.locator('.board');
    expect(await taula.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    // Lliscada que COMENÇA sobre una fitxa de la taula: ha de desplaçar.
    const cdp = await page.context().newCDPSession(page);
    const fitxa = (await page.locator('.board .tile').first().boundingBox())!;
    const x = fitxa.x + fitxa.width / 2;
    const y = fitxa.y + fitxa.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - i * 30 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(() => taula.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // I no s'ha endut cap fitxa: era un desplaçament, no un arrossegament.
    await expect(page.locator('.drag-layer')).toHaveCount(0);
    await expect(page.locator('.rack .tile')).toHaveCount(2);
    await expect(page.locator('.board .meld')).toHaveCount(grups.length);

    // Mantenir premuda una fitxa del faristol, en canvi, l'aixeca...
    // (primer es deixa morir la inèrcia de la lliscada, que continua rodant
    // uns instants pel seu compte i embrutaria la mesura de després)
    await expect
      .poll(async () => {
        const abans = await taula.evaluate((el) => el.scrollTop);
        await page.waitForTimeout(90);
        return (await taula.evaluate((el) => el.scrollTop)) === abans;
      })
      .toBe(true);
    await taula.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(80);
    const delRack = (await page.locator('.rack .tile').first().boundingBox())!;
    const rx = delRack.x + delRack.width / 2;
    const ry = delRack.y + delRack.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rx, y: ry }] });
    await page.waitForTimeout(320); // més que el manteniment de 180 ms
    await expect(page.locator('.drag-layer')).toHaveCount(1);

    // ...i el dit se l'enduu fins a una jugada de la taula sense desplaçar res.
    const destinacio = (await page.locator('.board .meld').first().boundingBox())!;
    const dx = destinacio.x + destinacio.width / 2;
    const dy = destinacio.y + destinacio.height / 2;
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: rx + ((dx - rx) * i) / 8, y: ry + ((dy - ry) * i) / 8 }],
      });
      await page.waitForTimeout(16);
    }
    // Mentre la fitxa és a l'aire, el dit no desplaça res.
    expect(await taula.evaluate((el) => el.scrollTop)).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.locator('.board .meld').first().locator('.tile')).toHaveCount(4);
    await expect(page.locator('.rack .tile')).toHaveCount(1);
  });
});

test.describe('en pantalla petita', () => {
  test.skip(({ isMobile }) => !isMobile, 'només té sentit al projecte de mòbil');

  test('res no desborda i les fitxes es poden tocar', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);

    const desbordament = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(desbordament).toBe(false);

    const caixa = (await page.locator('.rack .tile').first().boundingBox())!;
    expect(caixa.width).toBeGreaterThanOrEqual(44);
    expect(caixa.height).toBeGreaterThanOrEqual(44);

    for (const alçada of await page
      .locator('.actions button')
      .evaluateAll((b) => b.map((el) => el.getBoundingClientRect().height))) {
      expect(alçada).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('explicar les regles', () => {
  test('el menú del jugador explica com s’obre, amb exemples', async ({ page }) => {
    await comencaDeZero(page);
    await obreMenu(page);

    const explicacio = page.locator('details.rules');
    await expect(explicacio).toBeVisible();
    // A qui no ha jugat mai se li ensenya desplegada.
    expect(await explicacio.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(explicacio).toContainText('mateix número');
    await expect(explicacio).toContainText('mateix color');
    // I hi ha el cas que enganya: fitxes que sumen 30 sense ser jugada vàlida.
    await expect(page.locator('.exemple.malament')).toContainText('no és ni grup ni escala');
  });

  test('durant el torn diu per què una jugada no suma punts', async ({ page }) => {
    // El cas real: 6 + 12 + 12 suma 30 però no és ni grup ni escala.
    await entraAmbPartida(page, { rack: [f('red', 6), f('blue', 12), f('black', 12)] });
    await baixaGrup(page, ['6 vermell', '12 blau', '12 negre']);

    await expect(page.locator('.meld.invalid')).toHaveCount(1);
    const pista = page.locator('.hint');
    await expect(pista).toContainText('en portes 0');
    await expect(pista).toContainText('no compten');
    await expect(pista).toContainText('mateixa caixa');
  });
});

test.describe('qui ha jugat què', () => {
  test('la fitxa que acabes de robar queda marcada', async ({ page }) => {
    await entraAmbPartida(page, { rack: [f('red', 3), f('blue', 8)] });
    await expect(page.locator('.rack .tile.drawn')).toHaveCount(0);

    await page.getByRole('button', { name: 'Robar fitxa' }).click();
    await expect(page.locator('.rack .tile')).toHaveCount(3);

    // Al sac només hi ha un 1 negre: la fitxa marcada ha de ser aquesta.
    const marcada = page.locator('.rack .tile.drawn');
    await expect(marcada).toHaveCount(1);
    await expect(marcada).toHaveAttribute('aria-label', '1 negre (acabada de robar)');
  });

  test('la marca desapareix quan tornes a jugar', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('red', 12), f('blue', 12), f('black', 12)],
    });
    await page.getByRole('button', { name: 'Robar fitxa' }).click();
    await expect(page.locator('.rack .tile.drawn')).toHaveCount(1);

    // Robar acaba el torn: cal esperar que torni.
    await expect(page.locator('.turn-line')).toContainText('et toca a tu');
    await baixaGrup(page, ['12 vermell', '12 blau', '12 negre']);
    await page.getByRole('button', { name: 'Acabar jugada' }).click();

    await expect(page.locator('.error')).toHaveCount(0);
    await expect(page.locator('.rack .tile.drawn')).toHaveCount(0);
  });

  test('cada jugada d’un bot porta el color del seu bot', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);
    expect(await robaFinsQueUnBotJugui(page)).toBe(true);

    // El jugador només ha robat: tot el que hi ha a la taula és dels bots.
    await expect(page.locator('.board .meld:not([data-bot])')).toHaveCount(0);

    // I el color de cada jugada és el d'un bot que és a la llista de jugadors.
    const bots = new Set(
      await page.locator('.board .meld').evaluateAll((melds) =>
        melds.map((meld) => (meld as HTMLElement).dataset.bot),
      ),
    );
    expect(bots.size).toBeGreaterThan(0);
    for (const bot of bots) {
      await expect(page.locator(`.player[data-bot="${bot}"] .player-color`)).toBeVisible();
    }
  });

  test('continuar una partida no li fa perdre els colors', async ({ page }) => {
    const grup = [f('red', 7), f('blue', 7), f('black', 7)];
    await entraAmbPartida(page, {
      rack: [f('orange', 7), f('blue', 2)],
      board: [grup],
      haObert: true,
      // `meldKey` només mira els identificadors: les fitxes de prova li serveixen.
      autors: [[meldKey(grup as unknown as Meld), 1]],
    });

    await expect(page.locator('.board .meld').first()).toHaveAttribute('data-bot', '1');
    await expect(page.locator('.player[data-bot="1"] .player-color')).toBeVisible();
  });

  test('una jugada d’un bot que toques deixa de ser seva', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);
    expect(await robaFinsQueUnBotJugui(page)).toBe(true);

    const jugada = page.locator('.board .meld').first();
    await expect(jugada).toHaveAttribute('data-bot', /[1-3]/);

    // Deixar-hi una fitxa a sobre li treu el color a l'instant.
    await page.locator('.rack .tile').first().click();
    await jugada.click();
    await expect(jugada).not.toHaveAttribute('data-bot', /[1-3]/);

    // I desfer el torn l'hi torna.
    await page.getByRole('button', { name: 'Desfer canvis' }).click();
    await expect(jugada).toHaveAttribute('data-bot', /[1-3]/);
  });
});

test.describe('la taula de joc', () => {
  test('els rivals tenen nom propi i avatar, diferents entre ells', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 3);

    const noms = await page.locator('.player[data-bot] .player-nom').allTextContents();
    expect(noms).toHaveLength(3);
    expect(new Set(noms).size).toBe(3);
    // Nom de debò, no el «Bot 1» d'abans.
    for (const nom of noms) expect(nom).not.toMatch(/^Bot \d/);
    await expect(page.locator('.player[data-bot] .player-color')).toHaveCount(3);
  });

  test('els botons del torn van en una sola línia, també en pantalla estreta', async ({ page, isMobile }) => {
    await comencaDeZero(page);
    await jugaContra(page, 1);

    // Al mòbil hi ha també el botó de girar la pantalla; a l'escriptori, no.
    const botons = page.locator('.actions button');
    await expect(botons).toHaveCount(isMobile ? 4 : 3);
    const altures = await botons.evaluateAll((b) => b.map((el) => el.getBoundingClientRect().top));
    // Tots comencen a la mateixa alçada: cap no ha saltat de línia.
    expect(new Set(altures.map((v) => Math.round(v))).size).toBe(1);

    // Encara que el rètol s'amagui i quedi la icona, el nom no canvia.
    await expect(page.getByRole('button', { name: 'Acabar jugada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desfer canvis' })).toBeVisible();
  });

  test('al mòbil apaïsat tot cap a la pantalla', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'només té sentit al projecte de mòbil');
    // El mateix mòbil, girat.
    await page.setViewportSize({ width: 851, height: 393 });
    await comencaDeZero(page);
    await jugaContra(page, 2);

    const desborda = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth + 1,
      y: document.documentElement.scrollHeight > window.innerHeight + 1,
    }));
    expect(desborda).toEqual({ x: false, y: false });

    // La taula sobre el faristol, i els botons en una línia i tocables.
    const taula = (await page.locator('.board').boundingBox())!;
    const faristol = (await page.locator('.rack').boundingBox())!;
    expect(taula.y).toBeLessThan(faristol.y);
    expect(taula.height).toBeGreaterThan(80);
    for (const alçada of await page
      .locator('.actions button')
      .evaluateAll((b) => b.map((el) => el.getBoundingClientRect().height))) {
      expect(alçada).toBeGreaterThanOrEqual(44);
    }
  });

  test('el botó de girar la pantalla surt només on pot funcionar', async ({ page, isMobile }) => {
    await comencaDeZero(page);
    await jugaContra(page, 1);

    const boto = page.getByRole('button', { name: 'Gira la pantalla' });
    if (!isMobile) {
      // Sense pantalla tàctil no té sentit: no hi és.
      await expect(boto).toHaveCount(0);
      return;
    }
    await expect(boto).toBeVisible();
    // En un emulador el bloqueig d'orientació pot fallar: prémer no ha de petar.
    await boto.click();
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    await expect(boto).toBeVisible();
  });

  test('la partida cap a la pantalla, sense desplaçament de pàgina', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);

    const desborda = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth + 1,
      y: document.documentElement.scrollHeight > window.innerHeight + 1,
    }));
    expect(desborda).toEqual({ x: false, y: false });
    // El faristol és a baix de tot de la pantalla, amb la taula a sobre.
    const taula = (await page.locator('.board').boundingBox())!;
    const faristol = (await page.locator('.rack').boundingBox())!;
    expect(taula.y).toBeLessThan(faristol.y);
    expect(taula.height).toBeGreaterThan(0);
  });
});
