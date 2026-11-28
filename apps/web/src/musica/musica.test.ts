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
  pieceOpts,
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
    const first = R.composeJingle(R.pickJingle(() => 0.5, null), Math.floor(0.1 * 4294967295) + 1, { loop: true, v: 2 });
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

describe('la música del minut de relax de la lliga', () => {
  it('cada estil compon un bucle de 64 s (el descans de la lliga és de 60 s), sense errors', async () => {
    const R = (await import('./radioambient')).default;
    for (const { id } of R.JINGLES) {
      for (const seed of [1, 77, 4242]) {
        const spec = R.composeJingle(id, seed, { loop: true, seconds: 64 });
        const rate = 8000;
        const samples = R.jingleSamples(spec, rate, () => 0.5);
        const seconds = samples.length / rate;
        expect(seconds).toBeGreaterThan(60);
        expect(seconds).toBeLessThan(70);
      }
    }
  }, 60_000);

  it('per defecte, els bucles continuen sent de 32 s (repte i «Música infinita»)', async () => {
    const R = (await import('./radioambient')).default;
    const spec = R.composeJingle('rumba', 9, { loop: true });
    const seconds = R.jingleSamples(spec, 8000, () => 0.5).length / 8000;
    expect(seconds).toBeGreaterThan(29);
    expect(seconds).toBeLessThan(36);
  }, 30_000);
});

describe('el registre recorda la durada de les peces llargues', () => {
  it('una peça de 64 s es torna a escoltar igual (amb la mateixa durada)', () => {
    const store = memoryStore();
    registerPiece(store, { style: 'rumba', seed: 5, seconds: 64 }, 1000);
    registerPiece(store, { style: 'funk', seed: 6, seconds: 32 }, 2000);
    const list = registryList(store);
    expect(list.find((p) => p.seed === 5)?.seconds).toBe(64);
    expect(list.find((p) => p.seed === 6)?.seconds).toBeUndefined();
  });
});

describe('el generador d’estructures (versió 2) i els estils d’ska', () => {
  it('les receptes d’abans (versió 1) donen exactament les mateixes peces', () => {
    // Empremtes de la versió anterior del compositor (abans del generador).
    const before: Record<string, [string, string]> = {
      fanfarria: ['8djej1', 'v08t4p'],
      galop: ['758tfi', '1dmj4kh'],
      rumba: ['f7h65h', '1kb5ncv'],
      funk: ['mqlsyc', '1k0v1ih'],
      himne: ['6lvzbf', '12v98p5'],
    };
    for (const [style, [a, b]] of Object.entries(before)) {
      expect(R.jingleFingerprint(R.composeJingle(style, 1, { loop: true, seconds: 32 }))).toBe(a);
      expect(R.jingleFingerprint(R.composeJingle(style, 4242, { loop: true, seconds: 64 }))).toBe(b);
    }
  });

  it('ja no es componen peces noves de fanfàrria, rumba ni funk', () => {
    let k = 0;
    const random = () => ((k++ * 0.137) % 1);
    let previous: string | null = null;
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add((previous = R.pickJingle(random, previous)));
    expect([...picked].sort()).toEqual(['dostons', 'galop', 'himne', 'rocksteady', 'ska']);
    expect(R.RETIRED_JINGLES).toEqual(['fanfarria', 'rumba', 'funk']);
  });

  it('cada llavor tria una forma; els compassos quadren amb la durada', () => {
    const forms = new Set<string>();
    for (const style of ['ska', 'rocksteady', 'dostons', 'galop', 'himne']) {
      for (let seed = 1; seed <= 30; seed++) {
        const spec = R.composeJingle(style, seed * 7919, { loop: true, seconds: 64, v: 2 });
        expect(spec.v).toBe(2);
        forms.add(spec.form!);
        const sections = spec.sections!;
        const bars = sections.reduce((sum, sc) => sum + sc.bars, 0) + 1;
        expect(bars).toBe(Math.round(64 / (spec.beat * 4)));
        expect(sections.filter((sc) => sc.letter !== 'I').every((sc) => sc.bars === 4)).toBe(true);
        expect(R.jingleTitle(spec)).toContain(spec.formName!);
      }
    }
    expect(forms.size).toBe(6);
  });

  it('una secció que torna (sense prima) és la mateixa melodia', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed++) {
      const spec = R.composeJingle('ska', seed, { loop: true, seconds: 64, v: 2 });
      const sections = spec.sections!.filter((sc) => sc.texture !== 'pausa' && sc.letter !== 'I');
      const first = sections[0];
      const again = sections.find((sc, i) => i > 0 && sc.letter === first.letter && sc.prime === first.prime);
      if (!again) continue;
      const melody = spec.melody as [number, number, number, number][];
      const notes = (sc: typeof first) =>
        melody.filter(([b]) => b >= sc.start && b < sc.start + sc.bars).map(([b, t, n, d]) => [b - sc.start, t, n, d]);
      expect(notes(again)).toEqual(notes(first));
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('el reproductor (síntesi per trossos) també sap tocar els estils d’ska', async () => {
    for (const style of ['ska', 'rocksteady', 'dostons']) {
      const spec = R.composeJingle(style, 11, { loop: true, v: 2 });
      const samples = await R.exportSamples(spec, { cycles: 1, fadeSeconds: 0 });
      expect(samples).not.toBeNull();
      expect(samples!.some((v) => Math.abs(v) > 0.05)).toBe(true);
    }
  }, 30_000);

  it('cada tema d’ska porta la seva batucada (instruments i ritmes diferents)', () => {
    const sets = new Set<string>();
    for (const style of ['ska', 'rocksteady', 'dostons']) {
      for (let seed = 1; seed <= 40; seed++) {
        const spec = R.composeJingle(style, seed * 104729, { loop: true, v: 2 });
        const layers = spec.perc!.layers;
        expect(layers.length).toBeGreaterThanOrEqual(2);
        expect(layers.length).toBeLessThanOrEqual(4);
        expect(new Set(layers.map((l) => l.inst)).size).toBe(layers.length);
        expect(R.jingleTitle(spec)).toContain(spec.percName!);
        sets.add(layers.map((l) => `${l.inst}${l.pat}`).sort().join(','));
      }
    }
    expect(sets.size).toBeGreaterThan(50);
    // Els estils d'abans no en porten.
    expect(R.composeJingle('himne', 3, { loop: true, v: 2 }).perc).toBeUndefined();
  });

  it('les peces noves són de la versió 2 i el registre ho recorda', () => {
    const store = memoryStore();
    const spec = composeNew(R, store);
    expect(spec.v).toBe(2);
    registerPiece(store, spec, 1000);
    registerPiece(store, { style: 'himne', seed: spec.seed }, 2000);
    const list = registryList(store);
    expect(list.map(pieceKey)).toEqual([`himne:${spec.seed}`, `${spec.style}:${spec.seed}:2`]);
    const again = R.composeJingle(list[1].style, list[1].seed, pieceOpts(list[1]));
    expect(R.jingleFingerprint(again)).toBe(R.jingleFingerprint(spec));
  });
});

