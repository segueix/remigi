import { COLOR_LABELS, type Tile } from '@rummikub/core';

interface Props {
  tile: Tile;
  selected?: boolean;
  highlighted?: boolean;
  /** Marcada com a part d'una jugada possible (ajuda opcional). */
  suggested?: boolean;
  /** S'està arrossegant: es queda enrere, esmorteïda. */
  dragging?: boolean;
  /** Còpia que segueix el punter mentre s'arrossega. */
  floating?: boolean;
  onClick?(): void;
  onPointerDown?(event: React.PointerEvent): void;
}

/** Una fitxa. Fons crema i número acolorit, com les de debò. */
export function TileView({
  tile,
  selected,
  highlighted,
  suggested,
  dragging,
  floating,
  onClick,
  onPointerDown,
}: Props) {
  const classes = ['tile'];
  classes.push(tile.kind === 'joker' ? 'tile-joker' : `tile-${tile.color}`);
  if (selected) classes.push('selected');
  if (highlighted) classes.push('highlighted');
  if (suggested) classes.push('suggested');
  if (dragging) classes.push('dragging');
  if (floating) classes.push('floating');

  const label = tile.kind === 'joker' ? 'Joker' : `${tile.value} ${COLOR_LABELS[tile.color]}`;

  if (floating) {
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        {tile.kind === 'joker' ? '★' : tile.value}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onPointerDown={onPointerDown}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={suggested ? `${label} (pot formar jugada)` : label}
    >
      {tile.kind === 'joker' ? '★' : tile.value}
    </button>
  );
}
