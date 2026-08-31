import { useLayoutEffect, type RefObject } from 'react';
import { fitBoardTiles } from './boardDensity';

/**
 * Manté les fitxes de la taula a la mida més gran que hi càpiga.
 *
 * Es mesura després de cada canvi de la taula (`shape` diu quantes jugades hi
 * ha i de quina mida, que és el que en canvia la col·locació) i quan el feltre
 * canvia de mida (girar el mòbil, canviar la finestra). Va en un efecte de
 * disposició perquè el navegador no arribi a pintar mai la mida equivocada.
 *
 * L'escala s'escriu directament a l'element i no passa per l'estat de React:
 * el que decideix és una mesura del DOM, i tornar-la a l'estat només serviria
 * per repintar un altre cop el mateix.
 */
export function useBoardFit(board: RefObject<HTMLElement | null>, shape: string): void {
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return;
    fitBoardTiles(element);

    if (typeof ResizeObserver === 'undefined') return;
    /*
     * Només es torna a mesurar si el feltre ha canviat de mida de debò: la
     * mida de les fitxes no en canvia la caixa (la taula es queda l'espai que
     * li dona la pantalla), i així l'observador no s'encadena amb ell mateix.
     */
    let last = `${element.clientWidth}×${element.clientHeight}`;
    const observer = new ResizeObserver(() => {
      const size = `${element.clientWidth}×${element.clientHeight}`;
      if (size === last) return;
      last = size;
      fitBoardTiles(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [board, shape]);
}
