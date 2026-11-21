import { describe, expect, it } from 'vitest';
import { botDay, botPublication, nextStreak, playDaily, type BotConfig } from './automatic';

const bot: BotConfig = {
  key: 'prova',
  alias: 'Prova',
  uid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  rating: 1200,
  spread: 180,
  skipRate: 0.15,
  from: '08:00',
  to: '12:00',
  active: true,
};

describe('jugadors automàtics', () => {
  it('cada dia: si juga, la força (dins del marge) i l’hora de publicar (entre les 8 i les 12)', () => {
    const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 22 + i)).toISOString().slice(0, 10));
    const plans = days.map((day) => botDay(bot, day));
    for (const plan of plans) {
      expect(plan.rating).toBeGreaterThanOrEqual(1020);
      expect(plan.rating).toBeLessThanOrEqual(1380);
      expect(plan.publishAt).toBeGreaterThanOrEqual(8 * 60);
      expect(plan.publishAt).toBeLessThan(12 * 60);
    }
    // Algun dia no juga, però la majoria sí.
    const skipped = plans.filter((p) => !p.plays).length;
    expect(skipped).toBeGreaterThan(0);
    expect(skipped).toBeLessThan(30);
    // La força canvia d'un dia a l'altre.
    expect(new Set(plans.map((p) => p.rating)).size).toBeGreaterThan(10);
    // I és sempre la mateixa per al mateix dia.
    expect(botDay(bot, days[0])).toEqual(plans[0]);
  });

  it('un jugador desactivat no juga mai', () => {
    expect(botDay({ ...bot, active: false }, '2026-11-22').plays).toBe(false);
  });

  it('juga la partida del dia de debò, i sempre igual', () => {
    const result = playDaily('2026-11-23', 1300, bot.uid);
    expect(result.day).toBe('2026-11-23');
    expect(result.moves).toBeGreaterThan(0);
    expect(playDaily('2026-11-23', 1300, bot.uid)).toEqual(result);
  }, 30_000);

  it('la ratxa: suma si guanya l’endemà d’haver guanyat; si perd o salta un dia, torna a zero', () => {
    const win = (day: string) => ({ day, won: true, moves: 12, points: 0, rivals: 40 });
    expect(nextStreak(null, win('2026-11-23'))).toEqual({ streak: 1, bestStreak: 1 });
    const prev = { alias: 'Prova', streak: 3, bestStreak: 5, lastDay: '2026-11-22' };
    expect(nextStreak(prev, win('2026-11-23'))).toEqual({ streak: 4, bestStreak: 5 });
    expect(nextStreak({ ...prev, lastDay: '2026-11-20' }, win('2026-11-23'))).toEqual({ streak: 1, bestStreak: 5 });
    expect(nextStreak(prev, { ...win('2026-11-23'), won: false, points: 20 })).toEqual({ streak: 0, bestStreak: 5 });
  });

  it('el que es publica té la forma del rànquing (amb el desempat)', () => {
    const { entry, player } = botPublication(bot, { day: '2026-11-23', won: true, moves: 12, points: 0, rivals: 40 }, null);
    expect(entry).toEqual({ alias: 'Prova', won: true, moves: 12, points: 0, rivals: 40, score: 12_959, streak: 1 });
    expect(player).toEqual({ alias: 'Prova', streak: 1, bestStreak: 1, lastDay: '2026-11-23' });
  });
});
