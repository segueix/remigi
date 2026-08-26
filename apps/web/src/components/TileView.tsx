import { COLOR_LABELS, type Tile } from '@remigi/core';

interface Props {
  tile: Tile;
  selected?: boolean;
  highlighted?: boolean;
  /**
   * Marc d'origen, al repàs: 'played' és una fitxa que baixava del faristol i
   * 'moved' una que ja era a la taula però la jugada recol·locava.
   */
  mark?: 'played' | 'moved';
  /** Acabada de robar del sac: es marca amb un recuadre fins que tornis a jugar. */
  drawn?: boolean;
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
  mark,
  drawn,
  dragging,
  floating,
  onClick,
  onPointerDown,
}: Props) {
  const classes = ['tile'];
  classes.push(tile.kind === 'joker' ? 'tile-joker' : `tile-${tile.color}`);
  if (selected) classes.push('selected');
  if (highlighted) classes.push('highlighted');
  if (mark) classes.push(mark);
  if (drawn) classes.push('drawn');
  if (dragging) classes.push('dragging');
  if (floating) classes.push('floating');

  const label = tile.kind === 'joker' ? 'Joker' : `${tile.value} ${COLOR_LABELS[tile.color]}`;
  // El que es veu amb un cop d'ull s'ha de poder sentir també.
  const notes = [
    drawn && 'acabada de robar',
    mark === 'played' && 'baixava del faristol',
    mark === 'moved' && 'es recol·locava de la taula',
  ].filter(Boolean);

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
      aria-label={notes.length > 0 ? `${label} (${notes.join(', ')})` : label}
    >
      {tile.kind === 'joker' ? '★' : tile.value}
    </button>
  );
}
