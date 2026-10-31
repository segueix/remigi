import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { migrateOldStorage } from './storage/migrate';
import './styles.css';
import './appSwitch/appSwitch.css';
import { initAppSwitch } from './appSwitch/appSwitch';
import { registerUpdates } from './pwa/updates';

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

// Al mòbil, lliscar el dit pel mig de la pantalla porta a El Tauler (app germana).
initAppSwitch(window);

// Només en producció: cada publicació activa la recàrrega automàtica.
if (import.meta.env.PROD) {
  window.addEventListener('load', () => registerUpdates(import.meta.env.BASE_URL));
}
