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
  /** Si sap reordenar completament la taula per encabir-hi més fitxes. */
  rearrangesTable: boolean;
  /**
   * Proporció de torns en què fa servir la reordenació (0–1), si en sap. És el
   * que més pesa en la força d'un bot: un rival que no reordena mai perd totes
   * les partides contra un que sempre ho fa, així que aquest valor gradua el
   * salt entre nivells en comptes de fer-lo de cop.
   */
  rearrangeRate: number;
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
    rearrangeRate: 0,
  },
  easy: {
    key: 'easy',
    label: 'Fàcil',
    rating: 1000,
    mistakeRate: 0.2,
    extendsBoard: false,
    usesJokers: true,
    rearrangesTable: false,
    rearrangeRate: 0,
  },
  medium: {
    key: 'medium',
    label: 'Mitjà',
    rating: 1200,
    mistakeRate: 0.1,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: false,
    rearrangeRate: 0,
  },
  advanced: {
    key: 'advanced',
    label: 'Avançat',
    rating: 1400,
    mistakeRate: 0.04,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: true,
    rearrangeRate: 0.2,
  },
  expert: {
    key: 'expert',
    label: 'Expert',
    rating: 1600,
    mistakeRate: 0,
    extendsBoard: true,
    usesJokers: true,
    rearrangesTable: true,
    rearrangeRate: 1,
  },
};

/** Nivells ordenats de més fluix a més fort. */
export const DIFFICULTY_ORDER: DifficultyKey[] = ['rookie', 'easy', 'medium', 'advanced', 'expert'];

export const DEFAULT_DIFFICULTY: DifficultyKey = 'medium';

export function difficultyByKey(key: string | undefined): AiParams {
  return DIFFICULTIES[(key ?? DEFAULT_DIFFICULTY) as DifficultyKey] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

/**
 * Aplica substitucions de paràmetres a un nivell. Una substitució que només
 * diu `rearrangesTable` (sense `rearrangeRate`) es llegeix com abans que
 * existís la proporció: `true` vol dir reordenar sempre i `false`, mai.
 */
export function withOverrides(base: AiParams, overrides: Partial<AiParams> = {}): AiParams {
  const params = { ...base, ...overrides };
  if (overrides.rearrangesTable !== undefined && overrides.rearrangeRate === undefined) {
    params.rearrangeRate = overrides.rearrangesTable ? 1 : 0;
  }
  return params;
}
