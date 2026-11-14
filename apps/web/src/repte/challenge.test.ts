import { describe, expect, it } from 'vitest';
import {
  abandonChallenge,
  addGame,
  bestFor,
  challengeInsights,
  challengeStandings,
  challengeTotal,
  describeChallenge,
  emptyChallengeState,
  isDone,
  normalizeChallengeConfig,
  parseChallengeState,
  startChallenge,
  withRivals,
} from './challenge';

const CONFIG = { games: 3, level: 'expert' as const, opponents: 2 as const };

describe('el repte', () => {
  it('suma els punts de totes les partides i acaba quan toca', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 60, won: true });
    state = addGame(state, { points: -25, won: false });
    expect(isDone(state.current!)).toBe(false);
    expect(state.history).toHaveLength(0);
    state = addGame(state, { points: -10, won: false });
    expect(isDone(state.current!)).toBe(true);
    expect(challengeTotal(state.current!)).toBe(25);
    expect(state.history[0]).toMatchObject({ total: 25, wins: 1, config: CONFIG });
  });

  it('un cop acabat, no admet més partides ni torna a apuntar el rècord', () => {
    let state = startChallenge(emptyChallengeState(), { ...CONFIG, games: 1 });
    state = addGame(state, { points: 40, won: true });
    const again = addGame(state, { points: 99, won: true });
    expect(again).toBe(state);
    expect(again.history).toHaveLength(1);
  });

  it('recorda el millor resultat de cada configuració', () => {
    let state = emptyChallengeState();
    for (const points of [10, 80, -5]) {
      state = startChallenge(state, { ...CONFIG, games: 1 });
      state = addGame(state, { points, won: points > 0 });
    }
    state = startChallenge(state, { ...CONFIG, games: 1, level: 'rookie' });
    state = addGame(state, { points: 300, won: true });
    expect(bestFor(state.history, { ...CONFIG, games: 1 })?.total).toBe(80);
    expect(bestFor(state.history, CONFIG)).toBeNull();
  });

  it('es pot abandonar sense deixar rastre a l’historial', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 10, won: true });
    state = abandonChallenge(state);
    expect(state.current).toBeNull();
    expect(state.history).toHaveLength(0);
    expect(state.lastConfig).toEqual(CONFIG);
  });

  it('es desa i es recupera, i descarta el que no quadra', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG);
    state = addGame(state, { points: 10, won: true });
    expect(parseChallengeState(JSON.stringify(state))).toEqual(state);
    expect(parseChallengeState('{malmès')).toEqual(emptyChallengeState());
    expect(normalizeChallengeConfig({ games: 0, level: 'déu' as never, opponents: 7 as never })).toEqual({
      games: 5,
      level: 'medium',
      opponents: 2,
    });
  });

  it('es descriu en curt', () => {
    expect(describeChallenge(CONFIG)).toBe('3 partides · Expert · 2 rivals');
  });
});

describe('la classificació del repte', () => {
  const RIVALS = ['GuineuAstuta', 'LlopDeNit'];
  // Partida 1: guanya la Guineu; partida 2: guanyes tu (bloquejada).
  const g1 = { points: -12, won: false, scores: [-12, 40, -28], tilesLeft: [3, 0, 6], winner: 1, blocked: false, turns: 31 };
  const g2 = { points: 35, won: true, scores: [35, -20, -15], tilesLeft: [1, 4, 3], winner: 0, blocked: true, turns: 44 };

  it('els rivals es trien en començar i són els mateixos a tot el repte', () => {
    const state = startChallenge(emptyChallengeState(), CONFIG, new Date(), RIVALS);
    expect(state.current?.rivals).toEqual(RIVALS);
    // Si no quadren amb els rivals per partida, cap.
    expect(startChallenge(emptyChallengeState(), CONFIG, new Date(), ['Sol']).current?.rivals).toEqual([]);
    // Als reptes d'abans se'ls posen un cop, i després no canvien.
    const old = startChallenge(emptyChallengeState(), CONFIG);
    const fixed = withRivals(old, RIVALS);
    expect(fixed.current?.rivals).toEqual(RIVALS);
    expect(withRivals(fixed, ['A', 'B']).current?.rivals).toEqual(RIVALS);
  });

  it('a la primera partida, els punts de tothom i qui ha guanyat', () => {
    const state = addGame(startChallenge(emptyChallengeState(), CONFIG, new Date(), RIVALS), g1);
    const rows = challengeStandings(state.current!, 'Anna');
    expect(rows.map((r) => [r.name, r.last, r.total, r.wins])).toEqual([
      ['GuineuAstuta', 40, 40, 1],
      ['Anna', -12, -12, 0],
      ['LlopDeNit', -28, -28, 0],
    ]);
    expect(rows[1].you).toBe(true);
  });

  it('després, la partida i el total acumulat de cadascú, ordenats pel total', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG, new Date(), RIVALS);
    state = addGame(addGame(state, g1), g2);
    const rows = challengeStandings(state.current!, 'Anna');
    expect(rows.map((r) => [r.name, r.last, r.total, r.wins, r.place])).toEqual([
      ['Anna', 35, 23, 1, 1],
      ['GuineuAstuta', -20, 20, 1, 2],
      ['LlopDeNit', -15, -43, 0, 3],
    ]);
    // La suma de tots els punts del repte és zero, com a cada partida.
    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(0);
  });

  it('informació per jugar amb tàctica: frases curtes amb icona', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG, new Date(), RIVALS);
    state = addGame(state, g1);
    const first = challengeInsights(state.current!, challengeStandings(state.current!, 'Anna'));
    expect(first).toEqual([
      { icon: '🏁', text: 'GuineuAstuta s’ha quedat sense fitxes en 31 torns.' },
      { icon: '✋', text: 'Et quedaven 3 fitxes a la mà (−12).' },
      { icon: '⏳', text: 'Queden 2 partides · guanyar-ne una val uns +40.' },
      { icon: '💡', text: 'Si no pots guanyar, desfés-te de fitxes altes i jokers: el que tens a la mà resta.' },
    ]);
    state = addGame(state, g2);
    const second = challengeInsights(state.current!, challengeStandings(state.current!, 'Anna'));
    expect(second.map((i) => i.text)).toEqual([
      'Partida bloquejada: guanya qui té menys punts a la mà.',
      'Vas 1r, amb 3 punts d’avantatge.',
      'Queda 1 partida · guanyar-ne una val uns +38.',
      'Vas primer: posa fitxes sovint i no et quedis jokers a la mà.',
    ]);
  });

  it('es desa i es recupera tal com era; les partides que no quadren perden només les dades de tothom', () => {
    let state = startChallenge(emptyChallengeState(), CONFIG, new Date(), RIVALS);
    state = addGame(addGame(state, g1), g2);
    expect(parseChallengeState(JSON.stringify(state)).current).toEqual(state.current);
    const broken = JSON.parse(JSON.stringify(state));
    broken.current.games[0].scores = [1, 2];
    const parsed = parseChallengeState(JSON.stringify(broken)).current!;
    expect(parsed.games[0]).toEqual({ points: -12, won: false });
    expect(parsed.games[1]).toEqual(g2);
    // Un repte d'abans (sense rivals) es llegeix igual, només amb els teus punts.
    const old = { current: { version: 1, config: CONFIG, games: [{ points: 5, won: true }], startedAt: 'x' }, history: [] };
    const read = parseChallengeState(JSON.stringify(old)).current!;
    expect(read.rivals).toEqual([]);
    expect(challengeStandings(read, 'Anna').find((r) => r.you)?.total).toBe(5);
  });
});
