import { PUBLIC_REMIGI_URL } from '../state/profileTransfer';

/**
 * L'adreça del joc per als enllaços que es comparteixen (resultat del dia,
 * campió, «Em superes?»): sempre la pública, eltauler.cat/remigi, es jugui des
 * d'on es jugui. Així cap enllaç no porta l'adreça de GitHub Pages
 * (segueix.github.io), que duu el nom del compte de GitHub.
 */
export function gameUrl(): string {
  return PUBLIC_REMIGI_URL;
}
