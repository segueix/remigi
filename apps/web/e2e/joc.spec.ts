import { expect, test } from '@playwright/test';
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
  test('les fitxes d’una escala es col·loquen soles al lloc que toca', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('red', 7), f('red', 5), f('red', 6), f('blue', 2)],
      haObert: true,
    });

    // Es baixen desordenades: 7, després 5, després 6.
    await baixaGrup(page, ['7 vermell', '5 vermell', '6 vermell']);

    // I l'escala queda 5-6-7 igualment: cada fitxa va al seu lloc tota sola.
    await expect(page.locator('.board .meld').first().locator('.tile')).toHaveText(['5', '6', '7']);
    await expect(page.locator('.meld.invalid')).toHaveCount(0);
  });

  test('les fitxes surten de color amb número blanc, i cada color duu forma', async ({ page }) => {
    await comencaDeZero(page);

    // Per defecte, la fitxa és del color i el número (i la forma) en blanc os.
    // (Una numèrica: el joker no té color, i per tant tampoc forma.)
    const fitxa = page.locator('.rack .tile:not(.tile-joker)').first();
    expect(await fitxa.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(255, 253, 246)');

    // Cada fitxa numèrica porta la forma del seu color, per al daltonisme.
    await expect(fitxa.locator('.tile-forma')).toHaveCount(1);
    const formes = await page.locator('.rack .tile .tile-forma').count();
    const jokers = await page.locator('.rack .tile-joker').count();
    expect(formes).toBe(14 - jokers);

    // I la del menú de mostres també (una per mostra).
    await obreMenu(page);
    await expect(page.locator('.mostra-fitxa .tile-forma')).toHaveCount(2);

    // Amb l'estil de color actiu, la mostra clàssica continua sent clàssica:
    // les dues opcions s'han de poder distingir sempre.
    const mostraClassica = page.locator('.mostra-fitxa.classica .tile').first();
    await expect
      .poll(() => mostraClassica.evaluate((el) => getComputedStyle(el).color))
      .not.toBe('rgb(255, 253, 246)');
  });

  test('l’aspecte clàssic es pot triar des del menú, i es recorda', async ({ page }) => {
    await comencaDeZero(page);
    const fitxa = page.locator('.rack .tile:not(.tile-joker)').first();

    await obreMenu(page);
    await page
      .getByRole('button', { name: 'Fitxes de crema amb el número i la forma de color' })
      .click();
    // El número passa a ser del color sobre crema: ja no és blanc.
    await expect
      .poll(() => fitxa.evaluate((el) => getComputedStyle(el).color))
      .not.toBe('rgb(255, 253, 246)');
    const colorClassic = await fitxa.evaluate((el) => getComputedStyle(el).color);

    // Amb el clàssic actiu, la mostra de color continua sent de color.
    const mostraColor = page.locator('.mostra-fitxa.fitxes-inverses .tile').first();
    await expect
      .poll(() => mostraColor.evaluate((el) => getComputedStyle(el).color))
      .toBe('rgb(255, 253, 246)');
    // El menú es tanca també des del botó de baix de tot.
    await page.getByRole('button', { name: 'Tanca la finestra' }).click();
    await expect(page.locator('.menu-usuari')).toHaveCount(0);

    // I la tria sobreviu a tancar i tornar a obrir.
    await page.reload();
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    const colorDespres = await page
      .locator('.rack .tile:not(.tile-joker)')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    expect(colorDespres).toBe(colorClassic);
    expect(colorDespres).not.toBe('rgb(255, 253, 246)');
  });


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

  test('mantenir premuda una fitxa no selecciona cap text de la partida', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('orange', 5), f('orange', 6)],
      board: [[f('red', 9), f('blue', 9), f('black', 9)]],
      haObert: true,
    });

    // Tota la pantalla de joc és no-seleccionable: la selecció llarga del mòbil
    // s'estén al text seleccionable més proper, així que no n'hi pot quedar cap
    // al voltant de les fitxes (jugadors, «Ordena:», les jugades de la taula).
    for (const selector of ['.players .player-nom', '.rack-tools .muted', '.board .meld']) {
      expect(
        await page
          .locator(selector)
          .first()
          .evaluate((el) => getComputedStyle(el).userSelect),
        selector,
      ).toBe('none');
    }

    // I de debò: un manteniment llarg sobre una fitxa de la taula (més llarg
    // que el de seleccionar text) acaba sense res seleccionat.
    const cdp = await page.context().newCDPSession(page);
    const fitxa = (await page.locator('.board .tile').first().boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: fitxa.x + fitxa.width / 2, y: fitxa.y + fitxa.height / 2 }],
    });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => String(document.getSelection()))).toBe('');

    // El camp del nom, al menú del jugador, continua deixant triar-hi text.
    await obreMenu(page);
    expect(
      await page.locator('.menu-nom input').evaluate((el) => getComputedStyle(el).userSelect),
    ).toBe('text');
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

  test('les fitxes que posa un bot porten el marc del seu color, una per una', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);
    expect(await robaFinsQueUnBotJugui(page)).toBe(true);

    // Hi ha fitxes marcades, i totes són del mateix moviment: un sol bot.
    const bots = new Set(
      await page
        .locator('.board .tile[data-bot]')
        .evaluateAll((tiles) => tiles.map((tile) => (tile as HTMLElement).dataset.bot)),
    );
    expect(bots.size).toBe(1);
    const [bot] = [...bots];
    // I aquest bot és a la llista de jugadors.
    await expect(page.locator(`.player[data-bot="${bot}"] .player-color`)).toBeVisible();
    // Les jugades senceres, en canvi, ja no porten cap marc de color.
    await expect(page.locator('.board .meld[data-bot]')).toHaveCount(0);
  });

  test('les jugades que baixes tu no porten marc: només els bots en tenen', async ({ page }) => {
    await entraAmbPartida(page, {
      rack: [f('red', 12), f('blue', 12), f('black', 12), f('orange', 5)],
    });
    await baixaGrup(page, ['12 vermell', '12 blau', '12 negre']);
    await page.getByRole('button', { name: 'Acabar jugada' }).click();
    await expect(page.locator('.error')).toHaveCount(0);
    await expect(page.locator('.board .meld .tile')).toHaveCount(3);

    await expect(page.locator('.board .tile[data-bot]')).toHaveCount(0);
  });

  test('continuar una partida no li fa perdre els marcs', async ({ page }) => {
    const grup = [f('red', 7), f('blue', 7), f('black', 7)];
    await entraAmbPartida(page, {
      rack: [f('orange', 7), f('blue', 2)],
      board: [grup],
      haObert: true,
      // Les marques van per fitxa: cada identificador amb el seu bot.
      autors: grup.map((fitxa) => [fitxa.id, 1]),
    });

    await expect(page.locator('.board .tile[data-bot="1"]')).toHaveCount(3);
    await expect(page.locator('.player[data-bot="1"] .player-color')).toBeVisible();
  });

  test('el marc segueix la fitxa del bot, i la que hi afegeixes tu no en porta', async ({ page }) => {
    await comencaDeZero(page);
    await jugaContra(page, 2);
    expect(await robaFinsQueUnBotJugui(page)).toBe(true);

    const marcades = await page.locator('.board .tile[data-bot]').count();
    expect(marcades).toBeGreaterThan(0);

    // Deixar la teva fitxa a la taula no esborra els marcs del bot…
    await page.locator('.rack .tile').first().click();
    await page.getByRole('button', { name: '+ Jugada nova' }).click();
    await expect(page.locator('.board .tile[data-bot]')).toHaveCount(marcades);
    // …i la teva no en porta cap.
    await expect(page.locator('.board .meld').last().locator('.tile[data-bot]')).toHaveCount(0);

    // Desfer el torn ho deixa tot com estava.
    await page.getByRole('button', { name: 'Desfer canvis' }).click();
    await expect(page.locator('.board .tile[data-bot]')).toHaveCount(marcades);
  });
});

test.describe('la taula de joc', () => {
  test('el nivell del jugador es veu a dalt, amb el nom entre parèntesis', async ({ page }) => {
    await comencaDeZero(page);

    // Amb l'habilitat inicial (1100), el nivell amb nom és «Fàcil».
    const nivell = page.locator('.nivell-jugador');
    await expect(nivell).toBeVisible();
    await expect(nivell).toContainText('1100');
    await expect(nivell).toContainText('(Fàcil)');
  });

  test('fixar el nivell dels rivals es veu i es recorda; treure’l, també', async ({ page }) => {
    await comencaDeZero(page);
    // En mode automàtic no es diu res dels rivals: s'adapten sols.
    await expect(page.locator('.nivell-jugador')).not.toContainText('fixats');

    // Es fixa el nivell Mitjà i es comença una partida.
    await obreMenu(page);
    await page.locator('.menu-nivell select').selectOption('medium');
    await expect(page.locator('.menu-usuari .suggestion')).toContainText('Rivals fixats a Mitjà');
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'Partida nova' }).click();

    // La tria s'ha aplicat, i es veu per tres bandes: la píndola de dalt,
    // l'etiqueta del bot, i el menú que la recorda en reobrir-lo.
    await expect(page.locator('.nivell-jugador')).toContainText('rivals fixats: Mitjà');
    await expect(page.locator('.player[data-bot] .tag').first()).toHaveText('Mitjà');
    await obreMenu(page);
    await expect(page.locator('.menu-nivell select')).toHaveValue('medium');

    // I tornar a l'automàtic també es veu: la píndola calla.
    await page.locator('.menu-nivell select').selectOption('auto');
    await page.getByRole('button', { name: 'Partida nova' }).click();
    await expect(page.locator('.nivell-jugador')).not.toContainText('fixats');
  });

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

    // La taula s'ho queda gairebé tot: amplada sencera i més de mitja alçada.
    const finestra = page.viewportSize()!;
    expect(taula.width).toBeGreaterThan(finestra.width * 0.93);
    expect(taula.height).toBeGreaterThan(finestra.height * 0.55);
    // Els jugadors floten per sobre del feltre, no tenen columna pròpia.
    const tira = (await page.locator('.game-top').boundingBox())!;
    expect(tira.y).toBeGreaterThanOrEqual(taula.y);
    // I la fila d'«Ordena» no hi és: l'espai és per a les fitxes.
    await expect(page.locator('.rack-header')).toBeHidden();

    // Al seu lloc, «números / colors» sobre els botons, i mana de debò.
    const perNumeros = page.locator('.sort-mini button', { hasText: 'números' });
    await expect(perNumeros).toBeVisible();
    await perNumeros.click();
    await expect(perNumeros).toHaveAttribute('aria-pressed', 'true');
    const valors = await page
      .locator('.rack .tile')
      .evaluateAll((tiles) => tiles.map((el) => parseInt(el.textContent ?? '', 10)));
    expect([...valors].sort((a, b) => a - b)).toEqual(valors);
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

  test('a l’ordinador, les fitxes de la taula es veuen ben grans', async ({ page, isMobile }) => {
    test.skip(isMobile, 'als mòbils mana encabir-hi el màxim de joc');
    await entraAmbPartida(page, {
      rack: [f('orange', 7), f('blue', 2)],
      board: [[f('red', 7), f('blue', 7), f('black', 7)]],
      haObert: true,
    });

    const fitxa = (await page.locator('.board .tile').first().boundingBox())!;
    // 2.95rem = 47 px: més grans i tot que les del faristol.
    expect(fitxa.width).toBeGreaterThanOrEqual(45);
    expect(fitxa.height).toBeGreaterThanOrEqual(58);
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
