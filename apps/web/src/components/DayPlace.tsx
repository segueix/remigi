import { useEffect, useState } from 'react';
import { fetchDayPlace } from '../cloud/firebase';
import { rankScore } from '../cloud/ranking';
import { useCloudContext } from '../cloud/useCloud';
import type { DailyResult } from '../dia/daily';
import { ordinal } from '../ui/format';

/**
 * La teva posició al rànquing d'avui: «Ets el 3r de 25». Es calcula un sol
 * cop amb la teva puntuació (que ja se sap), sense esperar que el resultat
 * hagi pujat. Sense compte de Google, on s'entra (a dalt de l'inici).
 */
export function DayPlace({ result }: { result: DailyResult }) {
  const cloud = useCloudContext();
  const uid = cloud?.user?.uid ?? null;
  const score = rankScore(result);
  const [place, setPlace] = useState<{ place: number; total: number } | null>(null);

  useEffect(() => {
    setPlace(null);
    if (!uid) return;
    let cancelled = false;
    fetchDayPlace(result.day, score)
      .then((found) => !cancelled && setPlace(found))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [result.day, score, uid]);

  if (!cloud || cloud.checking) return null;
  if (!uid) {
    return <p className="dia-posicio muted small">Entra amb Google a dalt de l’inici per sortir al rànquing.</p>;
  }
  if (!place) return null;
  return (
    <p className="dia-posicio">
      <span aria-hidden="true">{place.place <= 3 ? ['🥇', '🥈', '🥉'][place.place - 1] : '🏅'}</span> Ets el{' '}
      <strong>{ordinal(place.place)}</strong> de {place.total} al rànquing d’avui
    </p>
  );
}
