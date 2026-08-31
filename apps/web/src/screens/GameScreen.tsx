import {
  DIFFICULTIES,
  difficultyByKey,
  finalScores,
  suggestOpponents,
  type DifficultyKey,
  type Tile,
} from '@remigi/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardView } from '../components/BoardView';
import { CheckIcon, DrawIcon, PassIcon, RotateIcon, UndoIcon } from '../components/icons';
import { PlayerMenu } from '../components/PlayerMenu';
import { RackView } from '../components/RackView';
import { TileView } from '../components/TileView';
import { useDragTile } from '../game/useDragTile';
import { botPersona } from '../game/bots';
import type { MissedChance } from '../game/missedChances';
import { orderRack, placeInRack, sortRack, type SortBy } from '../game/rackOrder';
import { useTurnClock } from '../game/useTurnClock';
import { useTurnSeconds, type TurnSeconds } from '../state/useTurnSeconds';
import { MIN_JEROGLIFICS, useJeroglifics } from '../state/useJeroglifics';
import { QuizScreen } from './QuizScreen';
import {
  invalidMeldIndexes,
  missingOpeningPoints,
  openingPoints,
  type Destination,
} from '../game/turnDraft';
import { BOT_DELAY_MS, useGame, type GameHandle, type GameSetup } from '../game/useGame';
import type { RatingChange } from '../state/gameOutcome';
import type { SavedGame } from '../state/savedGame';
import type { TileStyle } from '../state/useTileStyle';
import type { SavedGameHandle } from '../state/useSavedGame';
import type { ProfileHandle } from '../state/useProfile';
import { playerLevelLabel } from '../state/playerLevel';
import { useRecordResult } from '../state/useRecordResult';
import type { GameState } from '@remigi/core';

interface Props {
  setup: GameSetup;
  /** Partida a reprendre; si no n'hi ha, se'n reparteix una de nova. */
  resume?: GameState;
  /** Autors de les jugades de la partida represa, per no perdre'n els colors. */
  resumeOwners?: SavedGame['owners'];
  /** Oportunitats perdudes de la partida represa, perquè el repàs no comenci coix. */
  resumeMisses?: SavedGame['misses'];
  /** Com tenia col·locat el faristol qui reprèn la partida. */
  resumeRackOrder?: SavedGame['rackOrder'];
  profile: ProfileHandle;
  savedGame: SavedGameHandle;
  /** Obre l'historial (les estadístiques). */
  onHistory(): void;
  tileStyle: TileStyle;
  onTileStyle(style: TileStyle): void;
}

/** Estona que es veu l'avís de temps exhaurit abans d'apagar-se sol. */
const TIMEOUT_NOTICE_MS = 6000;

export function GameScreen({
  setup,
  resume,
  resumeOwners,
  resumeMisses,
  resumeRackOrder,
  profile,
  savedGame,
  onHistory,
  tileStyle,
  onTileStyle,
}: Props) {
  /*
   * La configuració viva de la partida: comença amb la que arriba (nova o
   * represa) i canvia quan el menú engega una partida nova. El registre del
   * resultat i el desat fan servir aquesta, no la inicial.
   */
  const [currentSetup, setCurrentSetup] = useState(setup);
  const handle = useGame(setup, resume, resumeOwners, resumeMisses);
  const { game, draft, selectedTileId, error, highlighted, drawnTileId, isHumanTurn } = handle;
  const change = useRecordResult(game, currentSetup.opponents, profile);
  const [menuOpen, setMenuOpen] = useState(false);
  /*
   * L'ordre del faristol és del jugador: es guarda com una llista d'ids i
   * sobreviu al canvi de torn i a reprendre la partida (vegeu `rackOrder.ts`).
   */
  const [rackOrder, setRackOrder] = useState<string[]>(() => [...(resumeRackOrder ?? [])]);
  const [turnSeconds, setTurnSeconds] = useTurnSeconds();
  /* Avís de temps exhaurit; s'apaga sol al cap d'uns segons. */
  const [timedOut, setTimedOut] = useState<string | null>(null);
  /* Els jeroglífics es poden jugar des del final de partida o des del menú. */
  const [quiz, setQuiz] = useState<'partida' | 'col·lecció' | null>(null);
  const jeroglifics = useJeroglifics();
  const rotation = useScreenRotation();

  // La partida es desa a cada moviment, i s'esborra quan s'acaba: així es pot
  // tancar la pestanya a mitges i continuar-la després.
  const { persist, clear } = savedGame;
  const { tileOwners, misses } = handle;
  useEffect(() => {
    if (game.status === 'playing') {
      persist({ setup: currentSetup, game, owners: [...tileOwners], misses, rackOrder });
    } else {
      clear();
    }
  }, [game, currentSetup, tileOwners, misses, rackOrder, persist, clear]);

  /* Cada jeroglífic nou de la partida va també a la col·lecció del menú. */
  const { add: addJeroglifics } = jeroglifics;
  useEffect(() => {
    if (misses.length > 0) addJeroglifics(misses);
  }, [misses, addJeroglifics]);

  const startNewGame = useCallback(
    (next: GameSetup) => {
      setCurrentSetup(next);
      setMenuOpen(false);
      setQuiz(null);
      handle.restart(next);
    },
    [handle],
  );

  /*
   * Amb rivals automàtics, els de la partida següent surten de l'habilitat
   * d'ARA: si guanyes, pugen; si perds, baixen. També des d'«Una altra
   * partida», que abans repetia els mateixos rivals per sempre.
   */
  const nextOpponents: DifficultyKey[] | null =
    currentSetup.auto !== false && profile.profile
      ? suggestOpponents(
          profile.profile,
          Math.min(3, Math.max(1, currentSetup.opponents.length)) as 1 | 2 | 3,
        )
      : null;

  /* El nivell fixat dels rivals, per dir-lo tal qual (únic si tots són iguals). */
  const fixedRivalsLabel =
    currentSetup.auto === false
      ? [...new Set(currentSetup.opponents)].map((key) => DIFFICULTIES[key].label).join(', ')
      : null;

  const restartAdapted = useCallback(() => {
    startNewGame(
      nextOpponents ? { ...currentSetup, opponents: nextOpponents } : currentSetup,
    );
  }, [startNewGame, nextOpponents, currentSetup]);

  /*
   * La taula que es veu és la del torn en curs mentre jugues tu, i la del
   * motor la resta del temps. Els marcs de color van fitxa a fitxa (les que
   * el bot de l'últim moviment ha posat) i segueixen la fitxa per
   * identificador: moure-la durant el teu torn no li treu el marc, perquè
   * continua sent la fitxa que el bot va posar.
   */
  const board = draft ? draft.board : game.board;

  const { moveTileTo } = handle;

  /*
   * El faristol, en l'ordre del jugador: mentre et toca, el de l'esborrany (el
   * que tens a la mà ara mateix); la resta del temps, el que en sap el motor.
   */
  const rackTiles = useMemo(
    () => orderRack(draft ? draft.rack : game.players[0].rack, rackOrder),
    [draft, game, rackOrder],
  );

  /* Ordenar de cop és només una empenta: escriu l'ordre i es continua a mà. */
  const sortRackBy = useCallback((by: SortBy) => setRackOrder(sortRack(rackTiles, by)), [rackTiles]);

  /**
   * Deixa una fitxa al faristol, al forat que es digui (al final, si no se'n
   * diu cap). Serveix tant per recol·locar-hi una fitxa com per tornar-n'hi
   * una de la taula; les que ja hi eren abans del torn no es poden agafar, i
   * llavors no es toca res.
   */
  const placeOnRack = useCallback(
    (tileId: string, gap: number | null) => {
      if (draft?.locked.has(tileId)) return;
      moveTileTo(tileId, { kind: 'rack' });
      setRackOrder((order) => placeInRack(rackTiles, order, tileId, gap ?? rackTiles.length));
    },
    [draft, moveTileTo, rackTiles],
  );

  /* Deixar anar una fitxa: al faristol va al lloc exacte; a la taula, com sempre. */
  const dropTile = useCallback(
    (tileId: string, destination: Destination) => {
      if (destination.kind === 'rack') placeOnRack(tileId, destination.index ?? null);
      else moveTileTo(tileId, destination);
    },
    [moveTileTo, placeOnRack],
  );

  const drag = useDragTile(isHumanTurn, dropTile);

  /**
   * Un sol gest per a tot: si no hi ha res triat, el clic tria la fitxa; si n'hi
   * ha, el clic diu on deixar-la. Tornar a clicar la fitxa triada la desmarca.
   * Un clic que ve de deixar anar una fitxa arrossegada s'ignora.
   */
  const handleTileClick = useCallback(
    (tileId: string, meldIndex: number) => {
      if (drag.consumeDragFlag()) return;
      if (!selectedTileId) return handle.selectTile(tileId);
      if (selectedTileId === tileId) return handle.selectTile(null);
      handle.placeSelected({ kind: 'meld', index: meldIndex });
    },
    [drag, handle, selectedTileId],
  );

  /**
   * Al faristol, el mateix gest també serveix per endreçar: la fitxa triada es
   * queda just abans de la que toques, i així es pot col·locar la mà sencera
   * sense arrossegar res (que amb el dit no sempre és còmode).
   */
  const handleRackTileClick = useCallback(
    (tileId: string, index: number) => {
      if (drag.consumeDragFlag()) return;
      if (!selectedTileId) return handle.selectTile(tileId);
      if (selectedTileId === tileId) return handle.selectTile(null);
      placeOnRack(selectedTileId, index);
    },
    [drag, handle, placeOnRack, selectedTileId],
  );

  /**
   * Avançar: si has posat fitxes, s'acaba la jugada; si no n'has posat cap,
   * robes (o passes, amb el sac buit). És el mateix botó de sempre, que fa el
   * que toca a cada moment, i per això no s'apaga mai mentre et toqui a tu.
   */
  const advance = useCallback(() => {
    if (handle.canCommit) handle.commit();
    else handle.draw();
  }, [handle]);

  /*
   * El rellotge del torn corre mentre et toca i tens la taula al davant: amb
   * el menú obert o fent jeroglífics s'atura, perquè allò no és jugar.
   */
  const { timeUp } = handle;
  const bagLeft = game.bag.length;
  const onTimeUp = useCallback(() => {
    setTimedOut(
      bagLeft > 0
        ? 'S’ha acabat el temps: s’ha desfet el que tenies a mig col·locar i has robat una fitxa.'
        : 'S’ha acabat el temps: s’ha desfet el que tenies a mig col·locar i has passat torn.',
    );
    timeUp();
  }, [bagLeft, timeUp]);

  const secondsLeft = useTurnClock(
    turnSeconds,
    isHumanTurn && game.status === 'playing' && !menuOpen && quiz === null,
    `${game.turn}:${game.currentPlayer}`,
    onTimeUp,
  );

  /*
   * L'avís del temps s'apaga sol al cap d'una estona. No s'espera al torn
   * següent a posta: amb rivals ràpids, el torn pot tornar de seguida i
   * llavors no s'arribaria a llegir mai per què t'has trobat una fitxa nova.
   */
  useEffect(() => {
    if (!timedOut) return;
    const timer = setTimeout(() => setTimedOut(null), TIMEOUT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [timedOut]);

  /*
   * La col·lecció de jeroglífics es juga des del menú, en qualsevol moment:
   * la partida continua viva a sota (els bots acaben la jugada) i hi tornes
   * en sortir.
   */
  if (quiz === 'col·lecció' && jeroglifics.items.length > 0) {
    return (
      <QuizScreen
        misses={jeroglifics.items}
        playerName={profile.profile?.name ?? game.players[0].name}
        closeLabel="Torna a la partida"
        onClose={() => setQuiz(null)}
      />
    );
  }

  if (game.status === 'finished') {
    if (quiz === 'partida' && misses.length > 0) {
      return (
        <QuizScreen
          misses={misses}
          playerName={profile.profile?.name ?? game.players[0].name}
          closeLabel="Torna al resum"
          onClose={() => setQuiz(null)}
        />
      );
    }
    return (
      <GameOver
        handle={handle}
        change={change}
        nextOpponents={nextOpponents}
        fixedRivals={fixedRivalsLabel}
        misses={misses}
        onQuiz={() => setQuiz('partida')}
        onRestart={restartAdapted}
        onHistory={onHistory}
      />
    );
  }

  const invalid = draft ? invalidMeldIndexes(draft) : new Set<number>();
  /* La fitxa triada ve de la taula (i, per tant, es pot tornar al faristol). */
  const selectedOnBoard =
    selectedTileId !== null && !rackTiles.some((tile) => tile.id === selectedTileId);
  const needsOpening = draft !== null && !game.players[0].hasOpened;
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
            tileStyle={tileStyle}
            onTileStyle={onTileStyle}
            turnSeconds={turnSeconds}
            onTurnSeconds={setTurnSeconds}
            jeroglifics={jeroglifics.items.length}
            onJeroglifics={() => {
              setMenuOpen(false);
              setQuiz('col·lecció');
            }}
            onNewGame={startNewGame}
            onHistory={onHistory}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {/* Els canvis de torn i els errors s'anuncien als lectors de pantalla. */}
        <p className="muted turn-line" aria-live="polite">
          Torn {game.turn} ·{' '}
          {isHumanTurn ? 'et toca a tu' : `juga ${game.players[game.currentPlayer].name}…`} ·{' '}
          {game.bag.length} {game.bag.length === 1 ? 'fitxa' : 'fitxes'} al sac
        </p>

        {/*
          * El teu nivell, sempre a la vista: puja i baixa amb els resultats.
          * Si has fixat el nivell dels rivals, també es diu — i si no, no es
          * diu res, perquè llavors s'adapten sols al teu.
          */}
        {profile.profile && (
          <span
            className="nivell-jugador"
            title={
              fixedRivalsLabel
                ? 'Has fixat el nivell dels rivals; el teu nivell continua movent-se amb els resultats'
                : 'Els rivals s’adapten al teu nivell: pugen i baixen amb tu'
            }
          >
            Nivell {profile.profile.rating}{' '}
            (<strong>{playerLevelLabel(profile.profile.rating)}</strong>)
            {fixedRivalsLabel && (
              <>
                {' '}· rivals fixats: <strong>{fixedRivalsLabel}</strong>
              </>
            )}
          </span>
        )}
      </header>

      <BoardView
        board={board}
        invalidIndexes={invalid}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        over={drag.dragging?.over ?? null}
        highlighted={highlighted}
        bots={tileOwners}
        interactive={isHumanTurn}
        overlay={
          <div className="taula-avisos">
            {secondsLeft !== null && (
              <TurnClock left={secondsLeft} total={turnSeconds ?? secondsLeft} />
            )}
          </div>
        }
        onTileClick={handleTileClick}
        onTilePointerDown={drag.start}
        onMeldClick={(index) => handle.placeSelected({ kind: 'meld', index })}
        onNewMeldClick={() => handle.placeSelected({ kind: 'new' })}
      />

      {/*
        * Fora de l'obertura també cal dir-ho: unes fitxes deixades soles no
        * són cap jugada, i el vermell tot sol pot passar per alt.
        */}
      {!needsOpening && invalid.size > 0 && (
        <p className="hint">
          Les jugades marcades en vermell no són vàlides: agrupa-les en grups o
          escales de 3 fitxes o més, o torna les fitxes al faristol.
        </p>
      )}

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
        {!error && timedOut && <span className="avis-temps">{timedOut}</span>}
      </p>

      <RackView
        rack={rackTiles}
        selectedTileId={selectedTileId}
        draggingTileId={drag.dragging?.tileId ?? null}
        /* El faristol sencer només s'encén quan la fitxa no va a cap lloc concret. */
        isOver={drag.dragging?.over?.kind === 'rack' && drag.dragging.over.index === undefined}
        overIndex={drag.dragging?.over?.kind === 'rack' ? drag.dragging.over.index ?? null : null}
        drawnTileId={drawnTileId}
        interactive={isHumanTurn}
        onSort={sortRackBy}
        onTileClick={handleRackTileClick}
        onTilePointerDown={drag.start}
        onReturnToRack={
          /*
           * Només si la fitxa triada és a la taula: si ja la tens a la mà, el
           * botó no faria res i el que vols és tocar on la vols deixar.
           */
          selectedOnBoard ? () => selectedTileId && placeOnRack(selectedTileId, null) : undefined
        }
      />

      {/*
        * Els botons del torn, sempre en una sola línia. El nom el porta
        * `aria-label` perquè no canviï mai: en pantalles estretes el rètol
        * s'amaga i queda la icona, com en una app. L'embolcall només pren cos
        * en apaïsat, on porta l'ordenació compacta a sobre dels botons.
        */}
      <div className="accions-costat">
        <div className="sort-mini" role="group" aria-label="Ordena les fitxes">
          {(['numero', 'color'] as SortBy[]).map((option) => (
            <button key={option} type="button" className="link" onClick={() => sortRackBy(option)}>
              {option === 'numero' ? 'números' : 'colors'}
            </button>
          ))}
        </div>
      <div className="row actions">
        {/*
          * Un sol botó per avançar, i sempre actiu mentre et toca: si has posat
          * fitxes acaba la jugada, i si no n'has posat cap roba i passa el torn.
          * Robar deixa de ser una decisió a part —era el botó que et robava
          * fitxes sense voler— i passa a ser el que vol dir «jo ja he acabat».
          */}
        <button
          onClick={advance}
          disabled={!isHumanTurn}
          aria-label={handle.canCommit ? 'Acabar jugada' : 'Avançar'}
          title={
            handle.canCommit
              ? 'Acabar jugada: la taula passa pel motor i el torn s’acaba'
              : game.bag.length === 0
                ? 'Avançar: no has posat cap fitxa i el sac és buit, passes torn'
                : 'Avançar: no has posat cap fitxa, robes una fitxa i s’acaba el torn'
          }
        >
          {handle.canCommit ? <CheckIcon /> : game.bag.length === 0 ? <PassIcon /> : <DrawIcon />}
          <span className="btn-text">{handle.canCommit ? 'Acabar jugada' : 'Avançar'}</span>
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
      </div>

      {/*
        * L'avís de torn: mentre un bot pensa (la pausa de tres segons), al mig
        * de la pantalla es veu qui està jugant, amb el seu avatar. No rep
        * clics i és decoratiu: la línia de torn ja ho anuncia als lectors de
        * pantalla.
        */}
      {game.status === 'playing' && !isHumanTurn && (
        <TurnNotice player={game.players[game.currentPlayer]} slot={game.currentPlayer} />
      )}

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

/**
 * L'avís de torn: mentre un rival pensa, al mig de la pantalla es veu qui
 * juga, amb el seu avatar i els seus colors, i una barra que s'omple amb el
 * temps que s'hi està. Així el torn dels altres es veu passar en comptes de
 * ser una estona morta mirant una taula quieta.
 */
function TurnNotice({ player, slot }: { player: GameState['players'][number]; slot: number }) {
  const persona = botPersona(player.name);
  return (
    <div className="torn-avis" aria-hidden="true" data-bot={slot}>
      <div
        className="torn-avis-caixa"
        style={{ '--pensada': `${BOT_DELAY_MS}ms` } as React.CSSProperties}
      >
        <span
          className="player-color torn-avatar"
          style={{ background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` }}
        >
          {persona.emoji}
        </span>
        <span className="torn-avis-text">
          <strong>{player.name}</strong>
          <span className="torn-avis-estat">
            està jugant
            <span className="punts-pensant">
              <i />
              <i />
              <i />
            </span>
          </span>
        </span>
        <span className="torn-avis-barra" />
      </div>
    </div>
  );
}

/** Volta sencera del cercle del compte enrere (2πr amb r = 15.5). */
const CLOCK_CIRCLE = 97.4;

/**
 * El compte enrere del torn, en un racó del feltre: l'anell es va buidant i,
 * als últims deu segons, tot es posa vermell i batega. No és decoració: quan
 * arriba a zero es desfà el que tinguis a mitges i es roba.
 */
function TurnClock({ left, total }: { left: number; total: number }) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div
      className={left <= 10 ? 'rellotge-torn urgent' : 'rellotge-torn'}
      role="timer"
      aria-label={`Temps del torn: ${left} segons`}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="rellotge-fons" cx="18" cy="18" r="15.5" />
        <circle
          className="rellotge-arc"
          cx="18"
          cy="18"
          r="15.5"
          style={{ strokeDasharray: `${(fraction * CLOCK_CIRCLE).toFixed(1)} ${CLOCK_CIRCLE}` }}
        />
      </svg>
      <span className="rellotge-segons">{left}</span>
    </div>
  );
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function GameOver({
  handle,
  change,
  nextOpponents,
  fixedRivals,
  misses,
  onQuiz,
  onRestart,
  onHistory,
}: {
  handle: GameHandle;
  change: RatingChange | null;
  /** Rivals de la partida següent, si són automàtics (adaptats a l'habilitat). */
  nextOpponents: DifficultyKey[] | null;
  /** Etiqueta dels rivals quan estan fixats a mà. */
  fixedRivals: string | null;
  /** Oportunitats perdudes de la partida, per oferir-ne el repàs. */
  misses: MissedChance[];
  onQuiz(): void;
  onRestart(): void;
  onHistory(): void;
}) {
  const { game } = handle;
  const scores = finalScores(game);
  const winner = game.players.find((player) => player.id === game.winnerId);
  const blocked = winner ? winner.rack.length > 0 : false;
  const humanWon = game.winnerId === game.players[0].id;

  /* L'avatar de cadascú, com a la tira de jugadors: bots amb el seu degradat. */
  const avatarOf = (playerId: string) => {
    const player = game.players.find((candidate) => candidate.id === playerId);
    if (!player || player.kind === 'human') {
      return { emoji: initialOf(player?.name ?? '?'), colors: null };
    }
    const persona = botPersona(player.name);
    return { emoji: persona.emoji, colors: persona.colors };
  };

  return (
    <section className={humanWon ? 'card game-over won' : 'card game-over'}>
      <div className="franja-fitxes" aria-hidden="true" />

      <div className="final-cap">
        {humanWon ? (
          <span className="final-emoji" aria-hidden="true">
            🏆
          </span>
        ) : (
          winner && (
            <span
              className="player-color final-avatar"
              aria-hidden="true"
              style={
                avatarOf(winner.id).colors
                  ? {
                      background: `linear-gradient(135deg, ${avatarOf(winner.id).colors![0]}, ${avatarOf(winner.id).colors![1]})`,
                    }
                  : undefined
              }
            >
              {avatarOf(winner.id).emoji}
            </span>
          )
        )}
        <h2>{humanWon ? 'Has guanyat!' : `Ha guanyat ${winner?.name}`}</h2>
        <p className="muted">
          {blocked
            ? 'Ningú no s’ha pogut desfer de totes les fitxes: la partida ha quedat bloquejada i guanya qui tenia menys punts a la mà.'
            : `${winner?.name} s’ha quedat sense fitxes en ${game.turn} torns.`}
        </p>
      </div>

      <ul className="scores">
        {[...scores]
          .sort((a, b) => b.points - a.points)
          .map((score) => {
            const avatar = avatarOf(score.playerId);
            return (
              <li key={score.playerId} className={score.playerId === game.winnerId ? 'winner' : ''}>
                <span className="score-jugador">
                  <span
                    className="player-color score-avatar"
                    aria-hidden="true"
                    style={
                      avatar.colors
                        ? { background: `linear-gradient(135deg, ${avatar.colors[0]}, ${avatar.colors[1]})` }
                        : undefined
                    }
                  >
                    {avatar.emoji}
                  </span>
                  <span className="score-nom">{score.name}</span>
                  {score.playerId === game.winnerId && <span aria-hidden="true">👑</span>}
                </span>
                <span className={score.points >= 0 ? 'punts points-positive' : 'punts points-negative'}>
                  {score.points > 0 ? '+' : ''}
                  {score.points}
                </span>
              </li>
            );
          })}
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

      {/*
        * Els jeroglífics de la partida: si has robat quan hi havia una jugada
        * de dues fitxes o més per fer, el final t'ho diu i t'ofereix
        * resoldre-la sobre el mateix tauler. I si no t'has deixat res, també
        * es diu, que és la millor notícia de la partida.
        */}
      {misses.length > 0 ? (
        <div className="quiz-crida">
          <p>
            D’aquesta partida{' '}
            {misses.length === 1 ? (
              <>
                n’ha sortit <strong>1 jeroglífic</strong>: una jugada que se t’ha escapat.
              </>
            ) : (
              <>
                n’han sortit <strong>{misses.length} jeroglífics</strong>: jugades que se
                t’han escapat.
              </>
            )}{' '}
            Els saps resoldre?
          </p>
          <button type="button" onClick={onQuiz}>
            Fes els jeroglífics
          </button>
        </div>
      ) : (
        <p className="quiz-crida-neta">
          No se t’ha escapat cap jugada que valgués un jeroglífic. 👏
        </p>
      )}

      {nextOpponents ? (
        <p className="seguents-rivals">
          El joc s’adapta a tu: els pròxims rivals seran{' '}
          <strong>{nextOpponents.map((key) => DIFFICULTIES[key].label).join(', ')}</strong>.
        </p>
      ) : (
        fixedRivals && (
          <p className="seguents-rivals">
            Rivals fixats a <strong>{fixedRivals}</strong>. Per tornar als automàtics,
            canvia-ho al menú del teu jugador.
          </p>
        )
      )}

      <div className="row">
        <button onClick={onRestart}>Una altra partida</button>
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
