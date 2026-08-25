import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '@remigi/core';

/**
 * El nivell «amb nom» del jugador: el nivell de bot amb l'habilitat més
 * propera a la seva. És el mateix criteri que fa servir el motor per proposar
 * rivals, empat inclòs: en cas de dubte, el més fluix (val més quedar-se curt
 * que passar-se).
 */
export function playerLevelKey(rating: number): DifficultyKey {
  let best: DifficultyKey = DIFFICULTY_ORDER[0];
  for (const key of DIFFICULTY_ORDER) {
    if (Math.abs(DIFFICULTIES[key].rating - rating) < Math.abs(DIFFICULTIES[best].rating - rating)) {
      best = key;
    }
  }
  return best;
}

/** L'etiqueta del nivell del jugador: «Novell», «Fàcil»… */
export function playerLevelLabel(rating: number): string {
  return DIFFICULTIES[playerLevelKey(rating)].label;
}
