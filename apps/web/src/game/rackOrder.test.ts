import type { NumberTile, Tile, TileColor } from '@remigi/core';
import { describe, expect, it } from 'vitest';
import { orderRack, placeInRack, sortRack, validRackOrder } from './rackOrder';

function t(color: TileColor, value: number, copy = 'a'): NumberTile {
  return { id: `${color}-${value}-${copy}`, kind: 'number', color, value };
}

const joker: Tile = { id: 'joker-a', kind: 'joker' };
const ids = (tiles: Tile[]) => tiles.map((tile) => tile.id);

describe('l’ordre del faristol', () => {
  const rack = [t('red', 5), t('blue', 2), t('black', 9)];

  it('sense ordre, les fitxes es queden com les dona el motor', () => {
    expect(ids(orderRack(rack, []))).toEqual(['red-5-a', 'blue-2-a', 'black-9-a']);
  });

  it('col·loca les fitxes en l’ordre triat', () => {
    const order = ['black-9-a', 'red-5-a', 'blue-2-a'];
    expect(ids(orderRack(rack, order))).toEqual(order);
  });

  it('les fitxes que no són a l’ordre (la que acabes de robar) van al final', () => {
    const amb = [...rack, t('orange', 1)];
    const order = ['black-9-a', 'blue-2-a', 'red-5-a'];
    expect(ids(orderRack(amb, order))).toEqual([...order, 'orange-1-a']);
  });

  it('les desconegudes conserven entre elles l’ordre del motor', () => {
    const amb = [...rack, t('orange', 1), t('orange', 2)];
    expect(ids(orderRack(amb, ['blue-2-a']))).toEqual([
      'blue-2-a',
      'red-5-a',
      'black-9-a',
      'orange-1-a',
      'orange-2-a',
    ]);
  });

  it('l’ordre d’una fitxa que ja no hi és no fa nosa', () => {
    expect(ids(orderRack(rack, ['fantasma', 'black-9-a']))).toEqual([
      'black-9-a',
      'red-5-a',
      'blue-2-a',
    ]);
  });
});

describe('col·locar una fitxa al faristol', () => {
  const rack = [t('red', 1), t('blue', 2), t('black', 3), t('orange', 4)];
  const order = ['red-1-a', 'blue-2-a', 'black-3-a', 'orange-4-a'];

  it('la porta al davant de tot', () => {
    expect(placeInRack(rack, order, 'orange-4-a', 0)).toEqual([
      'orange-4-a',
      'red-1-a',
      'blue-2-a',
      'black-3-a',
    ]);
  });

  it('la porta al final', () => {
    expect(placeInRack(rack, order, 'red-1-a', 4)).toEqual([
      'blue-2-a',
      'black-3-a',
      'orange-4-a',
      'red-1-a',
    ]);
  });

  it('cap a la dreta, el forat compta que la fitxa ja no hi és', () => {
    // El forat 3 és entre la 3a i la 4a: la fitxa hi ha d'anar, no una abans.
    expect(placeInRack(rack, order, 'red-1-a', 3)).toEqual([
      'blue-2-a',
      'black-3-a',
      'red-1-a',
      'orange-4-a',
    ]);
  });

  it('deixar-la al seu lloc no canvia res', () => {
    expect(placeInRack(rack, order, 'blue-2-a', 1)).toEqual(order);
    expect(placeInRack(rack, order, 'blue-2-a', 2)).toEqual(order);
  });

  it('una fitxa que torna de la taula entra al forat', () => {
    // Encara no és al faristol: l'esborrany l'hi posa al mateix temps.
    expect(placeInRack(rack, order, 'red-9-b', 2)).toEqual([
      'red-1-a',
      'blue-2-a',
      'red-9-b',
      'black-3-a',
      'orange-4-a',
    ]);
  });

  it('un forat impossible no llança: es queda a l’extrem', () => {
    expect(placeInRack(rack, order, 'blue-2-a', 99)).toEqual([
      'red-1-a',
      'black-3-a',
      'orange-4-a',
      'blue-2-a',
    ]);
    expect(placeInRack(rack, order, 'blue-2-a', -3)).toEqual([
      'blue-2-a',
      'red-1-a',
      'black-3-a',
      'orange-4-a',
    ]);
  });
});

describe('ordenar de cop', () => {
  const rack = [t('black', 9), joker, t('red', 5), t('blue', 5), t('red', 2)];

  it('per número, i a igualtat de número per color', () => {
    expect(sortRack(rack, 'numero')).toEqual([
      'red-2-a',
      'red-5-a',
      'blue-5-a',
      'black-9-a',
      'joker-a',
    ]);
  });

  it('per color, i dins de cada color per número', () => {
    expect(sortRack(rack, 'color')).toEqual([
      'red-2-a',
      'red-5-a',
      'blue-5-a',
      'black-9-a',
      'joker-a',
    ]);
  });

  it('els jokers sempre al final', () => {
    expect(sortRack([joker, t('red', 1)], 'numero')).toEqual(['red-1-a', 'joker-a']);
    expect(sortRack([joker, t('red', 1)], 'color')).toEqual(['red-1-a', 'joker-a']);
  });
});

describe('l’ordre que ve d’una partida desada', () => {
  it('accepta una llista d’identificadors', () => {
    expect(validRackOrder(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('descarta el que no ho és, sense fer soroll', () => {
    expect(validRackOrder(['a', 3, null, { id: 'b' }])).toEqual(['a']);
    expect(validRackOrder('a')).toEqual([]);
    expect(validRackOrder(undefined)).toEqual([]);
  });
});
