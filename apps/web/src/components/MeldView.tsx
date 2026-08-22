import { analyzeMeld, type Meld } from '@rummikub/core';
import { TileView } from './TileView';

interface Props {
  meld: Meld;
  invalid?: boolean;
  /** Hi ha una fitxa seleccionada, així que la jugada és una destinació. */
  isTarget?: boolean;
  selectedTileId?: string | null;
  highlighted?: ReadonlySet<string>;
  onTileClick?(tileId: string): void;
  onMeldClick?(): void;
}

export function MeldView({
  meld,
  invalid,
  isTarget,
  selectedTileId,
  highlighted,
  onTileClick,
  onMeldClick,
}: Props) {
  const info = analyzeMeld(meld);
  const classes = ['meld'];
  if (invalid) classes.push('invalid');
  if (isTarget) classes.push('target');

  return (
    <div
      className={classes.join(' ')}
      onClick={onMeldClick}
      role={isTarget ? 'button' : undefined}
      title={info.valid ? `${info.points} punts` : info.reason}
    >
      {meld.map((tile) => (
        <TileView
          key={tile.id}
          tile={tile}
          selected={tile.id === selectedTileId}
          highlighted={highlighted?.has(tile.id)}
          onClick={onTileClick ? () => onTileClick(tile.id) : undefined}
        />
      ))}
    </div>
  );
}
