import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { migrateOldStorage } from './storage/migrate';
import './styles.css';

// Abans de res: si hi ha dades desades amb el nom antic del joc, es migren.
try {
  migrateOldStorage(window.localStorage);
} catch {
  // Sense localStorage el joc funciona igual, en memòria.
}

/*
 * A l'app instal·lada, el gest d'enrere d'Android tancaria el joc a mitja
 * partida: es planta una entrada d'historial i es replanta a cada intent,
 * així el gest no fa res. Només a l'app (display-mode standalone): en una
 * pestanya normal l'enrere del navegador s'ha de respectar, i el gest de la
 * vora ja el frena l'overscroll-behavior del CSS.
 */
if (window.matchMedia('(display-mode: standalone)').matches) {
  try {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => history.pushState(null, '', location.href));
  } catch {
    // Si l'historial no es deixa tocar, el joc funciona igual.
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('No s’ha trobat l’element arrel de l’aplicació');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * El service worker només al build de producció: en desenvolupament només
 * faria nosa, servint fitxers desats en comptes dels que s'acaben de tocar.
 * Si el registre falla (navegador sense suport, servit per http...), el joc
 * funciona igual, només que sense connexió no s'obrirà.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn('No s’ha pogut registrar el service worker:', error);
    });
  });
}
