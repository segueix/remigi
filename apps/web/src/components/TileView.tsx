import { COLOR_LABELS, type Tile, type TileColor } from '@remigi/core';

/** Marc d'una fitxa al repàs: d'on venia, o com ha quedat un cop corregida. */
export type TileMark = 'played' | 'moved' | 'correct' | 'wrong';

interface Props {
  tile: Tile;
  selected?: boolean;
  highlighted?: boolean;
  /**
   * Marc del repàs: 'played' (baixava del faristol) i 'moved' (es
   * recol·locava de la taula) diuen l'origen; 'correct' i 'wrong' diuen, un
   * cop comprovada la jugada, si la fitxa ha quedat com a la solució.
   */
  mark?: TileMark;
  /**
   * Bot que acaba de posar aquesta fitxa a la taula (l'últim moviment): el
   * número li dona el marc del seu color, fitxa a fitxa.
   */
  bot?: number;
  /** Acabada de robar del sac: es marca amb un recuadre fins que tornis a jugar. */
  drawn?: boolean;
  /** S'està arrossegant: es queda enrere, esmorteïda. */
  dragging?: boolean;
  /** Còpia que segueix el punter mentre s'arrossega. */
  floating?: boolean;
  onClick?(): void;
  onPointerDown?(event: React.PointerEvent): void;
}

/**
 * La forma de cada color, petita i al racó de dalt a la dreta: així el color
 * també es pot llegir sense veure'l (daltonisme). Triangle per al vermell (el
 * dels senyals), cercle per al blau, quadrat per al negre i rombe per al
 * taronja: quatre siluetes que no s'assemblen gens entre elles. Es pinta amb
 * `currentColor`: del color de la tinta a les fitxes clàssiques i blanca a
 * les de color, com el número.
 */
export function ColorShape({ color }: { color: TileColor }) {
  return (
    <svg className="tile-forma" viewBox="0 0 10 10" aria-hidden="true">
      {color === 'red' && <polygon points="5,0.8 9.5,9 0.5,9" />}
      {color === 'blue' && <circle cx="5" cy="5" r="4.3" />}
      {color === 'black' && <rect x="0.9" y="0.9" width="8.2" height="8.2" rx="1" />}
      {color === 'orange' && <polygon points="5,0.2 9.8,5 5,9.8 0.2,5" />}
    </svg>
  );
}

/** Una fitxa, amb el número i la forma del seu color. */
export function TileView({
  tile,
  selected,
  highlighted,
  mark,
  bot,
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
    bot !== undefined && 'acabada de posar per un rival',
    mark === 'played' && 'baixava del faristol',
    mark === 'moved' && 'es recol·locava de la taula',
    mark === 'correct' && 'ben col·locada',
    mark === 'wrong' && 'en un altre lloc que la millor jugada',
  ].filter(Boolean);

  const contents = (
    <>
      {tile.kind === 'joker' ? '★' : tile.value}
      {tile.kind === 'number' && <ColorShape color={tile.color} />}
    </>
  );

  if (floating) {
    return (
      <span className={classes.join(' ')} aria-hidden="true">
        {contents}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-bot={bot}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onPointerDown={onPointerDown}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={notes.length > 0 ? `${label} (${notes.join(', ')})` : label}
    >
      {contents}
    </button>
  );
}
