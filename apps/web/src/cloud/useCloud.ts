import { useCallback, useEffect, useState } from 'react';
import { rememberSignedIn, signInWithGoogle, signOutCloud, wasSignedIn, watchUser, type CloudUser } from './firebase';

export interface CloudHandle {
  /** El compte amb què s'ha entrat; null si no se n'ha entrat (o encara no se sap). */
  user: CloudUser | null;
  /** Encara no se sap si hi ha sessió. */
  checking: boolean;
  /** Missatge si entrar ha fallat. */
  error: string | null;
  signIn(): void;
  signOut(): void;
}

function errorText(error: unknown): string | null {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/unauthorized-domain') return 'Aquest domini encara no està autoritzat per entrar amb Google.';
  if (code === 'auth/network-request-failed') return 'Sense connexió: no s’ha pogut entrar amb Google.';
  return 'No s’ha pogut entrar amb Google. Torna-ho a provar.';
}

/**
 * La sessió amb Google. Firebase només es carrega si cal (`active`: s'ha
 * obert la partida del dia) o si en aquest aparell ja s'hi havia entrat.
 */
export function useCloud(active: boolean): CloudHandle {
  const [started, setStarted] = useState(() => active || wasSignedIn());
  const [user, setUser] = useState<CloudUser | null>(null);
  const [checking, setChecking] = useState(started);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (active) setStarted(true);
  }, [active]);

  useEffect(() => {
    if (!started) return;
    setChecking(true);
    return watchUser((next) => {
      setUser(next);
      setChecking(false);
      rememberSignedIn(next !== null);
    });
  }, [started]);

  const signIn = useCallback(() => {
    setError(null);
    setStarted(true);
    signInWithGoogle().catch((caught: unknown) => setError(errorText(caught)));
  }, []);

  const signOut = useCallback(() => {
    setError(null);
    void signOutCloud().catch(() => {});
  }, []);

  return { user, checking: started && checking, error, signIn, signOut };
}
