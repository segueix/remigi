import type { GameState, Move } from '../src/core/types';

/**
 * Empremtes de trajectòria per al test de regressió comportamental del motor.
 *
 * Una partida sencera es redueix a una empremta compacta: la seqüència de
 * moviments (P jugar, D robar) i un hash de la composició exacta de cada
 * proposta de taula. Si el motor refactoritzat produís una jugada diferent en
 * qualsevol torn de qualsevol partida de referència, l'empremta canviaria.
 *
 * El baseline (`test/fixtures/engine-baseline.json`) es va generar amb el codi
 * ANTERIOR a la refactorització del motor, cridant `decideAiMove` directament.
 * Regenerar-lo és acceptar un canvi de comportament a consciència.
 */

export interface GameFingerprint {
  /** Nivell del jugador sota prova (jugador 0). */
  level: string;
  seed: number;
  turns: number;
  /** Índex del guanyador dins de `players`, o -1 si no n'hi ha. */
  winner: number;
  finalScores: number[];
  /** Un caràcter per decisió: P (jugar) o D (robar/passar). */
  moveTypes: string;
  /** FNV-1a de 64 bits sobre el detall de cada decisió. */
  trajectoryHash: string;
}

/** Acumulador d'una partida en curs. */
export interface TrajectoryAccumulator {
  record(state: GameState, playerIndex: number, move: Move): void;
  moveTypes(): string;
  hash(): string;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function createTrajectoryAccumulator(): TrajectoryAccumulator {
  let hash = FNV_OFFSET;
  let types = '';

  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= BigInt(text.charCodeAt(i));
      hash = (hash * FNV_PRIME) & MASK_64;
    }
  };

  return {
    record(state, playerIndex, move) {
      types += move.type === 'play' ? 'P' : 'D';
      const detail =
        move.type === 'play'
          ? move.board.map((meld) => meld.map((tile) => tile.id).join('.')).join('/')
          : '';
      mix(`${state.turn}|${playerIndex}|${move.type}|${detail}\n`);
    },
    moveTypes: () => types,
    hash: () => hash.toString(16).padStart(16, '0'),
  };
}

/** Llavors i nivells del baseline: prou variats per cobrir tots els camins. */
export const BASELINE_LEVELS = ['rookie', 'easy', 'medium', 'advanced', 'expert'] as const;
export const BASELINE_SEEDS = [101, 202, 303, 404, 505] as const;

/** Rivals de cada partida de referència: el nivell sota prova, un mitjà i un novell. */
export function baselinePlayers(level: string): { name: string; kind: 'ai'; aiLevel: string }[] {
  return [
    { name: 'Provat', kind: 'ai', aiLevel: level },
    { name: 'Mitja', kind: 'ai', aiLevel: 'medium' },
    { name: 'Novell', kind: 'ai', aiLevel: 'rookie' },
  ];
}
