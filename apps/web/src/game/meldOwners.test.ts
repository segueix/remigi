import type { Meld, PlayerState, Tile } from '@rummikub/core';
import { describe, expect, it } from 'vitest';
import { meldAuthors, meldKey, updateOwners, type MeldOwners } from './meldOwners';

const t = (color: string, value: number, copia = 'a'): Tile =>
  ({ id: `${color}-${value}-${copia}`, kind: 'number', color, value }) as Tile;

const GRUP_7: Meld = [t('red', 7), t('blue', 7), t('black', 7)];
const ESCALA: Meld = [t('orange', 4), t('orange', 5), t('orange', 6)];

const JUGADORS = [
  { id: 'p1', name: 'Daniel', kind: 'human', rack: [], hasOpened: true },
  { id: 'p2', name: 'Bot 1', kind: 'ai', aiLevel: 'easy', rack: [], hasOpened: true },
  { id: 'p3', name: 'Bot 2', kind: 'ai', aiLevel: 'hard', rack: [], hasOpened: true },
] as PlayerState[];

const buit: MeldOwners = new Map();

describe('meldKey', () => {
  it('no depèn de l’ordre de les fitxes', () => {
    expect(meldKey(GRUP_7)).toBe(meldKey([...GRUP_7].reverse()));
  });

  it('distingeix dues jugades que es veuen igual però són fitxes diferents', () => {
    const altre: Meld = [t('red', 7, 'b'), t('blue', 7, 'b'), t('black', 7, 'b')];
    expect(meldKey(GRUP_7)).not.toBe(meldKey(altre));
  });
});

describe('updateOwners', () => {
  it('atribueix una jugada nova a qui l’acaba de posar', () => {
    const owners = updateOwners(buit, [], [GRUP_7], 1);
    expect(owners.get(meldKey(GRUP_7))).toBe(1);
  });

  it('una jugada que no ha canviat conserva l’autor', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [GRUP_7, ESCALA], 2);
    expect(després.get(meldKey(GRUP_7))).toBe(1);
    expect(després.get(meldKey(ESCALA))).toBe(2);
  });

  it('reordenar les fitxes d’una jugada no la converteix en una altra', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [[...GRUP_7].reverse()], 2);
    expect(després.get(meldKey(GRUP_7))).toBe(1);
  });

  it('qui modifica una jugada se’n queda l’autoria', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const ampliada: Meld = [...GRUP_7, t('orange', 7)];
    const després = updateOwners(abans, [GRUP_7], [ampliada], 2);

    expect(després.get(meldKey(ampliada))).toBe(2);
    // I la jugada d'abans ja no existeix: no en queda rastre.
    expect(després.has(meldKey(GRUP_7))).toBe(false);
  });

  it('partir una jugada en dues fa que totes dues siguin de qui l’ha partida', () => {
    const llarga: Meld = [...ESCALA, t('orange', 7), t('orange', 8)];
    const abans = updateOwners(buit, [], [llarga], 1);
    const trossos: Meld[] = [
      [t('orange', 4), t('orange', 5), t('orange', 6)],
      [t('orange', 6, 'b'), t('orange', 7), t('orange', 8)],
    ];
    const després = updateOwners(abans, [llarga], trossos, 0);
    expect(trossos.map((meld) => després.get(meldKey(meld)))).toEqual([0, 0]);
  });

  it('no atribueix a ningú les jugades que ja hi eren sense autor conegut', () => {
    // És el cas d'una partida represa: la taula es carrega sense saber qui l'ha feta.
    const owners = updateOwners(buit, [GRUP_7], [GRUP_7, ESCALA], 1);
    expect(owners.has(meldKey(GRUP_7))).toBe(false);
    expect(owners.get(meldKey(ESCALA))).toBe(1);
  });

  it('oblida les jugades que ja no són a la taula', () => {
    const abans = updateOwners(buit, [], [GRUP_7, ESCALA], 1);
    const després = updateOwners(abans, [GRUP_7, ESCALA], [GRUP_7], 2);
    expect([...després.keys()]).toEqual([meldKey(GRUP_7)]);
  });

  it('aplicar dues vegades el mateix moviment dona el mateix resultat', () => {
    // React torna a executar les actualitzacions d'estat en mode estricte.
    const un = updateOwners(buit, [GRUP_7], [GRUP_7, ESCALA], 1);
    const dos = updateOwners(un, [GRUP_7], [GRUP_7, ESCALA], 1);
    expect([...dos.entries()]).toEqual([...un.entries()]);
  });
});

describe('meldAuthors', () => {
  it('dona el bot de cada jugada, alineat amb la taula', () => {
    const owners = updateOwners(updateOwners(buit, [], [GRUP_7], 2), [GRUP_7], [GRUP_7, ESCALA], 1);
    expect(meldAuthors([GRUP_7, ESCALA], owners, JUGADORS)).toEqual([
      { slot: 2, name: 'Bot 2' },
      { slot: 1, name: 'Bot 1' },
    ]);
  });

  it('les jugades de l’humà i les d’autor desconegut no en tenen', () => {
    const owners = updateOwners(buit, [], [GRUP_7], 0);
    expect(meldAuthors([GRUP_7, ESCALA], owners, JUGADORS)).toEqual([null, null]);
  });
});
