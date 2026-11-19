import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_CONFIG, TOP_TIER, YOU, closeSeason, createSeason, newCareer, recordRound, serializeLeagueState } from '../src/lliga/league';

/**
 * Guanyar la Lliga Mundial, Divisió A: confeti, el trofeu, el diploma amb el nom
 * del jugador (que es descarrega com a PNG) i el botó de WhatsApp.
 */

/** Un estat de lliga amb la temporada acabada al graó `tier`, guanyada amb la puntuació donada. */
function leagueAfterSeason(tier: number, yourScore: number): string {
  let season = createSeason({ tier, config: DEFAULT_CONFIG, home: null, seed: 11, date: new Date(2026, 10, 19, 20) });
  while (season.played < season.config.rounds) {
    const table = season.schedule[season.played].find((t) => t.includes(YOU)) ?? [];
    season = recordRound(season, table.map((id) => (id === YOU ? yourScore : -40)));
  }
  const career = { ...closeSeason(newCareer(null), season, new Date(2026, 10, 19, 21)), homeAsked: true };
  return serializeLeagueState({ career, season });
}

async function obreLaLliga(page: Page, estat: string): Promise<void> {
  await page.addInitScript((dades) => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
    localStorage.setItem('remigi:temps-torn', 'cap');
    localStorage.setItem('remigi:lliga', dades);
  }, estat);
  await page.goto('./');
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
}

const celebracio = (page: Page) => page.getByRole('dialog', { name: 'Ets el millor jugador del món!' });

test('guanyar la Mundial A obre la celebració, un sol cop', async ({ page }) => {
  await obreLaLliga(page, leagueAfterSeason(TOP_TIER, 900));

  await expect(celebracio(page)).toBeVisible();
  await expect(page.locator('canvas.confeti')).toBeVisible();
  await expect(celebracio(page)).toContainText('Lliga Mundial · Divisió A');
  // El diploma es dibuixa de debò (A4 apaïsat a 150 ppp).
  const diploma = celebracio(page).locator('.campio-diploma img');
  await expect(diploma).toBeVisible();
  expect(await diploma.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1754, 1240]);
  // El confeti pinta píxels de debò.
  await page.waitForTimeout(500);
  const pintat = await page.locator('canvas.confeti').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  });
  expect(pintat).toBe(true);

  await page.keyboard.press('Escape');
  await expect(celebracio(page)).toHaveCount(0);
  await expect(page.locator('canvas.confeti')).toHaveCount(0);

  // En tornar-hi no es repeteix, però el diploma es pot tornar a veure.
  await page.reload();
  await page.getByRole('button', { name: 'Lliga', exact: true }).click();
  await expect(page.locator('.lliga-final')).toBeVisible();
  await expect(celebracio(page)).toHaveCount(0);
  await page.getByRole('button', { name: /Diploma de Millor jugador del món/ }).click();
  await expect(celebracio(page)).toBeVisible();
});

test('el diploma es descarrega com a PNG', async ({ page }) => {
  await obreLaLliga(page, leagueAfterSeason(TOP_TIER, 900));
  await expect(celebracio(page).locator('.campio-diploma img')).toBeVisible();

  const baixada = page.waitForEvent('download');
  await celebracio(page).getByRole('button', { name: 'Descarrega el diploma' }).click();
  const fitxer = await baixada;
  expect(fitxer.suggestedFilename()).toMatch(/^diploma-remigi(-[a-z0-9-]+)?\.png$/);
  const path = await fitxer.path();
  const bytes = (await import('node:fs')).readFileSync(path);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.length).toBeGreaterThan(20_000);
});

test('compartir: al mòbil, el menú del sistema amb el diploma i el missatge', async ({ page }) => {
  await page.addInitScript(() => {
    const trucades: { files: { name: string; type: string }[]; text: string }[] = [];
    (window as unknown as { __shares: typeof trucades }).__shares = trucades;
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (data: { files: File[]; text: string }) => {
        trucades.push({ files: data.files.map((f) => ({ name: f.name, type: f.type })), text: data.text });
      },
      configurable: true,
    });
  });
  await obreLaLliga(page, leagueAfterSeason(TOP_TIER, 900));
  const boto = celebracio(page).getByRole('button', { name: 'Comparteix per WhatsApp' });
  await expect(boto).toBeEnabled();
  await boto.click();
  const enviat = await page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares);
  expect(enviat).toHaveLength(1);
  const [dades] = enviat as { files: { name: string; type: string }[]; text: string }[];
  expect(dades.files).toHaveLength(1);
  expect(dades.files[0].type).toBe('image/png');
  expect(dades.files[0].name).toMatch(/\.png$/);
  expect(dades.text).toContain('millor jugador del món');
});

test('compartir a l’ordinador: obre WhatsApp amb el missatge i baixa el diploma', async ({ page, context }) => {
  await obreLaLliga(page, leagueAfterSeason(TOP_TIER, 900));
  const boto = celebracio(page).getByRole('button', { name: 'Comparteix per WhatsApp' });
  await expect(boto).toBeEnabled();
  // Sense sortir a internet: WhatsApp es contesta des de la prova.
  await context.route('https://wa.me/**', (ruta) => ruta.fulfill({ contentType: 'text/html', body: 'WhatsApp' }));
  const nova = context.waitForEvent('page');
  const baixada = page.waitForEvent('download');
  await boto.click();
  const pestanya = await nova;
  await pestanya.waitForURL(/^https:\/\/wa\.me\//);
  const url = pestanya.url();
  await baixada;
  expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(url.split('?text=')[1])).toContain('Sóc el millor jugador del món al Remigi');
  await expect(celebracio(page)).toContainText('S’ha obert WhatsApp');
});

test('guanyar una altra lliga no dona el títol mundial', async ({ page }) => {
  await obreLaLliga(page, leagueAfterSeason(TOP_TIER - 3, 900));
  await expect(page.locator('.lliga-final')).toBeVisible();
  await expect(celebracio(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Diploma de Millor jugador del món/ })).toHaveCount(0);
});
