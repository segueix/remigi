import type { Destination } from '../game/turnDraft';
import type { Meld } from '@remigi/core';
import type { TileMark } from './TileView';
import { MeldView } from './MeldView';

interface Props {
  board: Meld[];
  invalidIndexes?: ReadonlySet<number>;
  selectedTileId?: string | null;
  draggingTileId?: string | null;
  /** Destinació sota el punter mentre s'arrossega. */
  over?: Destination | null;
  highlighted?: ReadonlySet<string>;
  /** Marc de cada fitxa, al repàs (vegeu TileView). */
  marks?: ReadonlyMap<string, TileMark>;
  /** Bot que ha posat cada fitxa (per identificador), per al marc del seu color. */
  bots?: ReadonlyMap<string, number>;
  /** Actiu només durant el torn del jugador. */
  interactive?: boolean;
  onTileClick?(tileId: string, meldIndex: number): void;
  onTilePointerDown?(event: React.PointerEvent, tileId: string): void;
  onMeldClick?(index: number): void;
  onNewMeldClick?(): void;
}

export function BoardView({
  board,
  invalidIndexes,
  selectedTileId,
  draggingTileId,
  over,
  highlighted,
  marks,
  bots,
  interactive,
  onTileClick,
  onTilePointerDown,
  onMeldClick,
  onNewMeldClick,
}: Props) {
  // La zona de destinació s'ensenya tant si s'ha triat una fitxa amb un clic
  // com si se n'està arrossegant una.
  const choosing = Boolean(selectedTileId) || Boolean(draggingTileId);

  return (
    /*
     * Tota la taula és zona per crear jugada nova: deixar-hi anar una fitxa en
     * un lloc buit n'obre una. Com que es busca la zona des de l'element de sota
     * cap amunt, deixar-la sobre una jugada concreta hi té preferència.
     */
    <div className="board" data-drop="new" style={{ position: 'relative' }}>
      {/*
       * Marca d'aigua del joc: queda integrada al feltre, a baix a la dreta,
       * sense ocupar espai ni interceptar cap clic o gest de les fitxes.
       * Va abans de les jugades perquè, si coincideixen, les fitxes es pintin
       * per sobre i el nom continuï fent de marca del tauler, no d'etiqueta.
       */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '0.85rem',
          bottom: '0.65rem',
          pointerEvents: 'none',
          userSelect: 'none',
          color: 'color-mix(in srgb, var(--feltre-1) 78%, #d8f3e8)',
          fontSize: '1.15rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          lineHeight: 1,
          opacity: 0.72,
          textShadow: '0 1px 1px rgb(0 0 0 / 0.18)',
        }}
      >
        Remigi
      </span>

      {board.length === 0 && !choosing && <p className="muted board-empty">La taula és buida.</p>}

      {board.map((meld, index) => (
        /*
         * Clau per posició i no pel contingut: afegir una fitxa a una jugada no
         * n'ha de crear una de nova, o l'animació de la fitxa acabada de jugar
         * es perdria en tornar-se a muntar. Les jugades no tenen estat propi,
         * així que reaprofitar-les per posició no té cap inconvenient.
         */
        <MeldView
          key={index}
          meld={meld}
          index={index}
          invalid={invalidIndexes?.has(index)}
          isTarget={interactive && choosing}
          isOver={over?.kind === 'meld' && over.index === index}
          selectedTileId={selectedTileId}
          draggingTileId={draggingTileId}
          highlighted={highlighted}
          marks={marks}
          bots={bots}
          onTileClick={interactive ? (tileId) => onTileClick?.(tileId, index) : undefined}
          onTilePointerDown={interactive ? onTilePointerDown : undefined}
          onMeldClick={interactive && selectedTileId ? () => onMeldClick?.(index) : undefined}
        />
      ))}

      {/* No porta la classe .meld a posta: no és una jugada, és com se'n crea una. */}
      {interactive && choosing && (
        <button
          type="button"
          className={over?.kind === 'new' ? 'new-meld over' : 'new-meld'}
          data-drop="new"
          onClick={onNewMeldClick}
        >
          + Jugada nova
        </button>
      )}
    </div>
  );
}
