import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
}

/**
 * De moment només ensenya el que el perfil ja conté. L'historial i el gràfic
 * d'evolució de l'Elo es completen a la Fase 4, quan les partides acabades
 * comencin a alimentar el perfil.
 */
export function StatsScreen({ handle }: Props) {
  const profile = handle.profile;
  if (!profile) return <p className="muted">Encara no hi ha cap perfil.</p>;

  const winRate = profile.gamesPlayed
    ? Math.round((100 * profile.wins) / profile.gamesPlayed)
    : null;

  return (
    <section className="card">
      <h2>Estadístiques</h2>
      <dl className="stats">
        <div>
          <dt>Habilitat</dt>
          <dd>{profile.rating}</dd>
        </div>
        <div>
          <dt>Partides</dt>
          <dd>{profile.gamesPlayed}</dd>
        </div>
        <div>
          <dt>Victòries</dt>
          <dd>{profile.wins}</dd>
        </div>
        <div>
          <dt>Percentatge</dt>
          <dd>{winRate === null ? '—' : `${winRate}%`}</dd>
        </div>
      </dl>

      <p className="notice">
        L’historial de partides i l’evolució de l’habilitat es podran veure aquí
        quan les partides comptin per al perfil (Fase 4).
      </p>
    </section>
  );
}
