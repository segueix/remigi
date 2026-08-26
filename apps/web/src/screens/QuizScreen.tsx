import { RulesError, applyMove, type Tile } from '@remigi/core';
import { useCallback, useMemo, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { CheckIcon, EyeIcon, NextIcon, UndoIcon } from '../components/icons';
import { TileView } from '../components/TileView';
import {
  movedBoardTileIds,
  solutionTileIds,
  stateFromMiss,
  type MissedChance,
} from '../game/missedChances';
import {
  hasChanges,
  invalidMeldIndexes,
  moveTile,
  openingPoints,
  playedTileIds,
  startTurn,
  toMove,
  type Destination,
  type TurnDraft,
} from '../game/turnDraft';
import { useDragTile } from '../game/useDragTile';

interface Props {
  misses: MissedChance[];
  playerName: string;
  /** Torna al resum del final de partida. */
  onClose(): void;
}

/** Com està cada oportunitat: buscant-la, trobada, o ensenyada sense trobar. */
type Phase = 'prova' | 'trobada' | 'ensenyada';

/**
 * El quiz del repàs: cada cop que vas robar havent-hi jugada, la taula i el
 * faristol tornen a ser exactament com eren i la jugada és teva per trobar.
 * Es juga igual que la partida (tocar o arrossegar), i «Comprova» pregunta al
 * mateix motor de sempre; si no surt, la solució s'ensenya sobre el tauler.
 */
export function QuizScreen({ misses, playerName, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('prova');
  const [attempt, setAttempt] = useState<TurnDraft>(() =>
    startTurn(stateFromMiss(misses[0], playerName), 0),
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);

  const miss = misses[Math.min(index, misses.length - 1)];
  const solutionIds = useMemo(() => solutionTileIds(miss), [miss]);
  const trying = phase === 'prova' && !done;

  const moveTileTo = useCallback((tileId: string, destination: Destination) => {
    setAttempt((current) => moveTile(current, tileId, destination));
    setSelectedTileId(null);
    setError(null);
  }, []);

  const drag = useDragTile(trying, moveTileTo);

  const placeSelected = useCallback(
    (destination: Destination) => {
      if (selectedTileId) moveTileTo(selectedTileId, destination);
    },
    [selectedTileId, moveTileTo],
  );

  /* El mateix gest que al joc: un toc tria la fitxa, el següent diu on va. */
  const handleTileClick = useCallback(
    (tileId: string, meldIndex: number | null) => {
      if (drag.consumeDragFlag()) return;
      if (!trying) return;
      if (!selectedTileId) return setSelectedTileId(tileId);
      if (selectedTileId === tileId) return setSelectedTileId(null);
      placeSelected(meldIndex === null ? { kind: 'rack' } : { kind: 'meld', index: meldIndex });
    },
    [drag, trying, selectedTileId, placeSelected],
  );

  const check = useCallback(() => {
    try {
      // El motor de la partida és qui corregeix: cap regla duplicada aquí.
      applyMove(stateFromMiss(miss, playerName), toMove(attempt));
      setPhase('trobada');
      setFound((count) => count + 1);
      setError(null);
      setSelectedTileId(null);
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [miss, playerName, attempt]);

  const reveal = useCallback(() => {
    if (phase === 'prova') setShown((count) => count + 1);
    setPhase('ensenyada');
    setError(null);
    setSelectedTileId(null);
  }, [phase]);

  const resetAttempt = useCallback(() => {
    setAttempt(startTurn(stateFromMiss(miss, playerName), 0));
    setSelectedTileId(null);
    setError(null);
  }, [miss, playerName]);

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      setPhase('prova');
      setAttempt(startTurn(stateFromMiss(misses[nextIndex], playerName), 0));
      setSelectedTileId(null);
      setError(null);
    },
    [misses, playerName],
  );

  const next = useCallback(() => {
    if (index + 1 < misses.length) goTo(index + 1);
    else setDone(true);
  }, [index, misses.length, goTo]);

  const restartQuiz = useCallback(() => {
    setFound(0);
    setShown(0);
    setDone(false);
    goTo(0);
  }, [goTo]);

  if (done) {
    return (
      <section className="card game-over quiz-final">
        <div className="franja-fitxes" aria-hidden="true" />
        <div className="final-cap">
          <span className="final-emoji" aria-hidden="true">
            {found === misses.length ? '🏅' : '🔍'}
          </span>
          <h2>Repàs acabat</h2>
          <p className="quiz-resultat">
            Has trobat <strong>{found}</strong> de <strong>{misses.length}</strong>{' '}
            {misses.length === 1 ? 'jugada' : 'jugades'}
            {shown > 0 && <> ({shown} {shown === 1 ? 'ensenyada' : 'ensenyades'})</>}.
          </p>
          <p className="muted">
            {found === misses.length
              ? 'Totes trobades: la pròxima partida, baixa-les quan toqui!'
              : 'Ara ja les has vist: la pròxima vegada seran teves.'}
          </p>
        </div>
        <div className="row">
          <button type="button" onClick={restartQuiz}>
            Torna-ho a provar
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Torna al resum
          </button>
        </div>
      </section>
    );
  }

  const revealed = phase === 'ensenyada';
  const board = revealed ? miss.solution : attempt.board;
  const rack = revealed
    ? miss.rack.filter((tile) => !solutionIds.has(tile.id))
    : attempt.rack;
  const invalid = revealed ? new Set<number>() : invalidMeldIndexes(attempt);
  const highlighted = revealed
    ? solutionIds
    : phase === 'trobada'
      ? playedTileIds(attempt)
      : new Set<string>();
  const placedCount = playedTileIds(attempt).size;

  /*
   * Els marcs d'origen, quan la jugada ja està feta (trobada o ensenyada):
   * turquesa per a les fitxes que baixaven del faristol, daurat per a les que
   * ja eren a la taula però la jugada recol·locava. Les que no s'han mogut no
   * porten res: així es veu de cop què era teu i què s'havia de remenar.
   */
  const marks = new Map<string, 'played' | 'moved'>();
  const movedIds = phase === 'prova' ? new Set<string>() : movedBoardTileIds(miss.board, board);
  if (phase !== 'prova') {
    for (const id of revealed ? solutionIds : playedTileIds(attempt)) marks.set(id, 'played');
    for (const id of movedIds) marks.set(id, 'moved');
  }
  const lastOne = index + 1 >= misses.length;
  const draggedTile = drag.dragging
    ? findTile(attempt.board.flat(), attempt.rack, drag.dragging.tileId)
    : null;

  return (
    <section className="game quiz">
      <header className="game-top">
        <div className="quiz-cap">
          <span className="quiz-titol">
            <strong>Repàs</strong> · oportunitat {index + 1} de {misses.length}
          </span>
          <span className="muted quiz-torn">al torn {miss.turn} vas robar</span>
          <button type="button" className="link quiz-surt" onClick={onClose}>
            Surt del repàs
          </button>
        </div>
      </header>

      <BoardView
        board={board}
        invalidIndexes={invalid}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        over={drag.dragging?.over ?? null}
        highlighted={highlighted}
        marks={marks}
        interactive={trying}
        onTileClick={handleTileClick}
        onTilePointerDown={drag.start}
        onMeldClick={(meldIndex) => placeSelected({ kind: 'meld', index: meldIndex })}
        onNewMeldClick={() => placeSelected({ kind: 'new' })}
      />

      {phase === 'prova' && (
        <p className="hint">
          Aquí hi havia jugada possible. Col·loca les fitxes com al joc i comprova-la.
          {!miss.hasOpened && (
            <>
              {' '}
              Encara no havies obert: calen <strong>30 punts</strong> i en portes{' '}
              <strong>{openingPoints(attempt)}</strong>.
            </>
          )}
        </p>
      )}
      {phase === 'trobada' && (
        <p className="hint hint-be">
          L’has trobada! Has baixat les <strong>{placedCount}</strong>{' '}
          {placedCount === 1 ? 'fitxa' : 'fitxes'} de marc turquesa
          {movedIds.size > 0 && (
            <>
              {' '}
              (les de marc daurat ja eren a la taula i les has recol·locat)
            </>
          )}
          {placedCount < miss.tilesUsed ? (
            <>
              {' '}
              — la millor jugada en baixava <strong>{miss.tilesUsed}</strong>: mira-la si vols.
            </>
          ) : (
            <> — tantes com la millor jugada que es va trobar.</>
          )}
        </p>
      )}
      {revealed && (
        <p className="hint hint-be">
          La jugada: es podien baixar les <strong>{solutionIds.size}</strong> fitxes de{' '}
          <strong>marc turquesa</strong>, del teu faristol
          {movedIds.size > 0 ? (
            <>
              , recol·locant les <strong>{movedIds.size}</strong> de{' '}
              <strong>marc daurat</strong> que ja eren a la taula.
            </>
          ) : (
            <>. La resta de la taula es quedava com estava.</>
          )}
        </p>
      )}

      <p className="error-slot" role="alert">
        {error && <span className="error">{error}</span>}
      </p>

      <section className="rack-area">
        <header className="rack-header">
          <div className="rack-tools">
            <span className="muted">
              El teu faristol d’aquell moment · {rack.length}{' '}
              {rack.length === 1 ? 'fitxa' : 'fitxes'}
            </span>
          </div>
        </header>
        <div className={drag.dragging?.over?.kind === 'rack' ? 'rack over' : 'rack'} data-drop="rack">
          {rack.map((tile) => (
            <TileView
              key={tile.id}
              tile={tile}
              selected={tile.id === selectedTileId}
              dragging={tile.id === drag.dragging?.tileId}
              onClick={trying ? () => handleTileClick(tile.id, null) : undefined}
              onPointerDown={trying ? (event) => drag.start(event, tile.id) : undefined}
            />
          ))}
          {rack.length === 0 && <p className="muted">Cap fitxa per baixar.</p>}
        </div>
      </section>

      <div className="accions-costat">
        <div className="row actions">
          {phase === 'prova' && (
            <>
              <button
                type="button"
                onClick={check}
                disabled={!hasChanges(attempt)}
                aria-label="Comprova la jugada"
                title="Comprova la jugada"
              >
                <CheckIcon />
                <span className="btn-text">Comprova la jugada</span>
              </button>
              <button
                type="button"
                className="secondary"
                onClick={resetAttempt}
                disabled={!hasChanges(attempt)}
                aria-label="Desfés"
                title="Desfés"
              >
                <UndoIcon />
                <span className="btn-text">Desfés</span>
              </button>
            </>
          )}
          {(phase === 'prova' || (phase === 'trobada' && placedCount < miss.tilesUsed)) && (
            <button
              type="button"
              className="secondary"
              onClick={reveal}
              aria-label="Mostra la solució"
              title="Mostra la solució"
            >
              <EyeIcon />
              <span className="btn-text">Mostra la solució</span>
            </button>
          )}
          {phase !== 'prova' && (
            <button
              type="button"
              onClick={next}
              aria-label={lastOne ? 'Acaba el repàs' : 'Següent'}
              title={lastOne ? 'Acaba el repàs' : 'Següent'}
            >
              <NextIcon />
              <span className="btn-text">{lastOne ? 'Acaba el repàs' : 'Següent'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Còpia que segueix el punter, com al joc. */}
      {drag.dragging && draggedTile && (
        <div
          className="drag-layer"
          style={{ transform: `translate(${drag.dragging.x}px, ${drag.dragging.y}px)` }}
        >
          <TileView tile={draggedTile} floating />
        </div>
      )}
    </section>
  );
}

function findTile(board: Tile[], rack: Tile[], id: string): Tile | null {
  return board.find((t) => t.id === id) ?? rack.find((t) => t.id === id) ?? null;
}
