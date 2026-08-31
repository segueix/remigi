import type { Tile } from '@remigi/core';
import type { SortBy } from '../game/rackOrder';
import { TileView } from './TileView';

interface Props {
  /** Les fitxes ja en l'ordre en què s'han de veure (vegeu `rackOrder.ts`). */
  rack: Tile[];
  selectedTileId?: string | null;
  draggingTileId?: string | null;
  /** El punter que arrossega és sobre el faristol, però no sobre cap lloc concret. */
  isOver?: boolean;
  /** Forat del faristol on cauria la fitxa que s'arrossega (0 = davant de tot). */
  overIndex?: number | null;
  /** Fitxa acabada de robar del sac, per trobar-la de seguida entre les altres. */
  drawnTileId?: string | null;
  interactive?: boolean;
  /** Ordena-ho tot de cop; a partir d'aquí el jugador ho retoca fitxa a fitxa. */
  onSort(by: SortBy): void;
  /** Un toc a la fitxa que fa `index` dins del faristol. */
  onTileClick?(tileId: string, index: number): void;
  onTilePointerDown?(event: React.PointerEvent, tileId: string): void;
  /** Tornar al faristol la fitxa triada. */
  onReturnToRack?(): void;
}

/**
 * El faristol del jugador.
 *
 * L'ordre de les fitxes és seu: les col·loca on vol arrossegant-les (o tocant
 * la fitxa i després el lloc), i els botons d'ordenar només són una empenta
 * per començar. Cada fitxa és un lloc on se'n pot deixar una altra, i mentre
 * s'arrossega una barra diu exactament on caurà.
 */
export function RackView({
  rack,
  selectedTileId,
  draggingTileId,
  isOver,
  overIndex,
  drawnTileId,
  interactive,
  onSort,
  onTileClick,
  onTilePointerDown,
  onReturnToRack,
}: Props) {
  return (
    <section className="rack-area">
      <header className="rack-header">
        <div className="rack-tools">
          <span className="muted">Ordena:</span>
          {(['numero', 'color'] as SortBy[]).map((option) => (
            <button key={option} type="button" className="link" onClick={() => onSort(option)}>
              {option === 'numero' ? 'per número' : 'per color'}
            </button>
          ))}
          <span className="muted rack-count">
            · {rack.length} {rack.length === 1 ? 'fitxa' : 'fitxes'}
          </span>
        </div>
      </header>

      <div className={isOver ? 'rack over' : 'rack'} data-drop="rack">
        {rack.map((tile, index) => {
          const places = ['rack-lloc'];
          if (overIndex === index) places.push('cau-abans');
          if (overIndex === index + 1 && index === rack.length - 1) places.push('cau-despres');
          return (
            /*
             * Cada fitxa és també el seu lloc: deixar-n'hi una a sobre la posa
             * al costat, per la meitat per on s'hi ha deixat.
             */
            <div key={tile.id} className={places.join(' ')} data-drop={`rack:${index}`}>
              <TileView
                tile={tile}
                selected={tile.id === selectedTileId}
                dragging={tile.id === draggingTileId}
                drawn={tile.id === drawnTileId}
                onClick={interactive ? () => onTileClick?.(tile.id, index) : undefined}
                onPointerDown={
                  interactive && onTilePointerDown
                    ? (event) => onTilePointerDown(event, tile.id)
                    : undefined
                }
              />
            </div>
          );
        })}
        {rack.length === 0 && <p className="muted">Cap fitxa: has guanyat!</p>}
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
