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
/** Un nom fet amb un nom i un cognom castellans (García, Martínez...). */
export function isCastilianName(name: string): boolean;
/**
 * El nom d'un rival d'una temporada ja començada, sense res de castellà a les
 * lligues dels Països Catalans (nivells 0-4): un nom castellà en dona un de nou
 * del territori (cap dels de `taken`, que s'hi afegeix) i les formes
 * castellanes d'abans passen a la catalana. A Europa, al món i per a qui juga
 * des de fora, el nom no es toca.
 */
export function catalanRivalName(
  name: string,
  level: number,
  home: LeagueHome | null,
  origin: string | null,
  options?: {
    random?: () => number;
    taken?: Set<string>;
    territoryOf?: (city: string) => TerritoryId | null;
  },
): string;
/** Formes castellanes d'abans entre els noms dels territoris → la catalana. */
export const CATALAN_FORMS: Readonly<Record<string, string>>;
/** Cultures del castellà, que no surten a les lligues dels Països Catalans. */
export const CASTILIAN_CULTURES: readonly string[];
export const DIVERSE: Readonly<Record<string, readonly (readonly [string, number])[]>>;
export const TERRITORY_CULTURE: Readonly<Record<string, string>>;
export const CULTURES: Readonly<Record<string, { f: string[]; m: string[]; s?: string[]; sf?: string[]; sm?: string[]; order?: string }>>;
