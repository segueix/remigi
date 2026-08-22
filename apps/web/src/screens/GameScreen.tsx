import { difficultyByKey, finalScores, findRackMelds, type Tile } from '@rummikub/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { RackView } from '../components/RackView';
import { TileView } from '../components/TileView';
import { useDragTile } from '../game/useDragTile';
import { invalidMeldIndexes, missingOpeningPoints, openingPoints } from '../game/turnDraft';
import { useGame, type GameHandle, type GameSetup } from '../game/useGame';
import type { RatingChange } from '../state/gameOutcome';
import type { SavedGameHandle } from '../state/useSavedGame';
import type { ProfileHandle } from '../state/useProfile';
import { useRecordResult } from '../state/useRecordResult';
import type { GameState } from '@rummikub/core';

interface Props {
  setup: GameSetup;
  /** Partida a reprendre; si no n'hi ha, se'n reparteix una de nova. */
  resume?: GameState;
  profile: ProfileHandle;
  savedGame: SavedGameHandle;
  onExit(): void;
}

export function GameScreen({ setup, resume, profile, savedGame, onExit }: Props) {
  const handle = useGame(setup, resume);
  const { game, draft, selectedTileId, error, highlighted, isHumanTurn } = handle;
  const change = useRecordResult(game, setup.opponents, profile);
  const [helpOn, setHelpOn] = useState(false);

  const { moveTileTo } = handle;
  const drag = useDragTile(isHumanTurn, moveTileTo);

  // La partida es desa a cada moviment, i s'esborra quan s'acaba: així es pot
  // tancar la pestanya a mitges i continuar-la després.
  const { persist, clear } = savedGame;
  useEffect(() => {
    if (game.status === 'playing') persist({ setup, game });
    else clear();
  }, [game, setup, persist, clear]);

  // Fitxes de la mà que poden formar alguna jugada. Només es calcula quan
  // l'ajuda està encesa i quan canvia el faristol.
  const suggested = useMemo(() => {
    if (!helpOn || !draft) return new Set<string>();
    const ids = new Set<string>();
    for (const candidate of findRackMelds(draft.rack, true)) {
      for (const tile of candidate.meld) ids.add(tile.id);
    }
    return ids;
  }, [helpOn, draft]);

  /**
   * Un sol gest per a tot: si no hi ha res triat, el clic tria la fitxa; si n'hi
   * ha, el clic diu on deixar-la. Tornar a clicar la fitxa triada la desmarca.
   * Un clic que ve de deixar anar una fitxa arrossegada s'ignora.
   */
  const handleTileClick = useCallback(
    (tileId: string, meldIndex: number | null) => {
      if (drag.consumeDragFlag()) return;
      if (!selectedTileId) return handle.selectTile(tileId);
      if (selectedTileId === tileId) return handle.selectTile(null);
      handle.placeSelected(
        meldIndex === null ? { kind: 'rack' } : { kind: 'meld', index: meldIndex },
      );
    },
    [drag, handle, selectedTileId],
  );

  if (game.status === 'finished') {
    return <GameOver handle={handle} change={change} onExit={onExit} />;
  }

  const human = game.players[0];
  const invalid = draft ? invalidMeldIndexes(draft) : new Set<number>();
  const needsOpening = draft !== null && !human.hasOpened;
  const draggedTile = drag.dragging ? findTile(draft?.board.flat(), draft?.rack, drag.dragging.tileId) : null;

  return (
    <section className="game">
      <ul className="players">
        {game.players.map((player, index) => (
          <li key={player.id} className={index === game.currentPlayer ? 'player active' : 'player'}>
            <span className="player-name">
              {player.name}
              {player.kind === 'ai' && (
                <span className="tag">{difficultyByKey(player.aiLevel).label}</span>
              )}
              {!player.hasOpened && <span className="tag">sense obrir</span>}
            </span>
            <span className="muted">{player.rack.length} fitxes</span>
          </li>
        ))}
      </ul>

      {/* Els canvis de torn i els errors s'anuncien als lectors de pantalla. */}
      <p className="muted turn-line" aria-live="polite">
        Torn {game.turn} ·{' '}
        {isHumanTurn ? 'et toca a tu' : `juga ${game.players[game.currentPlayer].name}…`} ·{' '}
        {game.bag.length} fitxes al sac
      </p>

      <BoardView
        board={draft ? draft.board : game.board}
        invalidIndexes={invalid}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        over={drag.dragging?.over ?? null}
        highlighted={highlighted}
        interactive={isHumanTurn}
        onTileClick={handleTileClick}
        onTilePointerDown={drag.start}
        onMeldClick={(index) => handle.placeSelected({ kind: 'meld', index })}
        onNewMeldClick={() => handle.placeSelected({ kind: 'new' })}
      />

      {needsOpening && (
        <p className="hint">
          {missingOpeningPoints(draft) > 0 ? (
            <>
              Encara no has obert: la primera jugada ha de sumar 30 punts i en portes{' '}
              <strong>{openingPoints(draft)}</strong>.
              {/*
               * Dir només «en portes 0» amb fitxes a la taula desconcerta: sembla
               * que el joc no les vegi. El que passa és que les jugades que no
               * són vàlides no sumen, i val més dir-ho aquí mateix.
               */}
              {invalid.size > 0 && (
                <>
                  {' '}
                  Les jugades marcades en vermell no compten: han de ser{' '}
                  <strong>grups</strong> (mateix número, colors diferents) o{' '}
                  <strong>escales</strong> (mateix color, números seguits), i totes les fitxes
                  d’una jugada han d’anar a la mateixa caixa.
                </>
              )}
            </>
          ) : (
            <>Ja tens els 30 punts de la sortida inicial: pots acabar la jugada.</>
          )}
        </p>
      )}

      <p className="error-slot" role="alert">
        {error && <span className="error">{error}</span>}
      </p>

      <RackView
        rack={draft ? draft.rack : human.rack}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        isOver={drag.dragging?.over?.kind === 'rack'}
        suggested={suggested}
        helpOn={helpOn}
        interactive={isHumanTurn}
        onToggleHelp={() => setHelpOn((on) => !on)}
        onTileClick={(tileId) => handleTileClick(tileId, null)}
        onTilePointerDown={drag.start}
        onReturnToRack={() => handle.placeSelected({ kind: 'rack' })}
      />

      <div className="row actions">
        <button onClick={handle.commit} disabled={!isHumanTurn || !handle.canCommit}>
          Acabar jugada
        </button>
        <button className="secondary" onClick={handle.draw} disabled={!isHumanTurn}>
          {game.bag.length === 0 ? 'Passar torn' : 'Robar fitxa'}
        </button>
        <button
          className="secondary"
          onClick={handle.resetTurn}
          disabled={!isHumanTurn || !handle.canCommit}
        >
          Desfer canvis
        </button>
        <button className="link" onClick={onExit}>
          Deixar la partida
        </button>
      </div>

      {/* Còpia que segueix el punter. No rep clics: així no tapa la destinació. */}
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

function findTile(board: Tile[] | undefined, rack: Tile[] | undefined, id: string): Tile | null {
  return board?.find((t) => t.id === id) ?? rack?.find((t) => t.id === id) ?? null;
}

function GameOver({
  handle,
  change,
  onExit,
}: {
  handle: GameHandle;
  change: RatingChange | null;
  onExit(): void;
}) {
  const { game } = handle;
  const scores = finalScores(game);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const blocked = winner ? winner.rack.length > 0 : false;
  const humanWon = game.winnerId === game.players[0].id;

  return (
    <section className={humanWon ? 'card game-over won' : 'card game-over'}>
      <h2>{humanWon ? 'Has guanyat!' : `Ha guanyat ${winner?.name}`}</h2>
      <p className="muted">
        {blocked
          ? 'Ningú no s’ha pogut desfer de totes les fitxes: la partida ha quedat bloquejada i guanya qui tenia menys punts a la mà.'
          : `${winner?.name} s’ha quedat sense fitxes en ${game.turn} torns.`}
      </p>

      <ul className="scores">
        {[...scores]
          .sort((a, b) => b.points - a.points)
          .map((score) => (
            <li key={score.playerId} className={score.playerId === game.winnerId ? 'winner' : ''}>
              <span>{score.name}</span>
              <span className={score.points >= 0 ? 'points-positive' : 'points-negative'}>
                {score.points > 0 ? '+' : ''}
                {score.points}
              </span>
            </li>
          ))}
      </ul>

      {change && (
        <p className="rating-change">
          La teva habilitat: {change.before} → <strong>{change.after}</strong>{' '}
          <span className={change.delta >= 0 ? 'points-positive' : 'points-negative'}>
            ({change.delta >= 0 ? '+' : ''}
            {change.delta})
          </span>
        </p>
      )}

      <div className="row">
        <button onClick={() => handle.restart()}>Una altra partida</button>
        <button className="secondary" onClick={onExit}>
          Torna a l’inici
        </button>
      </div>
    </section>
  );
}
