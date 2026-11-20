import { useEffect, useState } from 'react';
import { fetchDayPlace } from '../cloud/firebase';
import { useCloudContext } from '../cloud/useCloud';
import { ordinal } from '../ui/format';

/** Cops que es torna a mirar (el resultat tarda uns segons a pujar en acabar). */
const TRIES = 6;
const WAIT_MS = 2500;

/**
 * La teva posició al rànquing d'avui: «Ets el 3r de 25». Sense compte de
 * Google, on s'entra (a dalt de l'inici).
 */
export function DayPlace({ day }: { day: string }) {
  const cloud = useCloudContext();
  const uid = cloud?.user?.uid ?? null;
  const [place, setPlace] = useState<{ place: number; total: number } | null>(null);

  useEffect(() => {
    setPlace(null);
    if (!uid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      fetchDayPlace(day, uid)
        .then((found) => {
          if (cancelled) return;
          if (found) setPlace(found);
          else if (n + 1 < TRIES) timer = setTimeout(() => attempt(n + 1), WAIT_MS);
        })
        .catch(() => {
          if (!cancelled && n + 1 < TRIES) timer = setTimeout(() => attempt(n + 1), WAIT_MS);
        });
    };
    attempt(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [day, uid]);

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
