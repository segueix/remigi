import type { Destination } from '../game/turnDraft';
import type { Meld } from '@remigi/core';
import type { TileMark } from './TileView';
import { useEffect, useId, useRef, useState } from 'react';
import { useBoardFit } from '../game/useBoardFit';
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
  /**
   * Avisos que van sobre el feltre sense desplaçar-s'hi (el rellotge del torn,
   * què acaba de fer el rival). Van en una capa a part perquè es vegin sempre,
   * encara que la taula estigui desplaçada.
   */
  overlay?: React.ReactNode;
  /**
   * Una norma que explicar, si n'hi ha. No es pinta mai sobre la taula: surt
   * una «i» al costat de la marca «Remigi» i el text només s'obre si la toques
   * (vegeu `NormaInfo`). `urgent` la fa vermella: hi ha jugades que no valen.
   */
  norma?: { text: React.ReactNode; urgent?: boolean } | null;
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
  overlay,
  norma,
  onTileClick,
  onTilePointerDown,
  onMeldClick,
  onNewMeldClick,
}: Props) {
  // La zona de destinació s'ensenya tant si s'ha triat una fitxa amb un clic
  // com si se n'està arrossegant una.
  const choosing = Boolean(selectedTileId) || Boolean(draggingTileId);

  /*
   * Les fitxes s'empetiteixen soles quan la taula no dona més de si, just el
   * que calgui i sense tornar a créixer per no res (vegeu `boardDensity.ts`).
   * La signatura diu quantes jugades hi ha i de quina mida: és el que canvia
   * com s'escampen per la taula, i per tant quan cal tornar a mesurar.
   */
  const boardRef = useRef<HTMLDivElement>(null);
  useBoardFit(boardRef, board.map((meld) => meld.length).join(','));

  return (
    <div className={overlay ? 'board-zona amb-avisos' : 'board-zona'}>
    {/*
     * Tota la taula és zona per crear jugada nova: deixar-hi anar una fitxa en
     * un lloc buit n'obre una. Com que es busca la zona des de l'element de sota
     * cap amunt, deixar-la sobre una jugada concreta hi té preferència.
     */}
    <div className="board" data-drop="new" ref={boardRef} style={{ position: 'relative' }}>
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

      {/*
       * L'espai del botó de jugada nova es reserva sempre, també quan juguen
       * els rivals. Fer-lo aparèixer només després del primer toc canviava
       * l'alçada del tauler i podia trencar el segon toc del doble toc; i
       * reservar-lo només al teu torn feia que les fitxes de la taula
       * s'empetitissin quan et tocava i tornessin a créixer després.
       */}
      {onNewMeldClick && (
        <button
          type="button"
          className={[
            over?.kind === 'new' ? 'new-meld over' : 'new-meld',
            interactive && choosing ? '' : 'new-meld-reservat',
          ]
            .filter(Boolean)
            .join(' ')}
          data-drop={interactive && choosing ? 'new' : undefined}
          onClick={interactive && choosing ? onNewMeldClick : undefined}
          tabIndex={interactive && choosing ? 0 : -1}
          aria-hidden={!(interactive && choosing)}
          disabled={!interactive}
        >
          + Jugada nova
        </button>
      )}
    </div>
    {/*
     * La marca d'aigua del joc i, al costat, la «i» de les normes. Viuen aquí i
     * no dins la taula perquè la taula es desplaça: a dins, el nom pujava amb
     * les jugades quan n'hi havia moltes. Aquí es queda sempre a baix a la
     * dreta del feltre. El nom no rep cap clic ni gest de les fitxes.
     */}
    <div className="marca-zona">
      {norma && <NormaInfo text={norma.text} urgent={norma.urgent} />}
      <span className="marca-taula" aria-hidden="true">
        Remigi
      </span>
    </div>
    {overlay}
    </div>
  );
}

/**
 * La «i» informativa: respira (puja i baixa de llum) mentre hi ha una norma
 * que val la pena llegir, i en vermell si hi ha jugades que no valen. El text
 * no ocupa lloc: surt en un globus només quan es toca, i es tanca tocant la «i»
 * una altra vegada, tocant fora o amb Escape. Si la norma deixa d'aplicar-se
 * (la jugada ja és vàlida), la «i» i el globus desapareixen sols.
 */
function NormaInfo({ text, urgent }: { text: React.ReactNode; urgent?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="norma-info" ref={root}>
      {open && (
        <div
          id={id}
          className={urgent ? 'norma-globus norma-urgent' : 'norma-globus'}
          role="note"
        >
          {text}
        </div>
      )}
      <button
        type="button"
        className={urgent ? 'norma-boto norma-urgent' : 'norma-boto'}
        aria-label={urgent ? 'Hi ha jugades que no valen: toca per veure la norma' : 'Veure la norma'}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
    </div>
  );
}
