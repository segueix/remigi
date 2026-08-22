import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  describeSuggestion,
  suggestOpponents,
  type DifficultyKey,
} from '@rummikub/core';
import { useState } from 'react';
import { ComEsJuga } from '../components/ComEsJuga';
import type { GameSetup } from '../game/useGame';
import type { SavedGame } from '../state/savedGame';
import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
  /** Partida a mig jugar, si n'hi ha cap de desada. */
  savedGame: SavedGame | null;
  onPlay(setup: GameSetup): void;
  onContinue(): void;
}

type OpponentCount = 1 | 2 | 3;

const FALLBACK: DifficultyKey[] = ['easy', 'medium', 'advanced'];

export function HomeScreen({ handle, savedGame, onPlay, onContinue }: Props) {
  const { profile } = handle;
  const [name, setName] = useState(profile?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState<OpponentCount>(2);
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState<DifficultyKey[]>(FALLBACK);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [adaptDuringGame, setAdaptDuringGame] = useState(false);

  // Sense perfil encara no hi ha res a configurar: primer, el nom.
  const askingName = editing || !profile;

  /**
   * En mode automàtic els rivals surten de l'habilitat del perfil, de manera
   * que les partides tendeixin a estar igualades. Sempre es poden triar a mà.
   */
  const opponents = auto && profile ? suggestOpponents(profile, count) : manual.slice(0, count);

  async function submitName(event: React.FormEvent) {
    event.preventDefault();
    await handle.setName(name);
    setEditing(false);
  }

  function useManualLevels() {
    // En passar a manual es parteix de la proposta actual, no de zero.
    setManual((current) => opponents.concat(current.slice(opponents.length)));
    setAuto(false);
  }

  async function resetProfile() {
    await handle.reset();
    setConfirmingReset(false);
    setName('');
    setEditing(false);
  }

  if (askingName) {
    return (
      <section className="card">
        <h2>{profile ? 'Canvia el teu nom' : 'Benvingut/da!'}</h2>
        <p className="muted">
          {profile
            ? 'Aquest nom és el que veuràs a la taula durant les partides.'
            : 'Digue’ns com et dius i preparem la primera partida.'}
        </p>
        <form onSubmit={submitName} className="row">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="El teu nom"
            maxLength={20}
            aria-label="El teu nom"
          />
          <button type="submit" disabled={!name.trim()}>
            Desa
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Hola, {profile!.name}!</h2>
      <p className="muted">
        Habilitat actual: <strong>{profile!.rating}</strong> punts · {profile!.gamesPlayed}{' '}
        {profile!.gamesPlayed === 1 ? 'partida jugada' : 'partides jugades'}
      </p>

      <ComEsJuga obertPerDefecte={profile!.gamesPlayed === 0} />

      {savedGame && (
        <div className="resume">
          <p>
            Tens una partida a mig jugar: <strong>torn {savedGame.game.turn}</strong> contra{' '}
            {savedGame.setup.opponents.map((key) => DIFFICULTIES[key].label).join(', ')}.
          </p>
          <button onClick={onContinue}>Continua la partida</button>
        </div>
      )}

      <fieldset className="setup">
        <legend>{savedGame ? 'O comença’n una de nova' : 'Contra quants oponents vols jugar?'}</legend>
        <div className="row count-picker">
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

        {auto ? (
          <div className="auto-levels">
            <p className="suggestion">{describeSuggestion(opponents)}</p>
            <p className="muted small">
              El joc tria els rivals segons com jugues: si guanyes sovint, pujaran de
              nivell; si perds, baixaran.{' '}
              <button type="button" className="link" onClick={useManualLevels}>
                Prefereixo triar-los jo
              </button>
            </p>
          </div>
        ) : (
          <>
            <ul className="opponents">
              {opponents.map((level, index) => (
                <li key={index}>
                  <label>
                    Bot {index + 1}
                    <select
                      value={level}
                      onChange={(event) =>
                        setManual((current) =>
                          current.map((old, i) =>
                            i === index ? (event.target.value as DifficultyKey) : old,
                          ),
                        )
                      }
                    >
                      {DIFFICULTY_ORDER.map((key) => (
                        <option key={key} value={key}>
                          {DIFFICULTIES[key].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            <p className="muted small">
              <button type="button" className="link" onClick={() => setAuto(true)}>
                Torna als oponents automàtics
              </button>
            </p>
          </>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={adaptDuringGame}
            onChange={(event) => setAdaptDuringGame(event.target.checked)}
          />
          Ajusta la dificultat durant la partida
        </label>
        <p className="muted small">
          Si l’actives, els bots afluixen quan vas molt endarrerit i afinen quan
          vas guanyant. El nivell de sortida no canvia.
        </p>
      </fieldset>

      <div className="row">
        <button
          className={savedGame ? 'secondary' : ''}
          onClick={() => onPlay({ playerName: profile!.name, opponents, adaptDuringGame })}
        >
          {savedGame ? 'Comença una partida nova' : 'Comença a jugar'}
        </button>
        <button className="secondary" onClick={() => setEditing(true)}>
          Canvia el nom
        </button>
      </div>

      <p className="muted small reset-line">
        {confirmingReset ? (
          <>
            Segur que vols esborrar el perfil, l’habilitat i tot l’historial?{' '}
            <button type="button" className="link danger" onClick={resetProfile}>
              Sí, esborra’l
            </button>{' '}
            ·{' '}
            <button type="button" className="link" onClick={() => setConfirmingReset(false)}>
              Cancel·la
            </button>
          </>
        ) : (
          <button type="button" className="link" onClick={() => setConfirmingReset(true)}>
            Reinicia el perfil
          </button>
        )}
      </p>
    </section>
  );
}
