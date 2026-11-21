import { useEffect, useState } from 'react';
import { fetchDayView, fetchStreakRanking, type DayView } from '../cloud/firebase';
import { snapshotHourText, snapshotHoursText } from '../cloud/snapshot';
import {
  RANKING_SIZE,
  dayEntry,
  dayRanking,
  streakRanking,
  type DayEntry,
  type PlayerEntry,
  type RankRow,
} from '../cloud/ranking';
import { useCloudContext } from '../cloud/useCloud';
import { previousDay, resultText, type DailyResult } from '../dia/daily';

type Tab = 'avui' | 'ahir' | 'ratxes';

type Load<T> = { state: 'carregant' } | { state: 'error' } | { state: 'fet'; rows: RankRow<T>[] };

interface Props {
  today: string;
  /** L'àlies amb què surts (el teu nom a Remigi). */
  alias: string;
  /** El teu resultat d'avui: si no ets al top, la teva fila surt a sota. */
  mine?: DailyResult | null;
  /** El teu resultat d'ahir, per a la pestanya «Ahir». */
  mineYesterday?: DailyResult | null;
  /** Canvia quan hi ha un resultat nou pujat: es torna a carregar. */
  version: number;
}

/**
 * Els rànquings de la partida del dia: el d'avui i el d'ahir (victòries per
 * menys jugades i després derrotes per menys punts a la mà; només el dia
 * anterior, sense històric) i el de ratxes de partides guanyades seguides.
 * Per sortir-hi cal entrar amb Google (a dalt de l'inici); per mirar-los, no.
 */
export function DiaRanking({ today, alias, mine = null, mineYesterday = null, version }: Props) {
  const cloud = useCloudContext();
  const [tab, setTab] = useState<Tab>('avui');
  const [day, setDay] = useState<Load<DayEntry>>({ state: 'carregant' });
  const [streaks, setStreaks] = useState<Load<PlayerEntry>>({ state: 'carregant' });
  const [meta, setMeta] = useState<DayView | null>(null);
  const uid = cloud?.user?.uid ?? null;

  useEffect(() => {
    let cancelled = false;
    if (tab === 'avui' || tab === 'ahir') {
      const day = tab === 'avui' ? today : previousDay(today);
      const own = tab === 'avui' ? mine : mineYesterday;
      setDay({ state: 'carregant' });
      setMeta(null);
      void (async () => {
        try {
          const ownEntry = own && own.day === day ? dayEntry(own, alias, 0) : null;
          const view = await fetchDayView(day, uid, uid ? ownEntry : null);
          if (cancelled) return;
          setDay({ state: 'fet', rows: view.rows });
          setMeta(view);
        } catch {
          if (!cancelled) setDay({ state: 'error' });
        }
      })();
    } else {
      setStreaks({ state: 'carregant' });
      fetchStreakRanking(today, previousDay(today))
        .then(
          (rows) =>
            !cancelled && setStreaks({ state: 'fet', rows: streakRanking(rows, today, uid).slice(0, RANKING_SIZE) }),
        )
        .catch(() => !cancelled && setStreaks({ state: 'error' }));
    }
    return () => {
      cancelled = true;
    };
  }, [tab, today, uid, version, mine, mineYesterday, alias]);

  return (
    <section className="dia-ranking" aria-label="Rànquing">
      <div className="dia-ranking-cap">
        <h3>Rànquing</h3>
        <div className="dia-ranking-pestanyes" role="tablist">
          {(
            [
              ['avui', 'Avui'],
              ['ahir', 'Ahir'],
              ['ratxes', 'Ratxes'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? '' : 'secondary'}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'ratxes' ? (
        <RankList
          load={day}
          empty={tab === 'avui' ? 'Encara no hi ha ningú al rànquing d’avui. Sigues el primer!' : 'Ahir no hi va jugar ningú.'}
          column="Jugades"
          value={(e) => (e.won ? String(e.moves) : `−${e.points}`)}
          extraColumn="Rivals"
          extra={(e) => (e.won ? (e.rivals > 0 ? `+${e.rivals}` : '—') : '')}
          label={(e) => (e.won && e.rivals > 0 ? `${resultText(e)}; rivals amb ${e.rivals} punts` : resultText(e))}
          good={(e) => e.won}
        />
      ) : (
        <RankList
          load={streaks}
          empty="Encara no hi ha cap ratxa en marxa."
          column="Dies"
          value={(e) => `🔥 ${e.streak}`}
          label={(e) => `${e.streak} ${e.streak === 1 ? 'dia' : 'dies'} de ratxa`}
          good={() => true}
        />
      )}

      {tab !== 'ratxes' && <RankingNote meta={meta} />}

    </section>
  );
}

function RankList<T extends { alias: string }>({
  load,
  empty,
  column,
  value,
  extraColumn,
  extra,
  label,
  good,
}: {
  load: Load<T>;
  empty: string;
  /** Capçalera de la columna del resultat («Jugades», «Dies»): la paraula surt un sol cop. */
  column: string;
  /** El resultat curt de cada fila: el número de jugades, o «−punts» si ha perdut. */
  value(entry: T): string;
  /**
   * Segona columna, si n'hi ha: al rànquing d'avui, el desempat (els punts que
   * s'han quedat els rivals, en verd: com més, millor).
   */
  extraColumn?: string;
  extra?(entry: T): string;
  /** El resultat sencer, per als lectors de pantalla. */
  label(entry: T): string;
  good(entry: T): boolean;
}) {
  if (load.state === 'carregant') return <p className="muted small">Carregant el rànquing…</p>;
  if (load.state === 'error') return <p className="muted small">No s’ha pogut carregar el rànquing. Torna-ho a provar més tard.</p>;
  if (load.rows.length === 0) return <p className="muted small">{empty}</p>;
  return (
    <ol className={extra ? 'dia-ranking-llista amb-extra' : 'dia-ranking-llista'}>
      <li className="dia-ranking-capcalera" aria-hidden="true">
        <span>#</span>
        <span>Jugador</span>
        <span className="dia-ranking-valor">{column}</span>
        {extraColumn && <span className="dia-ranking-extra">{extraColumn}</span>}
      </li>
      {load.rows.map((row, i) => (
        <li
          key={row.id}
          className={
            [row.you && 'jo', row.gap && 'salt'].filter(Boolean).join(' ') ||
            undefined
          }
        >
          <span className="dia-ranking-pos">{row.place <= 3 ? ['🥇', '🥈', '🥉'][row.place - 1] : row.place}</span>
          <span className="dia-ranking-nom">
            {row.entry.alias}
            {row.you && <span className="muted"> (tu)</span>}
          </span>
          <span
            className={good(row.entry) ? 'dia-ranking-valor' : 'dia-ranking-valor perd'}
            aria-label={label(row.entry)}
          >
            {value(row.entry)}
          </span>
          {extra && <span className="dia-ranking-extra" aria-hidden="true">{extra(row.entry)}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Com d'actual és la classificació: en directe (pocs jugadors) o la fotografia
 * de les 9, 15 i 22 h, una hora més tard a l'estiu (la primera tanca la del
 * dia anterior).
 */
function RankingNote({ meta }: { meta: DayView | null }) {
  if (!meta) return null;
  const hours = snapshotHoursText();
  const first = hours.split(',')[0];
  if (meta.source === 'directe') {
    return (
      <p className="muted small dia-ranking-nota">
        Ara es veu en directe (hi ha pocs jugadors). Quan n’hi hagi més, s’actualitzarà a les {hours} h; la
        primera del dia tanca la del dia anterior.
      </p>
    );
  }
  return (
    <p className="muted small dia-ranking-nota">
      {meta.final ? 'Classificació final' : `Actualitzada a les ${snapshotHourText(meta.updatedAt ?? 0)}`} · s’actualitza a les{' '}
      {hours} h; la de les {first} h tanca la del dia anterior.
      {meta.provisional && ' La teva posició és provisional fins a la propera actualització.'}
    </p>
  );
}
