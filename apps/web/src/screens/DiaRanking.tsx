import { useEffect, useState } from 'react';
import { fetchDayRanking, fetchStreakRanking } from '../cloud/firebase';
import { dayRanking, streakRanking, type DayEntry, type PlayerEntry, type RankRow } from '../cloud/ranking';
import type { CloudHandle } from '../cloud/useCloud';
import { resultText } from '../dia/daily';

type Tab = 'avui' | 'ratxes';

type Load<T> = { state: 'carregant' } | { state: 'error' } | { state: 'fet'; rows: RankRow<T>[] };

interface Props {
  cloud: CloudHandle;
  today: string;
  /** L'àlies amb què surts (el teu nom a Remigi). */
  alias: string;
  /** Canvia quan hi ha un resultat nou pujat: es torna a carregar. */
  version: number;
}

/**
 * Els rànquings de la partida del dia: el d'avui (victòries per menys jugades
 * i després derrotes per menys punts a la mà) i el de ratxes de dies número 1.
 * Per sortir-hi cal entrar amb Google; per mirar-los, no.
 */
export function DiaRanking({ cloud, today, alias, version }: Props) {
  const [tab, setTab] = useState<Tab>('avui');
  const [day, setDay] = useState<Load<DayEntry>>({ state: 'carregant' });
  const [streaks, setStreaks] = useState<Load<PlayerEntry>>({ state: 'carregant' });
  const uid = cloud.user?.uid ?? null;

  useEffect(() => {
    let cancelled = false;
    if (tab === 'avui') {
      setDay({ state: 'carregant' });
      fetchDayRanking(today)
        .then((rows) => !cancelled && setDay({ state: 'fet', rows: dayRanking(rows, uid) }))
        .catch(() => !cancelled && setDay({ state: 'error' }));
    } else {
      setStreaks({ state: 'carregant' });
      fetchStreakRanking()
        .then((rows) => !cancelled && setStreaks({ state: 'fet', rows: streakRanking(rows, today, uid) }))
        .catch(() => !cancelled && setStreaks({ state: 'error' }));
    }
    return () => {
      cancelled = true;
    };
  }, [tab, today, uid, version]);

  return (
    <section className="dia-ranking" aria-label="Rànquing">
      <div className="dia-ranking-cap">
        <h3>Rànquing</h3>
        <div className="dia-ranking-pestanyes" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'avui'}
            className={tab === 'avui' ? '' : 'secondary'}
            onClick={() => setTab('avui')}
          >
            Avui
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ratxes'}
            className={tab === 'ratxes' ? '' : 'secondary'}
            onClick={() => setTab('ratxes')}
          >
            Ratxes
          </button>
        </div>
      </div>

      {tab === 'avui' ? (
        <RankList
          load={day}
          empty="Encara no hi ha ningú al rànquing d’avui. Sigues el primer!"
          value={(e) => resultText(e)}
          good={(e) => e.won}
        />
      ) : (
        <RankList
          load={streaks}
          empty="Encara no hi ha cap ratxa en marxa."
          value={(e) => `🔥 ${e.streak} ${e.streak === 1 ? 'dia' : 'dies'}`}
          good={() => true}
        />
      )}

      <div className="dia-compte">
        {cloud.checking ? (
          <p className="muted small">Mirant si has entrat amb Google…</p>
        ) : cloud.user ? (
          <p className="muted small">
            Surts al rànquing com a <strong>{alias}</strong> (el teu nom a Remigi; el canvies al menú del
            jugador).{' '}
            <button type="button" className="enllac" onClick={cloud.signOut}>
              Surt del compte
            </button>
          </p>
        ) : (
          <>
            <p className="muted small">
              Entra amb Google per sortir al rànquing. Només s’hi veu el teu nom de Remigi, mai el nom ni el
              correu del compte.
            </p>
            <button type="button" className="secondary dia-google" onClick={cloud.signIn}>
              <GoogleMark /> Entra amb Google
            </button>
          </>
        )}
        {cloud.error && (
          <p className="small points-negative" role="alert">
            {cloud.error}
          </p>
        )}
      </div>
    </section>
  );
}

function RankList<T extends { alias: string }>({
  load,
  empty,
  value,
  good,
}: {
  load: Load<T>;
  empty: string;
  value(entry: T): string;
  good(entry: T): boolean;
}) {
  if (load.state === 'carregant') return <p className="muted small">Carregant el rànquing…</p>;
  if (load.state === 'error') return <p className="muted small">No s’ha pogut carregar el rànquing. Torna-ho a provar més tard.</p>;
  if (load.rows.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <ol className="dia-ranking-llista">
      {load.rows.map((row) => (
        <li key={row.id} className={row.you ? 'jo' : undefined}>
          <span className="dia-ranking-pos">{row.place <= 3 ? ['🥇', '🥈', '🥉'][row.place - 1] : row.place}</span>
          <span className="dia-ranking-nom">
            {row.entry.alias}
            {row.you && <span className="muted"> (tu)</span>}
          </span>
          <span className={good(row.entry) ? 'punts points-positive' : 'punts points-negative'}>{value(row.entry)}</span>
        </li>
      ))}
    </ol>
  );
}

/** La «G» de Google, en colors (el botó ha de ser reconeixible). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
