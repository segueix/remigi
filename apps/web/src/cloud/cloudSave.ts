import type { PlayerProfile } from '@remigi/core';
import { parseLeagueState, type LeagueCareer, type LeagueSeason, type LeagueState } from '../lliga/league';
import { isValidProfileProgress, type ProfileProgress } from '../state/profileTransfer';

/**
 * El que es desa al compte de Google (`perfils/{uid}`, privat: només el
 * llegeix i l'escriu el mateix jugador). Només el mínim per continuar en un
 * altre aparell:
 *
 * - el **nom** i el **nivell** (habilitat, partides, victòries i calibratge);
 * - la **lliga en curs**: on ets de l'escala, la localitat, la configuració i
 *   la temporada d'ara amb els rivals (noms, població i força), el calendari
 *   i la classificació.
 *
 * **No** hi va cap historial: ni les partides del joc lliure, ni les
 * temporades acabades, ni els noms de rivals de temporades passades, ni els
 * reptes. De les temporades acabades només se'n desa quantes n'hi ha, per
 * saber quin aparell va més avançat.
 */
export interface CloudSave {
  version: 1;
  name: string;
  level: ProfileProgress;
  league: {
    career: Omit<LeagueCareer, 'seasons' | 'recentNames'>;
    season: LeagueSeason | null;
    /** Quantes temporades acabades (sense el detall). */
    seasonsPlayed: number;
  };
}

export function levelOf(profile: PlayerProfile): ProfileProgress {
  const level: ProfileProgress = {
    rating: profile.rating,
    gamesPlayed: profile.gamesPlayed,
    wins: profile.wins,
    ratedGames: profile.ratedGames,
  };
  if (profile.adaptiveStep !== undefined) level.adaptiveStep = profile.adaptiveStep;
  if (profile.adaptiveCalibrating !== undefined) level.adaptiveCalibrating = profile.adaptiveCalibrating;
  return level;
}

export function buildCloudSave(profile: PlayerProfile, league: LeagueState): CloudSave {
  const { seasons, recentNames: _recent, ...career } = league.career;
  return {
    version: 1,
    name: profile.name,
    level: levelOf(profile),
    league: { career, season: league.season, seasonsPlayed: seasons.length },
  };
}

/*
 * Firestore no accepta llistes dins de llistes, i el calendari ho és
 * (jornades → taules → jugadors): cada jornada es desa com un text,
 * «a,b,c|d,e,f» (taules separades per «|», jugadors per «,»).
 */
export function encodeSchedule(schedule: readonly (readonly (readonly string[])[])[]): string[] {
  return schedule.map((round) => round.map((table) => table.join(',')).join('|'));
}

export function decodeSchedule(rounds: unknown): string[][][] | null {
  if (!Array.isArray(rounds) || !rounds.every((round) => typeof round === 'string')) return null;
  return (rounds as string[]).map((round) => (round ? round.split('|').map((table) => table.split(',')) : []));
}

/**
 * El que s'envia a Firestore: sense `undefined` (no els accepta) i amb el
 * calendari codificat.
 */
export function toFirestore(save: CloudSave): Record<string, unknown> {
  const season = save.league.season ? { ...save.league.season, schedule: encodeSchedule(save.league.season.schedule) } : null;
  return JSON.parse(JSON.stringify({ ...save, league: { ...save.league, season } })) as Record<string, unknown>;
}

/** El que torna de Firestore, comprovat (null si no té forma). */
export function parseCloudSave(value: unknown): CloudSave | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || typeof v.name !== 'string') return null;
  const level = v.level as ProfileProgress | undefined;
  if (!level || typeof level !== 'object' || !isValidProfileProgress(level)) return null;
  const league = v.league as Record<string, unknown> | undefined;
  if (!league || typeof league !== 'object') return null;
  const seasonsPlayed = Number(league.seasonsPlayed);
  const rawSeason = league.season as Record<string, unknown> | null | undefined;
  const season = rawSeason && typeof rawSeason === 'object' ? { ...rawSeason, schedule: decodeSchedule(rawSeason.schedule) } : null;
  // La lliga passa pel mateix control que la desada a l'aparell.
  const parsed = parseLeagueState(
    JSON.stringify({ career: { ...(league.career as object), seasons: [], recentNames: [] }, season }),
  );
  const { seasons: _seasons, recentNames: _recent, ...career } = parsed.career;
  return {
    version: 1,
    name: v.name.slice(0, 40),
    level: {
      rating: level.rating,
      gamesPlayed: level.gamesPlayed,
      wins: level.wins,
      ratedGames: level.ratedGames,
      adaptiveStep: level.adaptiveStep,
      adaptiveCalibrating: level.adaptiveCalibrating,
    },
    league: {
      career,
      season: parsed.season,
      seasonsPlayed: Number.isInteger(seasonsPlayed) && seasonsPlayed >= 0 ? seasonsPlayed : 0,
    },
  };
}

/** Com d'avançada és una lliga: temporades acabades i jornades de la d'ara. */
function leagueProgress(seasonsPlayed: number, season: LeagueSeason | null): number {
  return seasonsPlayed * 1000 + (season?.played ?? 0);
}

export interface MergeResult {
  /** Nivell del compte, si va més avançat que el de l'aparell (més partides). */
  level: ProfileProgress | null;
  /** Nom del compte, si l'aparell encara té el de casa. */
  name: string | null;
  /** Lliga del compte, si va més avançada; l'historial de l'aparell es conserva. */
  league: LeagueState | null;
}

/**
 * En entrar amb Google en un aparell: de cada part (nivell, lliga) es queda
 * la que va més avançada. Si empaten, mana la de l'aparell.
 */
export function mergeCloudSave(cloud: CloudSave, profile: PlayerProfile, league: LeagueState): MergeResult {
  const level = cloud.level.gamesPlayed > profile.gamesPlayed ? cloud.level : null;
  const name = profile.name === 'Jugador' && cloud.name && cloud.name !== 'Jugador' ? cloud.name : null;
  const cloudAhead =
    leagueProgress(cloud.league.seasonsPlayed, cloud.league.season) >
    leagueProgress(league.career.seasons.length, league.season);
  return {
    level,
    name,
    league: cloudAhead
      ? {
          career: { ...league.career, ...cloud.league.career },
          season: cloud.league.season,
        }
      : null,
  };
}
