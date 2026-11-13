import { expect, test, type Page } from '@playwright/test';
import { PROFILE_KEY, avanca, comencaDeZero, entraAlJocLliure, obreMenu } from './ajudants';

/**
 * Les tres maneres de jugar de la pantalla d'inici: el joc lliure (que
 * recorda els rivals triats), el repte (unes quantes partides i se sumen els
 * punts) i la lliga (del poble al món, amb els noms de les lligues d'escacs).
 */

const inici = (page: Page) => page.getByRole('button', { name: 'Inici', exact: true });

/** Roba fins que s'acaba la partida i surt el resum del mode. */
async function acabaLaPartida(page: Page, resum: string): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (await page.locator(resum).isVisible().catch(() => false)) return;
    await avanca(page)
      .click({ timeout: 3000 })
      .catch(() => {});
  }
  await expect(page.locator(resum)).toBeVisible();
}

async function obreNet(page: Page, extra: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((dades) => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
    localStorage.setItem('remigi:temps-torn', 'cap');
    for (const [clau, valor] of Object.entries(dades)) localStorage.setItem(clau, valor);
  }, extra);
  await page.goto('./');
}

test('en obrir l’app surten les tres maneres de jugar: lliure, repte i lliga', async ({ page }) => {
  await obreNet(page);
  const lliure = page.getByRole('button', { name: 'Joc lliure', exact: true });
  const repte = page.getByRole('button', { name: 'Repte', exact: true });
  const lliga = page.getByRole('button', { name: 'Lliga', exact: true });
  await expect(lliure).toBeVisible();
  const [a, b, c] = await Promise.all([lliure.boundingBox(), repte.boundingBox(), lliga.boundingBox()]);
  // A l'esquerra, al centre i a la dreta, també al mòbil.
  expect(a!.x).toBeLessThan(b!.x);
  expect(b!.x).toBeLessThan(c!.x);
  expect(Math.abs(a!.y - c!.y)).toBeLessThan(4);
  const amplada = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(amplada).toBeLessThanOrEqual(0);
});

test('el joc lliure recorda els rivals i el nivell triats encara que s’acabi la partida', async ({ page }) => {
  await comencaDeZero(page);
  await obreMenu(page);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await page.locator('.menu-nivell select').selectOption('expert');
  await page.getByRole('button', { name: 'Partida nova' }).click();
  await expect(page.locator('.player')).toHaveCount(4);

  // Sense partida a mitges (com quan se n'acaba una) i tornant a obrir l'app.
  // Primer a l'inici: amb la partida tancada, els bots ja no la tornen a desar.
  await obreMenu(page);
  await inici(page).click();
  await page.evaluate(() => localStorage.removeItem('remigi:game'));
  await page.reload();
  await expect(page.locator('.mode-lliure .mode-estat')).toHaveText('3 rivals · Expert (fixat)');
  await entraAlJocLliure(page);
  await expect(page.locator('.player')).toHaveCount(4);
  await expect(page.locator('.player .tag').filter({ hasText: 'Expert' })).toHaveCount(3);
});

test('des de la partida es torna a l’inici, i la partida es reprèn on era', async ({ page }) => {
  await comencaDeZero(page);
  await avanca(page).click();
  await expect(avanca(page)).toBeEnabled();
  const torn = await page.locator('.turn-line').textContent();
  await obreMenu(page);
  await inici(page).click();
  await expect(page.locator('.mode-lliure .mode-cta')).toHaveText('Continua');
  await entraAlJocLliure(page);
  await expect(page.locator('.turn-line')).toHaveText(torn!);
});

test('el repte suma els punts de totes les partides i no mou el nivell del joc lliure', async ({ page }) => {
  await obreNet(page);
  await page.getByRole('button', { name: 'Repte', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).first().click();
  await page.getByRole('button', { name: 'Novell', exact: true }).click();
  await page.locator('.tria').filter({ hasText: 'Rivals per partida' }).getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Comença el repte' }).click();

  const punts: number[] = [];
  for (let partida = 1; partida <= 3; partida++) {
    await expect(page.locator('.nivell-mode')).toContainText(`partida ${partida} de 3`);
    await expect(page.locator('.player')).toHaveCount(2);
    await expect(page.locator('.player .tag').filter({ hasText: 'Novell' })).toHaveCount(1);
    await acabaLaPartida(page, '.final-repte');
    await expect(page.locator('.final-repte')).toContainText(`partida ${partida} de 3`);
    const text = (await page.locator('.final-mode-xifres dd').first().textContent())!;
    punts.push(Number(text.replace('−', '-').replace('+', '')));
    await page.getByRole('button', { name: partida < 3 ? /Següent partida/ : 'Resultat del repte' }).click();
  }

  const total = punts.reduce((a, b) => a + b, 0);
  const signe = total > 0 ? `+${total}` : total < 0 ? `−${Math.abs(total)}` : '0';
  await expect(page.locator('.repte-total')).toContainText(signe);
  await expect(page.locator('.repte-partides li')).toHaveCount(3);
  await expect(page.getByText('Reptes acabats (1)')).toBeVisible();

  // El repte té el seu marcador: l'habilitat del joc lliure no s'ha mogut.
  const perfil = await page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY);
  expect(perfil).toMatchObject({ rating: 1100, gamesPlayed: 0 });
});

test('la lliga fa servir la localitat d’El Tauler i els noms de les lligues d’escacs', async ({ page }) => {
  await obreNet(page, {
    chess_leagueCareer: JSON.stringify({ home: { territory: 'cat', municipi: 'Vic' } }),
  });
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
  const dialeg = page.getByRole('dialog', { name: 'On jugues?' });
  await expect(dialeg).toContainText('El Tauler');
  await expect(dialeg.getByLabel('Municipi')).toHaveValue('Vic');
  await expect(dialeg).toContainText("Lliga Comarcal d'Osona");
  await expect(dialeg).toContainText('Lliga Mundial');
  await dialeg.getByRole('button', { name: 'Desa' }).click();
  await expect(page.locator('.lliga h2')).toHaveText('Lliga de Vic · Grup C');
  // La lliga local comença a Novell.
  await expect(page.locator('.lliga-lloc')).toContainText('Novell · 800');
});

test('una temporada sencera de lliga: jornades, classificació i temporada següent', async ({ page }) => {
  await obreNet(page);
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ara no' }).click();
  await expect(page.locator('.lliga h2')).toHaveText('Lliga Local · Grup C');

  // Partides de tres (dos rivals), sis jugadors i tres jornades.
  const tria = (llegenda: string) => page.locator('.tria').filter({ hasText: llegenda });
  await tria('Rivals per partida').getByRole('button', { name: '2', exact: true }).click();
  await tria('Jugadors a la lliga').getByRole('button', { name: '6', exact: true }).click();
  while ((await page.locator('.tria-jornades output').textContent()) !== '3') {
    await page.getByRole('button', { name: 'Una jornada menys' }).click();
  }
  await page.getByRole('button', { name: 'Comença la temporada' }).click();
  await expect(page.locator('.lliga-taula tbody tr')).toHaveCount(6);

  // Jornada 1: en acabar, 30 segons de relax; «Classificació» atura el compte.
  let rivals = await page.locator('.lliga-rivals strong').allTextContents();
  expect(rivals).toHaveLength(2);
  await page.getByRole('button', { name: 'Juga la jornada 1' }).click();
  // Els rivals de la partida són els del calendari, amb nom i cognom.
  await expect(page.locator('.player .player-nom')).toHaveText(['Jugador', ...rivals]);
  await expect(page.locator('.nivell-mode')).toContainText('jornada 1/3');
  await obreMenu(page);
  await expect(page.locator('.nivell-seccio')).toHaveCount(0);
  await page.locator('.menu-fons').click({ position: { x: 5, y: 5 } });
  await acabaLaPartida(page, '.interludi');
  await expect(page.locator('.interludi-jornada')).toContainText('Jornada2/3');
  await expect(page.locator('.interludi-compte strong')).toHaveText(/^(30|29|28|27)$/);
  rivals = await page.locator('.interludi-rival-text strong').allTextContents();
  expect(rivals).toHaveLength(2);
  await page.getByRole('button', { name: 'Classificació' }).click();
  await expect(page.locator('.lliga-rivals strong')).toHaveText(rivals);

  // Jornada 2: «Juga ara» no espera.
  await page.getByRole('button', { name: 'Juga la jornada 2' }).click();
  await acabaLaPartida(page, '.interludi');
  rivals = await page.locator('.interludi-rival-text strong').allTextContents();
  await page.getByRole('button', { name: 'Juga ara' }).click();
  await expect(page.locator('.player .player-nom')).toHaveText(['Jugador', ...rivals]);
  await expect(page.locator('.nivell-mode')).toContainText('jornada 3/3');

  // L'última jornada acaba amb el resum de sempre.
  await acabaLaPartida(page, '.final-lliga');
  await expect(page.locator('.final-lliga')).toContainText('jornada 3 de 3');
  await page.getByRole('button', { name: 'Veure el final de la temporada' }).click();

  // Final de temporada: cadascú ha jugat les tres jornades.
  await expect(page.locator('.lliga-final')).toBeVisible();
  await expect(page.locator('.lliga-final-moviment')).toContainText(
    /Continues al Grup C de la Lliga Local|Puges al Grup B de la Lliga Local/,
  );
  const jugades = await page.locator('.lliga-final .lliga-taula tbody tr td.col-pj').allTextContents();
  if (jugades.length > 0) expect(new Set(jugades)).toEqual(new Set(['3']));
  await expect(page.getByText(/Palmarès \(1 temporada\)/)).toBeVisible();

  await page.getByRole('button', { name: 'Comença la temporada' }).click();
  await expect(page.getByRole('button', { name: 'Juga la jornada 1' })).toBeVisible();

  // La lliga no mou el nivell del joc lliure.
  const perfil = await page.evaluate((clau) => JSON.parse(localStorage.getItem(clau) ?? 'null'), PROFILE_KEY);
  expect(perfil).toMatchObject({ rating: 1100, gamesPlayed: 0 });
});

test('entre jornades: 30 segons de relax amb música composta, i la jornada següent comença sola', async ({ page }) => {
  await page.clock.install();
  await obreNet(page);
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ara no' }).click();
  await page.getByRole('button', { name: 'Comença la temporada' }).click();
  await page.getByRole('button', { name: 'Juga la jornada 1' }).click();
  await acabaLaPartida(page, '.interludi');

  // La música es compon en aquell moment i queda al registre.
  await expect(page.locator('.interludi-musica')).toContainText('Sona:', { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('remigi:musica-registre') ?? '[]').length))
    .toBe(1);

  // Amb l'app amagada, el compte enrere no corre.
  const rivals = await page.locator('.interludi-rival-text strong').allTextContents();
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.clock.fastForward(40_000);
  await page.clock.runFor(1000);
  await expect(page.locator('.interludi')).toBeVisible();

  // A la vista, a zero comença sola la jornada 2 amb els rivals anunciats.
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }));
  await page.clock.runFor(1000);
  await page.clock.fastForward(31_000);
  await page.clock.runFor(1000);
  await expect(page.locator('.player .player-nom')).toHaveText(['Jugador', ...rivals]);
  await expect(page.locator('.nivell-mode')).toContainText('jornada 2/7');

  // La peça que ha sonat es pot tornar a escoltar des de «Música composta».
  await obreMenu(page);
  await inici(page).click();
  await page.getByRole('button', { name: '🎵 Música composta' }).click();
  await expect(page.locator('.musica-peca')).toHaveCount(1);
  await page.locator('.musica-peca').getByRole('button', { name: 'Marca com a preferida' }).click();
  await expect(page.locator('.musica-peca').getByRole('button', { name: 'Treu de les preferides' })).toBeVisible();
});

test('la música entre jornades es pot silenciar i ho recorda', async ({ page }) => {
  await obreNet(page);
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ara no' }).click();
  await page.getByRole('button', { name: 'Comença la temporada' }).click();
  await page.getByRole('button', { name: 'Juga la jornada 1' }).click();
  await acabaLaPartida(page, '.interludi');
  await page.locator('.interludi-musica').getByRole('button', { name: 'Silencia' }).click();
  await expect(page.locator('.interludi-musica')).toContainText('Sense música');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('remigi:musica') ?? '{}').on)).toBe(false);
});
