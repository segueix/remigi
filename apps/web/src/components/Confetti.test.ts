import { describe, expect, it } from 'vitest';
import { burst, rain, step } from './Confetti';

/** Un atzar determinista (mulberry32), perquè les proves no depenguin de la sort. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('confeti', () => {
  it('un esclat surt del punt indicat i cap amunt', () => {
    const particles = burst(rng(1), 100, 500, 80, Math.PI * 0.5, -Math.PI / 2);
    expect(particles).toHaveLength(80);
    for (const p of particles) {
      expect(p.x).toBe(100);
      expect(p.y).toBe(500);
      expect(p.vy).toBeLessThan(0);
      expect(p.life).toBeGreaterThan(0);
    }
    expect(new Set(particles.map((p) => p.color)).size).toBeGreaterThan(3);
  });

  it('la pluja comença per sobre de la pantalla i dins de l’ample', () => {
    const particles = rain(rng(2), 400, 50);
    for (const p of particles) {
      expect(p.y).toBeLessThan(0);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(400);
      expect(p.vy).toBeGreaterThan(0);
    }
  });

  it('amb el temps cau (gravetat) i s’esgota', () => {
    const [p] = burst(rng(3), 0, 300, 1, 0, -Math.PI / 2);
    const startY = p.y;
    let top = startY;
    for (let i = 0; i < 600; i++) {
      step(p, 1 / 60);
      top = Math.min(top, p.y);
    }
    expect(top).toBeLessThan(startY); // primer puja…
    expect(p.y).toBeGreaterThan(top); // …i després cau
    expect(p.life).toBeLessThan(0); // en deu segons s'ha acabat
  });

  it('la simulació no depèn de la velocitat de refresc', () => {
    const a = burst(rng(4), 0, 0, 1, 0)[0];
    const b = { ...a };
    for (let i = 0; i < 60; i++) step(a, 1 / 60);
    for (let i = 0; i < 30; i++) step(b, 1 / 30);
    expect(Math.abs(a.y - b.y)).toBeLessThan(20);
  });
});
