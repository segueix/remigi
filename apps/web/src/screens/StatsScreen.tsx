import { DIFFICULTIES, STARTING_RATING, type GameRecord } from '@rummikub/core';
import { useState } from 'react';
import type { ProfileHandle } from '../state/useProfile';

interface Props {
  handle: ProfileHandle;
}

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

      {profile.history.length === 0 ? (
        <p className="notice">
          Encara no has acabat cap partida. Quan en juguis, aquí veuràs com evoluciona
          la teva habilitat i contra quins rivals has jugat.
        </p>
      ) : (
        <>
          <RatingChart history={profile.history} />
          <HistoryList history={profile.history} />
        </>
      )}
    </section>
  );
}

/* ---------- Evolució de l'habilitat ---------- */

const W = 600;
const H = 190;
const PAD = { top: 18, right: 46, bottom: 26, left: 44 };

/**
 * Una sola sèrie (l'habilitat després de cada partida), així que no cal
 * llegenda: el títol ja diu què s'hi ensenya. La línia de referència marca amb
 * quina habilitat es va començar, que és el que dona sentit a la pujada o la
 * baixada. Els detalls de cada punt es llegeixen a sota en passar-hi per sobre
 * (o amb el tabulador), i l'historial complet fa de versió en text.
 */
function RatingChart({ history }: { history: GameRecord[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Amb una sola partida no hi ha cap línia a dibuixar: el número ja ho diu tot.
  if (history.length < 2) return null;

  const ratings = history.map((record) => record.ratingAfter);
  const values = [STARTING_RATING, ...ratings];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = Math.max(20, (max - min) * 0.2);
  const lo = min - margin;
  const hi = max + margin;

  const x = (index: number) =>
    PAD.left + (index / (history.length - 1)) * (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - (value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const path = ratings.map((rating, i) => `${i ? 'L' : 'M'}${x(i)} ${y(rating)}`).join(' ');
  const last = ratings.length - 1;
  const active = hovered ?? last;
  const step = (W - PAD.left - PAD.right) / Math.max(1, history.length - 1);

  return (
    <figure className="chart">
      <figcaption>Evolució de la teva habilitat</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Habilitat després de cada partida">
        {/* Referència: amb quina habilitat es va començar. */}
        <line className="chart-baseline" x1={PAD.left} x2={W - PAD.right} y1={y(STARTING_RATING)} y2={y(STARTING_RATING)} />
        <text className="chart-axis" x={PAD.left - 6} y={y(STARTING_RATING)} textAnchor="end" dominantBaseline="middle">
          {STARTING_RATING}
        </text>

        <path className="chart-line" d={path} />

        {/* Punt final amb etiqueta directa: el valor d'ara. */}
        <circle className="chart-ring" cx={x(last)} cy={y(ratings[last])} r={6} />
        <circle className="chart-dot" cx={x(last)} cy={y(ratings[last])} r={4} />
        <text className="chart-value" x={x(last) + 10} y={y(ratings[last])} dominantBaseline="middle">
          {ratings[last]}
        </text>

        {active !== last && (
          <>
            <circle className="chart-ring" cx={x(active)} cy={y(ratings[active])} r={6} />
            <circle className="chart-dot" cx={x(active)} cy={y(ratings[active])} r={4} />
          </>
        )}

        {/* Zones de contacte més amples que els punts, i accessibles amb teclat. */}
        {history.map((record, i) => (
          <rect
            key={i}
            x={x(i) - step / 2}
            y={PAD.top}
            width={step}
            height={H - PAD.top - PAD.bottom}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={describeRecord(record, i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
          />
        ))}

        <text className="chart-axis" x={PAD.left} y={H - 8}>
          partida 1
        </text>
        <text className="chart-axis" x={W - PAD.right} y={H - 8} textAnchor="end">
          partida {history.length}
        </text>
      </svg>
      <p className="chart-readout">{describeRecord(history[active], active)}</p>
    </figure>
  );
}

function describeRecord(record: GameRecord, index: number): string {
  const rivals = record.opponents.map((key) => DIFFICULTIES[key].label).join(', ');
  return `Partida ${index + 1} · ${record.won ? 'guanyada' : 'perduda'} contra ${rivals} · habilitat ${record.ratingAfter}`;
}

/* ---------- Historial ---------- */

function HistoryList({ history }: { history: GameRecord[] }) {
  const recent = [...history].reverse();
  return (
    <>
      <h3 className="history-title">Historial</h3>
      <ul className="history">
        {recent.map((record, i) => (
          <li key={history.length - i}>
            <span className={record.won ? 'result-won' : 'result-lost'}>
              {record.won ? 'Guanyada' : 'Perduda'}
            </span>
            <span className="muted history-rivals">
              {record.opponents.map((key) => DIFFICULTIES[key].label).join(', ')}
            </span>
            <span className="muted history-date">{formatDate(record.date)}</span>
            <span className="history-rating">{record.ratingAfter}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' });
}
