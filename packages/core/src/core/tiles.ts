import { COLORS, COPIES_PER_TILE, JOKER_COUNT, MAX_VALUE, MIN_VALUE } from './constants';
import { createRng, shuffleInPlace } from './random';
import type { JokerTile, NumberTile, Tile } from './types';

const COPY_LABELS = ['a', 'b', 'c', 'd'];

export function isNumberTile(tile: Tile): tile is NumberTile {
  return tile.kind === 'number';
}

export function isJoker(tile: Tile): tile is JokerTile {
  return tile.kind === 'joker';
}

/** Crea el joc complet de 106 fitxes, sense barrejar. */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  for (const color of COLORS) {
    for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
      for (let copy = 0; copy < COPIES_PER_TILE; copy++) {
        tiles.push({ id: `${color}-${value}-${COPY_LABELS[copy]}`, kind: 'number', color, value });
      }
    }
  }
  for (let copy = 0; copy < JOKER_COUNT; copy++) {
    tiles.push({ id: `joker-${COPY_LABELS[copy]}`, kind: 'joker' });
  }
  return tiles;
}

/** Sac complet barrejat de manera determinista a partir de la llavor. */
export function shuffledBag(seed: number): Tile[] {
  return shuffleInPlace(createTileSet(), createRng(seed));
}

/** Representació curta per a registres i CLI, p. ex. "r7", "JK". */
export function tileToString(tile: Tile): string {
  return isJoker(tile) ? 'JK' : `${tile.color[0]}${tile.value}`;
}
