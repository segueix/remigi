import { useCallback, useSyncExternalStore } from 'react';

/**
 * El temps que tens per jugar cada torn. És una preferència del dispositiu,
 * com l'aspecte de les fitxes: viu a localStorage i s'aplica de seguida, també
 * a la partida que ja estàs jugant.
 *
 * `null` vol dir sense límit, per a qui prefereix pensar-s'ho tant com vulgui.
 */
export type TurnSeconds = number | null;

const KEY = 'remigi:temps-torn';

/** Les durades que ofereix el menú. */
export const TURN_OPTIONS = [30, 60, 120] as const;

/** Amb quant es juga si no s'ha triat res: un minut, ni curt ni etern. */
export const DEFAULT_TURN_SECONDS = 60;

/** Marges de seguretat per a un valor desat: ni un rellotge impossible ni etern. */
const MIN_SECONDS = 5;
const MAX_SECONDS = 600;

/**
 * Llegeix la preferència desada. El menú només n'escriu quatre valors, però
 * aquí s'accepta qualsevol durada raonable: una partida desada amb una altra
 * durada (una versió futura, una prova) s'ha de poder continuar tal com era,
 * i el que no té sentit cau al valor per defecte.
 */
export function readTurnSeconds(raw: string | null): TurnSeconds {
  if (raw === 'cap') return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds)) return DEFAULT_TURN_SECONDS;
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) return DEFAULT_TURN_SECONDS;
  return seconds;
}

/*
 * Un sol valor per a tota l'app: el menú de la partida i la configuració del
 * perfil el canvien i el rellotge de la taula el llegeix, encara que la partida
 * quedi oberta (amagada) mentre es mira el perfil.
 */
const listeners = new Set<() => void>();
let current: TurnSeconds | undefined;

function getTurnSeconds(): TurnSeconds {
  if (current === undefined) {
    try {
      current = readTurnSeconds(localStorage.getItem(KEY));
    } catch {
      current = DEFAULT_TURN_SECONDS;
    }
  }
  return current;
}

function setTurnSeconds(next: TurnSeconds): void {
  current = next;
  try {
    localStorage.setItem(KEY, next === null ? 'cap' : String(next));
  } catch {
    // Sense emmagatzematge, la tria dura mentre duri la pestanya.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTurnSeconds(): [TurnSeconds, (seconds: TurnSeconds) => void] {
  const seconds = useSyncExternalStore(subscribe, getTurnSeconds, () => DEFAULT_TURN_SECONDS);
  const set = useCallback((next: TurnSeconds) => setTurnSeconds(next), []);
  return [seconds, set];
}

/** Per a les proves: oblida el valor llegit (es tornarà a llegir de localStorage). */
export function resetTurnSecondsCache(): void {
  current = undefined;
}
