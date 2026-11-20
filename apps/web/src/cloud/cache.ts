/**
 * Memòria dels rànquings al mateix aparell durant uns minuts: tornar a obrir
 * la pantalla del dia no torna a llegir Firestore (cada lectura compta per a
 * la quota gratuïta). Quan el jugador puja el seu resultat, s'esborra
 * (`clearRankingCache`) perquè es vegi de seguida.
 */

/** Quant de temps val un rànquing desat. */
export const RANKING_TTL_MS = 10 * 60_000;

const PREFIX = 'remigi:ranquing:';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function storage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** El valor desat si encara és vigent; si no, null. */
export function readCache<T>(key: string, now = Date.now(), store: Store | null = storage()): T | null {
  try {
    const raw = store?.getItem(PREFIX + key);
    if (!raw) return null;
    const box = JSON.parse(raw) as { at?: unknown; value?: unknown };
    if (typeof box.at !== 'number' || now - box.at > RANKING_TTL_MS || now < box.at) return null;
    return box.value as T;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown, now = Date.now(), store: Store | null = storage()): void {
  try {
    store?.setItem(PREFIX + key, JSON.stringify({ at: now, value }));
  } catch {
    // Sense emmagatzematge, simplement es tornarà a llegir.
  }
}

/** Esborra tots els rànquings desats (el jugador acaba de pujar el seu resultat). */
export function clearRankingCache(store: Store | null = storage()): void {
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // No passa res: caducaran sols.
  }
}

/** Fa servir el valor desat o, si no n'hi ha, el va a buscar i el desa. */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  writeCache(key, value);
  return value;
}
