import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

// Servidor propi per simular dues publicacions sense modificar el build
// compartit amb les altres proves ni interceptar peticions del service worker.
test('una publicació nova recarrega l’app oberta i conserva les dades', async ({ page }) => {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  let release = 1;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, 'http://localhost');
      const relative = url.pathname.replace(/^\/remigi\//, '') || 'index.html';
      const path = resolve(dist, relative);
      if (!path.startsWith(dist)) { res.writeHead(404).end(); return; }
      let content = await readFile(path);
      if (relative === 'sw.js') content = Buffer.from(`// Versió de prova: ${release}\n${content}`);
      if (relative === 'index.html') {
        content = Buffer.from(content.toString().replace('<head>', `<head><meta name="test-release" content="${release}">`));
      }
      const type = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' } as Record<string, string>)[extname(path)] ?? 'application/json';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address() as { port: number };
  try {
    const sw = await readFile(resolve(dist, 'sw.js'), 'utf8');
    expect(sw).toMatch(/^\/\/ Publicació: [0-9a-f-]+/);
    await page.goto(`http://127.0.0.1:${address.port}/remigi/`);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.reload();
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    await page.evaluate(() => localStorage.setItem('test-update-preserved', 'sí'));
    release = 2;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', '2');
    await expect(page.locator('.rack .tile').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('test-update-preserved'))).toBe('sí');
    // No hi ha una segona recàrrega quan es comprova la mateixa publicació.
    await page.evaluate(() => { document.body.dataset.updateStable = 'sí'; window.dispatchEvent(new Event('focus')); });
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
    expect(await page.locator('body').getAttribute('data-update-stable')).toBe('sí');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  }
});
