import { useCallback, useState } from 'react';

/**
 * L'aspecte de les fitxes: crema amb el número de color (com les clàssiques),
 * o del color amb el número blanc. És una preferència visual del dispositiu,
 * així que viu a localStorage i no al perfil; si l'emmagatzematge falla
 * (navegació privada), es queda l'estil clàssic i no passa res.
 */
export type TileStyle = 'classic' | 'invers';

const KEY = 'remigi:fitxes';

export function useTileStyle(): [TileStyle, (style: TileStyle) => void] {
  const [style, setStyle] = useState<TileStyle>(() => {
    try {
      return localStorage.getItem(KEY) === 'invers' ? 'invers' : 'classic';
    } catch {
      return 'classic';
    }
  });

  const set = useCallback((next: TileStyle) => {
    setStyle(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sense emmagatzematge, la tria dura mentre duri la pestanya.
    }
  }, []);

  return [style, set];
}
