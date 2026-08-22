import { MAX_GROUP_SIZE, MAX_VALUE, MIN_MELD_SIZE, MIN_VALUE } from './constants';
import { isNumberTile } from './tiles';
import type { Meld, NumberTile } from './types';

export type MeldKind = 'group' | 'run';

export interface MeldInfo {
  valid: boolean;
  kind?: MeldKind;
  /** Punts de la jugada (els jokers valen el número que substitueixen). 0 si no és vàlida. */
  points: number;
  /** Motiu de la invalidesa, en català, pensat per mostrar-lo a la interfície. */
  reason?: string;
}

/**
 * Analitza una jugada. Nota: en una escala l'ordre de les fitxes és el que compta
 * (un joker val el número de la posició on és). Si una jugada amb jokers es pot
 * llegir com a grup i com a escala alhora, es tria la interpretació de més punts.
 */
export function analyzeMeld(meld: Meld): MeldInfo {
  if (meld.length < MIN_MELD_SIZE) {
    return { valid: false, points: 0, reason: `una jugada necessita com a mínim ${MIN_MELD_SIZE} fitxes` };
  }
  const numbers = meld.filter(isNumberTile);
  if (numbers.length === 0) {
    return { valid: false, points: 0, reason: 'una jugada no pot ser només de jokers' };
  }

  const asGroup = analyzeAsGroup(meld, numbers);
  const asRun = analyzeAsRun(meld);
  if (asGroup && asRun) return asGroup.points >= asRun.points ? asGroup : asRun;
  if (asGroup) return asGroup;
  if (asRun) return asRun;
  return {
    valid: false,
    points: 0,
    reason: 'ni és un grup (mateix número, colors diferents) ni una escala (mateix color, números consecutius)',
  };
}

/** Grup: 3 o 4 fitxes del mateix número, totes de colors diferents. */
function analyzeAsGroup(meld: Meld, numbers: NumberTile[]): MeldInfo | null {
  if (meld.length > MAX_GROUP_SIZE) return null;
  const value = numbers[0].value;
  if (!numbers.every((t) => t.value === value)) return null;
  const colors = new Set(numbers.map((t) => t.color));
  if (colors.size !== numbers.length) return null;
  return { valid: true, kind: 'group', points: value * meld.length };
}

/** Escala: 3 o més fitxes del mateix color amb números consecutius. */
function analyzeAsRun(meld: Meld): MeldInfo | null {
  const anchorIndex = meld.findIndex(isNumberTile);
  const anchor = meld[anchorIndex] as NumberTile;
  // El valor de cada posició queda fixat per la primera fitxa numerada.
  const base = anchor.value - anchorIndex;
  if (base < MIN_VALUE || base + meld.length - 1 > MAX_VALUE) return null;
  for (let i = 0; i < meld.length; i++) {
    const tile = meld[i];
    if (isNumberTile(tile) && (tile.color !== anchor.color || tile.value !== base + i)) return null;
  }
  let points = 0;
  for (let i = 0; i < meld.length; i++) points += base + i;
  return { valid: true, kind: 'run', points };
}

export function isValidMeld(meld: Meld): boolean {
  return analyzeMeld(meld).valid;
}

export function meldPoints(meld: Meld): number {
  return analyzeMeld(meld).points;
}
