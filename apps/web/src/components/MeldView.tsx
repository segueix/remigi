import { analyzeMeld, type Meld } from '@rummikub/core';
import type { MeldAuthor } from '../game/meldOwners';
import { TileView } from './TileView';

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
  /** Bot que hi ha jugat per últim cop: dona color al marc de la jugada. */
  author?: MeldAuthor | null;
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
  author,
  onTileClick,
  onTilePointerDown,
  onMeldClick,
}: Props) {
  const info = analyzeMeld(meld);
  const classes = ['meld'];
  if (invalid) classes.push('invalid');
  if (isTarget) classes.push('target');
  if (isOver) classes.push('over');
  if (author) classes.push('owned');

  const state = info.valid ? `${info.points} punts` : info.reason;

  return (
    <div
      className={classes.join(' ')}
      data-drop={`meld:${index}`}
      /* El color del marc també s'ha de poder llegir: qui hi ha jugat, en text. */
      data-bot={author ? author.slot : undefined}
      onClick={onMeldClick}
      role={isTarget ? 'button' : undefined}
      title={author ? `${state} · hi ha jugat ${author.name}` : state}
    >
      {meld.map((tile) => (
        <TileView
          key={tile.id}
          tile={tile}
          selected={tile.id === selectedTileId}
          dragging={tile.id === draggingTileId}
          highlighted={highlighted?.has(tile.id)}
          onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
          onPointerDown={
            onTilePointerDown ? (event) => onTilePointerDown(event, tile.id) : undefined
          }
        />
      ))}
    </div>
  );
}
