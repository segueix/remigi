import {
  DIFFICULTY_ORDER,
  suggestOpponentRatings,
  suggestOpponents,
  type DifficultyKey,
  type PlayerProfile,
} from '@remigi/core';
import type { GameSetup } from '../game/useGame';

/**
 * Com vol jugar el joc lliure el jugador: quants rivals i de quin nivell
 * (automàtic o fixat). Es desa a part de la partida perquè sobrevisqui al
 * final de cada partida: abans, en acabar-se, la partida desada s'esborrava i
 * en tornar a obrir l'app es perdien els rivals que s'havien triat.
 *
 * Amb el nivell automàtic no cal desar cap nivell: surt de l'habilitat del
 * perfil, que és on la va deixar l'última partida lliure.
 */
export const FREE_PLAY_KEY = 'remigi:lliure';

export type FreeLevel = 'auto' | DifficultyKey;

export interface FreePlayPrefs {
  count: 1 | 2 | 3;
  level: FreeLevel;
  adaptDuringGame: boolean;
}

export const DEFAULT_FREE_PLAY: FreePlayPrefs = { count: 2, level: 'auto', adaptDuringGame: false };

export function normalizeFreePlay(input: Partial<FreePlayPrefs> | null | undefined): FreePlayPrefs {
  const count = Number(input?.count);
  const level = input?.level;
  return {
    count: count === 1 || count === 2 || count === 3 ? count : DEFAULT_FREE_PLAY.count,
    level: level === 'auto' || DIFFICULTY_ORDER.includes(level as DifficultyKey) ? (level as FreeLevel) : 'auto',
    adaptDuringGame: input?.adaptDuringGame === true,
  };
}

export function parseFreePlay(raw: string | null): FreePlayPrefs | null {
  if (!raw) return null;
  try {
    return normalizeFreePlay(JSON.parse(raw) as Partial<FreePlayPrefs>);
  } catch {
    return null;
  }
}

/** Les preferències que es dedueixen d'una partida lliure (la represa, o una de nova). */
export function prefsFromSetup(setup: GameSetup): FreePlayPrefs {
  return normalizeFreePlay({
    count: setup.opponents.length as FreePlayPrefs['count'],
    level: setup.auto === false ? setup.opponents[0] : 'auto',
    adaptDuringGame: Boolean(setup.adaptDuringGame),
  });
}

/**
 * La partida lliure nova que toca: mateix nombre de rivals i, si el nivell és
 * automàtic, la força que dona l'habilitat d'ara mateix.
 */
export function setupFromPrefs(prefs: FreePlayPrefs, profile: PlayerProfile): GameSetup {
  if (prefs.level === 'auto') {
    return {
      mode: 'lliure',
      playerName: profile.name,
      opponents: suggestOpponents(profile, prefs.count),
      opponentRatings: suggestOpponentRatings(profile, prefs.count),
      auto: true,
      adaptDuringGame: prefs.adaptDuringGame,
    };
  }
  return {
    mode: 'lliure',
    playerName: profile.name,
    opponents: Array.from({ length: prefs.count }, () => prefs.level as DifficultyKey),
    auto: false,
    adaptDuringGame: prefs.adaptDuringGame,
  };
}
