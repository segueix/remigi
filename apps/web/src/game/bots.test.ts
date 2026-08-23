import { describe, expect, it } from 'vitest';
import { BOT_PERSONAS, botEmoji, pickPersonas } from './bots';

describe('el planter de bots', () => {
  it('té com a mínim 20 personatges, tots diferents', () => {
    expect(BOT_PERSONAS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(BOT_PERSONAS.map((p) => p.name)).size).toBe(BOT_PERSONAS.length);
    expect(new Set(BOT_PERSONAS.map((p) => p.emoji)).size).toBe(BOT_PERSONAS.length);
    // I cadascun amb els dos colors del seu avatar.
    for (const persona of BOT_PERSONAS) {
      expect(persona.colors).toHaveLength(2);
      for (const color of persona.colors) expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('tria personatges diferents dins de la mateixa partida', () => {
    // Amb prou tirades, una repetició sortiria segur si fos possible.
    for (let i = 0; i < 200; i++) {
      const triats = pickPersonas(3);
      expect(new Set(triats.map((p) => p.name)).size).toBe(3);
    }
  });

  it('les partides no tenen sempre els mateixos rivals', () => {
    const noms = new Set<string>();
    for (let i = 0; i < 50; i++) pickPersonas(2).forEach((p) => noms.add(p.name));
    // 50 partides han de tocar força més que els 2-3 noms d'una de sola.
    expect(noms.size).toBeGreaterThan(10);
  });

  it('no demana més personatges que el planter', () => {
    expect(pickPersonas(999).length).toBe(BOT_PERSONAS.length);
  });

  it('cada nom té el seu avatar, i els desconeguts en tenen un de recanvi', () => {
    expect(botEmoji('MussolSavi')).toBe('🦉');
    // Una partida desada d'una versió anterior porta bots d'un planter antic.
    expect(botEmoji('Bot 1')).toBe('🤖');
    expect(botEmoji('Núria')).toBe('🤖');
  });
});
