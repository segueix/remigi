import { createRng } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  MAX_RATING,
  MIN_RATING,
  PLACEMENT_MAX_TIER,
  START_TIER,
  TOP_TIER,
  YOU,
  catalanDe,
  closeSeason,
  createSeason,
  isFinished,
  levelName,
  levelShort,
  makeSchedule,
  movementText,
  newCareer,
  nextTier,
  normalizeConfig,
  parseLeagueState,
  placementRating,
  placementTier,
  rankOf,
  recordRound,
  serializeLeagueState,
  simulateTable,
  spreadRatings,
  standings,
  tablePoints,
  tierGroup,
  tierLevel,
  tierName,
  tierRating,
  upcomingTier,
  winChances,
  yourTable,
  zoneOf,
  zoneSize,
  type LeagueSeason,
} from './league';
import type { LeagueHome } from './localitats';

const VIC: LeagueHome = { territory: 'cat', municipi: 'Vic', comarca: 'Osona', provincia: 'Barcelona', pais: '' };

/** Juga una temporada sencera amb el resultat que es vulgui per a tu. */
function playSeason(season: LeagueSeason, mine: (round: number) => number[]): LeagueSeason {
  let current = season;
  while (!isFinished(current)) current = recordRound(current, mine(current.played));
  return current;
}

describe("l'escala de lligues", () => {
  it('té 21 graons: set nivells amb els grups C, B i A', () => {
    expect(TOP_TIER).toBe(20);
    expect([0, 1, 2, 3].map(tierGroup)).toEqual(['C', 'B', 'A', 'C']);
    expect([0, 2, 3, 20].map(tierLevel)).toEqual([0, 0, 1, 6]);
  });

  it('comença a Novell a la lliga local i acaba a Expert a la mundial', () => {
    expect(tierRating(0)).toBe(MIN_RATING);
    expect(tierRating(TOP_TIER)).toBe(MAX_RATING);
    for (let t = 1; t <= TOP_TIER; t++) expect(tierRating(t)).toBeGreaterThan(tierRating(t - 1));
  });

  it('fa servir els noms de les lligues d’escacs, amb la localitat', () => {
    expect(tierName(0, VIC)).toBe('Lliga de Vic · Grup C');
    expect(tierName(3, VIC)).toBe("Lliga Comarcal d'Osona · Grup C");
    expect(tierName(8, VIC)).toBe('Lliga Provincial de Barcelona · Grup A');
    expect(tierName(9, VIC)).toBe('Lliga Catalana · Grup C');
    expect(tierName(12, VIC)).toBe('Lliga dels Països Catalans · Grup C');
    expect(tierName(15, VIC)).toBe('Lliga Europea · Grup C');
    expect(tierName(20, VIC)).toBe('Lliga Mundial · Grup A');
    expect(tierName(0, null)).toBe('Lliga Local · Grup C');
    expect(catalanDe('el Bages')).toBe('del Bages');
    expect(catalanDe("l'Anoia")).toBe("de l'Anoia");
    expect(catalanDe('Igualada')).toBe("d'Igualada");
  });

  it('dins d’un nivell es passa de la C a la B i de la B a la A', () => {
    expect(tierGroup(nextTier(0, 1, 8))).toBe('B'); // Municipal C → Municipal B
    expect(tierGroup(nextTier(1, 1, 8))).toBe('A'); // Municipal B → Municipal A
    expect(tierLevel(nextTier(1, 1, 8))).toBe(0);
    expect(movementText(0, 1, 'up', VIC)).toBe('Puges al Grup B de la Lliga de Vic');
    expect(movementText(1, 2, 'up', VIC)).toBe('Puges al Grup A de la Lliga de Vic');
    expect(movementText(2, 3, 'up', VIC)).toBe("Puges a la Lliga Comarcal d'Osona · Grup C: nivell nou!");
    expect(movementText(4, 3, 'down', VIC)).toBe("Baixes al Grup C de la Lliga Comarcal d'Osona");
    expect(movementText(3, 2, 'down', VIC)).toBe('Baixes a la Lliga de Vic · Grup A');
    expect(movementText(5, 5, 'stay', VIC)).toBe("Continues al Grup A de la Lliga Comarcal d'Osona");
    expect(movementText(20, 20, 'champion', VIC)).toBe('Campió del món!');
    // De pujada, tots els graons un per un: C, B, A, C, B, A…
    const groups = Array.from({ length: 21 }, (_, t) => tierGroup(t)).join('');
    expect(groups).toBe('CBA'.repeat(7));
  });

  it('de la A es puja a la C del nivell següent, i de la C es baixa a la A de l’anterior', () => {
    expect(nextTier(2, 1, 8)).toBe(3); // Municipal A → Comarcal C
    expect(tierName(3, VIC)).toContain('Comarcal');
    expect(nextTier(3, 8, 8)).toBe(2); // Comarcal C → Municipal A
    expect(nextTier(4, 4, 8)).toBe(4); // mitja taula: es queda
  });

  it('no es baixa del primer graó ni es puja de l’últim: dalt de tot, el primer és campió', () => {
    expect(nextTier(0, 8, 8)).toBe(0);
    expect(zoneOf(0, 8, 8)).toBe('stay');
    expect(nextTier(TOP_TIER, 1, 8)).toBe(TOP_TIER);
    expect(zoneOf(TOP_TIER, 1, 8)).toBe('champion');
    expect(zoneOf(TOP_TIER, 2, 8)).toBe('stay');
  });

  it('puja i baixa una quarta part de la lliga', () => {
    expect(zoneSize(6)).toBe(2);
    expect(zoneSize(8)).toBe(2);
    expect(zoneSize(12)).toBe(3);
    expect(zoneSize(16)).toBe(4);
  });
});

describe('la configuració', () => {
  it('ajusta la mida de la lliga a un múltiple de la taula i les jornades al marge', () => {
    expect(normalizeConfig({ opponents: 2, players: 8, rounds: 50 })).toEqual({ opponents: 2, players: 9, rounds: 15 });
    expect(normalizeConfig({ opponents: 3, players: 9, rounds: 1 })).toEqual({ opponents: 3, players: 8, rounds: 3 });
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
  });
});

describe('els rivals', () => {
  it('reparteix forces ordenades al voltant del graó i dins del marge del motor', () => {
    const rng = createRng(1);
    for (const center of [MIN_RATING, 1000, 1200, MAX_RATING]) {
      const ratings = spreadRatings(center, 11, rng);
      for (const r of ratings) {
        expect(r).toBeGreaterThanOrEqual(MIN_RATING);
        expect(r).toBeLessThanOrEqual(MAX_RATING);
      }
      expect([...ratings].sort((a, b) => a - b)).toEqual(ratings);
    }
  });

  it('el soroll no treu cap rival del marge del motor, a cap graó', () => {
    for (let tier = 0; tier <= TOP_TIER; tier++) {
      for (let seed = 1; seed <= 300; seed++) {
        for (const count of [5, 7, 15]) {
          for (const rating of spreadRatings(tierRating(tier), count, createRng(seed))) {
            expect(rating).toBeGreaterThanOrEqual(MIN_RATING);
            expect(rating).toBeLessThanOrEqual(MAX_RATING);
          }
        }
      }
    }
  });

  it('les temporades generades es poden desar i recuperar senceres, a tots els graons', () => {
    for (let tier = 0; tier <= TOP_TIER; tier++) {
      for (const seed of [1, 2, 3]) {
        const season = createSeason({ tier, config: DEFAULT_CONFIG, home: VIC, seed });
        expect(parseLeagueState(serializeLeagueState({ career: newCareer(VIC), season })).season).toEqual(season);
      }
    }
    // El cas que va trobar la revisió: graó 1, llavor 2.
    const season = createSeason({ tier: 1, config: DEFAULT_CONFIG, home: null, seed: 2 });
    expect(Math.min(...season.rivals.map((r) => r.rating))).toBeGreaterThanOrEqual(MIN_RATING);
  });

  it('una temporada desada amb una força fora de marge es corregeix, no es perd', () => {
    const season = recordRound(createSeason({ tier: 1, config: DEFAULT_CONFIG, home: VIC, seed: 2 }), [10, -2, -3, -5]);
    const broken = { ...season, rivals: season.rivals.map((r, i) => (i === 0 ? { ...r, rating: 796 } : r)) };
    const parsed = parseLeagueState(JSON.stringify({ career: newCareer(VIC), season: broken })).season;
    expect(parsed?.played).toBe(1);
    expect(parsed?.rivals[0].rating).toBe(MIN_RATING);
  });

  it('crea una temporada amb noms de persona diferents, del lloc i del nivell', () => {
    const season = createSeason({ tier: 3, config: DEFAULT_CONFIG, home: VIC, seed: 42 });
    expect(season.rivals).toHaveLength(7);
    expect(new Set(season.rivals.map((r) => r.name)).size).toBe(7);
    for (const rival of season.rivals) expect(rival.name).toMatch(/\S+ \S+/);
    // A la comarcal, els rivals són de pobles de la comarca.
    expect(season.rivals.every((r) => r.origin && r.origin !== 'Vic')).toBe(true);
    expect(season.name).toBe("Lliga Comarcal d'Osona · Grup C");
  });

  it('la mateixa llavor dona la mateixa temporada', () => {
    const a = createSeason({ tier: 5, config: DEFAULT_CONFIG, home: VIC, seed: 7, date: new Date(0) });
    const b = createSeason({ tier: 5, config: DEFAULT_CONFIG, home: VIC, seed: 7, date: new Date(0) });
    expect(a).toEqual(b);
  });

  it('no repeteix els noms de les temporades anteriors', () => {
    const first = createSeason({ tier: 0, config: DEFAULT_CONFIG, home: VIC, seed: 3 });
    const exclude = first.rivals.map((r) => r.name);
    const second = createSeason({ tier: 0, config: DEFAULT_CONFIG, home: VIC, seed: 3, exclude });
    expect(second.rivals.some((r) => exclude.includes(r.name))).toBe(false);
  });
});

describe('el calendari', () => {
  it('cada jornada reparteix tothom en taules, sense ningú repetit', () => {
    const ids = [YOU, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    const schedule = makeSchedule(ids, 6, 4, createRng(5));
    expect(schedule).toHaveLength(6);
    for (const round of schedule) {
      expect(round).toHaveLength(3);
      expect(round.flat().sort()).toEqual([...ids].sort());
      // La teva taula, primera i amb tu al davant.
      expect(round[0][0]).toBe(YOU);
    }
  });

  it('et fa trobar tots els rivals abans de repetir-ne cap', () => {
    for (const [players, size] of [[8, 4], [9, 3], [12, 4], [16, 4], [6, 3]] as const) {
      const ids = [YOU, ...Array.from({ length: players - 1 }, (_, i) => `r${i + 1}`)];
      const rounds = Math.ceil((players - 1) / (size - 1));
      const schedule = makeSchedule(ids, rounds, size, createRng(players));
      const met = schedule.flatMap((round) => round[0].slice(1));
      expect(new Set(met).size).toBe(players - 1);
    }
  });
});

describe('les partides simulades', () => {
  it('sumen zero i el guanyador és qui fa més punts', () => {
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      const scores = simulateTable([900, 1000, 1100, 1200], rng);
      expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
      expect(scores.filter((s) => s > 0)).toHaveLength(1);
    }
  });

  it('el més fort guanya més sovint, i més com més diferència hi ha', () => {
    const rng = createRng(11);
    let strongWins = 0;
    for (let i = 0; i < 2000; i++) {
      const scores = simulateTable([1100, 1200, 1300], rng);
      if (scores[2] > 0) strongWins++;
    }
    const expected = winChances([1100, 1200, 1300])[2];
    expect(strongWins / 2000).toBeGreaterThan(expected - 0.04);
    expect(strongWins / 2000).toBeLessThan(expected + 0.04);
    expect(winChances([1000, 1000, 1000])[0]).toBeCloseTo(1 / 3);
  });

  it('als nivells baixos queden més fitxes a la mà que als alts', () => {
    const rng = createRng(13);
    const lost = (rating: number) => {
      let sum = 0;
      for (let i = 0; i < 500; i++) sum += simulateTable([rating, rating, rating], rng).filter((s) => s < 0).reduce((a, b) => a - b, 0);
      return sum / 500;
    };
    expect(lost(800)).toBeGreaterThan(lost(1600) * 2);
  });
});

describe('la classificació', () => {
  it('dona un punt per cada jugador de la taula que queda per sota', () => {
    expect(tablePoints([60, -10, -20, -30])).toEqual([3, 2, 1, 0]);
    expect(tablePoints([40, -20, -20])).toEqual([2, 0.5, 0.5]);
  });

  it('registra la jornada un sol cop i simula la resta de taules', () => {
    const season = createSeason({ tier: 0, config: DEFAULT_CONFIG, home: VIC, seed: 21 });
    const after = recordRound(season, [50, -10, -15, -25]);
    expect(after.played).toBe(1);
    expect(after.results).toHaveLength(2);
    expect(after.results.filter((r) => !r.simulated)).toHaveLength(1);
    expect(standings(after).every((row) => row.played === 1)).toBe(true);
    // La mateixa jornada no es pot tornar a comptar amb un resultat d'una altra mida.
    expect(recordRound(after, [1, 2])).toBe(after);
  });

  it('qui ho guanya tot acaba primer i puja', () => {
    const season = createSeason({ tier: 2, config: DEFAULT_CONFIG, home: VIC, seed: 4 });
    const done = playSeason(season, () => [90, -20, -30, -40]);
    expect(isFinished(done)).toBe(true);
    expect(rankOf(done)).toBe(1);
    const career = closeSeason({ ...newCareer(VIC), tier: 2 }, done);
    expect(career.tier).toBe(3);
    expect(career.seasons[0]).toMatchObject({ rank: 1, movement: 'up', nextTier: 3 });
    expect(career.recentNames).toHaveLength(7);
  });

  it('qui ho perd tot acaba últim i baixa', () => {
    const season = createSeason({ tier: 4, config: DEFAULT_CONFIG, home: VIC, seed: 4 });
    const done = playSeason(season, () => [-200, 120, 50, 30]);
    expect(rankOf(done)).toBe(8);
    expect(closeSeason({ ...newCareer(VIC), tier: 4 }, done).tier).toBe(3);
  });

  it('els punts de lliga de tothom quadren amb les partides jugades', () => {
    const season = playSeason(createSeason({ tier: 10, config: { opponents: 2, players: 9, rounds: 8 }, home: VIC, seed: 8 }), () => [30, -10, -20]);
    const rows = standings(season);
    // Cada taula de tres reparteix 3 punts; tres taules per jornada.
    expect(rows.reduce((sum, row) => sum + row.points, 0)).toBe(8 * 3 * 3);
    expect(rows.reduce((sum, row) => sum + row.diff, 0)).toBe(0);
    expect(rows.every((row) => row.played === 8)).toBe(true);
  });

  it('la teva taula de cada jornada són els rivals del calendari', () => {
    const season = createSeason({ tier: 0, config: DEFAULT_CONFIG, home: VIC, seed: 30 });
    expect(yourTable(season).map((r) => r.id)).toEqual(season.schedule[0][0].slice(1));
  });
});

describe('fora de Catalunya, cap nivell no repeteix l’àrea del de sota', () => {
  const home = (territory: LeagueHome['territory'], municipi: string, comarca: string, provincia: string): LeagueHome => ({
    territory, municipi, comarca, provincia, pais: '',
  });
  const names = (h: LeagueHome) => [0, 1, 2, 3].map((level) => levelName(level, h));

  it('Balears: illa, Gimnèsies o Pitiüses, Balear', () => {
    expect(names(home('bal', 'Palma', 'Mallorca', 'Illes Balears'))).toEqual([
      'Lliga de Palma', 'Lliga Insular de Mallorca', 'Lliga de les Gimnèsies', 'Lliga Balear',
    ]);
    expect(names(home('bal', 'es Castell', 'Menorca', 'Illes Balears'))[0]).toBe('Lliga des Castell');
    expect(levelName(2, home('bal', 'Eivissa', 'Eivissa', 'Illes Balears'))).toBe('Lliga de les Pitiüses');
    expect(levelShort(2, home('bal', 'Eivissa', 'Eivissa', 'Illes Balears'))).toBe('Pitiüses');
  });

  it('Catalunya Nord, Andorra i l’Alguer', () => {
    expect(names(home('nord', 'Perpinyà', 'el Rosselló', 'els Pirineus Orientals'))).toEqual([
      'Lliga de Perpinyà', 'Lliga Comarcal del Rosselló', 'Lliga de la Catalunya Nord', 'Lliga Catalana',
    ]);
    expect(names(home('and', 'Encamp', 'Andorra', 'Andorra'))).toEqual([
      "Lliga d'Encamp", 'Tercera Divisió Andorrana', 'Segona Divisió Andorrana', 'Lliga Andorrana',
    ]);
    expect(tierName(4, home('and', 'Encamp', 'Andorra', 'Andorra'))).toBe('Tercera Divisió Andorrana · Grup B');
    expect(names(home('alguer', "l'Alguer", "l'Alguer", 'Sàsser'))).toEqual([
      "Lliga de l'Alguer", 'Lliga de la Nurra', 'Lliga Provincial de Sàsser', 'Lliga de Sardenya',
    ]);
    expect(tierName(START_TIER, home('alguer', "l'Alguer", "l'Alguer", 'Sàsser'))).toBe('Lliga de Sardenya · Grup C');
  });

  it('els rivals tenen origen a tots els nivells de casa, també a l’Alguer i a Andorra', () => {
    const homes = [
      home('val', 'Gandia', 'la Safor', 'València'),
      home('bal', 'Maó', 'Menorca', 'Illes Balears'),
      home('nord', 'Prada', 'el Conflent', 'els Pirineus Orientals'),
      home('and', 'Encamp', 'Andorra', 'Andorra'),
      home('franja', 'Fraga', 'el Baix Cinca', 'Osca'),
      home('alguer', "l'Alguer", "l'Alguer", 'Sàsser'),
    ];
    for (const h of homes) {
      for (const tier of [3, 6, START_TIER]) {
        const season = createSeason({ tier, config: DEFAULT_CONFIG, home: h, seed: 5 });
        expect(season.name).toBe(tierName(tier, h));
        for (const rival of season.rivals) expect(rival.origin).toBeTruthy();
      }
    }
  });
});

describe('on es comença', () => {
  const VAL: LeagueHome = { territory: 'val', municipi: 'Gandia', comarca: 'la Safor', provincia: 'València', pais: '' };

  it('com a mínim a la lliga del territori, Grup C', () => {
    expect(START_TIER).toBe(9);
    expect(newCareer(VIC)).toMatchObject({ tier: START_TIER, bestTier: START_TIER });
    expect(tierName(START_TIER, VIC)).toBe('Lliga Catalana · Grup C');
    expect(tierName(START_TIER, VAL)).toBe('Lliga Valenciana · Grup C');
    expect(tierName(PLACEMENT_MAX_TIER, VIC)).toBe('Lliga Catalana · Grup A');
  });

  it('la primera temporada es col·loca pel nivell, uns 80 punts per sota, fins a la A', () => {
    expect(placementTier(null)).toBe(START_TIER);
    expect(placementTier(MIN_RATING)).toBe(START_TIER);
    expect(placementTier(1240)).toBe(START_TIER);
    expect(placementTier(1280)).toBe(START_TIER + 1);
    expect(placementTier(1300)).toBe(START_TIER + 1);
    expect(placementTier(1320)).toBe(PLACEMENT_MAX_TIER);
    expect(placementTier(MAX_RATING)).toBe(PLACEMENT_MAX_TIER);
    for (let r = MIN_RATING; r <= MAX_RATING; r += 10) {
      const tier = placementTier(r);
      if (tier > START_TIER) expect(tierRating(tier)).toBeLessThanOrEqual(r - 80);
    }
  });

  it('qui calibra encara no té habilitat per col·locar-lo', () => {
    expect(placementRating(null)).toBeNull();
    expect(placementRating({ rating: 1400, adaptiveCalibrating: true })).toBeNull();
    expect(placementRating({ rating: 1400, adaptiveCalibrating: false })).toBe(1400);
  });

  it('després de la primera temporada només mana l’escala, i es pot baixar', () => {
    expect(upcomingTier(newCareer(VIC), 1300)).toBe(START_TIER + 1);
    expect(upcomingTier(newCareer(VIC), null)).toBe(START_TIER);
    const season = createSeason({ tier: START_TIER, config: DEFAULT_CONFIG, home: VIC, seed: 4 });
    const done = playSeason(season, () => [-200, 120, 50, 30]);
    const career = closeSeason(newCareer(VIC), done);
    expect(career.tier).toBe(START_TIER - 1);
    expect(upcomingTier(career, 1600)).toBe(START_TIER - 1);
    expect(tierName(career.tier, VIC)).toBe('Lliga Provincial de Barcelona · Grup A');
    // I en tornar a obrir l'app no se la torna a pujar.
    expect(parseLeagueState(serializeLeagueState({ career, season: null })).career.tier).toBe(START_TIER - 1);
  });

  it('les trajectòries d’abans que no havien arribat a la Catalana hi pugen un sol cop', () => {
    const old = createSeason({ tier: 2, config: DEFAULT_CONFIG, home: VIC, seed: 5 });
    const raw = JSON.stringify({
      career: { ...newCareer(VIC), tier: 2, bestTier: 2 },
      season: recordRound(old, [10, -2, -3, -5]),
    });
    const parsed = parseLeagueState(raw);
    expect(parsed.career).toMatchObject({ tier: START_TIER, bestTier: START_TIER });
    // La temporada que tenia a mig fer per sota es descarta per tornar-la a començar.
    expect(parsed.season).toBeNull();
  });
});

describe('el desat', () => {
  it('torna exactament el que s’ha desat', () => {
    const season = recordRound(createSeason({ tier: 6, config: DEFAULT_CONFIG, home: VIC, seed: 1 }), [10, -2, -3, -5]);
    // Una trajectòria que ha baixat per sota de la Catalana s'hi queda.
    const state = { career: { ...newCareer(VIC), tier: 6, bestTier: 10 }, season };
    expect(parseLeagueState(serializeLeagueState(state))).toEqual(state);
  });

  it('descarta el que no quadra sense perdre la trajectòria', () => {
    expect(parseLeagueState('no és json')).toEqual({ career: newCareer(), season: null });
    const broken = { career: { ...newCareer(VIC), tier: 5 }, season: { version: 1, rivals: 'res' } };
    const parsed = parseLeagueState(JSON.stringify(broken));
    expect(parsed.season).toBeNull();
    expect(parsed.career.tier).toBe(5);
    expect(parsed.career.home?.municipi).toBe('Vic');
  });
});
