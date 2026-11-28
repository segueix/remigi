import { describe, expect, it } from 'vitest';
import { adaptDelta, botDay, botPending, curveRating, botPublication, nextStreak, playDaily, type BotConfig } from './automatic';

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

  it('corba d’aprenentatge: comença fluix i s’acosta a la seva força', () => {
    const learner: BotConfig = { ...bot, rating: 1450, curve: { kind: 'aprenent', start: '2026-11-29', from: 1050, halfLife: 21 } };
    expect(curveRating(learner, '2026-11-20')).toBe(1050);
    expect(curveRating(learner, '2026-11-29')).toBe(1050);
    expect(curveRating(learner, '2026-12-20')).toBeCloseTo(1250, 5);
    expect(curveRating(learner, '2027-03-01')).toBeGreaterThan(1400);
    expect(curveRating(learner, '2027-03-01')).toBeLessThan(1450);
  });

  it('corba d’ones: puja i baixa dins de l’amplitud, amb el cicle donat', () => {
    const waves: BotConfig = { ...bot, rating: 1300, curve: { kind: 'ones', period: 9, amplitude: 180 } };
    const values = Array.from({ length: 18 }, (_, i) => curveRating(waves, new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10)));
    for (const v of values) expect(Math.abs(v - 1300)).toBeLessThanOrEqual(180);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(300);
    for (let i = 0; i < 9; i++) expect(values[i + 9]).toBeCloseTo(values[i], 5);
  });

  it('corba setmanal: un ajust per a cada dia de la setmana', () => {
    const weekly: BotConfig = { ...bot, rating: 1250, curve: { kind: 'setmana', offsets: [150, -100, -50, -150, -50, 0, 150] } };
    expect(curveRating(weekly, '2026-11-29')).toBe(1400); // diumenge
    expect(curveRating(weekly, '2026-12-02')).toBe(1100); // dimecres
    expect(curveRating(weekly, '2026-12-05')).toBe(1400); // dissabte
  });

  it('reacció al dia abans: per ratxa o per derrota, amb límit, i res si no va jugar', () => {
    const moody: BotConfig = { ...bot, adapt: { win: 30, loss: -40, max: 120 } };
    const entry = (streak: number, lastDay: string) => ({ alias: 'Prova', streak, bestStreak: streak, lastDay });
    expect(adaptDelta(moody, '2026-12-02', entry(2, '2026-12-01'))).toBe(60);
    expect(adaptDelta(moody, '2026-12-02', entry(9, '2026-12-01'))).toBe(120);
    expect(adaptDelta(moody, '2026-12-02', entry(0, '2026-12-01'))).toBe(-40);
    expect(adaptDelta(moody, '2026-12-02', entry(3, '2026-11-29'))).toBe(0);
    expect(adaptDelta(moody, '2026-12-02', null)).toBe(0);
    expect(adaptDelta(bot, '2026-12-02', entry(2, '2026-12-01'))).toBe(0);
    // La reacció mou la força del dia, però no si juga ni l’hora.
    const plain = botDay(moody, '2026-12-02');
    const after = botDay(moody, '2026-12-02', entry(2, '2026-12-01'));
    expect(after.plays).toBe(plain.plays);
    expect(after.publishAt).toBe(plain.publishAt);
    expect(after.rating - plain.rating).toBe(60);
  });

  it('amb `start`, no juga abans d’aquell dia (ni per posar-se al dia)', () => {
    const late: BotConfig = { ...bot, skipRate: 0, start: '2026-11-28' };
    expect(botDay(late, '2026-11-27').plays).toBe(false);
    expect(botDay(late, '2026-11-28').plays).toBe(true);
    expect(botPending(late, '2026-11-28', 23 * 60, null).yesterday).toBe(false);
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

  it('no se salta cap dia que li toca: si ahir no va publicar, ho fa ara; avui, quan arriba la seva hora', () => {
    const days = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 10, 22 + i)).toISOString().slice(0, 10));
    // Un dia que juga i l'anterior també.
    const day = days.find((d, i) => i > 0 && botDay(bot, d).plays && botDay(bot, days[i - 1]).plays)!;
    const yesterday = days[days.indexOf(day) - 1];
    const at = botDay(bot, day).publishAt;
    const fitxa = (lastDay: string) => ({ alias: 'Prova', streak: 0, bestStreak: 0, lastDay });
    // L'última vegada que va publicar va ser abans d'ahir: ahir queda pendent.
    expect(botPending(bot, day, at - 1, fitxa('2026-11-01'))).toEqual({ yesterday: true, today: false });
    expect(botPending(bot, day, at, fitxa('2026-11-01'))).toEqual({ yesterday: true, today: true });
    // Sense fitxa (no ha publicat mai), també.
    expect(botPending(bot, day, at, null)).toEqual({ yesterday: true, today: true });
    // Ahir ja hi és: només avui, i un cop publicat, res.
    expect(botPending(bot, day, at, fitxa(yesterday))).toEqual({ yesterday: false, today: true });
    expect(botPending(bot, day, 1439, fitxa(day))).toEqual({ yesterday: false, today: false });
    // A mà, sense esperar l'hora.
    expect(botPending(bot, day, 0, fitxa(yesterday), true)).toEqual({ yesterday: false, today: true });
  });

  it('els dies que no li toca jugar no queden pendents, ni ahir ni avui', () => {
    const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 10, 22 + i)).toISOString().slice(0, 10));
    const off = days.find((d, i) => i < days.length - 1 && !botDay(bot, d).plays)!;
    const next = days[days.indexOf(off) + 1];
    expect(botPending(bot, off, 1439, null).today).toBe(false);
    expect(botPending(bot, next, 0, null).yesterday).toBe(false);
    expect(botPending({ ...bot, active: false }, next, 1439, null)).toEqual({ yesterday: false, today: false });
  });
});
