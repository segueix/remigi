import { isJoker, type Tile } from '@rummikub/core';
import { useState } from 'react';
import { TileView } from './TileView';

interface Props {
  rack: Tile[];
  selectedTileId?: string | null;
  interactive?: boolean;
  onTileClick?(tileId: string): void;
  /** Tornar al faristol la fitxa seleccionada. */
  onRackClick?(): void;
}

type Order = 'cap' | 'numero' | 'color';

const COLOR_ORDER = ['red', 'blue', 'black', 'orange'];

/** El faristol del jugador, amb ordenació opcional (només visual). */
export function RackView({ rack, selectedTileId, interactive, onTileClick, onRackClick }: Props) {
  const [order, setOrder] = useState<Order>('cap');
  const tiles = sortTiles(rack, order);

  return (
    <section className="rack-area">
      <header className="rack-header">
        <h3>
          El teu faristol <span className="muted">({rack.length})</span>
        </h3>
        <div className="rack-order">
          <span className="muted">Ordena:</span>
          {(['cap', 'numero', 'color'] as Order[]).map((option) => (
            <button
              key={option}
              type="button"
              className="link"
              onClick={() => setOrder(option)}
              disabled={order === option}
            >
              {option === 'cap' ? 'com està' : option === 'numero' ? 'per número' : 'per color'}
            </button>
          ))}
        </div>
      </header>

      <div className="rack" onClick={onRackClick}>
        {tiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            selected={tile.id === selectedTileId}
            onClick={interactive ? () => onTileClick?.(tile.id) : undefined}
          />
        ))}
        {tiles.length === 0 && <p className="muted">Cap fitxa: has guanyat!</p>}
      </div>
    </section>
  );
}

function sortTiles(rack: Tile[], order: Order): Tile[] {
  if (order === 'cap') return rack;
  return [...rack].sort((a, b) => {
    // Els jokers sempre al final, que és on són més fàcils de trobar.
    if (isJoker(a) || isJoker(b)) return Number(isJoker(a)) - Number(isJoker(b));
    return order === 'numero'
      ? a.value - b.value || COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color)
      : COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color) || a.value - b.value;
  });
}
