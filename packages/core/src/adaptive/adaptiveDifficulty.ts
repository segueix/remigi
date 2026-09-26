import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '../ai/difficulty';
import type { PlayerProfile } from './experience';

/**
 * El nivell adaptatiu es mou en mig graons:
 * 0 = Novell, 1 = entre Novell i Fàcil, 2 = Fàcil, ... 8 = Expert.
 *
 * Durant la primera calibració només es fan servir graons sencers: una victòria
 * puja directament al nivell següent. Quan arriba la primera derrota, el sistema
 * passa a l'ajust fi i cada resultat mou només mig graó.
 */
export const MAX_ADAPTIVE_STEP = (DIFFICULTY_ORDER.length - 1) * 2;

function clampStep(step: number): number {
  return Math.min(MAX_ADAPTIVE_STEP, Math.max(0, Math.round(step)));
}

/**
 * Perfils nous porten el graó explícit. Els perfils antics, que no el tenen,
 * es col·loquen segons el seu Elo perquè no perdin el nivell acumulat.
 */
export function adaptiveStepFor(profile: PlayerProfile): number {
  if (typeof profile.adaptiveStep === 'number') return clampStep(profile.adaptiveStep);

  const first = DIFFICULTIES[DIFFICULTY_ORDER[0]].rating;
  const second = DIFFICULTIES[DIFFICULTY_ORDER[1]].rating;
  const halfLevel = Math.max(1, (second - first) / 2);
  return clampStep((profile.rating - first) / halfLevel);
}

/** Els perfils antics entren directament en ajust fi; només els nous calibren. */
export function isCalibrating(profile: PlayerProfile): boolean {
  return profile.adaptiveCalibrating === true;
}

/**
 * Calcula el pròxim punt del nivell adaptatiu.
 *
 * - calibració: victòria = +1 nivell sencer; primera derrota = mig nivell avall
 *   i s'acaba la calibració;
 * - ajust fi: victòria = +mig nivell; derrota = -mig nivell.
 *
 * Això fa que, després de trobar el primer nivell massa fort, la dificultat
 * oscil·li al voltant del llindar real del jugador i pugui tornar a pujar quan
 * encadena resultats bons.
 */
export function nextAdaptiveProgress(
  profile: PlayerProfile,
  won: boolean,
): { adaptiveStep: number; adaptiveCalibrating: boolean } {
  const current = adaptiveStepFor(profile);

  if (isCalibrating(profile)) {
    if (won) {
      return {
        adaptiveStep: clampStep(current + 2),
        adaptiveCalibrating: true,
      };
    }
    return {
      adaptiveStep: clampStep(current - 1),
      adaptiveCalibrating: false,
    };
  }

  return {
    adaptiveStep: clampStep(current + (won ? 1 : -1)),
    adaptiveCalibrating: false,
  };
}

function difficultyAt(index: number): DifficultyKey {
  const clamped = Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, index));
  return DIFFICULTY_ORDER[clamped];
}

/**
 * Converteix un mig graó en rivals.
 *
 * En un graó sencer tots els rivals tenen el mateix nivell. En un mig graó,
 * amb dos rivals —el mode per defecte— n'hi ha un del nivell inferior i un del
 * superior. Amb un sol rival s'alternen els dos nivells entre partides; amb
 * tres, s'alterna quin dels dos es repeteix perquè la mitjana no quedi sempre
 * esbiaixada cap al mateix costat.
 */
function opponentsForStep(
  step: number,
  count: 1 | 2 | 3,
  gamesPlayed: number,
): DifficultyKey[] {
  const clamped = clampStep(step);
  const lowerIndex = Math.floor(clamped / 2);
  const lower = difficultyAt(lowerIndex);

  if (clamped % 2 === 0 || lowerIndex >= DIFFICULTY_ORDER.length - 1) {
    return Array.from({ length: count }, () => lower);
  }

  const upper = difficultyAt(lowerIndex + 1);
  if (count === 1) return [gamesPlayed % 2 === 0 ? lower : upper];
  if (count === 2) return [lower, upper];

  return gamesPlayed % 2 === 0 ? [lower, lower, upper] : [lower, upper, upper];
}

/**
 * Tria automàtica dels rivals.
 *
 * Un perfil nou comença a Novell. Mentre guanya durant la calibració, puja
 * Novell → Fàcil → Mitjà → Avançat → Expert. A la primera derrota entra en
 * ajust fi i es mou en mig graons, de manera que vagi trobant un punt on no
 * guanyi ni perdi sempre però pugui continuar progressant.
 */
export function suggestOpponents(profile: PlayerProfile, count: 1 | 2 | 3): DifficultyKey[] {
  return opponentsForStep(adaptiveStepFor(profile), count, profile.gamesPlayed);
}

/** Text curt per explicar la tria a la interfície. */
export function describeSuggestion(keys: DifficultyKey[]): string {
  const labels = keys.map((key) => DIFFICULTIES[key].label);
  return `Nivell adaptatiu: ${labels.join(', ')}`;
}
