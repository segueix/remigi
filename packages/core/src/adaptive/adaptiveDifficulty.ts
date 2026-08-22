import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '../ai/difficulty';
import type { PlayerProfile } from './experience';

/**
 * Tria automàtica dels oponents segons l'experiència del jugador: el nivell
 * principal és el que té la valoració més propera a la del perfil, de manera que
 * les partides tendeixin a un 50% de victòries. Amb més d'un oponent, es
 * dispersen un nivell amunt i avall perquè la partida sigui variada sense deixar
 * de ser equilibrada.
 */
export function suggestOpponents(profile: PlayerProfile, count: 1 | 2 | 3): DifficultyKey[] {
  const mainIndex = closestDifficultyIndex(profile.rating);
  if (count === 1) return [difficultyAt(mainIndex)];
  if (count === 2) return [difficultyAt(mainIndex - 1), difficultyAt(mainIndex)];
  return [difficultyAt(mainIndex - 1), difficultyAt(mainIndex), difficultyAt(mainIndex + 1)];
}

function closestDifficultyIndex(rating: number): number {
  let best = 0;
  DIFFICULTY_ORDER.forEach((key, index) => {
    const current = Math.abs(DIFFICULTIES[key].rating - rating);
    const bestDistance = Math.abs(DIFFICULTIES[DIFFICULTY_ORDER[best]].rating - rating);
    if (current < bestDistance) best = index;
  });
  return best;
}

function difficultyAt(index: number): DifficultyKey {
  const clamped = Math.min(DIFFICULTY_ORDER.length - 1, Math.max(0, index));
  return DIFFICULTY_ORDER[clamped];
}

/** Text curt per explicar la tria a la interfície. */
export function describeSuggestion(keys: DifficultyKey[]): string {
  const labels = keys.map((key) => DIFFICULTIES[key].label);
  return `Oponents proposats segons la teva experiència: ${labels.join(', ')}`;
}
