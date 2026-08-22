import { COLOR_LABELS, type Tile } from '@rummikub/core';

interface Props {
  tile: Tile;
  selected?: boolean;
  highlighted?: boolean;
  onClick?(): void;
}

/** Una fitxa. Fons crema i número acolorit, com les de debò. */
export function TileView({ tile, selected, highlighted, onClick }: Props) {
  const classes = ['tile'];
  if (tile.kind === 'joker') classes.push('tile-joker');
  else classes.push(`tile-${tile.color}`);
  if (selected) classes.push('selected');
  if (highlighted) classes.push('highlighted');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={tile.kind === 'joker' ? 'Joker' : `${tile.value} ${COLOR_LABELS[tile.color]}`}
    >
      {tile.kind === 'joker' ? '★' : tile.value}
    </button>
  );
}
