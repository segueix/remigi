import { describe, expect, it } from 'vitest';
import { MAX_STEP_MS, resyncCountdown, startCountdown, tickCountdown } from './countdown';

describe('el compte enrere entre jornades', () => {
  it('descompta el temps que passa amb l’app a la vista', () => {
    let c = startCountdown(30_000, 0);
    for (let t = 200; t <= 3000; t += 200) c = tickCountdown(c, t, false);
    expect(c.left).toBe(27_000);
  });

  it('amb l’app amagada no corre', () => {
    let c = startCountdown(30_000, 0);
    c = tickCountdown(c, 200, false);
    for (let t = 400; t <= 60_000; t += 200) c = tickCountdown(c, t, true);
    expect(c.left).toBe(29_800);
  });

  it('si el navegador ha suspès els temporitzadors, l’estona amagada no compta', () => {
    let c = startCountdown(30_000, 0);
    c = tickCountdown(c, 200, false);
    // S'amaga; el mòbil suspèn els tocs; torna al cap d'un minut.
    c = resyncCountdown(c, 300);
    c = resyncCountdown(c, 60_300);
    c = tickCountdown(c, 60_400, false);
    expect(c.left).toBe(29_700);
  });

  it('encara que no arribi l’avís de visibilitat, un salt no descompta més d’un segon', () => {
    let c = startCountdown(30_000, 0);
    c = tickCountdown(c, 120_000, false);
    expect(c.left).toBe(30_000 - MAX_STEP_MS);
  });
});
