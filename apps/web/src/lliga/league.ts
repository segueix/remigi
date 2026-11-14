import { DIFFICULTY_ORDER, createRng, shuffleInPlace, type DifficultyKey, type Rng } from '@remigi/core';
import { ppccCityTerritory, rivalOrigins, type LeagueHome } from './localitats';
import { rivalNames } from './nomsLliga';

/**
 * La lliga de Remigi (docs/LLIGA.md): la mateixa escala que les lligues
 * d'escacs d'El Tauler, del municipi al món, amb els mateixos noms de lliga i
 * de rivals. Cada nivell té tres grups —C, B i A— i es puja d'un en un: de la
 * C a la B, de la B a la A i de la A a la C del nivell següent.
 *
 * A diferència d'El Tauler, la força dels rivals no surt de la puntuació del
 * jugador sinó del graó: la lliga local comença a Novell (800) i la mundial
 * acaba a Expert (1600). Pujar vol dir, de debò, jugar contra rivals més forts.
 *
 * Tot és pur i serialitzable (sense DOM ni React): l'estat es desa tal qual i
 * l'atzar surt d'una llavor, de manera que recarregar no torna a tirar els daus.
 */

/** Identificador del jugador dins de la lliga (els rivals són `r1`, `r2`…). */
export const YOU = 'jo';

/** Els set nivells, com a El Tauler (`LEAGUE_LEVELS` de core.js). */
export const LEAGUE_LEVELS = [
  { id: 'municipal', label: 'Municipal' },
  { id: 'comarcal', label: 'Comarcal' },
  { id: 'provincial', label: 'Provincial' },
  { id: 'territorial', label: 'Catalana' },
  { id: 'ppcc', label: 'Països Catalans' },
  { id: 'europa', label: 'Europea' },
  { id: 'mundial', label: 'Mundial' },
] as const;

/** Grups de cada nivell, del més fluix al més fort. */
export const GROUPS = ['C', 'B', 'A'] as const;
export type GroupId = (typeof GROUPS)[number];

/** Graons de l'escala: 7 nivells × 3 grups. El 0 és Municipal C; el 20, Mundial A. */
export const TIER_COUNT = LEAGUE_LEVELS.length * GROUPS.length;
export const TOP_TIER = TIER_COUNT - 1;

/** Força dels rivals: de Novell (800) al primer graó a Expert (1600) a l'últim. */
export const MIN_RATING = 800;
export const MAX_RATING = 1600;
const TIER_STEP = (MAX_RATING - MIN_RATING) / (TIER_COUNT - 1);
/** Dispersió dels rivals al voltant de la força del graó (±80: dos graons). */
export const RIVAL_SPREAD = 80;

/**
 * On comença l'escalada, com a mínim: la lliga del territori (Catalana,
 * Valenciana, Balear…), Grup C. Els nivells de sota (municipal, comarcal i
 * provincial) hi són per a qui baixa, no per començar-hi.
 */
export const START_TIER = LEAGUE_LEVELS.findIndex((level) => level.id === 'territorial') * GROUPS.length;
/** Fins on pot arribar la col·locació de la primera temporada: la mateixa lliga, Grup A. */
export const PLACEMENT_MAX_TIER = START_TIER + 2;
/** La primera temporada es juga una mica per sota del teu nivell (dos graons). */
export const PLACEMENT_MARGIN = 80;

export function clampTier(tier: number): number {
  return Number.isFinite(tier) ? Math.min(TOP_TIER, Math.max(0, Math.round(tier))) : 0;
}

/** Nivell (0 municipal … 6 mundial) d'un graó. */
export function tierLevel(tier: number): number {
  return Math.floor(clampTier(tier) / GROUPS.length);
}

/** Grup (C, B o A) d'un graó. */
export function tierGroup(tier: number): GroupId {
  return GROUPS[clampTier(tier) % GROUPS.length];
}

/** Força mitjana dels rivals d'un graó. */
export function tierRating(tier: number): number {
  return Math.round(MIN_RATING + clampTier(tier) * TIER_STEP);
}

/** El nivell de joc amb nom més proper a una força (Novell, Fàcil…). */
export function difficultyForRating(rating: number): DifficultyKey {
  const index = Math.round((Math.min(MAX_RATING, Math.max(MIN_RATING, rating)) - MIN_RATING) / 200);
  return DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, index))];
}

/**
 * Graó de la primera temporada segons la teva habilitat: el més alt entre la
 * Lliga Catalana (o la del teu territori) C i A que tingui els rivals uns 80
 * punts per sota teu, perquè hi siguis favorit sense avorrir-te. Qui encara
 * calibra el nivell (`null`) comença a la C. Els Països Catalans, l'Europea i
 * la Mundial no es regalen: s'hi arriba jugant.
 */
export function placementTier(rating: number | null): number {
  if (rating === null || !Number.isFinite(rating)) return START_TIER;
  let tier = START_TIER;
  for (let t = START_TIER + 1; t <= PLACEMENT_MAX_TIER; t++) {
    if (tierRating(t) <= rating - PLACEMENT_MARGIN) tier = t;
  }
  return tier;
}

/** L'habilitat que compta per col·locar-te: cap mentre encara es calibra. */
export function placementRating(profile: { rating: number; adaptiveCalibrating?: boolean } | null): number | null {
  if (!profile || profile.adaptiveCalibrating === true) return null;
  return profile.rating;
}

/* ---------- Noms ---------- */

/** «de Vic», «d'Osona», «del Bages», «dels Ports», «de la Selva», «de l'Anoia». */
export function catalanDe(name: string): string {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  let m: RegExpExecArray | null;
  if ((m = /^el\s+(.+)$/i.exec(s))) return `del ${m[1]}`;
  if ((m = /^els\s+(.+)$/i.exec(s))) return `dels ${m[1]}`;
  if (/^(la|les)\s+/i.test(s) || /^l['’]/i.test(s)) return `de ${s}`;
  // Vocal (o h muda) al davant: «d'». La i i la u davant de vocal són consonants.
  if (/^h?[aeiouàèéíïòóúü]/i.test(s) && !/^h?[iuíúïü][aeiouàèéíòóú]/i.test(s)) return `d'${s}`;
  return `de ${s}`;
}

const TERRITORY_NAMES: Record<string, [string, string]> = {
  cat: ['Lliga Catalana', 'Catalana'],
  val: ['Lliga Valenciana', 'Valenciana'],
  bal: ['Lliga Balear', 'Balear'],
  and: ['Lliga Andorrana', 'Andorrana'],
  nord: ['Lliga de la Catalunya Nord', 'Catalunya Nord'],
  franja: ['Lliga de la Franja', 'Franja'],
  alguer: ['Lliga Algueresa', 'Algueresa'],
};

/** Nom de la lliga d'un nivell per a la localitat del jugador (com a El Tauler). */
export function levelName(level: number, home: LeagueHome | null): string {
  const h = home ?? null;
  switch (LEAGUE_LEVELS[Math.min(6, Math.max(0, level))].id) {
    case 'municipal':
      return h?.municipi ? `Lliga ${catalanDe(h.municipi)}` : 'Lliga Local';
    case 'comarcal':
      return h?.comarca ? `Lliga Comarcal ${catalanDe(h.comarca)}` : 'Lliga Comarcal';
    case 'provincial':
      return h?.provincia ? `Lliga Provincial ${catalanDe(h.provincia)}` : 'Lliga Provincial';
    case 'territorial': {
      const t = TERRITORY_NAMES[h?.territory ?? 'cat'];
      if (t) return t[0];
      return h?.pais ? `Lliga Nacional ${catalanDe(h.pais)}` : 'Lliga Nacional';
    }
    case 'ppcc':
      return 'Lliga dels Països Catalans';
    case 'europa':
      return 'Lliga Europea';
    default:
      return 'Lliga Mundial';
  }
}

/** Nom curt del nivell: «Municipal», «Catalana», «Mundial». */
export function levelShort(level: number, home: LeagueHome | null): string {
  const entry = LEAGUE_LEVELS[Math.min(6, Math.max(0, level))];
  if (entry.id !== 'territorial') return entry.label;
  const t = TERRITORY_NAMES[home?.territory ?? 'cat'];
  return t ? t[1] : 'Nacional';
}

/** «Lliga de Vic · Grup C». */
export function tierName(tier: number, home: LeagueHome | null): string {
  return `${levelName(tierLevel(tier), home)} · Grup ${tierGroup(tier)}`;
}

/* ---------- Configuració ---------- */

export type TableRivals = 2 | 3;

export interface LeagueConfig {
  /** Rivals a cada partida: 2 (taules de 3) o 3 (taules de 4). */
  opponents: TableRivals;
  /** Jugadors de la lliga, tu inclòs: sempre un múltiple de la mida de la taula. */
  players: number;
  /** Jornades (partides) per acabar la lliga. */
  rounds: number;
}

/** Mides de lliga que es poden triar: múltiples de la mida de la taula. */
export const PLAYER_OPTIONS: Record<TableRivals, readonly number[]> = {
  2: [6, 9, 12, 15],
  3: [8, 12, 16],
};
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 15;
export const DEFAULT_CONFIG: LeagueConfig = { opponents: 3, players: 8, rounds: 7 };

/** Jornades perquè, ben repartides, et trobis amb cada rival un cop. */
export function roundsToMeetAll(config: Pick<LeagueConfig, 'opponents' | 'players'>): number {
  return Math.ceil((config.players - 1) / config.opponents);
}

/**
 * Configuració vàlida a partir del que sigui (desat, formulari): la mida de la
 * lliga es corregeix al múltiple de la taula més proper, i les jornades al
 * marge permès.
 */
export function normalizeConfig(input: Partial<LeagueConfig> | null | undefined): LeagueConfig {
  const opponents: TableRivals = input?.opponents === 2 ? 2 : input?.opponents === 3 ? 3 : DEFAULT_CONFIG.opponents;
  const options = PLAYER_OPTIONS[opponents];
  const wanted = Number(input?.players);
  const players = Number.isFinite(wanted)
    ? options.reduce((best, n) => (Math.abs(n - wanted) < Math.abs(best - wanted) ? n : best), options[0])
    : opponents === DEFAULT_CONFIG.opponents ? DEFAULT_CONFIG.players : options[1];
  const rounds = Number.isFinite(Number(input?.rounds))
    ? Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(Number(input?.rounds))))
    : DEFAULT_CONFIG.rounds;
  return { opponents, players, rounds };
}

/** Quants pugen (i quants baixen): una quarta part de la lliga, com a mínim un. */
export function zoneSize(players: number): number {
  return Math.max(1, Math.round(players / 4));
}

/* ---------- Temporada ---------- */

export interface LeagueRival {
  id: string;
  name: string;
  /** D'on és (poble, comarca, ciutat o país); buit a la lliga local. */
  origin: string;
  /** Força fixa durant tota la temporada (800–1600). */
  rating: number;
}

export interface TableResult {
  /** Jornada, des de 0. */
  round: number;
  /** Jugadors de la taula (el primer de cada partida teva ets tu). */
  ids: string[];
  /** Punts de la partida (els de `finalScores`), alineats amb `ids`. */
  scores: number[];
  /** Partida entre rivals, amb el resultat simulat. */
  simulated: boolean;
}

export interface LeagueSeason {
  version: 1;
  /** Llavor de la temporada: rivals, calendari i resultats simulats en surten. */
  seed: number;
  tier: number;
  config: LeagueConfig;
  /** Nom fixat en crear-la («Lliga de Vic · Grup C»). */
  name: string;
  rivals: LeagueRival[];
  /** Calendari sencer: jornada → taules → jugadors. */
  schedule: string[][][];
  results: TableResult[];
  /** Jornades ja jugades. Quan arriba a `config.rounds`, la temporada s'ha acabat. */
  played: number;
  createdAt: string;
}

export interface CreateSeasonOptions {
  tier: number;
  config: LeagueConfig;
  home: LeagueHome | null;
  seed: number;
  /** Noms de les darreres temporades, perquè no tornin a sortir. */
  exclude?: readonly string[];
  date?: Date;
}

/**
 * Forces dels rivals: repartides de −spread a +spread al voltant del graó, amb
 * una mica de soroll, i encabides dins de 800–1600 en proporció (com fa El
 * Tauler amb el ROC als extrems): conserven l'ordre i la força que es veu és
 * la que juguen.
 */
export function spreadRatings(center: number, count: number, rng: Rng, spread = RIVAL_SPREAD): number[] {
  if (count <= 0) return [];
  const raw = Array.from({ length: count }, (_, i) =>
    count === 1 ? 0 : -spread + (2 * spread * i) / (count - 1) + (rng() - 0.5) * 16,
  );
  return raw.map((rawOffset) => {
    // El soroll no pot treure cap rival de la seva banda (ni del marge del motor).
    const offset = Math.max(-spread, Math.min(spread, rawOffset));
    const room = offset < 0 ? Math.min(spread, center - MIN_RATING) : Math.min(spread, MAX_RATING - center);
    return clampRating(Math.round(center + (offset / spread) * room));
  });
}

/** Una força dins del marge que juga el motor (800–1600). */
export function clampRating(rating: number): number {
  return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(rating)));
}

export function createSeason(options: CreateSeasonOptions): LeagueSeason {
  const config = normalizeConfig(options.config);
  const tier = clampTier(options.tier);
  const rng = createRng(options.seed);
  const level = tierLevel(tier);
  const count = config.players - 1;
  const origins = rivalOrigins(level, options.home, count, rng);
  const names = rivalNames(level, options.home, origins, {
    count,
    random: rng,
    exclude: options.exclude ?? [],
    territoryOf: ppccCityTerritory,
  });
  const ratings = shuffleInPlace(spreadRatings(tierRating(tier), count, rng), rng);
  const rivals: LeagueRival[] = names.map((name, i) => ({
    id: `r${i + 1}`,
    name,
    origin: origins[i] ?? '',
    rating: ratings[i],
  }));
  const ids = [YOU, ...rivals.map((rival) => rival.id)];
  return {
    version: 1,
    seed: options.seed,
    tier,
    config,
    name: tierName(tier, options.home),
    rivals,
    schedule: makeSchedule(ids, config.rounds, config.opponents + 1, rng),
    results: [],
    played: 0,
    createdAt: (options.date ?? new Date()).toISOString(),
  };
}

/**
 * Calendari: a cada jornada, tots els jugadors repartits en taules, buscant que
 * ningú no repeteixi rival abans d'hora. Per a cada jornada es proven molts
 * repartiments i es millora el millor amb intercanvis; el cost d'una taula és
 * la suma, per a cada parella, del quadrat de les vegades que ja s'han trobat
 * (amb molt més pes per a les teves parelles, que són les que es juguen de debò).
 */
export function makeSchedule(ids: readonly string[], rounds: number, tableSize: number, rng: Rng): string[][][] {
  const meets = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const met = (a: string, b: string) => meets.get(key(a, b)) ?? 0;
  const weight = (a: string, b: string) => (a === YOU || b === YOU ? 10 : 1);
  const tableCost = (table: readonly string[]) => {
    let cost = 0;
    for (let i = 0; i < table.length; i++) {
      for (let j = i + 1; j < table.length; j++) {
        const m = met(table[i], table[j]);
        cost += m * m * weight(table[i], table[j]);
      }
    }
    return cost;
  };
  const total = (tables: string[][]) => tables.reduce((sum, table) => sum + tableCost(table), 0);

  const schedule: string[][][] = [];
  for (let round = 0; round < rounds; round++) {
    let best: string[][] | null = null;
    let bestCost = Infinity;
    for (let attempt = 0; attempt < 60 && bestCost > 0; attempt++) {
      const order = shuffleInPlace([...ids], rng);
      const tables: string[][] = [];
      for (let i = 0; i < order.length; i += tableSize) tables.push(order.slice(i, i + tableSize));
      // Millora local: intercanviar dos jugadors de taules diferents si abarateix.
      let improved = true;
      while (improved) {
        improved = false;
        for (let a = 0; a < tables.length; a++) {
          for (let b = a + 1; b < tables.length; b++) {
            for (let i = 0; i < tables[a].length; i++) {
              for (let j = 0; j < tables[b].length; j++) {
                const before = tableCost(tables[a]) + tableCost(tables[b]);
                [tables[a][i], tables[b][j]] = [tables[b][j], tables[a][i]];
                if (tableCost(tables[a]) + tableCost(tables[b]) < before) improved = true;
                else [tables[a][i], tables[b][j]] = [tables[b][j], tables[a][i]];
              }
            }
          }
        }
      }
      const cost = total(tables);
      if (cost < bestCost) {
        best = tables;
        bestCost = cost;
      }
    }
    const tables = (best ?? []).map((table) => {
      // La teva taula comença per tu: és l'ordre dels jugadors de la partida.
      const sorted = [...table];
      const you = sorted.indexOf(YOU);
      if (you > 0) sorted.unshift(...sorted.splice(you, 1));
      return sorted;
    });
    // La teva taula, la primera.
    tables.sort((a, b) => Number(b[0] === YOU) - Number(a[0] === YOU));
    for (const table of tables) {
      for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) meets.set(key(table[i], table[j]), met(table[i], table[j]) + 1);
      }
    }
    schedule.push(tables);
  }
  return schedule;
}

export function isFinished(season: LeagueSeason): boolean {
  return season.played >= season.config.rounds;
}

/** Els teus rivals de la jornada (en l'ordre en què seuen a la taula). */
export function yourTable(season: LeagueSeason, round = season.played): LeagueRival[] {
  const table = season.schedule[round]?.find((t) => t.includes(YOU)) ?? [];
  return table
    .filter((id) => id !== YOU)
    .map((id) => season.rivals.find((rival) => rival.id === id))
    .filter((rival): rival is LeagueRival => rival !== undefined);
}

export function rivalById(season: LeagueSeason, id: string): LeagueRival | undefined {
  return season.rivals.find((rival) => rival.id === id);
}

/* ---------- Resultats simulats ---------- */

/*
 * Model de les partides entre rivals, mesurat fent jugar el motor mateix
 * (docs/LLIGA.md §4): qui guanya segueix un model de Plackett–Luce sobre
 * 10^(k·força/400), amb un pendent k que depèn del nivell —als nivells baixos i
 * mitjans la diferència de força pesa molt més del que diria l'Elo—, i les
 * fitxes que es queden a la mà els perdedors, segons la posició i el nivell.
 */
const ANCHORS = [800, 1000, 1200, 1400, 1600];
const STEEPNESS = [0.9, 3.4, 3, 1.8, 0.5];
/** Punts a la mà dels perdedors, del millor al pitjor, per mida de taula i força. */
const PENALTY_MEANS: Record<number, number[][]> = {
  3: [
    [122, 94, 41, 26, 18],
    [157, 120, 57, 49, 40],
  ],
  4: [
    [105, 75, 39, 21, 13],
    [125, 94, 51, 38, 29],
    [154, 119, 69, 65, 76],
  ],
};

function interpolate(values: readonly number[], rating: number): number {
  const r = Math.min(ANCHORS[ANCHORS.length - 1], Math.max(ANCHORS[0], rating));
  for (let i = 1; i < ANCHORS.length; i++) {
    if (r <= ANCHORS[i]) {
      const f = (r - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * f;
    }
  }
  return values[values.length - 1];
}

/** Pendent del model de victòries per a una taula d'aquesta força mitjana. */
export function steepness(averageRating: number): number {
  return interpolate(STEEPNESS, averageRating);
}

/** Probabilitat de guanyar la partida de cada jugador d'una taula. */
export function winChances(ratings: readonly number[]): number[] {
  const average = ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length);
  const k = steepness(average);
  const strengths = ratings.map((r) => 10 ** ((k * (r - average)) / 400));
  const sum = strengths.reduce((a, b) => a + b, 0);
  return strengths.map((s) => s / sum);
}

/**
 * Resultat simulat d'una taula de rivals: punts de la partida alineats amb les
 * forces que es passen. El guanyador s'emporta els punts que els altres tenen a
 * la mà, que és com es puntua una partida de debò (la suma és zero).
 */
export function simulateTable(ratings: readonly number[], rng: Rng): number[] {
  const n = ratings.length;
  const average = ratings.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const k = steepness(average);
  const remaining = ratings.map((r, i) => ({ i, s: 10 ** ((k * (r - average)) / 400) }));
  const order: number[] = [];
  while (remaining.length > 0) {
    const sum = remaining.reduce((a, b) => a + b.s, 0);
    let pick = rng() * sum;
    let index = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      pick -= remaining[j].s;
      if (pick < 0) {
        index = j;
        break;
      }
    }
    order.push(remaining.splice(index, 1)[0].i);
  }
  const means = PENALTY_MEANS[n] ?? PENALTY_MEANS[n < 3 ? 3 : 4];
  const penalties = order
    .slice(1)
    .map((_, j) => {
      const mean = interpolate(means[Math.min(j, means.length - 1)], average);
      return Math.max(2, Math.round(mean * (0.55 + 0.9 * rng())));
    })
    .sort((a, b) => a - b);
  const scores = new Array<number>(n).fill(0);
  order.slice(1).forEach((player, j) => {
    scores[player] = -penalties[j];
  });
  scores[order[0]] = penalties.reduce((a, b) => a + b, 0);
  return scores;
}

/**
 * Registra la teva partida de la jornada i simula la resta de taules. Les
 * puntuacions han de ser les de la partida (`finalScores`), alineades amb la
 * teva taula del calendari (tu primer). Si aquesta jornada ja s'havia
 * registrat, no fa res: el resultat d'una jornada només es compta un cop.
 */
export function recordRound(season: LeagueSeason, scores: readonly number[]): LeagueSeason {
  if (isFinished(season)) return season;
  const round = season.played;
  const tables = season.schedule[round] ?? [];
  const mine = tables.find((table) => table.includes(YOU));
  if (!mine || scores.length !== mine.length) return season;
  const rng = createRng((season.seed ^ Math.imul(round + 1, 0x9e3779b1)) >>> 0);
  const results: TableResult[] = tables.map((table) =>
    table === mine
      ? { round, ids: [...table], scores: [...scores], simulated: false }
      : {
          round,
          ids: [...table],
          scores: simulateTable(table.map((id) => rivalById(season, id)?.rating ?? tierRating(season.tier)), rng),
          simulated: true,
        },
  );
  return { ...season, results: [...season.results, ...results], played: round + 1 };
}

/* ---------- Classificació ---------- */

export interface StandingRow {
  id: string;
  name: string;
  /** Força del rival (la teva no hi compta: és la del graó). */
  rating: number;
  played: number;
  /** Punts de lliga: un per cada jugador de la taula que acaba per sota teu. */
  points: number;
  /** Diferència: suma dels punts de les partides. */
  diff: number;
  /** Partides guanyades (primer de la taula). */
  wins: number;
}

/**
 * Punts de lliga d'una taula, alineats amb els jugadors: com en una lliga
 * d'escacs, cada partida és un enfrontament contra cadascun dels altres de la
 * taula — 1 punt si acabes per davant, ½ si empateu, 0 si quedes per sota.
 * Guanyar a una taula de quatre dona 3 punts; quedar segon, 2.
 */
export function tablePoints(scores: readonly number[]): number[] {
  return scores.map((mine, i) =>
    scores.reduce((sum, other, j) => (i === j ? sum : sum + (mine > other ? 1 : mine === other ? 0.5 : 0)), 0),
  );
}

/**
 * Classificació amb els desempats de les lligues: 1) punts; 2) enfrontaments
 * directes entre els empatats (només si tots s'hi han trobat); 3) diferència
 * de punts de partida; 4) victòries; 5) força i nom, perquè l'ordre sigui
 * sempre el mateix.
 */
export function standings(season: LeagueSeason, playerName = 'Tu'): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  rows.set(YOU, { id: YOU, name: playerName, rating: tierRating(season.tier), played: 0, points: 0, diff: 0, wins: 0 });
  for (const rival of season.rivals) {
    rows.set(rival.id, { id: rival.id, name: rival.name, rating: rival.rating, played: 0, points: 0, diff: 0, wins: 0 });
  }
  const versus = new Map<string, number>();
  const vsKey = (a: string, b: string) => `${a}>${b}`;
  for (const result of season.results) {
    const points = tablePoints(result.scores);
    const top = Math.max(...result.scores);
    result.ids.forEach((id, i) => {
      const row = rows.get(id);
      if (!row) return;
      row.played += 1;
      row.points += points[i];
      row.diff += result.scores[i];
      if (result.scores[i] === top && top > 0) row.wins += 1;
      result.ids.forEach((other, j) => {
        if (i === j) return;
        const s = result.scores[i] > result.scores[j] ? 1 : result.scores[i] === result.scores[j] ? 0.5 : 0;
        versus.set(vsKey(id, other), (versus.get(vsKey(id, other)) ?? 0) + s);
      });
    });
  }
  const list = [...rows.values()];
  const h2h = new Map<string, number>();
  const byPoints = new Map<number, StandingRow[]>();
  for (const row of list) byPoints.set(row.points, [...(byPoints.get(row.points) ?? []), row]);
  for (const group of byPoints.values()) {
    if (group.length < 2) continue;
    const allMet = group.every((a) =>
      group.every((b) => a === b || versus.has(vsKey(a.id, b.id))),
    );
    if (!allMet) continue;
    for (const a of group) {
      h2h.set(a.id, group.reduce((sum, b) => (a === b ? sum : sum + (versus.get(vsKey(a.id, b.id)) ?? 0)), 0));
    }
  }
  return list.sort(
    (a, b) =>
      b.points - a.points ||
      (h2h.get(b.id) ?? 0) - (h2h.get(a.id) ?? 0) ||
      b.diff - a.diff ||
      b.wins - a.wins ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name, 'ca'),
  );
}

/** Posició (des d'1) d'un jugador a la classificació. */
export function rankOf(season: LeagueSeason, id = YOU): number {
  return standings(season).findIndex((row) => row.id === id) + 1;
}

export type Movement = 'up' | 'down' | 'stay' | 'champion';

/** Zona d'una posició: puja, baixa o es queda (respectant els extrems de l'escala). */
export function zoneOf(tier: number, rank: number, players: number): Movement {
  const zone = zoneSize(players);
  if (rank <= zone) return clampTier(tier) < TOP_TIER ? 'up' : rank === 1 ? 'champion' : 'stay';
  if (rank > players - zone && clampTier(tier) > 0) return 'down';
  return 'stay';
}

/** Graó de la temporada següent segons la posició final. */
export function nextTier(tier: number, rank: number, players: number): number {
  const zone = zoneOf(tier, rank, players);
  if (zone === 'up') return clampTier(tier + 1);
  if (zone === 'down') return clampTier(tier - 1);
  return clampTier(tier);
}

/**
 * On jugaràs la temporada següent, en paraules. Dins d'un nivell es passa de
 * la C a la B i de la B a la A («Puges al Grup B de la Lliga de Vic»); de la A
 * es passa a la C del nivell següent («nivell nou»).
 */
export function movementText(from: number, to: number, movement: Movement, home: LeagueHome | null): string {
  if (movement === 'champion') return 'Campió del món!';
  const sameLevel = tierLevel(from) === tierLevel(to);
  const where = sameLevel
    ? `al Grup ${tierGroup(to)} de la ${levelName(tierLevel(to), home)}`
    : `a la ${tierName(to, home)}`;
  if (movement === 'up') return `Puges ${where}${sameLevel ? '' : ': nivell nou!'}`;
  if (movement === 'down') return `Baixes ${where}`;
  return `Continues ${where}`;
}

/* ---------- Trajectòria ---------- */

export interface SeasonRecord {
  tier: number;
  name: string;
  rank: number;
  players: number;
  points: number;
  diff: number;
  wins: number;
  nextTier: number;
  movement: Movement;
  finishedAt: string;
}

export interface LeagueCareer {
  /** Graó on es jugarà la temporada següent (o on es juga l'actual). */
  tier: number;
  bestTier: number;
  /** On jugues: dona nom a les lligues i origen als rivals. */
  home: LeagueHome | null;
  /** S'ha preguntat ja on jugues (per no tornar-ho a preguntar a cada obertura). */
  homeAsked: boolean;
  /** Configuració per a les temporades noves. */
  config: LeagueConfig;
  seasons: SeasonRecord[];
  /** Noms de les darreres temporades, perquè no tornin a sortir de seguida. */
  recentNames: string[];
}

export const MAX_RECORDS = 30;
const MAX_RECENT_NAMES = 90;

export function newCareer(home: LeagueHome | null = null): LeagueCareer {
  return {
    tier: START_TIER,
    bestTier: START_TIER,
    home,
    homeAsked: false,
    config: { ...DEFAULT_CONFIG },
    seasons: [],
    recentNames: [],
  };
}

/**
 * Graó de la temporada que es començarà ara. La primera (encara no n'has
 * acabat cap) es col·loca segons la teva habilitat (`placementTier`); després
 * només mana l'escala: on t'han deixat l'ascens, el descens o la permanència.
 */
export function upcomingTier(career: LeagueCareer, rating: number | null): number {
  if (career.seasons.length > 0) return clampTier(career.tier);
  return Math.max(clampTier(career.tier), placementTier(rating));
}

/**
 * Tanca una temporada acabada: l'apunta al palmarès, mou el graó (puja, baixa
 * o es queda) i recorda els noms dels rivals perquè no tornin a sortir.
 */
export function closeSeason(career: LeagueCareer, season: LeagueSeason, date = new Date()): LeagueCareer {
  if (!isFinished(season)) return career;
  const table = standings(season);
  const rank = table.findIndex((row) => row.id === YOU) + 1;
  const me = table[rank - 1];
  const movement = zoneOf(season.tier, rank, season.config.players);
  const next = nextTier(season.tier, rank, season.config.players);
  const record: SeasonRecord = {
    tier: season.tier,
    name: season.name,
    rank,
    players: season.config.players,
    points: me?.points ?? 0,
    diff: me?.diff ?? 0,
    wins: me?.wins ?? 0,
    nextTier: next,
    movement,
    finishedAt: date.toISOString(),
  };
  return {
    ...career,
    tier: next,
    bestTier: Math.max(career.bestTier, next, season.tier),
    seasons: [record, ...career.seasons].slice(0, MAX_RECORDS),
    recentNames: [...season.rivals.map((rival) => rival.name), ...career.recentNames].slice(0, MAX_RECENT_NAMES),
  };
}

/* ---------- Desat ---------- */

export interface LeagueState {
  career: LeagueCareer;
  season: LeagueSeason | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validHome(value: unknown): LeagueHome | null {
  if (!isRecord(value) || typeof value.municipi !== 'string' || !value.municipi.trim()) return null;
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 60) : '');
  const territories = ['cat', 'val', 'bal', 'and', 'nord', 'franja', 'alguer', 'fora'];
  return {
    territory: (territories.includes(String(value.territory)) ? value.territory : 'cat') as LeagueHome['territory'],
    municipi: text(value.municipi),
    comarca: text(value.comarca),
    provincia: text(value.provincia),
    pais: text(value.pais),
  };
}

function validSeason(value: unknown): LeagueSeason | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const config = normalizeConfig(value.config as Partial<LeagueConfig>);
  const rivals = Array.isArray(value.rivals) ? value.rivals : null;
  const schedule = Array.isArray(value.schedule) ? value.schedule : null;
  const results = Array.isArray(value.results) ? value.results : null;
  if (!rivals || !schedule || !results) return null;
  if (rivals.length !== config.players - 1 || schedule.length !== config.rounds) return null;
  /*
   * Una força fora del marge (desats d'abans d'encabir el soroll) es corregeix
   * en comptes de llençar la temporada sencera amb els seus resultats.
   */
  const rivalsOk = rivals.every(
    (r) => isRecord(r) && typeof r.id === 'string' && typeof r.name === 'string' &&
      typeof r.rating === 'number' && Number.isFinite(r.rating),
  );
  const ids = new Set([YOU, ...rivals.map((r) => (r as LeagueRival).id)]);
  const scheduleOk = schedule.every(
    (round) => Array.isArray(round) && round.every(
      (table) => Array.isArray(table) && table.length === config.opponents + 1 &&
        table.every((id) => typeof id === 'string' && ids.has(id)),
    ),
  );
  const resultsOk = results.every(
    (r) => isRecord(r) && Array.isArray(r.ids) && Array.isArray(r.scores) && r.ids.length === r.scores.length &&
      r.scores.every((s) => typeof s === 'number' && Number.isFinite(s)),
  );
  const played = Number(value.played);
  if (!rivalsOk || !scheduleOk || !resultsOk || !Number.isInteger(played) || played < 0 || played > config.rounds) {
    return null;
  }
  return {
    version: 1,
    seed: Number(value.seed) >>> 0,
    tier: clampTier(Number(value.tier)),
    config,
    name: typeof value.name === 'string' ? value.name : '',
    rivals: (rivals as LeagueRival[]).map((rival) => ({ ...rival, rating: clampRating(rival.rating) })),
    schedule: schedule as string[][][],
    results: results as TableResult[],
    played,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString(),
  };
}

/**
 * Estat desat de la lliga, comprovat: el que hi ha al navegador pot venir
 * d'una altra versió o estar malmès. Una temporada que no quadra es descarta
 * (la trajectòria es conserva); una trajectòria que no quadra torna a zero.
 */
export function parseLeagueState(raw: string | null): LeagueState {
  if (!raw) return { career: newCareer(), season: null };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.career)) return { career: newCareer(), season: null };
    const c = value.career;
    const career: LeagueCareer = {
      tier: clampTier(Number(c.tier)),
      bestTier: clampTier(Number(c.bestTier)),
      home: validHome(c.home),
      homeAsked: c.homeAsked === true,
      config: normalizeConfig(c.config as Partial<LeagueConfig>),
      seasons: Array.isArray(c.seasons)
        ? (c.seasons.filter((s) => isRecord(s) && typeof s.rank === 'number' && typeof s.name === 'string') as SeasonRecord[])
            .slice(0, MAX_RECORDS)
        : [],
      recentNames: Array.isArray(c.recentNames)
        ? c.recentNames.filter((n): n is string => typeof n === 'string').slice(0, MAX_RECENT_NAMES)
        : [],
    };
    career.bestTier = Math.max(career.bestTier, career.tier);
    let season = validSeason(value.season);
    /*
     * Trajectòries d'abans que l'escalada comencés a la lliga del territori:
     * qui no hi havia arribat mai hi puja (un sol cop: després ja té el
     * millor graó a la Catalana i, si baixa, baixa), i la temporada que tenia
     * per sota es descarta per tornar-la a començar allà.
     */
    if (career.bestTier < START_TIER) {
      career.tier = START_TIER;
      career.bestTier = START_TIER;
      if (season && season.tier < START_TIER) season = null;
    }
    return { career, season };
  } catch {
    return { career: newCareer(), season: null };
  }
}

export function serializeLeagueState(state: LeagueState): string {
  return JSON.stringify(state);
}
