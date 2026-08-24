import type { DifficultyKey, GameState } from '@remigi/core';
import { useEffect, useRef, useState } from 'react';
import { profileAfterGame, ratingChange, type RatingChange } from './gameOutcome';
import type { ProfileHandle } from './useProfile';

/**
 * Registra al perfil el resultat d'una partida acabada i retorna com ha canviat
 * l'habilitat, per poder-ho ensenyar al jugador.
 *
 * Es registra **una sola vegada per partida**: es recorda quin estat de partida
 * ja s'ha comptat, perquè ni un render de més ni el doble muntatge del mode
 * estricte de React puguin comptar dos cops el mateix resultat.
 */
export function useRecordResult(
  game: GameState,
  opponents: DifficultyKey[],
  profile: ProfileHandle,
): RatingChange | null {
  // El perfil canvia d'identitat a cada render; es llegeix per referència
  // perquè l'efecte depengui només de la partida.
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const recordedFor = useRef<GameState | null>(null);
  const [change, setChange] = useState<RatingChange | null>(null);

  useEffect(() => {
    if (game.status !== 'finished') {
      recordedFor.current = null;
      setChange(null);
      return;
    }
    if (recordedFor.current === game) return;
    recordedFor.current = game;

    const current = profileRef.current.profile;
    if (!current) return;
    const next = profileAfterGame(current, game, opponents);
    setChange(ratingChange(current, next));
    void profileRef.current.save(next);
  }, [game, opponents]);

  return change;
}
