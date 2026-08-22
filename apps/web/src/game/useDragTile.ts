import { useCallback, useEffect, useRef, useState } from 'react';
import type { Destination } from './turnDraft';

/**
 * Arrossegar fitxes amb esdeveniments de punter, que tracten igual el ratolí,
 * el dit i el llapis (a diferència de l'arrossegament natiu d'HTML, que a
 * mòbil no funciona).
 *
 * Conviu amb el «tria i col·loca» a clics de la Fase 3, que continua sent
 * l'alternativa accessible: fins que el punter no es mou uns quants píxels no
 * es considera un arrossegament, així que un toc net segueix sent un toc. Quan
 * sí que hi ha hagut arrossegament, es marca perquè el `click` que el navegador
 * envia tot seguit no torni a actuar sobre la mateixa fitxa.
 */
const DRAG_THRESHOLD_PX = 6;

export interface DragInfo {
  tileId: string;
  x: number;
  y: number;
  /** Destinació sota el punter ara mateix, si n'hi ha cap. */
  over: Destination | null;
}

export interface DragHandle {
  dragging: DragInfo | null;
  start(event: React.PointerEvent, tileId: string): void;
  /** Diu si el clic que arriba ve d'un arrossegament (i, per tant, s'ha d'ignorar). */
  consumeDragFlag(): boolean;
}

/** Llegeix la destinació de l'element que hi ha sota unes coordenades. */
export function dropTargetAt(x: number, y: number): Destination | null {
  const element = document.elementFromPoint(x, y);
  const zone = element?.closest('[data-drop]')?.getAttribute('data-drop');
  if (!zone) return null;
  if (zone === 'rack') return { kind: 'rack' };
  if (zone === 'new') return { kind: 'new' };
  const meld = /^meld:(\d+)$/.exec(zone);
  return meld ? { kind: 'meld', index: Number(meld[1]) } : null;
}

export function useDragTile(
  enabled: boolean,
  onDrop: (tileId: string, target: Destination) => void,
): DragHandle {
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const gesture = useRef<{ tileId: string; startX: number; startY: number; active: boolean } | null>(
    null,
  );
  const draggedJustNow = useRef(false);

  const start = useCallback(
    (event: React.PointerEvent, tileId: string) => {
      // Cada gest nou parteix de zero: així una marca que no s'hagi arribat a
      // consumir no s'endú el clic següent.
      draggedJustNow.current = false;
      if (!enabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      gesture.current = { tileId, startX: event.clientX, startY: event.clientY, active: false };
    },
    [enabled],
  );

  useEffect(() => {
    function move(event: PointerEvent) {
      const current = gesture.current;
      if (!current) return;
      if (!current.active) {
        const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
        if (distance < DRAG_THRESHOLD_PX) return;
        current.active = true;
      }
      setDragging({
        tileId: current.tileId,
        x: event.clientX,
        y: event.clientY,
        over: dropTargetAt(event.clientX, event.clientY),
      });
    }

    function finish(event: PointerEvent) {
      const current = gesture.current;
      gesture.current = null;
      setDragging(null);
      if (!current?.active) return;
      draggedJustNow.current = true;
      const target = dropTargetAt(event.clientX, event.clientY);
      if (target) onDrop(current.tileId, target);
    }

    function cancel() {
      gesture.current = null;
      setDragging(null);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [onDrop]);

  const consumeDragFlag = useCallback(() => {
    const value = draggedJustNow.current;
    draggedJustNow.current = false;
    return value;
  }, []);

  return { dragging, start, consumeDragFlag };
}
