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
import type { ProfileHandle } from '../state/useProfile';
import { ComEsJuga } from './ComEsJuga';

interface Props {
  profile: ProfileHandle;
  /** Configuració de la partida en curs, com a punt de partida del formulari. */
  current: GameSetup;
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
export function PlayerMenu({ profile, current, onNewGame, onHistory, onClose }: Props) {
  const [name, setName] = useState(profile.profile?.name ?? '');
  const [count, setCount] = useState<OpponentCount>(
    Math.min(3, Math.max(1, current.opponents.length)) as OpponentCount,
  );
  const [level, setLevel] = useState<LevelChoice>('auto');
  const [adapt, setAdapt] = useState(Boolean(current.adaptDuringGame));

  const suggested = profile.profile ? suggestOpponents(profile.profile, count) : [];
  const opponents: DifficultyKey[] =
    level === 'auto' ? suggested : Array.from({ length: count }, () => level);

  async function saveName() {
    if (name.trim() && name.trim() !== profile.profile?.name) await profile.setName(name);
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
          Nivell:{' '}
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as LevelChoice)}
          >
            <option value="auto">automàtic (segons la teva habilitat)</option>
            {DIFFICULTY_ORDER.map((key) => (
              <option key={key} value={key}>
                {DIFFICULTIES[key].label}
              </option>
            ))}
          </select>
        </label>
        {level === 'auto' && suggested.length > 0 && (
          <p className="suggestion">{describeSuggestion(suggested)}</p>
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

        <div className="row menu-accions">
          <button onClick={() => void startNewGame()}>Partida nova</button>
          <button className="secondary" onClick={onHistory}>
            Historial
          </button>
        </div>

        <ComEsJuga obertPerDefecte={(profile.profile?.gamesPlayed ?? 0) === 0} />
      </div>
    </>
  );
}
