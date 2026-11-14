import type { GameState } from '@remigi/core';
import { validMisses, type MissedChance } from '../game/missedChances';
import { validRackOrder, validSortBy, type SortBy } from '../game/rackOrder';
import type { SavedDraft } from '../game/turnDraft';
import type { GameMode, GameSetup } from '../game/useGame';
import type { KeyValueStore } from '@remigi/core';

/**
 * Cada mode té la seva partida a mitges: deixar una jornada de lliga per fer
 * una partida lliure no fa perdre la jornada. El joc lliure conserva la clau
 * de sempre, així les partides desades abans dels modes es reprenen igual.
 */
export const SAVED_GAME_KEYS: Record<GameMode, string> = {
  lliure: 'remigi:game',
  repte: 'remigi:game:repte',
  lliga: 'remigi:game:lliga',
};

export interface SavedGame {
  setup: GameSetup;
  game: GameState;
  /**
   * Fitxes de la taula posades pel bot de l'últim moviment, en parelles
   * `[fitxa, jugador]` perquè un `Map` no es pot desar tal qual en JSON
   * (vegeu `meldOwners.ts`).
   *
   * És informació només visual, i per això no forma part de l'estat del motor.
   * Es desa perquè continuar una partida no faci desaparèixer els marcs; si
   * falta o ve malmesa (o ve d'una versió antiga amb claus de jugada), la
   * partida es continua igual i les fitxes es queden sense marc.
   */
  owners?: [string, number][];
  /**
   * Oportunitats perdudes de la partida, per al repàs del final (vegeu
   * `missedChances.ts`). Mateix criteri que els autors: si falten o venen
   * malmeses, la partida es continua igual i el repàs començarà de zero.
   */
  misses?: MissedChance[];
  /**
   * Com tens col·locades les fitxes al faristol: els identificadors, en
   * l'ordre en què les vols veure (vegeu `rackOrder.ts`). Com els autors, és
   * només visual; si falta o ve malmès, el faristol es veu en l'ordre del
   * motor i la partida continua igual.
   */
  rackOrder?: string[];
  /** Últim criteri automàtic triat; evita confondre color i número en mans ambigües. */
  rackSortBy?: SortBy;
  /**
   * El torn a mig fer: les fitxes que el jugador tenia a mig col·locar a la
   * taula. Es valida en restaurar-lo (`restoreDraft`); si no lliga amb la
   * partida, el torn comença net.
   */
  draft?: SavedDraft;
  /** La fitxa acabada de robar, perquè en tornar continuï marcada. */
  drawnTileId?: string;
}

export async function saveGame(
  store: KeyValueStore,
  saved: SavedGame,
  mode: GameMode = 'lliure',
): Promise<void> {
  await store.set(SAVED_GAME_KEYS[mode], JSON.stringify(saved));
}

export async function clearGame(store: KeyValueStore, mode: GameMode = 'lliure'): Promise<void> {
  await store.remove(SAVED_GAME_KEYS[mode]);
}

/**
 * Recupera la partida desada, o `null` si no n'hi ha cap d'aprofitable.
 *
 * El que hi ha al navegador no és de fiar: pot ser d'una versió anterior del
 * joc, haver-se quedat a mitges o haver-lo tocat algú. Per això es comprova la
 * forma abans de retornar-la; davant del dubte val més començar de nou que
 * carregar un estat que faria petar la partida.
 */
export async function loadGame(store: KeyValueStore, mode: GameMode = 'lliure'): Promise<SavedGame | null> {
  const raw = await store.get(SAVED_GAME_KEYS[mode]);
  if (!raw) return null;
  try {
    let saved = JSON.parse(raw) as SavedGame;
    if (!isResumable(saved)) return null;
    // Una partida desada en un altre mode no es barreja amb la d'aquest.
    if ((saved.setup.mode ?? 'lliure') !== mode) return null;
    if ('owners' in saved) saved = { ...saved, owners: validOwners(saved.owners) };
    if ('misses' in saved) saved = { ...saved, misses: validMisses(saved.misses) };
    if ('rackOrder' in saved) saved = { ...saved, rackOrder: validRackOrder(saved.rackOrder) };
    if ('rackSortBy' in saved) saved = { ...saved, rackSortBy: validSortBy(saved.rackSortBy) };
    if ('drawnTileId' in saved && typeof saved.drawnTileId !== 'string') saved = { ...saved, drawnTileId: undefined };
    return saved;
  } catch {
    return null;
  }
}

/** Els autors que tenen forma d'autor; la resta es descarten sense fer soroll. */
function validOwners(owners: unknown): [string, number][] {
  if (!Array.isArray(owners)) return [];
  return owners.filter(
    (pair): pair is [string, number] =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === 'string' &&
      typeof pair[1] === 'number',
  );
}

function isResumable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const { setup, game } = value as Partial<SavedGame>;

  if (!setup || !Array.isArray(setup.opponents) || typeof setup.playerName !== 'string') {
    return false;
  }
  if (setup.opponentNames !== undefined &&
      (!Array.isArray(setup.opponentNames) || setup.opponentNames.length !== setup.opponents.length ||
       !setup.opponentNames.every((name) => typeof name === 'string' && name.length > 0))) {
    return false;
  }
  if (setup.opponentRatings !== undefined &&
      (!Array.isArray(setup.opponentRatings) || setup.opponentRatings.length !== setup.opponents.length ||
       !setup.opponentRatings.every((rating) => Number.isFinite(rating) && rating >= 800 && rating <= 1600))) {
    return false;
  }
  if (!game || typeof game !== 'object') return false;
  // Només es reprenen partides a mig jugar: una d'acabada ja no té continuació.
  if (game.status !== 'playing') return false;
  if (!Array.isArray(game.bag) || !Array.isArray(game.board)) return false;
  if (!Array.isArray(game.players) || game.players.length < 2) return false;
  if (!game.players.every((player) => player && Array.isArray(player.rack))) return false;
  if (typeof game.currentPlayer !== 'number') return false;
  return game.currentPlayer >= 0 && game.currentPlayer < game.players.length;
}
