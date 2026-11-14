/* Tipus de `localitats.js` (còpia d'El Tauler). */

export type TerritoryId = 'cat' | 'val' | 'bal' | 'and' | 'nord' | 'franja' | 'alguer' | 'fora';

/** On juga el jugador: el que fa servir El Tauler a `chess_leagueCareer.home`. */
export interface LeagueHome {
  territory: TerritoryId;
  municipi: string;
  comarca: string;
  provincia: string;
  pais: string;
}

export interface Municipality {
  name: string;
  comarca: string;
  province: string;
  territory: TerritoryId;
}

export const TERRITORIES: readonly { id: TerritoryId; name: string }[];
export const CAT_COMARQUES: Readonly<Record<string, string>>;
export const CAT_PROVINCES: Readonly<Record<string, string>>;
export const PPCC_CITIES: readonly string[];
export const EUROPE: readonly string[];
export const WORLD: readonly string[];

export function fold(text: unknown): string;
export function bare(text: unknown): string;
export function territory(id: string): { id: TerritoryId; name: string } | null;
export function catalanMunicipalities(): Municipality[];
export function municipalities(territoryId: string): Municipality[];
export function comarques(territoryId: string): { name: string; province: string }[];
export function provinces(territoryId: string): string[];
export function provinceOfComarca(territoryId: string, comarca: string): string;
export function searchMunicipalities(
  query: string,
  options?: { territory?: string; limit?: number; minLength?: number },
): Municipality[];
export function findMunicipality(name: string, territoryId?: string): Municipality | null;
export function normalizeHome(input: Partial<LeagueHome> | null | undefined): LeagueHome | null;
/** D'on és cada rival segons el nivell (0 municipal … 6 mundial). */
export function rivalOrigins(
  level: number,
  home: LeagueHome | null,
  count: number,
  random?: () => number,
): string[];
export function ppccCityTerritory(city: string): TerritoryId | null;
/** Grup d'illes (Gimnèsies o Pitiüses) d'una illa de les Balears. */
export function islandGroup(island: string): { name: string; islands: string[] } | null;
/** Territori d'on és un rival: ciutat dels Països Catalans, o municipi de la Catalunya Nord o de Catalunya. */
export function originTerritory(place: string): TerritoryId | null;
