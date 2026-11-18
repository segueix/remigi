import { useCallback, useRef } from 'react';

/**
 * Dos tocs seguits sobre la mateixa fitxa es consideren doble toc.
 *
 * 360 ms era massa exigent en mòbil: entre el pointerup, el click sintetitzat
 * i el segon gest, un doble toc normal sovint quedava fora. 700 ms continua
 * exigint dos tocs intencionadament seguits, però respecta millor el ritme real
 * de dits i pantalles tàctils.
 */
export const DOUBLE_TAP_MS = 700;

export type TapZone = 'board' | 'rack';

/**
 * Detecta el doble toc sobre una fitxa: el mateix a la partida i als
 * jeroglífics. `isDoubleTap` s'ha de cridar a cada toc (apunta el toc i diu si
 * completa un doble toc); `cancelTap` oblida el toc pendent (un arrossegament,
 * un desplaçament o un canvi de torn el fan caducar).
 */
export function useDoubleTap(): {
  isDoubleTap(tileId: string, zone: TapZone): boolean;
  cancelTap(): void;
} {
  const lastTap = useRef<{ tileId: string; zone: TapZone; at: number } | null>(null);
  const isDoubleTap = useCallback((tileId: string, zone: TapZone) => {
    const now = performance.now();
    const previous = lastTap.current;
    lastTap.current = { tileId, zone, at: now };
    if (
      previous &&
      previous.tileId === tileId &&
      previous.zone === zone &&
      now - previous.at <= DOUBLE_TAP_MS
    ) {
      lastTap.current = null;
      return true;
    }
    return false;
  }, []);
  const cancelTap = useCallback(() => {
    lastTap.current = null;
  }, []);
  return { isDoubleTap, cancelTap };
}
