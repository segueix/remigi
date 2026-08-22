import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyKey } from '@rummikub/core';
import { useState } from 'react';
import type { GameSetup } from '../game/useGame';
import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
  onPlay(setup: GameSetup): void;
}

const DEFAULT_OPPONENTS: DifficultyKey[] = ['easy', 'medium'];

export function HomeScreen({ handle, onPlay }: Props) {
  const { profile } = handle;
  const [name, setName] = useState(profile?.name ?? '');
  const [editing, setEditing] = useState(!profile);
  const [opponents, setOpponents] = useState<DifficultyKey[]>(DEFAULT_OPPONENTS);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await handle.setName(name);
    setEditing(false);
  }

  /** En canviar el nombre d'oponents es conserven els nivells ja triats. */
  function setOpponentCount(count: number) {
    setOpponents((current) =>
      Array.from({ length: count }, (_, i) => current[i] ?? DEFAULT_OPPONENTS[i] ?? 'medium'),
    );
  }

  if (editing) {
    return (
      <section className="card">
        <h2>{profile ? 'Canvia el teu nom' : 'Benvingut/da!'}</h2>
        <p className="muted">
          {profile
            ? 'Aquest nom és el que veuràs a la taula durant les partides.'
            : 'Digue’ns com et dius i preparem la primera partida.'}
        </p>
        <form onSubmit={submit} className="row">
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

      <fieldset className="setup">
        <legend>Contra quants oponents vols jugar?</legend>
        <div className="row count-picker">
          {[1, 2, 3].map((count) => (
            <button
              key={count}
              type="button"
              className={opponents.length === count ? '' : 'secondary'}
              onClick={() => setOpponentCount(count)}
              aria-pressed={opponents.length === count}
            >
              {count}
            </button>
          ))}
        </div>

        <ul className="opponents">
          {opponents.map((level, index) => (
            <li key={index}>
              <label>
                Bot {index + 1}
                <select
                  value={level}
                  onChange={(event) =>
                    setOpponents((current) =>
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
          A la Fase 4 el joc et proposarà els nivells segons la teva habilitat.
        </p>
      </fieldset>

      <div className="row">
        <button onClick={() => onPlay({ playerName: profile!.name, opponents })}>
          Comença a jugar
        </button>
        <button className="secondary" onClick={() => setEditing(true)}>
          Canvia el nom
        </button>
      </div>
    </section>
  );
}
