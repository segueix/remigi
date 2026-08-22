import { isJoker, type Tile } from '@rummikub/core';
import { useState } from 'react';
import { TileView } from './TileView';

interface Props {
  rack: Tile[];
  selectedTileId?: string | null;
  draggingTileId?: string | null;
  /** El punter que arrossega és sobre el faristol. */
  isOver?: boolean;
  /** Fitxes que poden formar jugada, quan l'ajuda està activada. */
  suggested?: ReadonlySet<string>;
  helpOn?: boolean;
  interactive?: boolean;
  onToggleHelp?(): void;
  onTileClick?(tileId: string): void;
  onTilePointerDown?(event: React.PointerEvent, tileId: string): void;
  /** Tornar al faristol la fitxa triada. */
  onReturnToRack?(): void;
}

type Order = 'cap' | 'numero' | 'color';

const COLOR_ORDER = ['red', 'blue', 'black', 'orange'];

/** El faristol del jugador, amb ordenació i ajuda opcionals (només visuals). */
export function RackView({
  rack,
  selectedTileId,
  draggingTileId,
  isOver,
  suggested,
  helpOn,
  interactive,
  onToggleHelp,
  onTileClick,
  onTilePointerDown,
  onReturnToRack,
}: Props) {
  const [order, setOrder] = useState<Order>('cap');
  const tiles = sortTiles(rack, order);

  return (
    <section className="rack-area">
      <header className="rack-header">
        <h3>
          El teu faristol <span className="muted">({rack.length})</span>
        </h3>
        <div className="rack-tools">
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
          {interactive && onToggleHelp && (
            <button type="button" className="link" onClick={onToggleHelp} aria-pressed={helpOn}>
              {helpOn ? 'amaga l’ajuda' : 'ajuda’m'}
            </button>
          )}
        </div>
      </header>

      <div className={isOver ? 'rack over' : 'rack'} data-drop="rack">
        {tiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            selected={tile.id === selectedTileId}
            dragging={tile.id === draggingTileId}
            suggested={helpOn && suggested?.has(tile.id)}
            onClick={interactive ? () => onTileClick?.(tile.id) : undefined}
            onPointerDown={
              interactive && onTilePointerDown
                ? (event) => onTilePointerDown(event, tile.id)
                : undefined
            }
          />
        ))}
        {tiles.length === 0 && <p className="muted">Cap fitxa: has guanyat!</p>}
      </div>

      {/*
       * Amb el ratolí o el dit, tornar una fitxa al faristol és deixar-la-hi a
       * sobre; amb el teclat cal un botó, perquè si el faristol és buit no hi ha
       * cap fitxa on clicar.
       */}
      {interactive && selectedTileId && onReturnToRack && (
        <button type="button" className="secondary return-tile" onClick={onReturnToRack}>
          ↩ Torna la fitxa al faristol
        </button>
      )}
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
