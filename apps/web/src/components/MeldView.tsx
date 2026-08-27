import { analyzeMeld, type Meld } from '@remigi/core';
import { TileView, type TileMark } from './TileView';

interface Props {
  meld: Meld;
  index: number;
  invalid?: boolean;
  /** Hi ha una fitxa triada o s'està arrossegant: la jugada és una destinació. */
  isTarget?: boolean;
  /** La fitxa que s'arrossega és just a sobre d'aquesta jugada. */
  isOver?: boolean;
  selectedTileId?: string | null;
  draggingTileId?: string | null;
  highlighted?: ReadonlySet<string>;
  /** Marc de cada fitxa, al repàs (vegeu TileView). */
  marks?: ReadonlyMap<string, TileMark>;
  /** Bot que ha posat cada fitxa (per identificador). */
  bots?: ReadonlyMap<string, number>;
  onTileClick?(tileId: string): void;
  onTilePointerDown?(event: React.PointerEvent, tileId: string): void;
  onMeldClick?(): void;
}

export function MeldView({
  meld,
  index,
  invalid,
  isTarget,
  isOver,
  selectedTileId,
  draggingTileId,
  highlighted,
  marks,
  bots,
  onTileClick,
  onTilePointerDown,
  onMeldClick,
}: Props) {
  const info = analyzeMeld(meld);
  const classes = ['meld'];
  if (invalid) classes.push('invalid');
  if (isTarget) classes.push('target');
  if (isOver) classes.push('over');

  const state = info.valid ? `${info.points} punts` : info.reason;

  return (
    <div
      className={classes.join(' ')}
      data-drop={`meld:${index}`}
      onClick={onMeldClick}
      role={isTarget ? 'button' : undefined}
      title={state}
    >
      {meld.map((tile) => (
        <TileView
          key={tile.id}
          tile={tile}
          selected={tile.id === selectedTileId}
          dragging={tile.id === draggingTileId}
          highlighted={highlighted?.has(tile.id)}
          mark={marks?.get(tile.id)}
          bot={bots?.get(tile.id)}
          onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
          onPointerDown={
            onTilePointerDown ? (event) => onTilePointerDown(event, tile.id) : undefined
          }
        />
      ))}
    </div>
  );
}
