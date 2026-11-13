import { normalizeHome, type LeagueHome } from './localitats';

/**
 * Remigi viu a `eltauler.cat/remigi/`, al mateix origen que El Tauler, i per
 * això comparteixen `localStorage`. Si el jugador ja va dir a la lliga
 * d'escacs on juga (`chess_leagueCareer.home`), la lliga de Remigi ho aprofita
 * i no ho torna a preguntar. Només es llegeix: mai no s'hi escriu res.
 */
export const EL_TAULER_CAREER_KEY = 'chess_leagueCareer';

export function readElTaulerHome(storage: Pick<Storage, 'getItem'> | null | undefined): LeagueHome | null {
  try {
    const raw = storage?.getItem(EL_TAULER_CAREER_KEY);
    if (!raw) return null;
    const career: unknown = JSON.parse(raw);
    if (typeof career !== 'object' || career === null) return null;
    return normalizeHome((career as { home?: Partial<LeagueHome> }).home ?? null);
  } catch {
    return null;
  }
}
