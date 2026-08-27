import type { Meld, Tile } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { updateOwners, type TileOwners } from './meldOwners';

const t = (color: string, value: number, copia = 'a'): Tile =>
  ({ id: `${color}-${value}-${copia}`, kind: 'number', color, value }) as Tile;

const GRUP_7: Meld = [t('red', 7), t('blue', 7), t('black', 7)];
const ESCALA: Meld = [t('orange', 4), t('orange', 5), t('orange', 6)];

const buit: TileOwners = new Map();

describe('updateOwners (marques fitxa a fitxa)', () => {
  it('marca les fitxes que el bot acaba de posar, una per una', () => {
    const owners = updateOwners(buit, [], [GRUP_7], 1);
    expect([...owners.entries()].sort()).toEqual([
      ['black-7-a', 1],
      ['blue-7-a', 1],
      ['red-7-a', 1],
    ]);
  });

  it('allargar una escala marca només la fitxa afegida, no la jugada sencera', () => {
    const ampliada: Meld = [...GRUP_7, t('orange', 7)];
    const owners = updateOwners(buit, [GRUP_7], [ampliada], 2);
    expect([...owners.entries()]).toEqual([['orange-7-a', 2]]);
  });

  it('només es marca l’últim moviment: les marques d’abans s’esborren', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [GRUP_7, ESCALA], 2);
    expect(després.get('orange-4-a')).toBe(2);
    expect(després.has('red-7-a')).toBe(false);
  });

  it('robar o passar no esborra les marques de l’últim moviment', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [GRUP_7], 2);
    expect(després.get('red-7-a')).toBe(1);
  });

  it('reordenar la taula sense posar-hi res no canvia les marques', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [[...GRUP_7].reverse()], 2);
    expect(després.get('red-7-a')).toBe(1);
  });

  it('les jugades del jugador humà no es marquen: només netegen', () => {
    const abans = updateOwners(buit, [], [GRUP_7], 1);
    const després = updateOwners(abans, [GRUP_7], [GRUP_7, ESCALA], 0);
    expect(després.size).toBe(0);
  });

  it('una reordenació del bot marca només les fitxes que venen de la seva mà', () => {
    // El bot desfà el grup per fer-hi encaixar les seves: les velles no es marquen.
    const nova: Meld[] = [
      [t('red', 7), t('red', 8), t('red', 9)],
      [t('blue', 7), t('black', 7), t('orange', 7)],
    ];
    const owners = updateOwners(buit, [GRUP_7], nova, 1);
    expect([...owners.keys()].sort()).toEqual(['orange-7-a', 'red-8-a', 'red-9-a']);
  });

  it('aplicar dues vegades el mateix moviment dona el mateix resultat', () => {
    // React torna a executar les actualitzacions d'estat en mode estricte.
    const un = updateOwners(buit, [GRUP_7], [GRUP_7, ESCALA], 1);
    const dos = updateOwners(un, [GRUP_7], [GRUP_7, ESCALA], 1);
    expect([...dos.entries()]).toEqual([...un.entries()]);
  });
});
