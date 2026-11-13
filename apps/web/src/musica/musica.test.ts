import { describe, expect, it } from 'vitest';
import R from './radioambient';
import {
  EL_TAULER_SEEN_KEY,
  MUSIC_LAST_KEY,
  MUSIC_SEEN_KEY,
  composeNew,
  mp3FileName,
  parseMusicPrefs,
  pieceKey,
  registerPiece,
  registryGroups,
  registryList,
  toggleFavourite,
} from './musica';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('la música composta', () => {
  it('cada peça és nova: estil diferent de l’anterior i cap empremta repetida', () => {
    const store = memoryStore();
    const prints = new Set<string>();
    let previous: string | null = null;
    for (let i = 0; i < 40; i++) {
      const spec = composeNew(R, store);
      expect(spec.loop).toBe(true);
      expect(spec.style).not.toBe(previous);
      previous = spec.style;
      prints.add(R.jingleFingerprint(spec));
    }
    expect(prints.size).toBe(40);
    expect(JSON.parse(store.getItem(MUSIC_SEEN_KEY)!)).toHaveLength(40);
    expect(store.getItem(MUSIC_LAST_KEY)).toBe(previous);
  });

  it('tampoc no repeteix les peces que ja han sonat a El Tauler, i no hi escriu', () => {
    // Amb un atzar que sempre dona la mateixa llavor, la primera peça seria la
    // sentida a El Tauler: n'ha de buscar una altra.
    let k = 0;
    const seq = [0.5, 0.1, 0.1, 0.7];
    const random = () => seq[k++ % seq.length];
    const first = R.composeJingle(R.pickJingle(() => 0.5, null), Math.floor(0.1 * 4294967295) + 1, { loop: true });
    const tauler = JSON.stringify([R.jingleFingerprint(first)]);
    const store = memoryStore({ [EL_TAULER_SEEN_KEY]: tauler });
    const spec = composeNew(R, store, random);
    expect(R.jingleFingerprint(spec)).not.toBe(R.jingleFingerprint(first));
    expect(store.getItem(EL_TAULER_SEEN_KEY)).toBe(tauler);
  });

  it('la mateixa recepta torna a donar la mateixa peça', () => {
    const a = R.composeJingle('himne', 777, { loop: true });
    const b = R.composeJingle('himne', 777, { loop: true });
    expect(R.jingleFingerprint(a)).toBe(R.jingleFingerprint(b));
    expect(R.jingleTitle(a)).toMatch(/^Himne de la lliga · .+ · .+$/);
  });

  it('sintetitza un bucle de 32 segons al dispositiu', () => {
    const samples = R.jingleSamples(R.composeJingle('galop', 9, { loop: true }), 8000);
    expect(samples.length).toBe(8000 * 32);
    expect(samples.some((v) => Math.abs(v) > 0.01)).toBe(true);
  });
});

describe('el registre de peces', () => {
  it('guarda la recepta de cada peça, la més nova primer, sense duplicats', () => {
    const store = memoryStore();
    registerPiece(store, { style: 'rumba', seed: 1 }, 1000);
    registerPiece(store, { style: 'funk', seed: 2 }, 2000);
    registerPiece(store, { style: 'rumba', seed: 1 }, 3000);
    const list = registryList(store);
    expect(list.map(pieceKey)).toEqual(['rumba:1', 'funk:2']);
  });

  it('les preferides es conserven i es mostren a part', () => {
    const store = memoryStore();
    for (let i = 1; i <= 8; i++) registerPiece(store, { style: 'galop', seed: i }, i * 1000);
    toggleFavourite(store, 'galop:1');
    const groups = registryGroups(registryList(store), 9000);
    expect(groups.latest.map((p) => p.seed)).toEqual([8, 7, 6, 5, 4]);
    expect(groups.favs.map((p) => p.seed)).toEqual([1]);
    expect(groups.days.flatMap((d) => d.items).map((p) => p.seed)).toEqual([3, 2]);
    expect(registryList(store).find((p) => p.seed === 1)?.fav).toBe(true);
  });

  it('les preferències i el nom del fitxer', () => {
    expect(parseMusicPrefs(null)).toEqual({ on: true, volume: 60 });
    expect(parseMusicPrefs('{"on":false,"volume":250}')).toEqual({ on: false, volume: 100 });
    expect(mp3FileName('Rumba de la classificació · la menor · flauta')).toBe(
      'Remigi - Rumba de la classificacio - la menor - flauta.mp3',
    );
  });
});
