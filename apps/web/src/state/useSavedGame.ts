import { type KeyValueStore } from '@remigi/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameMode } from '../game/useGame';
import { createWebStore } from '../storage/webStore';
import { clearGame, loadGame, saveGame, type SavedGame } from './savedGame';

/** El desat de la partida d'un mode, tal com el fa servir la pantalla de joc. */
export interface SavedGameHandle {
  /** Partida a mig jugar que s'ofereix de continuar, si n'hi ha. */
  saved: SavedGame | null;
  loading: boolean;
  /** Desa l'estat actual (es crida a cada moviment). */
  persist(saved: SavedGame): void;
  /** Esborra la partida desada: ja no hi ha res a continuar. */
  clear(): void;
  /** Torna a mirar què hi ha desat. */
  refresh(): void;
}

export interface SavedGamesHandle {
  loading: boolean;
  /** La partida a mitges de cada mode (el joc lliure, el repte i la lliga). */
  saved: Record<GameMode, SavedGame | null>;
  persist(mode: GameMode, saved: SavedGame): void;
  clear(mode: GameMode): void;
  /** El desat d'un sol mode, per a la pantalla de joc. */
  forMode(mode: GameMode): SavedGameHandle;
  /** Llegeix ara mateix la partida desada d'un mode (en començar a jugar-hi). */
  load(mode: GameMode): Promise<SavedGame | null>;
  /** Torna a mirar què hi ha desat de tots els modes (en tornar a l'inici). */
  refresh(): void;
}

const MODES: GameMode[] = ['lliure', 'repte', 'lliga'];
const EMPTY: Record<GameMode, SavedGame | null> = { lliure: null, repte: null, lliga: null };

export function useSavedGames(): SavedGamesHandle {
  const store: KeyValueStore = useMemo(() => createWebStore(), []);
  const [saved, setSaved] = useState<Record<GameMode, SavedGame | null>>(EMPTY);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(
    () =>
      Promise.all(MODES.map((mode) => loadGame(store, mode))).then(([lliure, repte, lliga]) => ({
        lliure,
        repte,
        lliga,
      })),
    [store],
  );

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((found) => {
        if (!cancelled) setSaved(found);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  /*
   * Desar no toca l'estat de React: la partida es desa a cada moviment i
   * repintar l'app sencera cada cop no serviria de res. L'estat només
   * reflecteix el que hi havia en obrir-la i el que s'esborra.
   */
  const persist = useCallback(
    (mode: GameMode, next: SavedGame) => {
      void saveGame(store, next, mode);
    },
    [store],
  );

  const clear = useCallback(
    (mode: GameMode) => {
      setSaved((current) => (current[mode] ? { ...current, [mode]: null } : current));
      void clearGame(store, mode);
    },
    [store],
  );

  const refresh = useCallback(() => {
    void loadAll().then(setSaved);
  }, [loadAll]);

  /*
   * Les funcions de cada mode són estables: la pantalla de joc les té a les
   * dependències de l'efecte que desa, i no han de canviar a cada render.
   */
  const perMode = useMemo(
    () =>
      Object.fromEntries(
        MODES.map((mode) => [
          mode,
          { persist: (next: SavedGame) => persist(mode, next), clear: () => clear(mode) },
        ]),
      ) as Record<GameMode, Pick<SavedGameHandle, 'persist' | 'clear'>>,
    [persist, clear],
  );

  const forMode = useCallback(
    (mode: GameMode): SavedGameHandle => ({ saved: saved[mode], loading, ...perMode[mode], refresh }),
    [saved, loading, perMode, refresh],
  );

  const load = useCallback((mode: GameMode) => loadGame(store, mode), [store]);

  return { loading, saved, persist, clear, forMode, load, refresh };
}
