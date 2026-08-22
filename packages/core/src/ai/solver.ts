import { COLORS, INITIAL_MELD_POINTS, MAX_GROUP_SIZE, MAX_VALUE, MIN_MELD_SIZE, MIN_VALUE } from '../core/constants';
import { analyzeMeld } from '../core/melds';
import { isJoker, isNumberTile } from '../core/tiles';
import type { GameState, Meld, NumberTile, Tile, TileColor } from '../core/types';

/**
 * Cercador de jugades. És una heurística voraç: en aquesta fase no busca la
 * combinació òptima ni reordena la taula sencera (està apuntat com a millora al
 * full de ruta), però juga prou bé per als nivells actuals.
 */

export interface SolverOptions {
  /** Si pot fer servir els jokers de la mà. */
  allowJokers: boolean;
  /** Si pot allargar jugades que ja són a la taula. */
  allowExtensions: boolean;
}

export interface PlayCandidate {
  /** Proposta completa de taula nova (el format del moviment 'play'). */
  board: Meld[];
  /** Quantes fitxes de la mà fa servir. */
  tilesUsed: number;
  /** Punts de les jugades noves baixades de la mà (criteri de la sortida inicial). */
  points: number;
}

interface MeldCandidate {
  meld: Meld;
  points: number;
}

/** Enumera jugades completes (grups i escales) que es poden fer només amb la mà. */
export function findRackMelds(rack: Tile[], allowJokers: boolean): MeldCandidate[] {
  const jokers = allowJokers ? rack.filter(isJoker) : [];
  const numbers = rack.filter(isNumberTile);
  const candidates: MeldCandidate[] = [];

  // Grups: per a cada número, una fitxa de cada color disponible + jokers.
  for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
    const byColor = new Map<TileColor, NumberTile>();
    for (const tile of numbers) {
      if (tile.value === value && !byColor.has(tile.color)) byColor.set(tile.color, tile);
    }
    for (const colorSubset of subsets([...byColor.values()])) {
      if (colorSubset.length === 0) continue;
      for (let jokerCount = 0; jokerCount <= jokers.length; jokerCount++) {
        const size = colorSubset.length + jokerCount;
        if (size < MIN_MELD_SIZE || size > MAX_GROUP_SIZE) continue;
        pushCandidate(candidates, [...colorSubset, ...jokers.slice(0, jokerCount)]);
      }
    }
  }

  // Escales: per a cada color, totes les finestres de valors consecutius que es
  // puguin omplir amb els jokers disponibles (heurística: extrems sempre reals).
  for (const color of COLORS) {
    const byValue = new Map<number, NumberTile>();
    for (const tile of numbers) {
      if (tile.color === color && !byValue.has(tile.value)) byValue.set(tile.value, tile);
    }
    for (let start = MIN_VALUE; start <= MAX_VALUE - MIN_MELD_SIZE + 1; start++) {
      if (!byValue.has(start)) continue;
      for (let end = start + MIN_MELD_SIZE - 1; end <= MAX_VALUE; end++) {
        if (!byValue.has(end)) continue;
        const meld: Meld = [];
        let jokersUsed = 0;
        for (let value = start; value <= end; value++) {
          const tile = byValue.get(value);
          if (tile) {
            meld.push(tile);
          } else if (jokersUsed < jokers.length) {
            meld.push(jokers[jokersUsed++]);
          }
        }
        if (meld.length === end - start + 1) pushCandidate(candidates, meld);
      }
    }
  }

  return candidates;
}

function pushCandidate(candidates: MeldCandidate[], meld: Meld): void {
  const info = analyzeMeld(meld);
  if (info.valid) candidates.push({ meld, points: info.points });
}

/** Tots els subconjunts d'una llista curta (aquí, com a màxim 4 fitxes). */
function subsets<T>(items: T[]): T[][] {
  const result: T[][] = [[]];
  for (const item of items) {
    const len = result.length;
    for (let i = 0; i < len; i++) result.push([...result[i], item]);
  }
  return result;
}

/**
 * Selecció voraç de jugades que no comparteixen fitxes, prioritzant desfer-se de
 * més fitxes ('tiles') o sumar més punts ('points', per a la sortida inicial).
 */
export function pickDisjointMelds(
  candidates: MeldCandidate[],
  prefer: 'tiles' | 'points',
): { melds: Meld[]; points: number } {
  const sorted = [...candidates].sort((a, b) =>
    prefer === 'tiles'
      ? b.meld.length - a.meld.length || b.points - a.points
      : b.points - a.points || b.meld.length - a.meld.length,
  );
  const used = new Set<string>();
  const melds: Meld[] = [];
  let points = 0;
  for (const candidate of sorted) {
    if (candidate.meld.some((t) => used.has(t.id))) continue;
    candidate.meld.forEach((t) => used.add(t.id));
    melds.push(candidate.meld);
    points += candidate.points;
  }
  return { melds, points };
}

/**
 * Prova d'allargar les jugades de la taula amb fitxes soltes de la mà (afegir el
 * quart color a un grup, o punxar un extrem d'una escala), repetidament fins que
 * no hi hagi cap més extensió possible.
 */
function extendBoardMelds(
  board: Meld[],
  rack: Tile[],
  allowJokers: boolean,
): { board: Meld[]; rack: Tile[]; used: number } {
  const melds = board.map((m) => [...m]);
  let rest = [...rack];
  let used = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < melds.length && !changed; i++) {
      for (const tile of rest) {
        if (isJoker(tile) && !allowJokers) continue;
        const extended = [
          [...melds[i], tile],
          [tile, ...melds[i]],
        ].find((m) => analyzeMeld(m).valid);
        if (extended) {
          melds[i] = extended;
          rest = rest.filter((t) => t.id !== tile.id);
          used++;
          changed = true;
          break;
        }
      }
    }
  }
  return { board: melds, rack: rest, used };
}

/**
 * Millor jugada trobada per al jugador, o null si no en té cap (i per tant ha de
 * robar). Té en compte si encara ha de fer la sortida inicial de 30 punts.
 */
export function chooseBestPlay(
  state: GameState,
  playerIndex: number,
  options: SolverOptions,
): PlayCandidate | null {
  const player = state.players[playerIndex];
  const candidates = findRackMelds(player.rack, options.allowJokers);

  if (!player.hasOpened) {
    const { melds, points } = pickDisjointMelds(candidates, 'points');
    if (points < INITIAL_MELD_POINTS) return null;
    return {
      board: [...state.board, ...melds],
      tilesUsed: melds.reduce((sum, m) => sum + m.length, 0),
      points,
    };
  }

  const { melds, points } = pickDisjointMelds(candidates, 'tiles');
  let board = [...state.board, ...melds];
  const usedIds = new Set(melds.flat().map((t) => t.id));
  let rack = player.rack.filter((t) => !usedIds.has(t.id));
  let tilesUsed = usedIds.size;

  if (options.allowExtensions) {
    const extended = extendBoardMelds(board, rack, options.allowJokers);
    board = extended.board;
    rack = extended.rack;
    tilesUsed += extended.used;
  }

  if (tilesUsed === 0) return null;
  return { board, tilesUsed, points };
}
