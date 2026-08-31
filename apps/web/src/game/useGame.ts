import {
  RulesError,
  applyMove,
  createEngine,
  createGame,
  type DifficultyKey,
  type GameState,
} from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickPersonas } from './bots';
import { addMiss, detectMissedChances, type MissedChance } from './missedChances';
import { updateOwners, type TileOwners } from './meldOwners';
import {
  hasChanges,
  moveTile,
  startTurn,
  toMove,
  type Destination,
  type TurnDraft,
} from './turnDraft';

/**
 * Pausa abans que un bot jugui: els tres segons que dura l'avís de «qui està
 * jugant» al mig de la pantalla, perquè el canvi de torn es vegi venir. Es pot
 * abaixar amb `VITE_BOT_DELAY` per veure partides senceres de pressa mentre es
 * desenvolupa o es fan proves automatitzades.
 */
export const BOT_DELAY_MS = Number(import.meta.env.VITE_BOT_DELAY ?? 3000);

/**
 * El motor que juga pels bots: l'única porta de la web cap a la IA (vegeu
 * docs/ENGINE.md). Sense llavor perquè cada partida real sigui diferent.
 */
const engine = createEngine();

/**
 * L'última jugada d'un rival, per poder-la explicar a la taula: qui, què i
 * quantes fitxes. És informació de la pantalla (com els colors dels autors):
 * no forma part de l'estat del motor, es dedueix del moviment que acaba de fer.
 */
export interface BotAction {
  /** Lloc del jugador a la tira (és el que li dona el color). */
  slot: number;
  name: string;
  kind: 'play' | 'draw';
  /** Fitxes que ha deixat a la taula, si ha jugat. */
  tiles: number;
}

export interface GameSetup {
  playerName: string;
  opponents: DifficultyKey[];
  /**
   * Els rivals són automàtics: surten de l'habilitat del perfil i es tornen a
   * triar a cada partida nova. Absent (partides desades velles) val com a cert.
   */
  auto?: boolean;
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
  /** Fitxes de la taula posades pel bot de l'últim moviment (vegeu `meldOwners.ts`). */
  tileOwners: TileOwners;
  /** Cops que el jugador ha robat havent-hi jugada, per al repàs del final. */
  misses: MissedChance[];
  /** Què acaba de fer l'últim rival que ha mogut, per dir-ho a la taula. */
  lastAction: BotAction | null;
  isHumanTurn: boolean;
  canCommit: boolean;
  selectTile(tileId: string | null): void;
  placeSelected(destination: Destination): void;
  /** Mou una fitxa concreta (l'usa l'arrossegament, que no passa per la tria). */
  moveTileTo(tileId: string, destination: Destination): void;
  commit(): void;
  draw(): void;
  /**
   * S'ha acabat el temps del torn: es desfà el que no s'hagi validat i es roba
   * (o es passa, si el sac és buit).
   */
  timeUp(): void;
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
  initialMisses?: readonly MissedChance[],
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
  const [tileOwners, setTileOwners] = useState<TileOwners>(() => new Map(initialOwners ?? []));
  const [misses, setMisses] = useState<MissedChance[]>(() => [...(initialMisses ?? [])]);
  const [lastAction, setLastAction] = useState<BotAction | null>(null);

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
        const decision = engine.play(current, {
          playerIndex: mover,
          rubberBanding: setupRef.current.adaptDuringGame,
        });
        const next = applyMove(current, decision.move);
        const played = new Set(next.board.flat().map((t) => t.id).filter((id) => !before.has(id)));
        setHighlighted(played);
        setTileOwners((owners) => updateOwners(owners, current.board, next.board, mover));
        /* Qui ha mogut i què ha fet: la taula ho explica fins que tornis a jugar tu. */
        setLastAction({
          slot: mover,
          name: current.players[mover].name,
          kind: decision.move.type === 'play' ? 'play' : 'draw',
          tiles: played.size,
        });
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
      setTileOwners((owners) => updateOwners(owners, game.board, next.board, game.currentPlayer));
      setGame(next);
      setHighlighted(new Set());
      setLastAction(null);
      // La fitxa robada deixa de ser «la que acabes de robar» quan tornes a jugar.
      setDrawnTileId(null);
    } catch (caught) {
      setError(caught instanceof RulesError ? caught.message : String(caught));
    }
  }, [draft, game]);

  /**
   * Roba una fitxa (o passa, si el sac és buit) i tanca el torn.
   *
   * `discardDraft` només l'engega el final del temps. La resta del temps,
   * robar amb fitxes a mig col·locar les descartaria en silenci: la robada
   * s'aplica sobre l'estat del motor, que no ha vist l'esborrany, i el torn
   * següent totes les fitxes col·locades tornarien de cop al faristol amb la
   * robada — la sensació de «m'han donat quatre fitxes». Com a la taula de
   * debò: primer es desfà (o s'acaba) la jugada, i llavors es roba.
   */
  const drawTile = useCallback(
    (discardDraft: boolean) => {
      if (!discardDraft && draft && hasChanges(draft)) {
        setError(
          'Tens fitxes a mig col·locar: acaba la jugada o desfés els canvis abans de robar.',
        );
        return;
      }
      try {
        const player = game.currentPlayer;
        const before = new Set(game.players[player].rack.map((tile) => tile.id));
        const next = applyMove(game, { type: 'draw' });
        /*
         * Robar (o passar) havent-hi jugada que valgués la pena és deixar
         * escapar jeroglífics: se'n guarden els grups interrelacionats (sense
         * repetir el mateix grup torn rere torn, vegeu `addMiss`). Només compta
         * per a l'humà, que és l'únic que roba des d'aquí: els bots ja roben
         * expressament quan el seu nivell «no veu» la jugada.
         */
        if (game.players[player].kind === 'human') {
          const found = detectMissedChances(game, player);
          if (found.length > 0) {
            setMisses((current) => found.reduce((acc, miss) => addMiss(acc, miss), current));
          }
        }
        /*
         * Amb el sac buit, «robar» és passar torn: no hi ha cap fitxa nova, i
         * llavors el que toca és treure la marca de la de l'últim cop.
         */
        const drawn = next.players[player].rack.find((tile) => !before.has(tile.id));
        setDrawnTileId(drawn?.id ?? null);
        setGame(next);
        setHighlighted(new Set());
        setLastAction(null);
      } catch (caught) {
        setError(caught instanceof RulesError ? caught.message : String(caught));
      }
    },
    [game, draft],
  );

  const draw = useCallback(() => drawTile(false), [drawTile]);

  /*
   * S'ha acabat el temps: el que estiguessis col·locant no s'ha validat, i per
   * tant no ha passat mai. La robada s'aplica sobre l'estat del motor, que no
   * ha vist res de l'esborrany, i l'esborrany es refà sol amb el torn nou.
   */
  const timeUp = useCallback(() => drawTile(true), [drawTile]);

  const resetTurn = useCallback(() => {
    setDraft(draftFor(game));
    setSelectedTileId(null);
    setError(null);
  }, [game]);

  const restart = useCallback((setup?: GameSetup) => {
    if (setup) setupRef.current = setup;
    setHighlighted(new Set());
    setDrawnTileId(null);
    setLastAction(null);
    setTileOwners(new Map());
    setMisses([]);
    setGame(newGameState(setupRef.current));
  }, []);

  return {
    game,
    draft,
    selectedTileId,
    error,
    highlighted,
    drawnTileId,
    tileOwners,
    misses,
    lastAction,
    isHumanTurn: isHumanTurn(game),
    canCommit: draft !== null && hasChanges(draft),
    selectTile,
    placeSelected,
    moveTileTo,
    commit,
    draw,
    timeUp,
    resetTurn,
    restart,
  };
}
