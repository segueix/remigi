import { useCallback, useState } from 'react';
import { DEFAULT_MUSIC, MUSIC_PREFS_KEY, parseMusicPrefs, type MusicPrefs } from './musica';

/**
 * Si sona música entre jornades i a quin volum. És una preferència del
 * dispositiu, com l'aspecte de les fitxes: viu a localStorage i, si falla,
 * es queda la de sèrie.
 */
export function useMusicPrefs(): [MusicPrefs, (next: MusicPrefs) => void] {
  const [prefs, setPrefs] = useState<MusicPrefs>(() => {
    try {
      return parseMusicPrefs(localStorage.getItem(MUSIC_PREFS_KEY));
    } catch {
      return { ...DEFAULT_MUSIC };
    }
  });

  const set = useCallback((next: MusicPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(MUSIC_PREFS_KEY, JSON.stringify(next));
    } catch {
      // Sense emmagatzematge, la tria dura mentre duri la pestanya.
    }
  }, []);

  return [prefs, set];
}

/** El `localStorage`, si n'hi ha (navegació privada pot no deixar-hi entrar). */
export function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
