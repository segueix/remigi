import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWebStore } from '../storage/webStore';

export interface PersistedHandle<T> {
  /** El valor; `null` mentre es carrega. */
  value: T | null;
  /** Canvia el valor i el desa (amb una funció, a partir de l'actual). */
  update(next: T | ((current: T) => T)): T | null;
  /** El valor d'ara mateix, encara que el render no l'hagi vist. */
  get(): T | null;
}

/**
 * Un valor desat al navegador sota una clau, amb la seva validació: el que hi
 * ha desat no és de fiar (versions anteriors, dades malmeses), així que sempre
 * passa per `parse`, que ha de tornar un valor bo o el de partida.
 *
 * El valor viu també en una referència perquè `update` el pugui llegir i
 * retornar a l'instant: qui registra un resultat necessita l'estat nou al
 * moment, no al render següent.
 */
export function usePersisted<T>(key: string, parse: (raw: string | null) => T): PersistedHandle<T> {
  const store = useMemo(() => createWebStore(), []);
  const [value, setValue] = useState<T | null>(null);
  const ref = useRef<T | null>(null);
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    let cancelled = false;
    void store.get(key).then((raw) => {
      if (cancelled) return;
      const parsed = parseRef.current(raw);
      ref.current = parsed;
      setValue(parsed);
    });
    return () => {
      cancelled = true;
    };
  }, [store, key]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = ref.current;
      if (current === null) return null;
      const value = typeof next === 'function' ? (next as (current: T) => T)(current) : next;
      if (value === current) return current;
      ref.current = value;
      setValue(value);
      void store.set(key, JSON.stringify(value));
      return value;
    },
    [store, key],
  );

  const get = useCallback(() => ref.current, []);

  return { value, update, get };
}
