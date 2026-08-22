/** Generador de nombres pseudoaleatoris [0, 1), com Math.random. */
export type Rng = () => number;

/**
 * RNG determinista (mulberry32). Amb la mateixa llavor, la mateixa seqüència:
 * així les partides i els tests són reproduïbles.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Barreja Fisher–Yates sobre el mateix array. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Llavor aleatòria per a partides sense llavor explícita. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
