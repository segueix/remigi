import { useCloudContext, type CloudHandle } from '../cloud/useCloud';

/**
 * Entrar i sortir del compte de Google. Al compte només es desa el nivell, la
 * lliga en curs i els rànquings de la partida del dia (vegeu
 * `cloud/cloudSave.ts`); al rànquing només surt el nom de Remigi.
 */
export function GoogleAccount({ cloud: given, alias }: { cloud?: CloudHandle; alias: string }) {
  const fromContext = useCloudContext();
  const cloud = given ?? fromContext;
  if (!cloud) return null;
  return (
    <div className="dia-compte">
      {cloud.checking ? (
        <p className="muted small">Mirant si has entrat amb Google…</p>
      ) : cloud.user ? (
        <p className="muted small">
          Compte de Google connectat: el nivell i la lliga en curs es desen al compte, i als rànquings surts com a{' '}
          <strong>{alias}</strong> (el teu nom a Remigi).{' '}
          <button type="button" className="enllac" onClick={cloud.signOut}>
            Surt del compte
          </button>
        </p>
      ) : (
        <>
          <p className="muted small">
            Entra amb Google per sortir als rànquings i continuar el nivell i la lliga en un altre aparell. Als
            rànquings només surt el teu nom de Remigi.
          </p>
          <button type="button" className="secondary dia-google" onClick={cloud.signIn}>
            <GoogleMark /> Entra amb Google
          </button>
        </>
      )}
      {cloud.error && (
        <p className="small points-negative" role="alert">
          {cloud.error}
        </p>
      )}
    </div>
  );
}

/**
 * A l'inici, al costat del jugador: «Entra amb Google» si no s'hi ha entrat;
 * si s'hi ha entrat, res (el jugador ja porta la marca de compte desat).
 */
export function GoogleHeaderButton({ cloud }: { cloud: CloudHandle }) {
  if (cloud.user || cloud.checking) return null;
  return (
    <button
      type="button"
      className="secondary inici-google"
      onClick={cloud.signIn}
      title="Entra amb Google per sortir als rànquings i desar el nivell i la lliga"
    >
      <GoogleMark /> <span>Entra</span>
    </button>
  );
}

/** La «G» de Google, en colors (el botó ha de ser reconeixible). */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
