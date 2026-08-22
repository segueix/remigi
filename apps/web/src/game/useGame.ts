import {
  RulesError,
  applyMove,
  createGame,
  decideAiMove,
  type DifficultyKey,
  type GameState,
} from '@rummikub/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasChanges,
  moveTile,
  startTurn,
  toMove,
  type Destination,
  type TurnDraft,
} from './turnDraft';

/**
 * Pausa abans que un bot jugui, perquè es pugui seguir el seu torn. Es pot
 * abaixar amb `VITE_BOT_DELAY` per veure partides senceres de pressa mentre es
 * desenvolupa o es fan proves automatitzades.
 */
const BOT_DELAY_MS = Number(import.meta.env.VITE_BOT_DELAY ?? 900);

export interface GameSetup {
  playerName: string;
  opponents: DifficultyKey[];
}

export interface GameHandle {
  game: GameState;
  /** Còpia de treball; només durant el torn del jugador humà. */
  draft: TurnDraft | null;
  selectedTileId: string | null;
  /** Missatge del motor quan la jugada no és legal. */
  error: string | null;
  /** Fitxes que el bot acaba de posar a la taula, per ressaltar-les. */
  highlighted: ReadonlySet<string>;
  isHumanTurn: boolean;
  canCommit: boolean;
  selectTile(tileId: string | null): void;
  placeSelected(destination: Destination): void;
  /** Mou una fitxa concreta (l'usa l'arrossegament, que no passa per la tria). */
  moveTileTo(tileId: string, destination: Destination): void;
  commit(): void;
  draw(): void;
  resetTurn(): void;
  restart(setup?: GameSetup): void;
}

export function newGameState(setup: GameSetup): GameState {
  return createGame({
    players: [
      { name: setup.playerName, kind: 'human' },
      ...setup.opponents.map((level, i) => ({
        name: `Bot ${i + 1}`,
        kind: 'ai' as const,
        aiLevel: level,
      })),
    ],
  });
}

function isHumanTurn(game: GameState): boolean {
  return game.status === 'playing' && game.players[game.currentPlayer].kind === 'human';
}

function draftFor(game: GameState): TurnDraft | null {
  return isHumanTurn(game) ? startTurn(game, game.currentPlayer) : null;
}

/**
 * `initialGame` permet reprendre una partida desada: si no se'n passa cap,
 * se'n reparteix una de nova.
 */
export function useGame(initialSetup: GameSetup, initialGame?: GameState): GameHandle {
  const setupRef = useRef(initialSetup);
  const [game, setGame] = useState<GameState>(() => initialGame ?? newGameState(initialSetup));
  const [draft, setDraft] = useState<TurnDraft | null>(() => draftFor(game));
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());

  // Cada vegada que el motor avança, el torn comença de zero.
  useEffect(() => {
    setDraft(draftFor(game));
    setSelectedTileId(null);
    setError(null);
  }, [game]);

  // Torn dels bots. El temporitzador es cancel·la si l'estat canvia abans
  // d'hora, i la comprovació dins de `setGame` evita jugar dos cops el mateix
  // torn (React executa els efectes dues vegades en mode estricte).
  useEffect(() => {
    if (game.status !== 'playing' || isHumanTurn(game)) return;
    const timer = setTimeout(() => {
      setGame((current) => {
        if (current.status !== 'playing' || isHumanTurn(current)) return current;
        const before = new Set(current.board.flat().map((tile) => tile.id));
        const next = applyMove(current, decideAiMove(current, current.currentPlayer));
        setHighlighted(new Set(next.board.flat().map((t) => t.id).filter((id) => !before.has(id))));
        return next;
      });
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const selectTile = useCallback((tileId: string | null) => {
    setSelectedTileId(tileId);
    setError(null);
  }, []);

  const moveTileTo = useCallback((tileId: string, destination: Destination) => {
    setDraft((current) => (current ? moveTile(current, tileId, destination) : current));
    setSelectedTileId(null);
    setError(null);
  }, []);

  const placeSelected = useCallback(
    (destination: Destination) => {
      if (selectedTileId) moveTileTo(selectedTileId, destination);
    },
    [selectedTileId, moveTileTo],
  );

  const commit = useCallback(() => {
    if (!draft) return;
    try {
      setGame(applyMove(game, toMove(draft)));
      setHighlighted(new Set());
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [draft, game]);

  const draw = useCallback(() => {
    try {
      setGame(applyMove(game, { type: 'draw' }));
      setHighlighted(new Set());
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [game]);

  const resetTurn = useCallback(() => {
    setDraft(draftFor(game));
    setSelectedTileId(null);
    setError(null);
  }, [game]);

  const restart = useCallback((setup?: GameSetup) => {
    if (setup) setupRef.current = setup;
    setHighlighted(new Set());
    setGame(newGameState(setupRef.current));
  }, []);

  return {
    game,
    draft,
    selectedTileId,
    error,
    highlighted,
    isHumanTurn: isHumanTurn(game),
    canCommit: draft !== null && hasChanges(draft),
    selectTile,
    placeSelected,
    moveTileTo,
    commit,
    draw,
    resetTurn,
    restart,
  };
}
