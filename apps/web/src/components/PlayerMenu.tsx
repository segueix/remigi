import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  describeSuggestion,
  suggestOpponents,
  type DifficultyKey,
} from '@remigi/core';
import { useState } from 'react';
import type { GameSetup } from '../game/useGame';
import { playerLevelLabel } from '../state/playerLevel';
import {
  buildProfileTransferUrl,
  isValidProfileProgress,
  type ProfileProgress,
} from '../state/profileTransfer';
import type { ProfileHandle } from '../state/useProfile';
import { MIN_JEROGLIFICS } from '../state/useJeroglifics';
import type { TileStyle } from '../state/useTileStyle';
import { TURN_OPTIONS, type TurnSeconds } from '../state/useTurnSeconds';
import { ComEsJuga } from './ComEsJuga';
import { ColorShape } from './TileView';

interface Props {
  profile: ProfileHandle;
  /** Configuració de la partida en curs, com a punt de partida del formulari. */
  current: GameSetup;
  tileStyle: TileStyle;
  onTileStyle(style: TileStyle): void;
  /** Temps per torn; s'aplica de seguida, també a la partida que jugues ara. */
  turnSeconds: TurnSeconds;
  onTurnSeconds(seconds: TurnSeconds): void;
  /** Jeroglífics a la col·lecció; amb prou n'apareix l'opció de jugar-los. */
  jeroglifics: number;
  onJeroglifics(): void;
  onNewGame(setup: GameSetup): void;
  onHistory(): void;
  onClose(): void;
}

type OpponentCount = 1 | 2 | 3;
type LevelChoice = 'auto' | DifficultyKey;

/**
 * El desplegable que s'obre en tocar el teu jugador: el teu nom, el nivell i
 * el nombre de rivals, partida nova, historial i com es juga. És l'antiga
 * pantalla d'inici feta menú, perquè l'app entri directament a la taula.
 */
export function PlayerMenu({
  profile,
  current,
  tileStyle,
  onTileStyle,
  turnSeconds,
  onTurnSeconds,
  jeroglifics,
  onJeroglifics,
  onNewGame,
  onHistory,
  onClose,
}: Props) {
  const [name, setName] = useState(profile.profile?.name ?? '');
  const [count, setCount] = useState<OpponentCount>(
    Math.min(3, Math.max(1, current.opponents.length)) as OpponentCount,
  );
  /*
   * La tria es llegeix de la partida en curs: si els rivals estan fixats, el
   * desplegable s'obre mostrant el nivell fixat, no «automàtic». Sense això
   * semblava que la tria no s'hagués aplicat.
   */
  const [level, setLevel] = useState<LevelChoice>(
    current.auto === false ? (current.opponents[0] ?? 'auto') : 'auto',
  );
  const [adapt, setAdapt] = useState(Boolean(current.adaptDuringGame));
  const [editProgress, setEditProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [ratingInput, setRatingInput] = useState(String(profile.profile?.rating ?? 1100));
  const [gamesInput, setGamesInput] = useState(String(profile.profile?.gamesPlayed ?? 0));
  const [winsInput, setWinsInput] = useState(String(profile.profile?.wins ?? 0));

  const suggested = profile.profile ? suggestOpponents(profile.profile, count) : [];
  const opponents: DifficultyKey[] =
    level === 'auto' ? suggested : Array.from({ length: count }, () => level);

  async function saveName() {
    if (name.trim() && name.trim() !== profile.profile?.name) await profile.setName(name);
  }

  function currentProgress(): ProfileProgress | null {
    if (!profile.profile) return null;
    return {
      rating: profile.profile.rating,
      gamesPlayed: profile.profile.gamesPlayed,
      wins: profile.profile.wins,
    };
  }

  async function copyProgressLink() {
    const progress = currentProgress();
    if (!progress) return;
    const url = buildProfileTransferUrl(progress);
    try {
      await navigator.clipboard.writeText(url);
      setProgressMessage('Enllaç copiat. El pots enganxar a WhatsApp, Keep o on vulguis.');
    } catch {
      window.prompt('Copia aquest enllaç de Remigi:', url);
      setProgressMessage('');
    }
  }

  async function shareProgress() {
    const progress = currentProgress();
    if (!progress) return;
    const url = buildProfileTransferUrl(progress);
    const text = `Remigi · habilitat ${progress.rating} · ${progress.gamesPlayed} partides`;
    if (!navigator.share) {
      await copyProgressLink();
      return;
    }
    try {
      await navigator.share({
        title: 'El meu nivell de Remigi',
        text,
        url,
      });
      setProgressMessage('Nivell compartit.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copyProgressLink();
    }
  }

  async function saveProgress() {
    const next: ProfileProgress = {
      rating: Number(ratingInput),
      gamesPlayed: Number(gamesInput),
      wins: Number(winsInput),
    };
    if (!isValidProfileProgress(next)) {
      setProgressMessage(
        'Revisa els valors: les victòries no poden superar les partides i tots han de ser números sencers.',
      );
      return;
    }
    await profile.setProgress(next);
    setEditProgress(false);
    setProgressMessage('Nivell actualitzat en aquest aparell.');
  }

  async function startNewGame() {
    await saveName();
    onNewGame({
      playerName: name.trim() || profile.profile?.name || 'Jugador',
      opponents,
      auto: level === 'auto',
      adaptDuringGame: adapt,
    });
  }

  return (
    <>
      {/* Un toc fora del menú el tanca. */}
      <div className="menu-fons" onClick={onClose} />
      <div className="menu-usuari" role="dialog" aria-label="El teu jugador">
        {/* La firma de la casa: els quatre colors de les fitxes. */}
        <div className="franja-fitxes" aria-hidden="true" />

        <div className="menu-cap">
          <span className="player-color menu-avatar" aria-hidden="true">
            {(name.trim() || 'J').charAt(0).toUpperCase()}
          </span>
          <form
            className="row menu-nom"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="El teu nom"
              maxLength={20}
              aria-label="El teu nom"
            />
            <button type="submit" disabled={!name.trim()}>
              Desa el nom
            </button>
          </form>
        </div>

        {profile.profile && (
          <p className="muted small menu-habilitat">
            Habilitat: <strong>{profile.profile.rating}</strong> (
            {playerLevelLabel(profile.profile.rating)}) · {profile.profile.gamesPlayed}{' '}
            {profile.profile.gamesPlayed === 1 ? 'partida' : 'partides'}
          </p>
        )}

        {profile.profile && (
          <section className="nivell-sync" aria-label="Nivell entre dispositius">
            <div className="nivell-sync-cap">
              <strong>Nivell entre dispositius</strong>
              <span className="muted small">sense compte ni inici de sessió</span>
            </div>
            <div className="row nivell-sync-accions">
              <button type="button" onClick={() => void shareProgress()}>
                Comparteix nivell
              </button>
              <button type="button" className="secondary" onClick={() => void copyProgressLink()}>
                Copia enllaç
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditProgress((open) => !open);
                  setProgressMessage('');
                }}
              >
                {editProgress ? 'Tanca edició' : 'Canvia manualment'}
              </button>
            </div>

            {editProgress && (
              <div className="nivell-sync-form">
                <label>
                  Habilitat
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="4000"
                    step="1"
                    value={ratingInput}
                    onChange={(event) => setRatingInput(event.target.value)}
                  />
                </label>
                <label>
                  Partides jugades
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100000"
                    step="1"
                    value={gamesInput}
                    onChange={(event) => setGamesInput(event.target.value)}
                  />
                </label>
                <label>
                  Victòries
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100000"
                    step="1"
                    value={winsInput}
                    onChange={(event) => setWinsInput(event.target.value)}
                  />
                </label>
                <button type="button" onClick={() => void saveProgress()}>
                  Desa nivell
                </button>
              </div>
            )}

            <p className="muted small nivell-sync-nota">
              L’enllaç obre <strong>eltauler.cat/remigi</strong> i permet importar el nivell amb
              un toc. L’historial detallat de partides no es transfereix.
            </p>
            {progressMessage && (
              <p className="small nivell-sync-missatge" role="status">
                {progressMessage}
              </p>
            )}
          </section>
        )}

        <div className="menu-seccio">
        <div className="row count-picker">
          <span className="muted">Rivals:</span>
          {([1, 2, 3] as OpponentCount[]).map((option) => (
            <button
              key={option}
              type="button"
              className={count === option ? '' : 'secondary'}
              onClick={() => setCount(option)}
              aria-pressed={count === option}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="menu-nivell">
          Nivell dels rivals:{' '}
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as LevelChoice)}
          >
            <option value="auto">automàtic: puja i baixa amb tu</option>
            {DIFFICULTY_ORDER.map((key) => (
              <option key={key} value={key}>
                {DIFFICULTIES[key].label} (fixat)
              </option>
            ))}
          </select>
        </label>
        {level === 'auto' ? (
          suggested.length > 0 && (
            <p className="suggestion">
              {describeSuggestion(suggested)} Aniran canviant a mesura que milloris o
              empitjoris.
            </p>
          )
        ) : (
          <p className="suggestion">
            Rivals fixats a <strong>{DIFFICULTIES[level].label}</strong>: no canviaran
            encara que el teu nivell es mogui. S’aplica a la partida nova.
          </p>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={adapt}
            onChange={(event) => setAdapt(event.target.checked)}
          />
          Que s’adaptin també durant la partida
        </label>
        </div>

        {/*
          * El temps de cada torn. Es canvia en calent (no espera cap partida
          * nova) perquè es vegi de seguida al rellotge de la taula. Quan
          * s'acaba, el que tinguessis a mig col·locar es desfà i robes.
          */}
        <div className="temps-torn" role="group" aria-label="Temps per torn">
          <span className="muted">Temps per torn:</span>
          {TURN_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={turnSeconds === option ? '' : 'secondary'}
              aria-pressed={turnSeconds === option}
              onClick={() => onTurnSeconds(option)}
            >
              {option} s
            </button>
          ))}
          <button
            type="button"
            className={turnSeconds === null ? '' : 'secondary'}
            aria-pressed={turnSeconds === null}
            onClick={() => onTurnSeconds(null)}
          >
            sense límit
          </button>
        </div>

        {/*
          * L'aspecte de les fitxes: es tria mirant, amb una mostra de cada.
          * El predeterminat (color amb número blanc) va primer.
          */}
        <div className="tria-fitxes" role="group" aria-label="Aspecte de les fitxes">
          <span className="muted">Fitxes:</span>
          <button
            type="button"
            className="mostra-fitxa fitxes-inverses"
            aria-pressed={tileStyle === 'invers'}
            aria-label="Fitxes de color amb el número i la forma en blanc"
            onClick={() => onTileStyle('invers')}
          >
            <span className="tile tile-red mostra" aria-hidden="true">
              7
              <ColorShape color="red" />
            </span>
          </button>
          <button
            type="button"
            className="mostra-fitxa classica"
            aria-pressed={tileStyle === 'classic'}
            aria-label="Fitxes de crema amb el número i la forma de color"
            onClick={() => onTileStyle('classic')}
          >
            <span className="tile tile-red mostra" aria-hidden="true">
              7
              <ColorShape color="red" />
            </span>
          </button>
        </div>

        <div className="row menu-accions">
          <button onClick={() => void startNewGame()}>Partida nova</button>
          <button className="secondary" onClick={onHistory}>
            Historial
          </button>
          {/*
            * Jugar o fer jeroglífics: quan la col·lecció en té prou, aquí es
            * tria. Els trencaclosques venen de les jugades que se t'han
            * escapat a les partides.
            */}
          {jeroglifics >= MIN_JEROGLIFICS && (
            <button className="secondary" onClick={onJeroglifics}>
              Jeroglífics ({jeroglifics})
            </button>
          )}
        </div>

        <ComEsJuga obertPerDefecte={(profile.profile?.gamesPlayed ?? 0) === 0} />

        <button type="button" className="secondary menu-tanca" onClick={onClose}>
          Tanca la finestra
        </button>
      </div>
    </>
  );
}
