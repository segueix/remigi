import { describe, expect, it } from 'vitest';
import {
  HINT_KEY,
  HINT_TIMES,
  TARGET_NAME,
  TARGET_URL,
  commitDistance,
  initAppSwitch,
  lockAxis,
  progress,
  shouldCommit,
  shouldShowHint,
  startAllowed,
} from './appSwitch';

const W = 393; // un mòbil
const H = 851;

describe('pas a El Tauler: zona on ha de començar el gest', () => {
  it('el mig de la pantalla sí', () => {
    expect(startAllowed({ x: W / 2, y: H / 2, width: W, height: H })).toBe(true);
  });

  it("les vores no (hi ha el gest d'enrere del sistema)", () => {
    expect(startAllowed({ x: 10, y: H / 2, width: W, height: H })).toBe(false);
    expect(startAllowed({ x: W - 10, y: H / 2, width: W, height: H })).toBe(false);
  });

  it('ni la llista de jugadors de dalt ni els botons de baix', () => {
    expect(startAllowed({ x: W / 2, y: 40, width: W, height: H })).toBe(false);
    expect(startAllowed({ x: W / 2, y: H - 30, width: W, height: H })).toBe(false);
  });

  it("sense mides de pantalla no s'activa", () => {
    expect(startAllowed({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
  });
});

describe('pas a El Tauler: direcció i llindar', () => {
  it('fins als 12 px encara no es decideix', () => {
    expect(lockAxis(8, 3)).toBe('');
  });

  it('horitzontal només si és clarament de costat (desplaçar la taula és vertical)', () => {
    expect(lockAxis(30, 5)).toBe('h');
    expect(lockAxis(-30, 5)).toBe('h');
    expect(lockAxis(20, 15)).toBe('v');
    expect(lockAxis(3, 40)).toBe('v');
  });

  it("cal arrossegar el 35 % de l'ample, com a mínim 110 px", () => {
    expect(commitDistance(W)).toBeCloseTo(W * 0.35);
    expect(commitDistance(200)).toBe(110);
    expect(shouldCommit({ dx: -W * 0.3, dy: 0, width: W })).toBe(false);
    expect(shouldCommit({ dx: -W * 0.4, dy: 10, width: W })).toBe(true);
    expect(shouldCommit({ dx: W * 0.4, dy: 10, width: W })).toBe(true);
    // Massa en diagonal: no.
    expect(shouldCommit({ dx: W * 0.4, dy: W * 0.3, width: W })).toBe(false);
  });

  it("el panell entra proporcionalment al dit i s'atura a 1", () => {
    expect(progress(0, W)).toBe(0);
    expect(progress(-commitDistance(W) / 2, W)).toBeCloseTo(0.5);
    expect(progress(1000, W)).toBe(1);
  });

  it('va a El Tauler', () => {
    expect(TARGET_URL).toBe('https://eltauler.cat/');
    expect(TARGET_NAME).toBe('El Tauler');
  });
});

describe('pas a El Tauler: avís de les primeres vegades', () => {
  it('surt tres vegades i prou', () => {
    expect(HINT_TIMES).toBe(3);
    expect(shouldShowHint(0)).toBe(true);
    expect(shouldShowHint(2)).toBe(true);
    expect(shouldShowHint(3)).toBe(false);
    expect(shouldShowHint('x')).toBe(true);
  });

  it("la clau és de Remigi (comparteix domini i localStorage amb El Tauler)", () => {
    expect(HINT_KEY).toMatch(/^remigi:/);
  });
});

describe('pas a El Tauler: arrencada', () => {
  it("s'arrenca un sol cop i escolta el dit sense bloquejar el desplaçament", () => {
    const listeners: { name: string; options: unknown }[] = [];
    const doc = {
      documentElement: { dataset: {} as Record<string, string> },
      addEventListener: (name: string, _cb: unknown, options: unknown) => listeners.push({ name, options }),
    };
    const win = {
      document: doc,
      addEventListener: () => {},
      matchMedia: () => ({ matches: false }), // ordinador: no hi ha avís
    } as unknown as Window;

    expect(initAppSwitch(win)).toBe(true);
    expect(initAppSwitch(win)).toBe(false);
    const touch = listeners.filter((l) => l.name.startsWith('touch'));
    expect(touch.map((l) => l.name).sort()).toEqual(['touchcancel', 'touchend', 'touchmove', 'touchstart']);
    expect(touch.every((l) => (l.options as { passive?: boolean }).passive === true)).toBe(true);
  });
});
