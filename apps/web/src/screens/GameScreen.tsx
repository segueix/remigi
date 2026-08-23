import { difficultyByKey, finalScores, type Tile } from '@rummikub/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { CheckIcon, DrawIcon, PassIcon, RotateIcon, UndoIcon } from '../components/icons';
import { PlayerMenu } from '../components/PlayerMenu';
import { RackView } from '../components/RackView';
import { TileView } from '../components/TileView';
import { useDragTile } from '../game/useDragTile';
import { botPersona } from '../game/bots';
import { meldAuthors } from '../game/meldOwners';
import { invalidMeldIndexes, missingOpeningPoints, openingPoints } from '../game/turnDraft';
import { useGame, type GameHandle, type GameSetup } from '../game/useGame';
import type { RatingChange } from '../state/gameOutcome';
import type { SavedGame } from '../state/savedGame';
import type { SavedGameHandle } from '../state/useSavedGame';
import type { ProfileHandle } from '../state/useProfile';
import { useRecordResult } from '../state/useRecordResult';
import type { GameState } from '@rummikub/core';

interface Props {
  setup: GameSetup;
  /** Partida a reprendre; si no n'hi ha, se'n reparteix una de nova. */
  resume?: GameState;
  /** Autors de les jugades de la partida represa, per no perdre'n els colors. */
  resumeOwners?: SavedGame['owners'];
  profile: ProfileHandle;
  savedGame: SavedGameHandle;
  /** Obre l'historial (les estadístiques). */
  onHistory(): void;
}

export function GameScreen({ setup, resume, resumeOwners, profile, savedGame, onHistory }: Props) {
  /*
   * La configuració viva de la partida: comença amb la que arriba (nova o
   * represa) i canvia quan el menú engega una partida nova. El registre del
   * resultat i el desat fan servir aquesta, no la inicial.
   */
  const [currentSetup, setCurrentSetup] = useState(setup);
  const handle = useGame(setup, resume, resumeOwners);
  const { game, draft, selectedTileId, error, highlighted, drawnTileId, isHumanTurn } = handle;
  const change = useRecordResult(game, currentSetup.opponents, profile);
  const [menuOpen, setMenuOpen] = useState(false);
  const rotation = useScreenRotation();

  const { moveTileTo } = handle;
  const drag = useDragTile(isHumanTurn, moveTileTo);

  // La partida es desa a cada moviment, i s'esborra quan s'acaba: així es pot
  // tancar la pestanya a mitges i continuar-la després.
  const { persist, clear } = savedGame;
  const { meldOwners } = handle;
  useEffect(() => {
    if (game.status === 'playing') persist({ setup: currentSetup, game, owners: [...meldOwners] });
    else clear();
  }, [game, currentSetup, meldOwners, persist, clear]);

  const startNewGame = useCallback(
    (next: GameSetup) => {
      setCurrentSetup(next);
      setMenuOpen(false);
      handle.restart(next);
    },
    [handle],
  );

  /*
   * La taula que es veu és la del torn en curs mentre jugues tu, i la del motor
   * la resta del temps. Els marcs de color surten d'aquesta mateixa taula: una
   * jugada que toques deixa de coincidir amb la que hi havia i perd el color a
   * l'instant, que és justament el senyal que se'n vol.
   */
  const board = draft ? draft.board : game.board;
  const authors = useMemo(
    () => meldAuthors(board, meldOwners, game.players),
    [board, meldOwners, game.players],
  );

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
    return <GameOver handle={handle} change={change} onHistory={onHistory} />;
  }

  const human = game.players[0];
  const invalid = draft ? invalidMeldIndexes(draft) : new Set<number>();
  const needsOpening = draft !== null && !human.hasOpened;
  const draggedTile = drag.dragging ? findTile(draft?.board.flat(), draft?.rack, drag.dragging.tileId) : null;

  return (
    <section className="game">
      <header className="game-top">
        <ul className="players">
          {game.players.map((player, index) => {
            const isHuman = player.kind === 'human';
            const persona = isHuman ? null : botPersona(player.name);
            const inner = (
              <>
                <span className="player-name">
                  {/* L'avatar: el del bot amb els seus colors, o la teva inicial. */}
                  <span
                    className="player-color"
                    aria-hidden="true"
                    style={
                      persona
                        ? { background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` }
                        : undefined
                    }
                  >
                    {persona ? persona.emoji : initialOf(profile.profile?.name ?? player.name)}
                  </span>
                  <span className="player-nom">
                    {isHuman ? (profile.profile?.name ?? player.name) : player.name}
                  </span>
                  {player.kind === 'ai' && (
                    <span className="tag">{difficultyByKey(player.aiLevel).label}</span>
                  )}
                  {!player.hasOpened && <span className="tag">sense obrir</span>}
                </span>
                <span className="muted">{player.rack.length} fitxes</span>
              </>
            );
            return (
              <li
                key={player.id}
                className={index === game.currentPlayer ? 'player active' : 'player'}
                /* Cada bot té color propi; aquí és on es veu de qui és cadascun. */
                data-bot={player.kind === 'ai' ? index : undefined}
              >
                {isHuman ? (
                  /* El teu jugador s'obre: nom, nivell, partida nova i historial. */
                  <button
                    type="button"
                    className="player-obre"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-label="El teu jugador"
                  >
                    {inner}
                    <span className="fletxa" aria-hidden="true">▾</span>
                  </button>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>

        {menuOpen && (
          <PlayerMenu
            profile={profile}
            current={currentSetup}
            onNewGame={startNewGame}
            onHistory={onHistory}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {/* Els canvis de torn i els errors s'anuncien als lectors de pantalla. */}
        <p className="muted turn-line" aria-live="polite">
          Torn {game.turn} ·{' '}
          {isHumanTurn ? 'et toca a tu' : `juga ${game.players[game.currentPlayer].name}…`} ·{' '}
          {game.bag.length} fitxes al sac
        </p>
      </header>

      <BoardView
        board={board}
        invalidIndexes={invalid}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        over={drag.dragging?.over ?? null}
        highlighted={highlighted}
        authors={authors}
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
        drawnTileId={drawnTileId}
        interactive={isHumanTurn}
        onTileClick={(tileId) => handleTileClick(tileId, null)}
        onTilePointerDown={drag.start}
        onReturnToRack={() => handle.placeSelected({ kind: 'rack' })}
      />

      {/*
        * Els botons del torn, sempre en una sola línia. El nom el porta
        * `aria-label` perquè no canviï mai: en pantalles estretes el rètol
        * s'amaga i queda la icona, com en una app.
        */}
      <div className="row actions">
        <button
          onClick={handle.commit}
          disabled={!isHumanTurn || !handle.canCommit}
          aria-label="Acabar jugada"
          title="Acabar jugada"
        >
          <CheckIcon />
          <span className="btn-text">Acabar jugada</span>
        </button>
        <button
          className="secondary"
          onClick={handle.draw}
          disabled={!isHumanTurn}
          aria-label={game.bag.length === 0 ? 'Passar torn' : 'Robar fitxa'}
          title={game.bag.length === 0 ? 'Passar torn' : 'Robar fitxa'}
        >
          {game.bag.length === 0 ? <PassIcon /> : <DrawIcon />}
          <span className="btn-text">{game.bag.length === 0 ? 'Passar torn' : 'Robar fitxa'}</span>
        </button>
        <button
          className="secondary"
          onClick={handle.resetTurn}
          disabled={!isHumanTurn || !handle.canCommit}
          aria-label="Desfer canvis"
          title="Desfer canvis"
        >
          <UndoIcon />
          <span className="btn-text">Desfer canvis</span>
        </button>
        {rotation.available && (
          <button
            className="secondary gir"
            onClick={rotation.toggle}
            aria-label="Gira la pantalla"
            title="Gira la pantalla"
            aria-pressed={rotation.locked}
          >
            <RotateIcon />
          </button>
        )}
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

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function GameOver({
  handle,
  change,
  onHistory,
}: {
  handle: GameHandle;
  change: RatingChange | null;
  onHistory(): void;
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
        <button className="secondary" onClick={onHistory}>
          Historial
        </button>
      </div>
    </section>
  );
}

/**
 * Girar la pantalla des d'un botó, per a qui té el gir del mòbil blocat o vol
 * jugar en horitzontal sense remenar res: es posa l'aplicació a pantalla
 * completa (el bloqueig d'orientació ho demana) i es gira a l'orientació
 * contrària; tornar-lo a prémer ho desfà. Si el navegador no ho permet (els
 * iPhone, per exemple), el botó ni surt: girar el mòbil fa el mateix, ara que
 * el manifest ja no clava l'app en vertical.
 */
function useScreenRotation() {
  const [locked, setLocked] = useState(false);

  // TypeScript ja no declara `lock` (massa navegadors sense): es mira en viu.
  const orientation = () =>
    screen.orientation as ScreenOrientation & {
      lock?(target: 'landscape' | 'portrait'): Promise<void>;
    };

  const available = useMemo(
    () =>
      typeof screen !== 'undefined' &&
      typeof orientation()?.lock === 'function' &&
      navigator.maxTouchPoints > 0,
    [],
  );

  // Si se surt de pantalla completa (gest del sistema), el bloqueig cau sol.
  useEffect(() => {
    if (!available) return;
    const onChange = () => {
      if (!document.fullscreenElement) setLocked(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [available]);

  const toggle = useCallback(async () => {
    try {
      if (!locked) {
        await document.documentElement.requestFullscreen?.().catch(() => {});
        const target = screen.orientation.type.startsWith('portrait') ? 'landscape' : 'portrait';
        await orientation().lock?.(target);
        setLocked(true);
      } else {
        screen.orientation.unlock();
        setLocked(false);
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      }
    } catch {
      // El navegador no ha volgut girar: no passa res, girar el mòbil funciona.
      setLocked(false);
    }
  }, [locked]);

  return { available, locked, toggle };
}
