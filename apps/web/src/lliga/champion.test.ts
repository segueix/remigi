import { describe, expect, it } from 'vitest';
import {
  catalanDate,
  diplomaContent,
  diplomaFileName,
  diplomaSerial,
  isWorldChampion,
  markCelebrated,
  shareMessage,
  wasCelebrated,
  whatsappUrl,
  worldTitles,
} from './champion';
import {
  DEFAULT_CONFIG,
  TOP_TIER,
  YOU,
  closeSeason,
  createSeason,
  newCareer,
  recordRound,
  type LeagueSeason,
} from './league';

/** Una temporada sencera a un graó on el jugador ho guanya tot de llarg. */
function playedSeason(tier: number, yourScore: number): LeagueSeason {
  let season = createSeason({ tier, config: DEFAULT_CONFIG, home: null, seed: 7, date: new Date(2026, 10, 19) });
  while (season.played < season.config.rounds) {
    const table = season.schedule[season.played].find((t) => t.includes(YOU)) ?? [];
    season = recordRound(season, table.map((id) => (id === YOU ? yourScore : -40)));
  }
  return season;
}

describe('isWorldChampion', () => {
  it('només és campió del món qui guanya la Mundial A', () => {
    expect(isWorldChampion({ tier: TOP_TIER, rank: 1 })).toBe(true);
    expect(isWorldChampion({ tier: TOP_TIER, rank: 2 })).toBe(false);
    expect(isWorldChampion({ tier: TOP_TIER - 1, rank: 1 })).toBe(false);
    expect(isWorldChampion(null)).toBe(false);
    expect(isWorldChampion(undefined)).toBe(false);
  });

  it('una temporada tancada guanyant la Mundial A queda al palmarès com a títol', () => {
    const season = playedSeason(TOP_TIER, 900);
    const career = closeSeason(newCareer(null), season, new Date(2026, 10, 19, 21, 30));
    expect(career.seasons[0].movement).toBe('champion');
    expect(isWorldChampion(career.seasons[0])).toBe(true);
    expect(worldTitles(career)).toHaveLength(1);
  });

  it('guanyar una altra lliga no és el títol mundial', () => {
    const season = playedSeason(TOP_TIER - 3, 900);
    const career = closeSeason(newCareer(null), season);
    expect(career.seasons[0].rank).toBe(1);
    expect(worldTitles(career)).toEqual([]);
  });
});

describe('catalanDate', () => {
  it('posa l’apòstrof davant de vocal', () => {
    expect(catalanDate(new Date(2026, 10, 19))).toBe('19 de novembre de 2026');
    expect(catalanDate(new Date(2027, 3, 4))).toBe('4 d’abril de 2027');
    expect(catalanDate(new Date(2027, 7, 1))).toBe('1 d’agost de 2027');
    expect(catalanDate(new Date(2027, 9, 31))).toBe('31 d’octubre de 2027');
    expect(catalanDate(new Date(2027, 2, 9))).toBe('9 de març de 2027');
  });
});

describe('el diploma', () => {
  const season = playedSeason(TOP_TIER, 900);
  const record = closeSeason(newCareer(null), season, new Date(2026, 10, 19, 12)).seasons[0];

  it('porta el nom, la lliga, el títol i les xifres', () => {
    const content = diplomaContent(record, '  Maria  ');
    expect(content.playerName).toBe('Maria');
    expect(content.title).toBe('Millor jugador del món');
    expect(content.leagueName).toBe('Lliga Mundial · Divisió A');
    expect(content.stats).toContain('1r de 8 jugadors');
    expect(content.stats).toMatch(/victòri(a|es)/);
    expect(content.dateText).toBe('19 de novembre de 2026');
  });

  it('sense nom fa servir un de genèric', () => {
    expect(diplomaContent(record, '   ').playerName).toBe('Jugador anònim');
  });

  it('el número de sèrie és estable i canvia amb la temporada', () => {
    const a = diplomaSerial(record, 'Maria');
    expect(a).toMatch(/^[0-9A-Z]{7}$/);
    expect(diplomaSerial(record, 'Maria')).toBe(a);
    expect(diplomaSerial({ ...record, finishedAt: '2027-01-01T00:00:00.000Z' }, 'Maria')).not.toBe(a);
  });

  it('el fitxer no porta accents ni símbols', () => {
    expect(diplomaFileName('Núria Garcia-Ròs!')).toBe('diploma-remigi-nuria-garcia-ros.png');
    expect(diplomaFileName('???')).toBe('diploma-remigi.png');
  });
});

describe('compartir per WhatsApp', () => {
  const record = closeSeason(newCareer(null), playedSeason(TOP_TIER, 900)).seasons[0];

  it('el missatge diu el títol i porta l’adreça del joc', () => {
    const text = shareMessage(record, 'https://segueix.github.io/remigi/');
    expect(text).toContain('millor jugador del món');
    expect(text).toContain('Lliga Mundial · Divisió A');
    expect(text).toContain('T’atreveixes a succeir-me? 🎲');
    expect(text.endsWith('https://segueix.github.io/remigi/')).toBe(true);
  });

  it('l’enllaç codifica el missatge (salts de línia, emoji i signes)', () => {
    const url = whatsappUrl('Hola & adéu\n🏆 100%');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).not.toContain('\n');
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe('Hola & adéu\n🏆 100%');
  });
});

describe('celebrar només un cop', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('recorda el títol celebrat, per temporada', () => {
    const storage = memory();
    const one = { finishedAt: '2026-11-19T10:00:00.000Z' };
    const other = { finishedAt: '2027-02-01T10:00:00.000Z' };
    expect(wasCelebrated(one, storage)).toBe(false);
    markCelebrated(one, storage);
    expect(wasCelebrated(one, storage)).toBe(true);
    expect(wasCelebrated(other, storage)).toBe(false);
  });

  it('sense emmagatzematge (o si peta) no trenca res', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloquejat');
      },
      setItem: () => {
        throw new Error('bloquejat');
      },
    };
    expect(wasCelebrated({ finishedAt: 'x' }, broken)).toBe(false);
    expect(() => markCelebrated({ finishedAt: 'x' }, broken)).not.toThrow();
    expect(wasCelebrated({ finishedAt: 'x' }, null)).toBe(false);
    expect(() => markCelebrated({ finishedAt: 'x' }, null)).not.toThrow();
  });
});
