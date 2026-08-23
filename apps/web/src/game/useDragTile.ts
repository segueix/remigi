import { useCallback, useEffect, useRef, useState } from 'react';
import type { Destination } from './turnDraft';

/**
 * Arrossegar fitxes amb esdeveniments de punter, que tracten igual el ratolí,
 * el dit i el llapis (a diferència de l'arrossegament natiu d'HTML, que a
 * mòbil no funciona).
 *
 * Amb el ratolí, moure's uns píxels amb el botó premut ja és arrossegar. Amb
 * el dit no pot ser tan directe: el mateix gest —tocar una fitxa i lliscar—
 * és també com es desplaça la taula, i si la fitxa se l'endugués sempre, no
 * es podria arribar mai a una jugada que no és a la pantalla. Per això amb el
 * tacte es fa com a les apps: **lliscar desplaça; mantenir premut un instant
 * aixeca la fitxa**, i a partir d'aquí el dit se l'enduu (i una vibració curta
 * ho confirma, on n'hi ha).
 *
 * Perquè això funcioni les fitxes NO porten `touch-action: none`: el navegador
 * ha de poder desplaçar amb normalitat mentre no hi hagi fitxa aixecada. Quan
 * n'hi ha, el desplaçament es frena aturant el `touchmove` (amb un oient no
 * passiu), que és l'única manera de prendre-li el gest al navegador un cop
 * descartat el `touch-action`.
 *
 * Conviu amb el «tria i col·loca» a tocs, que continua sent l'alternativa
 * accessible: un toc net segueix sent un toc. Quan sí que hi ha hagut
 * arrossegament, es marca perquè el `click` que el navegador envia tot seguit
 * no torni a actuar sobre la mateixa fitxa.
 */
const DRAG_THRESHOLD_PX = 6;
/** Temps que cal mantenir el dit quiet sobre una fitxa per aixecar-la. */
const HOLD_MS = 180;
/** Moviment permès durant el manteniment; més enllà, el gest és desplaçar. */
const HOLD_SLOP_PX = 12;

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

interface Gesture {
  tileId: string;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  holdTimer?: number;
}

export function useDragTile(
  enabled: boolean,
  onDrop: (tileId: string, target: Destination) => void,
): DragHandle {
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const draggedJustNow = useRef(false);

  const start = useCallback(
    (event: React.PointerEvent, tileId: string) => {
      // Cada gest nou parteix de zero: així una marca que no s'hagi arribat a
      // consumir no s'endú el clic següent.
      draggedJustNow.current = false;
      if (!enabled) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const next: Gesture = {
        tileId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        active: false,
      };
      gesture.current = next;

      if (event.pointerType === 'touch') {
        next.holdTimer = window.setTimeout(() => {
          const current = gesture.current;
          if (current !== next || current.active) return;
          current.active = true;
          try {
            navigator.vibrate?.(15);
          } catch {
            // Sense vibració no passa res.
          }
          setDragging({
            tileId: current.tileId,
            x: current.lastX,
            y: current.lastY,
            over: dropTargetAt(current.lastX, current.lastY),
          });
        }, HOLD_MS);
      }
    },
    [enabled],
  );

  useEffect(() => {
    function clearHold(current: Gesture | null) {
      if (current?.holdTimer !== undefined) window.clearTimeout(current.holdTimer);
    }

    function move(event: PointerEvent) {
      const current = gesture.current;
      if (!current) return;
      current.lastX = event.clientX;
      current.lastY = event.clientY;
      if (!current.active) {
        const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
        if (current.pointerType === 'touch') {
          // Moure's abans que el manteniment venci és desplaçar: el gest es
          // deixa anar i el navegador fa el seu desplaçament de sempre.
          if (distance > HOLD_SLOP_PX) {
            clearHold(current);
            gesture.current = null;
          }
          return;
        }
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
      clearHold(current);
      gesture.current = null;
      setDragging(null);
      if (!current?.active) return;
      draggedJustNow.current = true;
      const target = dropTargetAt(event.clientX, event.clientY);
      if (target) onDrop(current.tileId, target);
    }

    function cancel() {
      clearHold(gesture.current);
      gesture.current = null;
      setDragging(null);
    }

    /*
     * Amb una fitxa aixecada, el desplaçament es frena aquí: aturar el
     * `touchmove` és l'única manera un cop les fitxes ja no porten
     * `touch-action: none`. L'oient ha de ser no passiu per poder fer-ho.
     */
    function blockScrollWhileDragging(event: TouchEvent) {
      if (gesture.current?.active) event.preventDefault();
    }

    /* El manteniment no ha d'acabar en menú contextual (Android hi tendeix). */
    function blockContextMenu(event: Event) {
      if (gesture.current) event.preventDefault();
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', blockScrollWhileDragging, { passive: false });
    window.addEventListener('contextmenu', blockContextMenu);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', blockScrollWhileDragging);
      window.removeEventListener('contextmenu', blockContextMenu);
    };
  }, [onDrop]);

  const consumeDragFlag = useCallback(() => {
    const value = draggedJustNow.current;
    draggedJustNow.current = false;
    return value;
  }, []);

  return { dragging, start, consumeDragFlag };
}
