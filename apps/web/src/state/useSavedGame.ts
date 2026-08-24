import { type KeyValueStore } from '@remigi/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWebStore } from '../storage/webStore';
import { clearGame, loadGame, saveGame, type SavedGame } from './savedGame';

export interface SavedGameHandle {
  /** Partida a mig jugar que s'ofereix de continuar, si n'hi ha. */
  saved: SavedGame | null;
  loading: boolean;
  /** Desa l'estat actual (es crida a cada moviment). */
  persist(saved: SavedGame): void;
  /** Esborra la partida desada: ja no hi ha res a continuar. */
  clear(): void;
  /** Torna a mirar què hi ha desat (en tornar a la pantalla d'inici). */
  refresh(): void;
}

export function useSavedGame(): SavedGameHandle {
  const store: KeyValueStore = useMemo(() => createWebStore(), []);
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void loadGame(store).then(setSaved);
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    loadGame(store)
      .then((found) => {
        if (!cancelled) setSaved(found);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const persist = useCallback(
    (next: SavedGame) => {
      void saveGame(store, next);
    },
    [store],
  );

  const clear = useCallback(() => {
    setSaved(null);
    void clearGame(store);
  }, [store]);

  return { saved, loading, persist, clear, refresh };
}
