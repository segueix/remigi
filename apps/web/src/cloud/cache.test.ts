import { describe, expect, it } from 'vitest';
import { RANKING_TTL_MS, clearRankingCache, readCache, writeCache } from './cache';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    map,
  };
}

describe('memòria dels rànquings', () => {
  it('val 10 minuts', () => {
    const store = memoryStore();
    writeCache('dia:2026-11-20', [1, 2], 1000, store);
    expect(readCache('dia:2026-11-20', 1000 + RANKING_TTL_MS, store)).toEqual([1, 2]);
    expect(readCache('dia:2026-11-20', 1001 + RANKING_TTL_MS, store)).toBeNull();
  });

  it('s’esborra quan puges el resultat, sense tocar res més', () => {
    const store = memoryStore();
    writeCache('dia:x', 1, 0, store);
    writeCache('ratxes:x', 2, 0, store);
    store.setItem('remigi:profile:local', 'perfil');
    clearRankingCache(store);
    expect(readCache('dia:x', 0, store)).toBeNull();
    expect(readCache('ratxes:x', 0, store)).toBeNull();
    expect(store.getItem('remigi:profile:local')).toBe('perfil');
  });
});

import { UPLOAD_EVERY_MS, uploadDelay } from './useCloudSync';

describe('pujar el nivell i la lliga', () => {
  it('com a molt un cop cada 30 minuts', () => {
    expect(uploadDelay(null, 1_000)).toBe(2000);
    const at = 1_000_000;
    expect(uploadDelay(at, at + 60_000)).toBe(UPLOAD_EVERY_MS - 60_000);
    expect(uploadDelay(at, at + UPLOAD_EVERY_MS + 1)).toBe(2000);
  });
});
