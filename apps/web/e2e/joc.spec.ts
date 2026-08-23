import { expect, test } from '@playwright/test';
import type { Meld } from '@rummikub/core';
import { meldKey } from '../src/game/meldOwners';
import {
  baixaGrup,
  comencaDeZero,
  entraAmbPartida,
  f,
  jugaContra,
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

  test('l’ajuda marca les fitxes que poden formar jugada', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 1);
    await page.getByRole('button', { name: 'ajuda’m' }).click();

    // Una mà de 14 fitxes a l'atzar pot no tenir cap jugada possible, i llavors
    // no marcar-ne cap és el comportament correcte. Es roba fins que n'hi hagi.
    for (let i = 0; i < 30 && (await page.locator('.rack .tile.suggested').count()) === 0; i++) {
      const roba = page.getByRole('button', { name: /Robar fitxa|Passar torn/ });
      if (await roba.isEnabled().catch(() => false)) await roba.click();
      await page.waitForTimeout(60);
    }

    await expect(page.locator('.rack .tile.suggested').first()).toBeVisible();
    await page.getByRole('button', { name: 'amaga l’ajuda' }).click();
    await expect(page.locator('.rack .tile.suggested')).toHaveCount(0);
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
  test('l’inici explica com s’obre, amb exemples', async ({ page }) => {
    await comencaDeZero(page);

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
