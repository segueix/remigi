import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  adaptiveLevelLabel,
  describeSuggestion,
  suggestOpponents,
  suggestOpponentRatings,
  type DifficultyKey,
} from '@remigi/core';
import { useState } from 'react';
import type { GameMode, GameSetup } from '../game/useGame';
import {
  buildProfileTransferUrl,
  isValidProfileProgress,
  type ProfileProgress,
} from '../state/profileTransfer';
import type { ProfileHandle } from '../state/useProfile';
import { MIN_JEROGLIFICS } from '../state/useJeroglifics';
import type { TileStyle } from '../state/useTileStyle';
import { ComEsJuga } from './ComEsJuga';
import { SettingsPanel } from './SettingsPanel';

interface Props {
  profile: ProfileHandle;
  /** Configuració de la partida en curs, com a punt de partida del formulari. */
  current: GameSetup;
  tileStyle: TileStyle;
  onTileStyle(style: TileStyle): void;
  /** Jeroglífics a la col·lecció; amb prou n'apareix l'opció de jugar-los. */
  jeroglifics: number;
  onJeroglifics(): void;
  onNewGame(setup: GameSetup): void;
  onHistory(): void;
  onClose(): void;
  /** Al repte i a la lliga, els rivals els fixa el mode: aquí no es canvien. */
  mode?: GameMode;
  /** Torna a la pantalla d'inici. */
  onHome(): void;
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
  jeroglifics,
  onJeroglifics,
  onNewGame,
  onHistory,
  onClose,
  mode = 'lliure',
  onHome,
}: Props) {
  const free = mode === 'lliure';
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
  const [resetLevelConfirm, setResetLevelConfirm] = useState(false);
  const [ratingInput, setRatingInput] = useState(String(profile.profile?.rating ?? 1100));
  const [gamesInput, setGamesInput] = useState(String(profile.profile?.gamesPlayed ?? 0));
  const [winsInput, setWinsInput] = useState(String(profile.profile?.wins ?? 0));

  const calibrating = profile.profile?.adaptiveCalibrating === true;
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
      ratedGames: profile.profile.ratedGames,
      adaptiveStep: profile.profile.adaptiveStep,
      adaptiveCalibrating: profile.profile.adaptiveCalibrating,
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
    const text = progress.adaptiveCalibrating
      ? `Remigi · calibrant nivell · ${progress.gamesPlayed} partides`
      : `Remigi · habilitat ${progress.rating} · ${progress.gamesPlayed} partides`;
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

  async function resetAdaptiveLevel() {
    await profile.resetAdaptiveLevel();
    setLevel('auto');
    setResetLevelConfirm(false);
    setProgressMessage('Calibració reiniciada. La pròxima partida començarà a Novell.');
  }

  async function startNewGame() {
    await saveName();
    onNewGame({
      playerName: name.trim() || profile.profile?.name || 'Jugador',
      opponents,
      opponentRatings: level === 'auto' && profile.profile
        ? suggestOpponentRatings(profile.profile, count) : undefined,
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
            {calibrating ? (
              <>
                <strong>Calibrant el teu nivell</strong> · encara no hi ha cap número d’habilitat definitiu
              </>
            ) : (
              <>
                Nivell adaptatiu: <strong>{adaptiveLevelLabel(profile.profile)}</strong> · habilitat{' '}
                <strong>{profile.profile.rating}</strong> · {profile.profile.gamesPlayed}{' '}
                {profile.profile.gamesPlayed === 1 ? 'partida' : 'partides'}
              </>
            )}
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
              {!calibrating && (
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
              )}
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
              {calibrating ? (
                <>
                  Encara no mostrem cap número d’habilitat: primer acabarem de trobar el teu nivell.
                  L’enllaç conserva aquesta calibració entre dispositius.
                </>
              ) : (
                <>
                  L’enllaç obre <strong>eltauler.cat/remigi</strong> i permet importar el nivell amb
                  un toc. L’historial detallat de partides no es transfereix.
                </>
              )}
            </p>
            {progressMessage && (
              <p className="small nivell-sync-missatge" role="status">
                {progressMessage}
              </p>
            )}
          </section>
        )}

        {!free && (
          <p className="suggestion menu-mode">
            {mode === 'lliga'
              ? 'Jornada de lliga: els rivals i el seu nivell els posa el calendari de la lliga.'
              : 'Partida de repte: el nivell i el nombre de rivals els vas triar en començar el repte.'}{' '}
            El teu nivell del joc lliure no es mou amb aquestes partides.
          </p>
        )}

        {free && (
        <div className="menu-seccio nivell-seccio">
        <div className="menu-seccio-cap">
          <span className="menu-seccio-icona" aria-hidden="true">🎯</span>
          <div>
            <strong>Nivell i rivals</strong>
            <span className="muted small">
              {calibrating
                ? 'Estem buscant el teu nivell: començaràs a Novell i anirem pujant.'
                : 'Tria nivell adaptatiu o fixa manualment la dificultat.'}
            </span>
          </div>
        </div>
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
              {calibrating ? describeSuggestion(suggested) : `Rivals de nivell ${profile.profile?.rating} (${profile.profile ? adaptiveLevelLabel(profile.profile) : ""})`} Aniran canviant a mesura que milloris o
              empitjoris.
            </p>
          )
        ) : (
          <p className="suggestion">
            Rivals fixats a <strong>{DIFFICULTIES[level].label}</strong>: no canviaran
            encara que el teu nivell es mogui. S’aplica a la partida nova.
          </p>
        )}

        <div className="nivell-reset">
          {resetLevelConfirm ? (
            <div className="nivell-reset-confirm">
              <span>Vols tornar a començar la calibració des de Novell?</span>
              <button type="button" onClick={() => void resetAdaptiveLevel()}>
                Sí, reinicia el nivell
              </button>
              <button type="button" className="secondary" onClick={() => setResetLevelConfirm(false)}>
                Cancel·la
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="secondary reset-nivell"
              onClick={() => setResetLevelConfirm(true)}
            >
              ↺ Reinicia nivell i torna a calibrar
            </button>
          )}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={adapt}
            onChange={(event) => setAdapt(event.target.checked)}
          />
          Que s’adaptin també durant la partida
        </label>
        </div>
        )}

        <SettingsPanel tileStyle={tileStyle} onTileStyle={onTileStyle} />

        <div className="row menu-accions">
          {free && <button onClick={() => void startNewGame()}>Partida nova</button>}
          <button className={free ? 'secondary' : ''} onClick={onHome}>
            Inici
          </button>
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
