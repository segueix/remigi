import { describe, expect, it } from 'vitest';
import { migrateOldStorage } from './migrate';

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('migració de les claus del nom antic', () => {
  it('copia el perfil i la partida a les claus noves i esborra les velles', () => {
    const storage = fakeStorage({
      'rummikub:profile:local': '{"name":"Anna"}',
      'rummikub:game': '{"turn":3}',
    });
    migrateOldStorage(storage);
    expect(storage.getItem('remigi:profile:local')).toBe('{"name":"Anna"}');
    expect(storage.getItem('remigi:game')).toBe('{"turn":3}');
    expect(storage.getItem('rummikub:profile:local')).toBeNull();
    expect(storage.getItem('rummikub:game')).toBeNull();
  });

  it('no trepitja mai una clau nova que ja existeix', () => {
    const storage = fakeStorage({
      'rummikub:profile:local': '{"name":"Vella"}',
      'remigi:profile:local': '{"name":"Nova"}',
    });
    migrateOldStorage(storage);
    expect(storage.getItem('remigi:profile:local')).toBe('{"name":"Nova"}');
    expect(storage.getItem('rummikub:profile:local')).toBeNull();
  });

  it('amb un navegador net no fa res', () => {
    const storage = fakeStorage({});
    migrateOldStorage(storage);
    expect(storage.data.size).toBe(0);
  });
});
