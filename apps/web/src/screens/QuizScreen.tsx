import { RulesError, applyMove, type Tile } from '@remigi/core';
import { useCallback, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { CheckIcon, EyeIcon, NextIcon, PencilIcon, RedoIcon, UndoIcon } from '../components/icons';
import { TileView, type TileMark } from '../components/TileView';
import {
  meldKeysByTile,
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
  /** Rètol del botó de sortir: on tornes depèn d'on vens (resum o partida). */
  closeLabel: string;
  onClose(): void;
}

/** Com està cada oportunitat: buscant-la, comprovada, o ensenyada. */
type Phase = 'prova' | 'trobada' | 'ensenyada';

/**
 * Els jeroglífics: cada cop que vas robar havent-hi una jugada que valia la pena, la taula i el
 * faristol tornen a ser exactament com eren i la jugada és teva per trobar.
 * Les fitxes que calia moure van marcades i un comptador diu quantes queden;
 * es juga igual que la partida (tocar o arrossegar), amb desfer i refer pas a
 * pas. «Comprova» pregunta al motor de sempre i després corregeix contra la
 * millor jugada: marc verd les fitxes ben col·locades, vermell les que no.
 */
export function QuizScreen({ misses, playerName, closeLabel, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('prova');
  /*
   * L'intent és una història de passos, no un sol estat: així desfer torna
   * enrere moviment a moviment i refer els recupera. Un moviment nou després
   * de desfer estronca el que hi havia per davant, com a tot arreu.
   */
  const [history, setHistory] = useState<TurnDraft[]>(() => [
    startTurn(stateFromMiss(misses[0], playerName), 0),
  ]);
  const [cursor, setCursor] = useState(0);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const [shown, setShown] = useState(0);
  /* Cada oportunitat compta com a trobada un sol cop, corregeixis el que corregeixis. */
  const [scored, setScored] = useState(false);
  const [done, setDone] = useState(false);

  const miss = misses[Math.min(index, misses.length - 1)];
  const attempt = history[cursor];
  const solutionIds = solutionTileIds(miss);
  const trying = phase === 'prova' && !done;

  const moveTileTo = useCallback(
    (tileId: string, destination: Destination) => {
      setHistory((current) => {
        const kept = current.slice(0, cursor + 1);
        return [...kept, moveTile(kept[kept.length - 1], tileId, destination)];
      });
      setCursor(cursor + 1);
      setSelectedTileId(null);
      setError(null);
    },
    [cursor],
  );

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

  const undo = useCallback(() => {
    setCursor((at) => Math.max(0, at - 1));
    setSelectedTileId(null);
    setError(null);
  }, []);

  const redo = useCallback(() => {
    setCursor((at) => Math.min(history.length - 1, at + 1));
    setSelectedTileId(null);
    setError(null);
  }, [history.length]);

  const check = useCallback(() => {
    try {
      // El motor de la partida és qui valida: cap regla duplicada aquí.
      applyMove(stateFromMiss(miss, playerName), toMove(attempt));
      setPhase('trobada');
      if (!scored) {
        setFound((count) => count + 1);
        setScored(true);
      }
      setError(null);
      setSelectedTileId(null);
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [miss, playerName, attempt, scored]);

  const reveal = useCallback(() => {
    if (phase === 'prova') setShown((count) => count + 1);
    setPhase('ensenyada');
    setError(null);
    setSelectedTileId(null);
  }, [phase]);

  /* Tornar de la correcció a l'intent, amb la història sencera intacta. */
  const amend = useCallback(() => {
    setPhase('prova');
    setError(null);
  }, []);

  const goTo = useCallback(
    (nextIndex: number) => {
      setIndex(nextIndex);
      setPhase('prova');
      setHistory([startTurn(stateFromMiss(misses[nextIndex], playerName), 0)]);
      setCursor(0);
      setScored(false);
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
          <h2>Jeroglífics fets</h2>
          <p className="quiz-resultat">
            N’has resolt <strong>{found}</strong> de <strong>{misses.length}</strong>
            {shown > 0 && <> ({shown} {shown === 1 ? 'ensenyat' : 'ensenyats'})</>}.
          </p>
          <p className="muted">
            {found === misses.length
              ? 'Tots resolts: la pròxima partida, baixa-les quan toqui!'
              : 'Ara ja els has vist: la pròxima vegada seran teus.'}
          </p>
        </div>
        <div className="row">
          <button type="button" onClick={restartQuiz}>
            Torna-ho a provar
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            {closeLabel}
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

  /* Les fitxes marcades (la jugada a fer) que encara són al faristol. */
  const total = miss.tilesUsed;
  const rackIds = new Set(attempt.rack.map((tile) => tile.id));
  const remaining = [...solutionIds].filter((id) => rackIds.has(id)).length;

  /*
   * Els marcs. Mentre proves: turquesa a les fitxes que la jugada baixava
   * (siguin encara al faristol o ja col·locades) i daurat a les de la taula
   * que caldrà recol·locar. Comprovada la jugada: verd les que han quedat amb
   * les mateixes companyes que a la solució, vermell les que no. Ensenyada:
   * els marcs d'origen de sempre.
   */
  const marks = new Map<string, TileMark>();
  const futureMoved = movedBoardTileIds(miss.board, miss.solution);
  let correctCount = 0;
  let wrongCount = 0;
  if (phase === 'prova') {
    for (const id of solutionIds) marks.set(id, 'played');
    for (const id of futureMoved) marks.set(id, 'moved');
  } else if (phase === 'trobada') {
    const attemptKeys = meldKeysByTile(attempt.board);
    const solutionKeys = meldKeysByTile(miss.solution);
    const graded = new Set([
      ...playedTileIds(attempt),
      ...movedBoardTileIds(miss.board, attempt.board),
    ]);
    for (const id of graded) {
      const good = attemptKeys.get(id) !== undefined && attemptKeys.get(id) === solutionKeys.get(id);
      marks.set(id, good ? 'correct' : 'wrong');
      if (good) correctCount++;
      else wrongCount++;
    }
    for (const id of solutionIds) {
      if (rackIds.has(id)) marks.set(id, 'played');
    }
  } else {
    for (const id of solutionIds) marks.set(id, 'played');
    for (const id of futureMoved) marks.set(id, 'moved');
  }
  const movedIds = revealed ? futureMoved : movedBoardTileIds(miss.board, attempt.board);
  const perfect = phase === 'trobada' && wrongCount === 0 && remaining === 0;

  const lastOne = index + 1 >= misses.length;
  const draggedTile = drag.dragging
    ? findTile(attempt.board.flat(), attempt.rack, drag.dragging.tileId)
    : null;

  return (
    <section className="game quiz">
      <header className="game-top">
        <div className="quiz-cap">
          <span className="quiz-titol">
            <strong>Jeroglífic</strong> {index + 1} de {misses.length}
          </span>
          <span className="muted quiz-torn">al torn {miss.turn} vas robar</span>
          <button type="button" className="link quiz-surt" onClick={onClose}>
            Surt dels jeroglífics
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
          La jugada d’aquí baixava <strong>{total}</strong>{' '}
          {total === 1 ? 'fitxa: és la' : 'fitxes: són les'} del marc turquesa
          {futureMoved.size > 0 && <> (i les de marc daurat s’hauran de recol·locar)</>}.{' '}
          {remaining > 0 ? (
            <>
              Te’n queden <strong>{remaining}</strong> per col·locar.
            </>
          ) : (
            <>Totes col·locades: comprova la jugada.</>
          )}
          {!miss.hasOpened && (
            <>
              {' '}
              Encara no havies obert: calen <strong>30 punts</strong> i en portes{' '}
              <strong>{openingPoints(attempt)}</strong>.
            </>
          )}
        </p>
      )}
      {phase === 'trobada' &&
        (perfect ? (
          <p className="hint hint-be">
            Perfecte! Les <strong>{correctCount}</strong> fitxes de la millor jugada, cadascuna
            al seu lloc.
          </p>
        ) : (
          <p className="hint hint-be">
            Jugada vàlida: <strong>{correctCount}</strong>{' '}
            {correctCount === 1 ? 'fitxa ben col·locada' : 'fitxes ben col·locades'} (marc verd)
            {wrongCount > 0 && (
              <>
                , <strong>{wrongCount}</strong> en un altre lloc que la millor jugada (marc
                vermell)
              </>
            )}
            {remaining > 0 && (
              <>
                {' '}
                — i en quedaven <strong>{remaining}</strong> per baixar
              </>
            )}
            . Corregeix-la o mira la solució.
          </p>
        ))}
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
              mark={marks.get(tile.id)}
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
                onClick={undo}
                disabled={cursor === 0}
                aria-label="Desfés"
                title="Desfés"
              >
                <UndoIcon />
                <span className="btn-text">Desfés</span>
              </button>
              <button
                type="button"
                className="secondary"
                onClick={redo}
                disabled={cursor >= history.length - 1}
                aria-label="Refés"
                title="Refés"
              >
                <RedoIcon />
                <span className="btn-text">Refés</span>
              </button>
            </>
          )}
          {phase === 'trobada' && !perfect && (
            <button
              type="button"
              className="secondary"
              onClick={amend}
              aria-label="Corregeix"
              title="Corregeix"
            >
              <PencilIcon />
              <span className="btn-text">Corregeix</span>
            </button>
          )}
          {(phase === 'prova' || (phase === 'trobada' && !perfect)) && (
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
              aria-label={lastOne ? 'Acaba els jeroglífics' : 'Següent'}
              title={lastOne ? 'Acaba els jeroglífics' : 'Següent'}
            >
              <NextIcon />
              <span className="btn-text">{lastOne ? 'Acaba els jeroglífics' : 'Següent'}</span>
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
