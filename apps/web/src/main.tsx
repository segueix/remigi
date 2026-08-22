import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

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
