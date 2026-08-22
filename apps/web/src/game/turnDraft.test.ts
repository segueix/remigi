import type { GameState, Meld, NumberTile, Tile, TileColor } from '@rummikub/core';
import { describe, expect, it } from 'vitest';
import {
  hasChanges,
  insertSmart,
  invalidMeldIndexes,
  missingOpeningPoints,
  moveTile,
  openingPoints,
  playedTileIds,
  startTurn,
  toMove,
  type TurnDraft,
} from './turnDraft';

function t(color: TileColor, value: number, copy = 'a'): NumberTile {
  return { id: `${color}-${value}-${copy}`, kind: 'number', color, value };
}

const joker: Tile = { id: 'joker-a', kind: 'joker' };

/** Esborrany directe: `board` és la taula de treball i `locked` el que ja hi era. */
function draft(board: Meld[], rack: Tile[], locked: string[] = []): TurnDraft {
  return { board, rack, locked: new Set(locked) };
}

const ids = (melds: Meld[]) => melds.map((m) => m.map((x) => x.id));

describe('inici del torn', () => {
  it('copia la taula i el faristol, i bloqueja les fitxes que ja hi eren', () => {
    const state = {
      board: [[t('red', 1), t('blue', 1), t('black', 1)]],
      players: [{ rack: [t('orange', 5)] }, { rack: [t('red', 9)] }],
    } as unknown as GameState;

    const d = startTurn(state, 0);
    expect(d.rack.map((x) => x.id)).toEqual(['orange-5-a']);
    expect(d.locked.has('red-1-a')).toBe(true);
    expect(d.locked.has('orange-5-a')).toBe(false);

    // La còpia és independent: tocar-la no ha de modificar l'estat del motor.
    d.board[0].push(t('orange', 1));
    expect(state.board[0]).toHaveLength(3);
  });
});

describe('inserció intel·ligent', () => {
  it('col·loca la fitxa a la posició que fa vàlida la jugada', () => {
    const run = [t('red', 7), t('red', 8), t('red', 9)];
    expect(insertSmart(run, t('red', 6)).map((x) => x.id)[0]).toBe('red-6-a');
    expect(insertSmart(run, t('red', 10)).map((x) => x.id)[3]).toBe('red-10-a');
  });

  it('completa un grup i accepta jokers', () => {
    const group = [t('red', 5), t('blue', 5), t('black', 5)];
    expect(insertSmart(group, t('orange', 5))).toHaveLength(4);
    expect(insertSmart([t('red', 7), t('red', 9)], joker).map((x) => x.id)).toEqual([
      'red-7-a',
      'joker-a',
      'red-9-a',
    ]);
  });

  it('si cap posició no la fa vàlida, la deixa al final', () => {
    const run = [t('red', 7), t('red', 8), t('red', 9)];
    expect(insertSmart(run, t('blue', 2)).map((x) => x.id)[3]).toBe('blue-2-a');
  });
});

describe('moure fitxes', () => {
  it('del faristol a una jugada nova i a una d’existent', () => {
    const d = draft([[t('red', 7), t('red', 8), t('red', 9)]], [t('red', 6), t('blue', 2)]);

    const nova = moveTile(d, 'blue-2-a', { kind: 'new' });
    expect(ids(nova.board)[1]).toEqual(['blue-2-a']);
    expect(nova.rack.map((x) => x.id)).toEqual(['red-6-a']);

    const dins = moveTile(d, 'red-6-a', { kind: 'meld', index: 0 });
    expect(ids(dins.board)[0]).toEqual(['red-6-a', 'red-7-a', 'red-8-a', 'red-9-a']);
  });

  it('torna al faristol una fitxa jugada aquest torn', () => {
    const d = draft([[t('red', 7)]], []);
    expect(moveTile(d, 'red-7-a', { kind: 'rack' }).rack.map((x) => x.id)).toEqual(['red-7-a']);
  });

  it('no deixa endur-se una fitxa que ja era a la taula', () => {
    const d = draft([[t('red', 7), t('red', 8), t('red', 9)]], [], [
      'red-7-a',
      'red-8-a',
      'red-9-a',
    ]);
    expect(moveTile(d, 'red-8-a', { kind: 'rack' })).toBe(d);
  });

  it('elimina la jugada que es queda sense fitxes', () => {
    const d = draft([[t('red', 7)], [t('blue', 1), t('blue', 2), t('blue', 3)]], []);
    const after = moveTile(d, 'red-7-a', { kind: 'rack' });
    expect(after.board).toHaveLength(1);
    expect(ids(after.board)[0]).toEqual(['blue-1-a', 'blue-2-a', 'blue-3-a']);
  });

  /**
   * Cas subtil: si en treure la fitxa la seva jugada queda buida i desapareix,
   * les jugades següents es desplacen i l'índex de destinació que venia de la
   * interfície ja no assenyala el mateix lloc.
   */
  it('ajusta l’índex de destinació quan una jugada anterior desapareix', () => {
    const d = draft([[t('red', 6)], [t('red', 7), t('red', 8), t('red', 9)]], []);
    const after = moveTile(d, 'red-6-a', { kind: 'meld', index: 1 });
    expect(after.board).toHaveLength(1);
    expect(ids(after.board)[0]).toEqual(['red-6-a', 'red-7-a', 'red-8-a', 'red-9-a']);
  });

  it('ignora una fitxa inexistent o una destinació fora de rang', () => {
    const d = draft([[t('red', 7)]], [t('blue', 2)]);
    expect(moveTile(d, 'no-existeix', { kind: 'new' })).toBe(d);
    expect(moveTile(d, 'blue-2-a', { kind: 'meld', index: 9 })).toBe(d);
  });
});

describe('estat de la jugada en curs', () => {
  it('distingeix les fitxes jugades aquest torn de les que ja hi eren', () => {
    const d = draft([[t('red', 7), t('red', 8), t('red', 9)]], [], ['red-7-a', 'red-8-a']);
    expect([...playedTileIds(d)]).toEqual(['red-9-a']);
    expect(hasChanges(d)).toBe(true);
    expect(hasChanges(draft([], [t('red', 1)]))).toBe(false);
  });

  it('assenyala quines jugades no són vàlides', () => {
    const d = draft(
      [
        [t('red', 1), t('blue', 1), t('black', 1)],
        [t('red', 5), t('red', 9)],
      ],
      [],
    );
    expect([...invalidMeldIndexes(d)]).toEqual([1]);
  });

  it('compta els punts de la sortida inicial només de les jugades noves', () => {
    const d = draft(
      [
        [t('red', 10), t('blue', 10), t('black', 10)], // nova: 30 punts
        [t('red', 1), t('blue', 1), t('black', 1)], // ja era a la taula: no compta
      ],
      [],
      ['red-1-a', 'blue-1-a', 'black-1-a'],
    );
    expect(openingPoints(d)).toBe(30);
    expect(missingOpeningPoints(d)).toBe(0);
  });

  it('diu quants punts falten per poder obrir', () => {
    const d = draft([[t('red', 5), t('blue', 5), t('black', 5)]], []);
    expect(openingPoints(d)).toBe(15);
    expect(missingOpeningPoints(d)).toBe(15);
  });

  it('el moviment que rep el motor és la taula sencera', () => {
    const d = draft([[t('red', 7), t('red', 8), t('red', 9)]], []);
    expect(toMove(d)).toEqual({ type: 'play', board: d.board });
  });
});
