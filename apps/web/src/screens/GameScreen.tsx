import { difficultyByKey, finalScores } from '@rummikub/core';
import { BoardView } from '../components/BoardView';
import { RackView } from '../components/RackView';
import { invalidMeldIndexes, missingOpeningPoints, openingPoints } from '../game/turnDraft';
import { useGame, type GameHandle, type GameSetup } from '../game/useGame';

interface Props {
  setup: GameSetup;
  onExit(): void;
}

export function GameScreen({ setup, onExit }: Props) {
  const handle = useGame(setup);
  const { game, draft, selectedTileId, error, highlighted, isHumanTurn } = handle;

  if (game.status === 'finished') {
    return <GameOver handle={handle} onExit={onExit} />;
  }

  const human = game.players[0];
  const invalid = draft ? invalidMeldIndexes(draft) : new Set<number>();
  const needsOpening = draft !== null && !human.hasOpened;

  /**
   * Un sol gest per a tot: si no hi ha res seleccionat, el clic tria la fitxa;
   * si n'hi ha, el clic diu on deixar-la (la jugada on has clicat, o el
   * faristol). Tornar a clicar la fitxa triada la deselecciona.
   */
  function handleTileClick(tileId: string, meldIndex: number | null) {
    if (!selectedTileId) return handle.selectTile(tileId);
    if (selectedTileId === tileId) return handle.selectTile(null);
    handle.placeSelected(meldIndex === null ? { kind: 'rack' } : { kind: 'meld', index: meldIndex });
  }

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

      <p className="muted turn-line">
        Torn {game.turn} · {isHumanTurn ? 'et toca a tu' : `juga ${game.players[game.currentPlayer].name}…`} ·{' '}
        {game.bag.length} fitxes al sac
      </p>

      <BoardView
        board={draft ? draft.board : game.board}
        invalidIndexes={invalid}
        selectedTileId={selectedTileId}
        highlighted={highlighted}
        interactive={isHumanTurn}
        onTileClick={handleTileClick}
        onMeldClick={(index) => handle.placeSelected({ kind: 'meld', index })}
        onNewMeldClick={() => handle.placeSelected({ kind: 'new' })}
      />

      {needsOpening && (
        <p className="hint">
          {missingOpeningPoints(draft) > 0 ? (
            <>
              Encara no has obert: la primera jugada ha de sumar 30 punts i en portes{' '}
              <strong>{openingPoints(draft)}</strong>.
            </>
          ) : (
            <>Ja tens els 30 punts de la sortida inicial: pots acabar la jugada.</>
          )}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <RackView
        rack={draft ? draft.rack : human.rack}
        selectedTileId={selectedTileId}
        interactive={isHumanTurn}
        onTileClick={(tileId) => handleTileClick(tileId, null)}
        onRackClick={() => selectedTileId && handle.placeSelected({ kind: 'rack' })}
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
    </section>
  );
}

function GameOver({ handle, onExit }: { handle: GameHandle; onExit(): void }) {
  const { game } = handle;
  const scores = finalScores(game);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const blocked = winner ? winner.rack.length > 0 : false;
  const humanWon = game.winnerId === game.players[0].id;

  return (
    <section className="card">
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

      <p className="notice">
        Aquest resultat encara no compta per al teu perfil: l’habilitat i
        l’historial s’actualitzaran a partir de la Fase 4.
      </p>

      <div className="row">
        <button onClick={() => handle.restart()}>Una altra partida</button>
        <button className="secondary" onClick={onExit}>
          Torna a l’inici
        </button>
      </div>
    </section>
  );
}
