import { describe, expect, it } from 'vitest';
import { bestRearrangement } from '../src/ai/rearrange';
import { boardProblems } from '../src/core/board';
import type { Meld, Tile } from '../src/core/types';
import { joker, t } from './helpers';

/** Comprova el que ha de complir sempre qualsevol reordenació proposada. */
function expectSound(before: Meld[], rack: Tile[], after: Meld[]): void {
  expect(boardProblems(after)).toEqual([]);

  const ids = after.flat().map((tile) => tile.id);
  expect(new Set(ids).size, 'cap fitxa repetida').toBe(ids.length);

  const disponibles = new Set([...before.flat(), ...rack].map((tile) => tile.id));
  for (const id of ids) expect(disponibles.has(id), `${id} surt del no-res`).toBe(true);

  for (const tile of before.flat()) {
    expect(ids, `${tile.id} no es pot retirar de la taula`).toContain(tile.id);
  }
}

describe('reordenació de la taula', () => {
  it('allarga una jugada existent', () => {
    const before = [[t('red', 1), t('red', 2), t('red', 3)]];
    const rack = [t('red', 4)];
    const result = bestRearrangement(before, rack)!;
    expect(result.tilesUsed).toBe(1);
    expectSound(before, rack, result.board);
  });

  /**
   * El cas que l'heurística voraç no pot resoldre: cal partir una escala de la
   * taula per alliberar-ne una fitxa i formar un grup amb dues fitxes de la mà.
   */
  it('parteix una escala de la taula per col·locar dues fitxes de la mà', () => {
    const before = [
      [t('red', 1), t('red', 2), t('red', 3), t('red', 4), t('red', 5), t('red', 6), t('red', 7)],
    ];
    const rack = [t('blue', 4), t('black', 4)];

    const result = bestRearrangement(before, rack)!;
    expect(result.tilesUsed).toBe(2);
    expectSound(before, rack, result.board);
    expect(result.board.flat()).toHaveLength(9);

    // El 4 vermell ha passat a formar grup amb els dos 4 de la mà.
    const grup = result.board.find((meld) => meld.some((tile) => tile.id === 'blue-4-a'));
    expect(grup!.map((tile) => tile.id).sort()).toEqual(['black-4-a', 'blue-4-a', 'red-4-a']);
  });

  it('recupera un joker de la taula canviant-lo per la fitxa de debò', () => {
    // A la taula, el joker fa de 6 vermell; a la mà hi ha el 6 vermell autèntic.
    const before = [[t('red', 5), joker('a'), t('red', 7)]];
    const rack = [t('red', 6), t('blue', 5), t('black', 5)];

    const result = bestRearrangement(before, rack)!;
    expect(result.tilesUsed).toBe(3);
    expectSound(before, rack, result.board);

    const escala = result.board.find((meld) => meld.some((tile) => tile.id === 'red-6-a'))!;
    expect(escala.map((tile) => tile.id)).toEqual(['red-5-a', 'red-6-a', 'red-7-a']);
    // I el joker s'ha reaprofitat en una altra jugada.
    const ambJoker = result.board.find((meld) => meld.some((tile) => tile.id === 'joker-a'))!;
    expect(ambJoker).toHaveLength(3);
  });

  it('no proposa res quan no es pot col·locar cap fitxa de la mà', () => {
    const before = [[t('red', 1), t('red', 2), t('red', 3)]];
    expect(bestRearrangement(before, [t('blue', 9)])).toBeNull();
  });

  it('funciona amb la taula buida', () => {
    const rack = [t('red', 5), t('blue', 5), t('black', 5), t('orange', 12)];
    const result = bestRearrangement([], rack)!;
    expect(result.tilesUsed).toBe(3);
    expectSound([], rack, result.board);
  });

  it('col·loca tantes fitxes com pot en una mà que en dona molt de joc', () => {
    const before = [[t('blue', 10), t('blue', 11), t('blue', 12)]];
    const rack = [
      t('blue', 13),
      t('red', 1),
      t('red', 2),
      t('red', 3),
      t('black', 7),
      t('blue', 7),
      t('red', 7),
    ];
    const result = bestRearrangement(before, rack)!;
    // 13 blau allarga l'escala, 1-2-3 vermell i el grup de 7: totes 7 fitxes.
    expect(result.tilesUsed).toBe(7);
    expectSound(before, rack, result.board);
  });

  it('respecta el sostre de nodes i no retorna res si l’esgota', () => {
    const before = [[t('red', 1), t('red', 2), t('red', 3)]];
    expect(bestRearrangement(before, [t('red', 4)], { maxNodes: 1 })).toBeNull();
  });
});
