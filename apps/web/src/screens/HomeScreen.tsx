import { useState } from 'react';
import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
  onPlay(): void;
}

export function HomeScreen({ handle, onPlay }: Props) {
  const { profile } = handle;
  const [name, setName] = useState(profile?.name ?? '');
  const [editing, setEditing] = useState(!profile);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await handle.setName(name);
    setEditing(false);
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
      <div className="row">
        <button onClick={onPlay}>Comença a jugar</button>
        <button className="secondary" onClick={() => setEditing(true)}>
          Canvia el nom
        </button>
      </div>
    </section>
  );
}
