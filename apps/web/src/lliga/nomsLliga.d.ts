/* Tipus de `nomsLliga.js` (còpia de `nomslliga.js` d'El Tauler). */
import type { LeagueHome, TerritoryId } from './localitats';

export interface PersonName {
  name: string;
  given: string;
  surname: string;
  culture: string;
}

export const DIVERSITY_BY_LEVEL: readonly number[];
export const FAMOUS: ReadonlySet<string>;

export function fold(text: unknown): string;
export function countryCulture(name: string): string | null;
export function makeName(code: string, random?: () => number): PersonName;
export function cultureFor(
  level: number,
  home: LeagueHome | null,
  origin: string,
  options?: { random?: () => number; territoryOf?: (city: string) => TerritoryId | null },
): string;
/**
 * Noms dels rivals d'una lliga nova (nivell 0 municipal … 6 mundial): tots
 * diferents i, si es pot, sense repetir nom de pila ni cognom.
 */
export function rivalNames(
  level: number,
  home: LeagueHome | null,
  origins: readonly string[],
  options?: {
    random?: () => number;
    count?: number;
    exclude?: readonly string[];
    territoryOf?: (city: string) => TerritoryId | null;
  },
): string[];
