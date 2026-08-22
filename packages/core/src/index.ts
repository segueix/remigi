// API pública de @rummikub/core. L'app web (Fase 2) importarà d'aquí.
// (jsonFileStore.ts s'importa a banda, expressament, perquè depèn de Node.)

export * from './core/types';
export * from './core/constants';
export * from './core/random';
export * from './core/tiles';
export * from './core/melds';
export * from './core/board';
export * from './core/game';
export * from './core/scoring';

export * from './ai/difficulty';
export * from './ai/solver';
export * from './ai/rearrange';
export * from './ai/aiPlayer';

export * from './adaptive/rating';
export * from './adaptive/experience';
export * from './adaptive/adaptiveDifficulty';

export * from './persistence/storage';
export * from './persistence/profiles';
