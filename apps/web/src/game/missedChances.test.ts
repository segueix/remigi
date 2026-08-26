import {
  applyMove,
  type GameState,
  type Meld,
  type NumberTile,
  type Tile,
  type TileColor,
} from '@remigi/core';
import { describe, expect, it } from 'vitest';
import {
  addMiss,
  detectMissedChance,
  missKey,
  movedBoardTileIds,
  solutionTileIds,
  stateFromMiss,
  validMisses,
  type MissedChance,
} from './missedChances';
import { moveTile, startTurn, toMove } from './turnDraft';

function t(color: TileColor, value: number, copy = 'a'): NumberTile {
  return { id: `${color}-${value}-${copy}`, kind: 'number', color, value };
}

function state(rack: Tile[], board: Meld[] = [], hasOpened = true): GameState {
  return {
    seed: 1,
    bag: [],
    board,
    players: [
      { id: 'p1', name: 'Anna', kind: 'human', rack, hasOpened },
      { id: 'p2', name: 'Bot', kind: 'ai', aiLevel: 'easy', rack: [t('orange', 1)], hasOpened: true },
    ],
    currentPlayer: 0,
    turn: 7,
    consecutivePasses: 0,
    status: 'playing',
  };
}

describe('detecció d’oportunitats perdudes', () => {
  it('troba el grup que es podia baixar, amb el moment sencer', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const miss = detectMissedChance(game, 0);

    expect(miss).not.toBeNull();
    expect(miss!.turn).toBe(7);
    expect(miss!.hasOpened).toBe(true);
    expect(miss!.tilesUsed).toBe(3);
    expect([...solutionTileIds(miss!)].sort()).toEqual(['black-9-a', 'blue-9-a', 'red-9-a']);
  });

  it('no inventa res quan robar és l’única sortida', () => {
    const game = state([t('red', 1), t('blue', 5), t('black', 9)]);
    expect(detectMissedChance(game, 0)).toBeNull();
  });

  it('abans d’obrir, només compta si la jugada arriba als 30 punts', () => {
    // Tres nous sumen 27: no s'hi arriba, així que robar no perd res.
    const curt = state([t('red', 9), t('blue', 9), t('black', 9)], [], false);
    expect(detectMissedChance(curt, 0)).toBeNull();

    // Una escala 10-11-12 en són 33: això sí que era una oportunitat.
    const obre = state([t('red', 10), t('red', 11), t('red', 12)], [], false);
    const miss = detectMissedChance(obre, 0);
    expect(miss).not.toBeNull();
    expect(miss!.tilesUsed).toBe(3);
  });

  it('també veu els allargaments de jugades de la taula', () => {
    const game = state([t('red', 10), t('blue', 2)], [[t('red', 7), t('red', 8), t('red', 9)]]);
    const miss = detectMissedChance(game, 0);
    expect(miss).not.toBeNull();
    expect(miss!.tilesUsed).toBe(1);
    expect([...solutionTileIds(miss!)]).toEqual(['red-10-a']);
  });

  it('la mateixa jugada perduda no s’apunta dos cops: només el primer torn', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const primera = detectMissedChance(game, 0)!;
    // El torn següent, amb una fitxa robada que no hi fa res, l'error és el mateix.
    const despres = state([...game.players[0].rack, t('black', 2, 'b')]);
    const repetida = detectMissedChance({ ...despres, turn: 9 }, 0)!;
    expect(missKey(repetida)).toBe(missKey(primera));

    let misses = addMiss([], primera);
    misses = addMiss(misses, repetida);
    expect(misses).toEqual([primera]);

    // Però si l'oportunitat creix (s'hi suma un altre error), sí que s'apunta.
    const creix = state([...game.players[0].rack, t('orange', 9)]);
    const quarteta = detectMissedChance({ ...creix, turn: 11 }, 0)!;
    expect(quarteta.tilesUsed).toBe(4);
    misses = addMiss(misses, quarteta);
    expect(misses.map((m) => m.turn)).toEqual([7, 11]);
  });

  it('distingeix les fitxes de la taula que la jugada recol·locava', () => {
    // Allargar una escala no mou res: les fitxes velles es queden on eren.
    const allarga = detectMissedChance(
      state([t('red', 10), t('blue', 2)], [[t('red', 7), t('red', 8), t('red', 9)]]),
      0,
    )!;
    expect(movedBoardTileIds(allarga.board, allarga.solution).size).toBe(0);

    // Reordenar la taula sí: el 7 vermell se'n va a un grup i l'escala es refà.
    const reordena = detectMissedChance(
      state(
        [t('blue', 7), t('black', 7), t('red', 10), t('red', 11)],
        [[t('red', 7), t('red', 8), t('red', 9)]],
      ),
      0,
    )!;
    expect(reordena.tilesUsed).toBe(4);
    expect([...solutionTileIds(reordena)].sort()).toEqual([
      'black-7-a',
      'blue-7-a',
      'red-10-a',
      'red-11-a',
    ]);
    expect([...movedBoardTileIds(reordena.board, reordena.solution)].sort()).toEqual([
      'red-7-a',
      'red-8-a',
      'red-9-a',
    ]);
  });

  it('el motor accepta la solució guardada tal qual (cap regla duplicada)', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const miss = detectMissedChance(game, 0)!;
    expect(() =>
      applyMove(stateFromMiss(miss, 'Anna'), { type: 'play', board: miss.solution }),
    ).not.toThrow();
  });
});

describe('el quiz valida amb el mateix motor', () => {
  it('un intent correcte passa, i un de coix rep l’error de sempre', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const miss = detectMissedChance(game, 0)!;

    let attempt = startTurn(stateFromMiss(miss, 'Anna'), 0);
    attempt = moveTile(attempt, 'red-9-a', { kind: 'new' });
    attempt = moveTile(attempt, 'blue-9-a', { kind: 'meld', index: 0 });
    expect(() => applyMove(stateFromMiss(miss, 'Anna'), toMove(attempt))).toThrow(/com a mínim 3/);

    attempt = moveTile(attempt, 'black-9-a', { kind: 'meld', index: 0 });
    expect(() => applyMove(stateFromMiss(miss, 'Anna'), toMove(attempt))).not.toThrow();
  });
});

describe('el que hi ha desat no és de fiar', () => {
  const bona: MissedChance = {
    turn: 3,
    board: [],
    rack: [t('red', 9)],
    hasOpened: true,
    solution: [[t('red', 9)]],
    tilesUsed: 1,
  };

  it('filtra les oportunitats malmeses i es queda les bones', () => {
    expect(validMisses([bona])).toEqual([bona]);
    expect(
      validMisses([bona, null, 'res', { turn: 'no' }, { ...bona, solution: 'trencada' }]),
    ).toEqual([bona]);
    expect(validMisses('ni tan sols una llista')).toEqual([]);
    expect(validMisses(undefined)).toEqual([]);
  });
});
