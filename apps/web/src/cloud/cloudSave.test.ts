import { createProfile } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { createSeason, parseLeagueState, type LeagueState } from '../lliga/league';
import { buildCloudSave, mergeCloudSave, parseCloudSave, toFirestore } from './cloudSave';

function leagueWith(seasons: number, played: number, seed = 7): LeagueState {
  const base = parseLeagueState(null);
  const season = createSeason({ tier: 0, config: base.career.config, home: null, seed });
  return {
    career: {
      ...base.career,
      seasons: Array.from({ length: seasons }, (_, i) => ({
        tier: 0, name: `T${i}`, rank: 1, players: 8, points: 10, diff: 5, wins: 3, nextTier: 1, movement: 'up' as const,
        finishedAt: '2026-11-01T00:00:00.000Z',
      })),
      recentNames: ['Anna Puig', 'Pere Vila'],
    },
    season: { ...season, played },
  };
}

const profileWith = (gamesPlayed: number, name = 'Jugador') => ({
  ...createProfile('local', name),
  rating: 1100,
  gamesPlayed,
  wins: Math.floor(gamesPlayed / 2),
  ratedGames: gamesPlayed,
  history: [{ playedAt: 'x' } as never],
});

describe('el desat al compte', () => {
  it('només porta el nom, el nivell i la lliga en curs: cap historial', () => {
    const save = buildCloudSave(profileWith(12, 'Daniel'), leagueWith(3, 2));
    const data = toFirestore(save);
    expect(Object.keys(data).sort()).toEqual(['league', 'level', 'name', 'version']);
    expect(Object.keys(data.level as object)).not.toContain('history');
    expect(data.league).not.toHaveProperty('career.seasons');
    expect(data.league).not.toHaveProperty('career.recentNames');
    expect((data.league as { seasonsPlayed: number }).seasonsPlayed).toBe(3);
    // La temporada en curs hi és, amb els noms dels rivals.
    const season = (data.league as { season: { rivals: { name: string }[] } }).season;
    expect(season.rivals.length).toBeGreaterThan(0);
    expect(season.rivals.every((r) => typeof r.name === 'string' && r.name.length > 0)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('undefined');
  });

  it('el que torna del compte es comprova i es recupera igual', () => {
    const league = leagueWith(1, 3);
    const save = buildCloudSave(profileWith(5, 'Daniel'), league);
    const parsed = parseCloudSave(JSON.parse(JSON.stringify(toFirestore(save))));
    expect(parsed?.name).toBe('Daniel');
    expect(parsed?.level.gamesPlayed).toBe(5);
    expect(parsed?.league.season?.seed).toBe(league.season?.seed);
    expect(parsed?.league.season?.played).toBe(3);
    expect(parseCloudSave({ version: 1, name: 'x', level: { rating: -5 } })).toBeNull();
    expect(parseCloudSave(null)).toBeNull();
  });

  it('en entrar, de cada part es queda la més avançada i l’historial local es conserva', () => {
    const cloud = parseCloudSave(toFirestore(buildCloudSave(profileWith(30, 'Daniel'), leagueWith(2, 1, 99))))!;
    const local = leagueWith(1, 4, 7);
    const merged = mergeCloudSave(cloud, profileWith(10), local);
    expect(merged.level?.gamesPlayed).toBe(30);
    expect(merged.name).toBe('Daniel');
    expect(merged.league?.season?.seed).toBe(99);
    expect(merged.league?.career.seasons).toHaveLength(1);
    expect(merged.league?.career.recentNames).toEqual(['Anna Puig', 'Pere Vila']);
  });

  it('si l’aparell va més avançat, no es toca res', () => {
    const cloud = parseCloudSave(toFirestore(buildCloudSave(profileWith(3, 'Altre'), leagueWith(0, 2))))!;
    const merged = mergeCloudSave(cloud, profileWith(10, 'Daniel'), leagueWith(1, 0));
    expect(merged).toEqual({ level: null, name: null, league: null });
  });
});

describe('el calendari a Firestore', () => {
  it('no porta llistes dins de llistes i es recupera igual', () => {
    const league = leagueWith(0, 1);
    const data = toFirestore(buildCloudSave(profileWith(1), league));
    const schedule = (data.league as { season: { schedule: unknown[] } }).season.schedule;
    expect(schedule.every((round) => typeof round === 'string')).toBe(true);
    expect(parseCloudSave(data)?.league.season?.schedule).toEqual(league.season?.schedule);
  });
});
