import { botPersona, isPersonName } from '../game/bots';
import { signed } from '../ui/format';

export interface BarRow {
  key: string;
  name: string;
  you: boolean;
  points: number | null;
  /** Una nota curta a la dreta del nom (p. ex. «+2 pts» de lliga). */
  note?: string;
}

/** L'avatar de cadascú: el teu, amb la inicial; els rivals, amb el seu degradat. */
export function Avatar({ name, you, big = false }: { name: string; you: boolean; big?: boolean }) {
  const persona = you ? null : botPersona(name);
  const classes = ['player-color', 'carrusel-avatar'];
  if (big) classes.push('gran');
  if (persona && isPersonName(name)) classes.push('inicials');
  return (
    <span
      className={classes.join(' ')}
      aria-hidden="true"
      style={persona ? { background: `linear-gradient(135deg, ${persona.colors[0]}, ${persona.colors[1]})` } : undefined}
    >
      {persona ? persona.emoji : (name.trim().charAt(0) || 'T').toUpperCase()}
    </span>
  );
}

const sign = (n: number) => (n >= 0 ? 'points-positive' : 'points-negative');

/**
 * El resultat d'una partida, molt visual: qui l'ha guanyada, en gran, i una
 * barra per jugador sobre un eix al mig (cap a la dreta els punts guanyats i
 * cap a l'esquerra els perduts).
 */
export function ResultBars({ rows, winner, detail }: { rows: BarRow[]; winner?: BarRow; detail?: string }) {
  const ordered = [...rows].sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity));
  const maxAbs = Math.max(1, ...ordered.map((row) => Math.abs(row.points ?? 0)));
  return (
    <>
      {winner && (
        <div className={winner.you ? 'carrusel-guanyador jo' : 'carrusel-guanyador'}>
          <Avatar name={winner.name} you={winner.you} big />
          <strong>{winner.you ? 'Has guanyat!' : `Guanya ${winner.name}`}</strong>
          {detail && <span className="muted small">{detail}</span>}
        </div>
      )}
      <ul className="carrusel-barres">
        {ordered.map((row) => {
          const points = row.points ?? 0;
          return (
            <li key={row.key} className={row.you ? 'jo' : undefined}>
              <Avatar name={row.name} you={row.you} />
              <span className="carrusel-nom">
                {row.you ? 'Tu' : row.name}
                {row.note && <small className="carrusel-nota">{row.note}</small>}
              </span>
              <span className="carrusel-eix" aria-hidden="true">
                <span
                  className={points >= 0 ? 'barra positiva' : 'barra negativa'}
                  style={{ width: `${(Math.abs(points) / maxAbs) * 50}%` }}
                />
              </span>
              <span className={`carrusel-punts ${sign(points)}`}>{row.points === null ? '—' : signed(points)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
