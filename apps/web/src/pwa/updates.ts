/** Comprova publicacions en tornar al joc, recuperar connexió i cada minut. */
export function registerUpdates(baseUrl: string): void {
  if (!('serviceWorker' in navigator)) return;
  const serviceWorker = navigator.serviceWorker;
  const hadController = Boolean(serviceWorker.controller);
  let reloaded = false;

  // Instal·lem el listener abans del registre perquè no es perdi l'activació.
  serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  void serviceWorker.register(`${baseUrl}sw.js`, { updateViaCache: 'none' })
    .then((registration) => {
      let checking = false;
      const check = async () => {
        if (checking || reloaded || document.visibilityState !== 'visible' || !navigator.onLine) return;
        checking = true;
        try {
          await registration.update();
        } catch {
          // Sense xarxa o durant un desplegament, es reintenta al proper avís.
        } finally {
          checking = false;
        }
      };
      document.addEventListener('visibilitychange', () => { void check(); });
      for (const event of ['online', 'focus', 'pageshow']) {
        window.addEventListener(event, () => { void check(); });
      }
      window.setInterval(() => { void check(); }, 60_000);
      void check();
    })
    .catch((error) => {
      console.warn('No s’ha pogut registrar el service worker:', error);
    });
}
