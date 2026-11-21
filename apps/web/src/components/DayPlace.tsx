import { useEffect, useState } from 'react';
import { fetchDayView } from '../cloud/firebase';
import { dayEntry } from '../cloud/ranking';
import { useCloudContext } from '../cloud/useCloud';
import type { DailyResult } from '../dia/daily';
import { ordinal } from '../ui/format';

/**
 * La teva posició al rànquing d'avui: «Ets el 2n al rànquing d'avui». És la
 * mateixa que surt a la llista (la del resultat desat a Firestore). Sense
 * compte de Google, on s'entra (a dalt de l'inici).
 */
export function DayPlace({ result }: { result: DailyResult }) {
  const cloud = useCloudContext();
  const uid = cloud?.user?.uid ?? null;
  const [place, setPlace] = useState<number | null>(null);

  useEffect(() => {
    setPlace(null);
    if (!uid) return;
    let cancelled = false;
    // La mateixa vista que la classificació (i desada amb ella): la posició hi coincideix.
    fetchDayView(result.day, uid, dayEntry(result, 'Tu', 0))
      .then((view) => !cancelled && setPlace(view.rows.find((row) => row.you)?.place ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [result, uid]);

  if (!cloud || cloud.checking) return null;
  if (!uid) {
    return <p className="dia-posicio muted small">Entra amb Google a dalt de l’inici per sortir al rànquing.</p>;
  }
  if (place === null) return null;
  return (
    <p className="dia-posicio">
      <span aria-hidden="true">{place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : '🏅'}</span> Ets el{' '}
      <strong>{ordinal(place)}</strong> al rànquing d’avui
    </p>
  );
}
