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
  detectMissedChances,
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

describe('detecció de jeroglífics', () => {
  it('el grup que es podia baixar és un jeroglífic, amb el moment sencer', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const found = detectMissedChances(game, 0);

    expect(found).toHaveLength(1);
    expect(found[0].turn).toBe(7);
    expect(found[0].tilesUsed).toBe(3);
    expect([...solutionTileIds(found[0])].sort()).toEqual(['black-9-a', 'blue-9-a', 'red-9-a']);
  });

  it('no inventa res quan robar és l’única sortida', () => {
    expect(detectMissedChances(state([t('red', 1), t('blue', 5), t('black', 9)]), 0)).toEqual([]);
  });

  it('una sola fitxa no és cap jeroglífic: el quart color d’un grup, tampoc', () => {
    // Podries posar el quart nou al grup de nous… i això és un regal, no un
    // trencaclosques: no s'apunta.
    const quartColor = state(
      [t('orange', 9), t('blue', 2)],
      [[t('red', 9), t('blue', 9), t('black', 9)]],
    );
    expect(detectMissedChances(quartColor, 0)).toEqual([]);

    // Ni l'allargament d'una escala amb una sola fitxa.
    const allarga = state([t('red', 10), t('blue', 2)], [[t('red', 7), t('red', 8), t('red', 9)]]);
    expect(detectMissedChances(allarga, 0)).toEqual([]);
  });

  it('dues fitxes que s’aguanten l’una a l’altra sí que en són un', () => {
    // El 10 i l'11 allarguen la mateixa escala: l'11 necessita el 10.
    const game = state(
      [t('red', 10), t('red', 11), t('blue', 2)],
      [[t('red', 7), t('red', 8), t('red', 9)]],
    );
    const found = detectMissedChances(game, 0);
    expect(found).toHaveLength(1);
    expect(found[0].tilesUsed).toBe(2);
    expect(movedBoardTileIds(found[0].board, found[0].solution).size).toBe(0);
  });

  it('les jugades que no es toquen són jeroglífics independents', () => {
    // Dos grups sense res en comú: cadascun és el seu trencaclosques.
    const game = state([
      t('red', 9), t('blue', 9), t('black', 9),
      t('red', 4), t('blue', 4), t('black', 4),
    ]);
    const found = detectMissedChances(game, 0);
    expect(found).toHaveLength(2);
    const keys = found.map(missKey);
    expect(new Set(keys).size).toBe(2);
    // I cada solució és una jugada legal per ella sola.
    for (const miss of found) {
      expect(() =>
        applyMove(stateFromMiss(miss, 'Anna'), { type: 'play', board: miss.solution }),
      ).not.toThrow();
    }
  });

  it('el jeroglífic no s’endú els regals del costat: la resta de taula queda intacta', () => {
    // Hi ha el grup de nous (jeroglífic) i un allargament d'una fitxa (regal).
    const game = state(
      [t('red', 9), t('blue', 9), t('black', 9), t('red', 10)],
      [[t('red', 7, 'b'), t('red', 8, 'b'), t('red', 9, 'b')]],
    );
    const found = detectMissedChances(game, 0);
    expect(found).toHaveLength(1);
    expect(found[0].tilesUsed).toBe(3);
    // L'escala de la taula es queda tal com era, sense el 10 afegit.
    const escala = found[0].solution.find((meld) => meld.some((x) => x.id === 'red-7-b'))!;
    expect(escala.map((x) => x.id)).toEqual(['red-7-b', 'red-8-b', 'red-9-b']);
    expect(() =>
      applyMove(stateFromMiss(found[0], 'Anna'), { type: 'play', board: found[0].solution }),
    ).not.toThrow();
  });

  it('desfer jugades per posar diverses fitxes és un jeroglífic dels bons', () => {
    // Per jugar-ho tot cal desfer l'escala 7-8-9: grup de sets + escala 8-11.
    const game = state(
      [t('blue', 7), t('black', 7), t('red', 10), t('red', 11)],
      [[t('red', 7), t('red', 8), t('red', 9)]],
    );
    const found = detectMissedChances(game, 0);
    expect(found).toHaveLength(1);
    expect(found[0].tilesUsed).toBe(4);
    expect([...movedBoardTileIds(found[0].board, found[0].solution)].sort()).toEqual([
      'red-7-a',
      'red-8-a',
      'red-9-a',
    ]);
  });

  it('abans d’obrir, la sortida sencera és un sol jeroglífic', () => {
    // Tres nous sumen 27: no s'hi arriba, així que robar no perd res.
    expect(
      detectMissedChances(state([t('red', 9), t('blue', 9), t('black', 9)], [], false), 0),
    ).toEqual([]);

    // Escala de 33 + grup de cincs: totes les jugades s'aguanten pels 30 punts.
    const obre = state(
      [t('red', 10), t('red', 11), t('red', 12), t('red', 5), t('blue', 5), t('black', 5)],
      [],
      false,
    );
    const found = detectMissedChances(obre, 0);
    expect(found).toHaveLength(1);
    expect(found[0].tilesUsed).toBe(6);
  });

  it('el mateix jeroglífic no s’apunta dos cops: només el primer torn', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const primera = detectMissedChances(game, 0)[0];
    // El torn següent, amb una fitxa robada que no hi fa res, és el mateix.
    const despres = state([...game.players[0].rack, t('black', 2, 'b')]);
    const repetida = detectMissedChances({ ...despres, turn: 9 }, 0)[0];
    expect(missKey(repetida)).toBe(missKey(primera));

    let misses = addMiss([], primera);
    misses = addMiss(misses, repetida);
    expect(misses).toEqual([primera]);

    // Però si el grup creix (s'hi suma el quart nou), és un altre jeroglífic.
    const creix = state([...game.players[0].rack, t('orange', 9)]);
    const quarteta = detectMissedChances({ ...creix, turn: 11 }, 0)[0];
    expect(quarteta.tilesUsed).toBe(4);
    misses = addMiss(misses, quarteta);
    expect(misses.map((m) => m.turn)).toEqual([7, 11]);
  });
});

describe('el quiz valida amb el mateix motor', () => {
  it('un intent correcte passa, i un de coix rep l’error de sempre', () => {
    const game = state([t('red', 9), t('blue', 9), t('black', 9), t('orange', 13)]);
    const miss = detectMissedChances(game, 0)[0];

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

  it('filtra els jeroglífics malmesos i es queda els bons', () => {
    expect(validMisses([bona])).toEqual([bona]);
    expect(
      validMisses([bona, null, 'res', { turn: 'no' }, { ...bona, solution: 'trencada' }]),
    ).toEqual([bona]);
    expect(validMisses('ni tan sols una llista')).toEqual([]);
    expect(validMisses(undefined)).toEqual([]);
  });
});
