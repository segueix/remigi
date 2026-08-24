import {
  RulesError,
  applyMove,
  createGame,
  decideAiMove,
  type DifficultyKey,
  type GameState,
} from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickPersonas } from './bots';
import { updateOwners, type MeldOwners } from './meldOwners';
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
  /** Ajusta la dificultat dels bots durant la partida segons com et va. */
  adaptDuringGame?: boolean;
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
  /** Fitxa que el jugador acaba de robar del sac, per marcar-la al faristol. */
  drawnTileId: string | null;
  /** Qui ha tocat per últim cop cada jugada de la taula (vegeu `meldOwners.ts`). */
  meldOwners: MeldOwners;
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
  // Cada partida té rivals nous: el nom viatja dins de l'estat del joc, així
  // que en reprendre una partida desada tornen exactament els mateixos.
  const personas = pickPersonas(setup.opponents.length);
  return createGame({
    players: [
      { name: setup.playerName, kind: 'human' },
      ...setup.opponents.map((level, i) => ({
        name: personas[i]?.name ?? `Bot ${i + 1}`,
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
 * se'n reparteix una de nova. `initialOwners` són els autors de les jugades que
 * ja hi ha a la taula, que es desen amb ella.
 */
export function useGame(
  initialSetup: GameSetup,
  initialGame?: GameState,
  initialOwners?: readonly (readonly [string, number])[],
): GameHandle {
  const setupRef = useRef(initialSetup);
  const [game, setGame] = useState<GameState>(() => initialGame ?? newGameState(initialSetup));
  const [draft, setDraft] = useState<TurnDraft | null>(() => draftFor(game));
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
  const [drawnTileId, setDrawnTileId] = useState<string | null>(null);
  /*
   * D'una partida represa se'n saben els autors si es van desar; d'una de més
   * antiga, no, i llavors les jugades que ja hi havia es queden sense marc en
   * comptes de posar-n'hi un d'inventat.
   */
  const [meldOwners, setMeldOwners] = useState<MeldOwners>(() => new Map(initialOwners ?? []));

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
        const mover = current.currentPlayer;
        const next = applyMove(
          current,
          decideAiMove(current, mover, Math.random, {
            rubberBanding: setupRef.current.adaptDuringGame,
          }),
        );
        setHighlighted(new Set(next.board.flat().map((t) => t.id).filter((id) => !before.has(id))));
        setMeldOwners((owners) => updateOwners(owners, current.board, next.board, mover));
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
      const next = applyMove(game, toMove(draft));
      setMeldOwners((owners) => updateOwners(owners, game.board, next.board, game.currentPlayer));
      setGame(next);
      setHighlighted(new Set());
      // La fitxa robada deixa de ser «la que acabes de robar» quan tornes a jugar.
      setDrawnTileId(null);
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [draft, game]);

  const draw = useCallback(() => {
    try {
      const player = game.currentPlayer;
      const before = new Set(game.players[player].rack.map((tile) => tile.id));
      const next = applyMove(game, { type: 'draw' });
      /*
       * Amb el sac buit, «robar» és passar torn: no hi ha cap fitxa nova, i
       * llavors el que toca és treure la marca de la de l'últim cop.
       */
      const drawn = next.players[player].rack.find((tile) => !before.has(tile.id));
      setDrawnTileId(drawn?.id ?? null);
      setGame(next);
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
    setDrawnTileId(null);
    setMeldOwners(new Map());
    setGame(newGameState(setupRef.current));
  }, []);

  return {
    game,
    draft,
    selectedTileId,
    error,
    highlighted,
    drawnTileId,
    meldOwners,
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
