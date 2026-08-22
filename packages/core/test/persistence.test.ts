import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProfile, recordGame } from '../src/adaptive/experience';
import { JsonFileStore } from '../src/persistence/jsonFileStore';
import { ProfileRepository } from '../src/persistence/profiles';
import { MemoryStore, type KeyValueStore } from '../src/persistence/storage';

/** Bateria comuna: qualsevol KeyValueStore s'ha de comportar igual. */
function describeStore(name: string, makeStore: () => KeyValueStore): void {
  describe(name, () => {
    it('retorna null per a una clau que no existeix', async () => {
      expect(await makeStore().get('cap')).toBeNull();
    });

    it('desa, sobreescriu i esborra', async () => {
      const store = makeStore();
      await store.set('k', 'primer');
      expect(await store.get('k')).toBe('primer');
      await store.set('k', 'segon');
      expect(await store.get('k')).toBe('segon');
      await store.remove('k');
      expect(await store.get('k')).toBeNull();
    });

    it('esborrar una clau inexistent no falla', async () => {
      await expect(makeStore().remove('cap')).resolves.toBeUndefined();
    });

    it('manté les claus independents', async () => {
      const store = makeStore();
      await store.set('a', '1');
      await store.set('b', '2');
      await store.remove('a');
      expect(await store.get('b')).toBe('2');
    });
  });
}

describeStore('MemoryStore', () => new MemoryStore());

describe('JsonFileStore', () => {
  let dir: string;
  let counter = 0;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rummikub-test-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describeStore('compliment de la interfície', () => new JsonFileStore(join(dir, `s${counter++}.json`)));

  it('el contingut sobreviu a una instància nova (és al disc)', async () => {
    const path = join(dir, 'persistent.json');
    await new JsonFileStore(path).set('k', 'valor');
    expect(await new JsonFileStore(path).get('k')).toBe('valor');
  });

  it('crea el directori si no existeix i tolera un fitxer inexistent', async () => {
    const store = new JsonFileStore(join(dir, 'nova', 'carpeta', 'dades.json'));
    expect(await store.get('k')).toBeNull();
    await store.set('k', 'v');
    expect(await store.get('k')).toBe('v');
  });
});

describe('ProfileRepository', () => {
  it('load retorna null si el perfil no existeix i loadOrCreate en crea un de nou', async () => {
    const repo = new ProfileRepository(new MemoryStore());
    expect(await repo.load('u1')).toBeNull();
    const created = await repo.loadOrCreate('u1', 'Anna');
    expect(created).toMatchObject({ id: 'u1', name: 'Anna', gamesPlayed: 0 });
  });

  it('desa i recupera el perfil sencer, historial inclòs', async () => {
    const repo = new ProfileRepository(new MemoryStore());
    const played = recordGame(createProfile('u1', 'Anna'), ['expert'], true, new Date('2026-01-01'));
    await repo.save(played);

    const loaded = await repo.load('u1');
    expect(loaded).toEqual(played);
    expect(loaded!.history).toHaveLength(1);
    // loadOrCreate no ha de trepitjar un perfil que ja existeix.
    expect(await repo.loadOrCreate('u1', 'Un altre nom')).toEqual(played);
  });

  it('manté separats els perfils de jugadors diferents', async () => {
    const repo = new ProfileRepository(new MemoryStore());
    await repo.save(createProfile('u1', 'Anna'));
    await repo.save(createProfile('u2', 'Bru'));
    await repo.remove('u1');
    expect(await repo.load('u1')).toBeNull();
    expect((await repo.load('u2'))?.name).toBe('Bru');
  });
});
