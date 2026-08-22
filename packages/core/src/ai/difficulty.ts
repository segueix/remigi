/**
 * Nivells de dificultat de la IA. Tots els nivells fan servir el mateix cercador
 * de jugades (solver.ts); el que canvia són els paràmetres que el limiten o hi
 * introdueixen errors "humans". Això fa fàcil afegir nivells intermedis o ajustar
 * la corba de dificultat sense tocar la lògica.
 */
export type DifficultyKey = 'rookie' | 'easy' | 'medium' | 'advanced' | 'expert';

export interface AiParams {
  key: DifficultyKey;
  /** Nom per ensenyar a la interfície. */
  label: string;
  /** Valoració Elo del nivell, per encaixar-lo amb l'habilitat del jugador. */
  rating: number;
  /** Probabilitat de "no veure" la millor jugada del torn i robar fitxa. */
  mistakeRate: number;
  /** Si sap allargar les jugades que ja hi ha a la taula. */
  extendsBoard: boolean;
  /** Si està disposat a jugar els jokers de la mà (els nivells baixos se'ls guarden). */
  usesJokers: boolean;
  /**
   * Reservat per a la fase següent del solver: reordenar completament la taula
   * per encabir-hi més fitxes. Encara no implementat (vegeu docs/ARQUITECTURA.md).
   */
  rearrangesTable: boolean;
}

export const DIFFICULTIES: Record<DifficultyKey, AiParams> = {
  rookie: {
    key: 'rookie',
    label: 'Novell',
    rating: 800,
    mistakeRate: 0.35,
    extendsBoard: false,
    usesJokers: false,
    rearrangesTable: false,
  },
  easy: {
    key: 'easy',
    label: 'Fàcil',
    rating: 1000,
    mistakeRate: 0.2,
    extendsBoard: false,
    usesJokers: true,
    rearrangesTable: false,
  },
  medium: {
    key: 'medium',
    label: 'Mitjà',
    rating: 1200,
    mistakeRate: 0.1,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: false,
  },
  advanced: {
    key: 'advanced',
    label: 'Avançat',
    rating: 1400,
    mistakeRate: 0.04,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: false,
  },
  expert: {
    key: 'expert',
    label: 'Expert',
    rating: 1600,
    mistakeRate: 0,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: true,
  },
};

/** Nivells ordenats de més fluix a més fort. */
export const DIFFICULTY_ORDER: DifficultyKey[] = ['rookie', 'easy', 'medium', 'advanced', 'expert'];

export const DEFAULT_DIFFICULTY: DifficultyKey = 'medium';

export function difficultyByKey(key: string | undefined): AiParams {
  return DIFFICULTIES[(key ?? DEFAULT_DIFFICULTY) as DifficultyKey] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}
