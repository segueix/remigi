import { ProfileRepository, createProfile, type PlayerProfile } from '@remigi/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWebStore } from '../storage/webStore';
import type { ProfileProgress } from './profileTransfer';

/**
 * Hi ha un sol perfil per dispositiu. `ProfileRepository` ja en suporta més
 * d'un: per oferir-ho només caldria triar l'identificador des de la interfície.
 */
export const LOCAL_PROFILE_ID = 'local';

export interface ProfileHandle {
  profile: PlayerProfile | null;
  loading: boolean;
  /** Crea el perfil la primera vegada, o li canvia el nom si ja existeix. */
  setName(name: string): Promise<void>;
  /** Desa un perfil ja actualitzat (p. ex. després de `recordGame`). */
  save(profile: PlayerProfile): Promise<void>;
  /** Actualitza els totals necessaris per reprendre el mateix nivell en un altre aparell. */
  setProgress(progress: ProfileProgress): Promise<void>;
  /** Esborra el perfil i tot el seu historial. */
  reset(): Promise<void>;
}

export function useProfile(): ProfileHandle {
  const repository = useMemo(() => new ProfileRepository(createWebStore()), []);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    repository
      .load(LOCAL_PROFILE_ID)
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const save = useCallback(
    async (next: PlayerProfile) => {
      setProfile(next);
      await repository.save(next);
    },
    [repository],
  );

  const setName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const base = profile ?? createProfile(LOCAL_PROFILE_ID, trimmed);
      await save({ ...base, name: trimmed });
    },
    [profile, save],
  );

  const setProgress = useCallback(
    async (progress: ProfileProgress) => {
      if (!profile) return;
      await save({
        ...profile,
        rating: progress.rating,
        gamesPlayed: progress.gamesPlayed,
        wins: progress.wins,
        // Els enllaços nous conserven exactament el mig graó adaptatiu. Els
        // antics només porten Elo: en aquest cas se'n deriva el nivell.
        adaptiveStep: progress.adaptiveStep,
        adaptiveCalibrating: progress.adaptiveStep === undefined
          ? false
          : (progress.adaptiveCalibrating ?? false),
      });
    },
    [profile, save],
  );

  const reset = useCallback(async () => {
    await repository.remove(LOCAL_PROFILE_ID);
    setProfile(null);
  }, [repository]);

  return { profile, loading, setName, save, setProgress, reset };
}
