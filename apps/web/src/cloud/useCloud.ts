import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { currentBrowser, inAppMessage, redirectFailedMessage } from './browser';
import {
  checkRedirect,
  rememberSignedIn,
  signInWithGoogle,
  signOutCloud,
  wasSignedIn,
  watchUser,
  type CloudUser,
} from './firebase';

export interface CloudHandle {
  /** El compte amb què s'ha entrat; null si no se n'ha entrat (o encara no se sap). */
  user: CloudUser | null;
  /** Encara no se sap si hi ha sessió. */
  checking: boolean;
  /** Missatge si entrar ha fallat. */
  error: string | null;
  /** S'acaba d'entrar amb el botó (no en obrir l'app amb la sessió ja feta). */
  justSignedIn: boolean;
  /** Ja s'ha atès l'entrada (s'ha confirmat el nom). */
  ackSignedIn(): void;
  signIn(): void;
  signOut(): void;
}

/** La sessió amb Google, per a qualsevol pantalla (també els finals de partida, que es pinten un cop). */
export const CloudContext = createContext<CloudHandle | null>(null);

export function useCloudContext(): CloudHandle | null {
  return useContext(CloudContext);
}

function errorText(error: unknown): string | null {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/unauthorized-domain') return 'Aquest domini encara no està autoritzat per entrar amb Google.';
  if (code === 'auth/network-request-failed') return 'Sense connexió: no s’ha pogut entrar amb Google.';
  return 'No s’ha pogut entrar amb Google. Torna-ho a provar.';
}

/**
 * La sessió amb Google. Firebase només es carrega si cal (`active`: l'inici,
 * on hi ha «Entra», o la partida del dia) o si en aquest aparell ja s'hi
 * havia entrat. A l'inici es carrega per endavant perquè, en tocar «Entra», la
 * finestra de Google s'obri dins del mateix toc (Safari a l'iPhone ho exigeix).
 */
export function useCloud(active: boolean): CloudHandle {
  const [started, setStarted] = useState(() => active || wasSignedIn());
  const [user, setUser] = useState<CloudUser | null>(null);
  const [checking, setChecking] = useState(started);
  const [error, setError] = useState<string | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);

  useEffect(() => {
    if (!started) return;
    setChecking(true);
    let cancelled = false;
    // En tornar d'una redirecció de Google sense sessió, avisa (sobretot a l'iPhone).
    void checkRedirect().then((outcome) => {
      if (cancelled) return;
      if (outcome === 'failed') setError(redirectFailedMessage(currentBrowser()));
      if (outcome === 'ok') setJustSignedIn(true);
    });
    const stop = watchUser((next) => {
      setUser(next);
      setChecking(false);
      rememberSignedIn(next !== null);
      if (next) setError(null);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [started]);

  const signIn = useCallback(() => {
    setError(null);
    // Dins del navegador d'Instagram, Facebook… Google no deixa entrar: cal dir-ho.
    const browser = currentBrowser();
    if (browser.inApp) {
      setError(inAppMessage(browser));
      return;
    }
    setStarted(true);
    // Sense res abans: la finestra de Google s'ha d'obrir dins del mateix toc.
    signInWithGoogle()
      .then(() => setJustSignedIn(true))
      .catch((caught: unknown) => setError(errorText(caught)));
  }, []);

  const ackSignedIn = useCallback(() => setJustSignedIn(false), []);

  const signOut = useCallback(() => {
    setError(null);
    setJustSignedIn(false);
    void signOutCloud().catch(() => {});
  }, []);

  return { user, checking: started && checking, error, justSignedIn, ackSignedIn, signIn, signOut };
}
