import { expect, test } from '@playwright/test';
import { baixaGrup, entraAmbPartida, f } from './ajudants';

/**
 * El repàs de després de la partida: robar havent-hi jugada queda apuntat, el
 * final ho diu, i el quiz torna a posar aquella taula i aquell faristol perquè
 * la jugada la trobis tu (o te l'ensenyi, sobre el mateix tauler).
 *
 * La partida preparada acaba de seguida: el sac té una sola fitxa i el bot no
 * pot jugar mai, així que robar i passar la deixen bloquejada en dos torns del
 * jugador — tots dos amb un grup de nous a la mà que es podia baixar.
 */
test('robar havent-hi jugada acaba en quiz sobre el mateix tauler', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('red', 9), f('blue', 9), f('black', 9), f('orange', 13)],
    board: [],
    haObert: true,
  });

  // Primer torn: robar tot i tenir el grup de nous és la primera oportunitat…
  await page.getByRole('button', { name: 'Robar fitxa' }).click();

  // …i queda desada amb la partida, per si es tanca la pestanya a mitges.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = localStorage.getItem('remigi:game');
        return saved ? (JSON.parse(saved).misses?.length ?? 0) : -1;
      }),
    )
    .toBe(1);

  // Segon torn (el bot ha passat, el sac és buit): passar és la segona.
  const passa = page.getByRole('button', { name: 'Passar torn' });
  await expect(passa).toBeEnabled();
  await passa.click();

  // La partida queda bloquejada i el final ofereix el repàs, amb el compte.
  const crida = page.locator('.quiz-crida');
  await expect(crida).toContainText('2 cops has robat fitxa quan hi havia jugada');
  await page.getByRole('button', { name: 'Fes el quiz del repàs' }).click();

  // Oportunitat 1: la taula i el faristol tornen a ser els d'aquell moment.
  await expect(page.locator('.quiz-cap')).toContainText('oportunitat 1 de 2');
  await expect(page.locator('.quiz-cap')).toContainText('al torn 5');
  await expect(page.locator('.quiz .rack .tile')).toHaveCount(4);
  await expect(page.locator('.quiz .board .meld')).toHaveCount(0);

  // Una jugada a mitges rep l'error del motor, com a la partida.
  await baixaGrup(page, ['9 vermell', '9 blau']);
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  await expect(page.locator('.error')).toContainText('com a mínim 3');

  // Completada, el motor la dona per bona i el quiz ho celebra.
  await page.locator('.rack .tile[aria-label="9 negre"]').click();
  await page.locator('.board .meld').first().click();
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  await expect(page.locator('.hint-be')).toContainText('L’has trobada!');
  await expect(page.locator('.hint-be')).toContainText('tantes com la millor jugada');
  await expect(page.locator('.quiz .board .tile.highlighted')).toHaveCount(3);

  // Oportunitat 2: aquesta s'ensenya en comptes de trobar-la. Les fitxes de la
  // solució apareixen il·luminades al tauler i desapareixen del faristol.
  await page.getByRole('button', { name: 'Següent' }).click();
  await expect(page.locator('.quiz-cap')).toContainText('oportunitat 2 de 2');
  await expect(page.locator('.quiz .rack .tile')).toHaveCount(5);
  await page.getByRole('button', { name: 'Mostra la solució' }).click();
  await expect(page.locator('.hint-be')).toContainText('es podien baixar les 3 fitxes');
  await expect(page.locator('.quiz .board .tile.highlighted')).toHaveCount(3);
  await expect(page.locator('.quiz .rack .tile')).toHaveCount(2);

  // El resum del repàs: una de trobada, una d'ensenyada. I tornar al final.
  await page.getByRole('button', { name: 'Acaba el repàs' }).click();
  await expect(page.locator('.quiz-final')).toContainText('Has trobat 1 de 2');
  await expect(page.locator('.quiz-final')).toContainText('(1 ensenyada)');
  await page.getByRole('button', { name: 'Torna al resum' }).click();
  await expect(page.getByRole('button', { name: 'Una altra partida' })).toBeVisible();
  await expect(crida).toBeVisible();
});

/**
 * L'altra cara: si no t'has deixat cap jugada, el final ho diu i no hi ha quiz.
 * Guanyar baixant l'única jugada possible no en deixa cap per repassar.
 */
test('sense oportunitats perdudes no hi ha quiz, i es felicita', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('red', 9), f('blue', 9), f('black', 9)],
    board: [],
    haObert: true,
  });

  await baixaGrup(page, ['9 vermell', '9 blau', '9 negre']);
  await page.getByRole('button', { name: 'Acabar jugada' }).click();

  await expect(page.locator('.quiz-crida-neta')).toContainText('No t’has deixat cap jugada');
  await expect(page.locator('.quiz-crida')).toHaveCount(0);
});
