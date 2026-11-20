import { createGame } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DAILY,
  bestStreak,
  compareResults,
  countdownText,
  msUntilNextDay,
  currentStreak,
  dayKey,
  dayNumber,
  daySeed,
  firstPlayerOf,
  humanMoves,
  parseDailyState,
  previousDay,
  recentSquares,
  recordResult,
  resultText,
  shareText,
  withCarried,
  type DailyResult,
  type DailyState,
} from './daily';

const win = (day: string, moves = 10): DailyResult => ({ day, won: true, moves, points: 0 });
const loss = (day: string, points = 20, moves = 15): DailyResult => ({ day, won: false, moves, points });
const withResults = (...results: DailyResult[]): DailyState =>
  results.reduce((state, r) => recordResult(state, r), EMPTY_DAILY);

describe('dates', () => {
  it('el dia és el de Barcelona, en format AAAA-MM-DD', () => {
    // 23:30 UTC del 5 de gener són les 00:30 del 6 a Barcelona (hivern, UTC+1).
    expect(dayKey(new Date(Date.UTC(2026, 0, 5, 23, 30)))).toBe('2026-01-06');
    expect(dayKey(new Date(Date.UTC(2026, 0, 5, 22, 30)))).toBe('2026-01-05');
    // A l'estiu, UTC+2: les 22:30 UTC ja són l'endemà.
    expect(dayKey(new Date(Date.UTC(2026, 6, 5, 22, 30)))).toBe('2026-07-06');
  });

  it('el compte enrere va fins a mitjanit de Barcelona', () => {
    // 22:00 a Barcelona (21:00 UTC a l'hivern): falten 2 hores.
    expect(msUntilNextDay(new Date(Date.UTC(2026, 0, 5, 21, 0)))).toBe(2 * 3_600_000);
    expect(countdownText(2 * 3_600_000 + 5 * 60_000)).toBe('2 h 5 min');
    expect(countdownText(12 * 60_000)).toBe('12 min');
    expect(countdownText(20_000)).toBe('menys d’1 min');
  });

  it('el dia anterior travessa mesos i anys', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });

  it('la partida del dia es numera des del primer dia', () => {
    expect(dayNumber('2026-11-20')).toBe(1);
    expect(dayNumber('2026-11-21')).toBe(2);
    expect(dayNumber('2027-11-20')).toBe(366);
  });
});

describe('la mateixa partida per a tothom', () => {
  it('la llavor depèn només del dia', () => {
    expect(daySeed('2026-11-20')).toBe(daySeed('2026-11-20'));
    expect(daySeed('2026-11-20')).not.toBe(daySeed('2026-11-21'));
  });

  it('mateixa llavor: mateixa mà i el sac en el mateix ordre', () => {
    const players = [
      { name: 'Tu', kind: 'human' as const },
      { name: 'A', kind: 'ai' as const },
      { name: 'B', kind: 'ai' as const },
    ];
    const a = createGame({ seed: daySeed('2026-11-20'), firstPlayer: 0, players });
    const b = createGame({ seed: daySeed('2026-11-20'), firstPlayer: 0, players });
    expect(a.players[0].rack.map((t) => t.id)).toEqual(b.players[0].rack.map((t) => t.id));
    expect(a.bag.map((t) => t.id)).toEqual(b.bag.map((t) => t.id));
  });
});

describe('les jugades', () => {
  it('compta els teus torns, començant tu', () => {
    // Taula de tres, comences tu: torns 1, 4, 7 són teus.
    expect(humanMoves(7, 3, 0)).toBe(3);
    expect(humanMoves(6, 3, 0)).toBe(2);
  });

  it('compta els teus torns si comença un altre', () => {
    // Comença el jugador 2 de 3: el teu primer torn és el 2.
    expect(humanMoves(2, 3, 2)).toBe(1);
    expect(humanMoves(1, 3, 2)).toBe(0);
  });

  it('dedueix qui va començar', () => {
    expect(firstPlayerOf(1, 0, 3)).toBe(0);
    expect(firstPlayerOf(7, 0, 3)).toBe(0);
    expect(firstPlayerOf(5, 1, 3)).toBe(0);
    expect(firstPlayerOf(2, 0, 3)).toBe(2);
  });
});

describe('resultats', () => {
  it('guanyar sempre és millor que perdre; menys jugades o menys punts, millor', () => {
    expect(compareResults(win('d', 30), loss('d', 1))).toBeLessThan(0);
    expect(compareResults(win('d', 9), win('d', 12))).toBeLessThan(0);
    expect(compareResults(loss('d', 5), loss('d', 40))).toBeLessThan(0);
  });

  it('cada dia compta un sol cop: el primer', () => {
    const state = withResults(win('2026-11-20', 10), loss('2026-11-20', 3));
    expect(state.results).toHaveLength(1);
    expect(state.results[0].won).toBe(true);
  });

  it('els textos', () => {
    expect(resultText(win('d', 1))).toBe('Guanyada en 1 jugada');
    expect(resultText(win('d', 12))).toBe('Guanyada en 12 jugades');
    expect(resultText(loss('d', 23))).toBe('23 punts a la mà');
  });
});

describe('la ratxa de dies número 1', () => {
  it('compta els dies seguits guanyats fins avui', () => {
    const state = withResults(win('2026-11-18'), win('2026-11-19'), win('2026-11-20'));
    expect(currentStreak(state, '2026-11-20')).toBe(3);
  });

  it('si avui encara no has jugat, la ratxa d’ahir continua viva', () => {
    const state = withResults(win('2026-11-18'), win('2026-11-19'));
    expect(currentStreak(state, '2026-11-20')).toBe(2);
  });

  it('perdre o saltar-se un dia la talla', () => {
    expect(currentStreak(withResults(win('2026-11-18'), loss('2026-11-19')), '2026-11-19')).toBe(0);
    expect(currentStreak(withResults(win('2026-11-17'), win('2026-11-19')), '2026-11-19')).toBe(1);
    expect(currentStreak(withResults(win('2026-11-17')), '2026-11-19')).toBe(0);
  });

  it('la millor ratxa de tots els temps', () => {
    const state = withResults(
      win('2026-11-01'),
      win('2026-11-02'),
      win('2026-11-03'),
      loss('2026-11-04'),
      win('2026-11-05'),
      win('2026-11-07'),
      win('2026-11-08'),
    );
    expect(bestStreak(state)).toBe(3);
  });

  it('els quadrets dels últims dies', () => {
    const state = withResults(win('2026-11-18'), loss('2026-11-20'));
    expect(recentSquares(state, '2026-11-20', 3)).toBe('🟩⬜🟥');
  });

  it('el missatge per compartir porta el número, el resultat, la ratxa i l’enllaç', () => {
    const state = withResults(win('2026-11-20', 11), win('2026-11-21', 9));
    const text = shareText(state, state.results[0], 'https://exemple.cat/remigi/');
    expect(text).toContain('Partida del dia #2');
    expect(text).toContain('Guanyada en 9 jugades');
    expect(text).toContain('2 dies seguits número 1');
    expect(text.endsWith('https://exemple.cat/remigi/')).toBe(true);
  });
});

describe('desat', () => {
  it('torna el que s’ha desat i descarta el que ve malmès', () => {
    const state = withResults(win('2026-11-20'), loss('2026-11-21'));
    expect(parseDailyState(JSON.stringify(state))).toEqual(state);
    const dirty = { results: [win('2026-11-20'), { day: 'ahir', won: true }, { ...loss('2026-11-21'), points: -3 }] };
    expect(parseDailyState(JSON.stringify(dirty)).results).toEqual([win('2026-11-20')]);
    expect(parseDailyState('no és json')).toEqual(EMPTY_DAILY);
    expect(parseDailyState(null)).toEqual(EMPTY_DAILY);
  });
});

describe('la ratxa que ve del compte', () => {
  it('continua amb les victòries d’aquí i compta per a la millor', () => {
    const carried = { streak: 4, bestStreak: 6, lastDay: '2026-11-19' };
    let state = withCarried(EMPTY_DAILY, carried);
    expect(currentStreak(state, '2026-11-20')).toBe(4);
    state = recordResult(state, win('2026-11-20'));
    expect(currentStreak(state, '2026-11-20')).toBe(5);
    expect(bestStreak(state)).toBe(6);
    state = recordResult(state, win('2026-11-21'));
    state = recordResult(state, win('2026-11-22'));
    expect(bestStreak(state)).toBe(7);
  });

  it('no compta si aquí ja hi ha dies més nous, i es desa', () => {
    const state = withResults(loss('2026-11-20'));
    expect(withCarried(state, { streak: 4, bestStreak: 4, lastDay: '2026-11-19' })).toBe(state);
    const kept = withCarried(EMPTY_DAILY, { streak: 2, bestStreak: 3, lastDay: '2026-11-19' });
    expect(parseDailyState(JSON.stringify(kept)).carried).toEqual({ streak: 2, bestStreak: 3, lastDay: '2026-11-19' });
  });
});
