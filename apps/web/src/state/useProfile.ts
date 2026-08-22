import { ProfileRepository, createProfile, type PlayerProfile } from '@rummikub/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createWebStore } from '../storage/webStore';

/**
 * De moment hi ha un sol perfil per dispositiu. `ProfileRepository` ja en
 * suporta més d'un; la interfície per triar-los és opcional a la Fase 4.
 */
export const LOCAL_PROFILE_ID = 'local';

export interface ProfileHandle {
  profile: PlayerProfile | null;
  loading: boolean;
  /** Crea el perfil la primera vegada, o li canvia el nom si ja existeix. */
  setName(name: string): Promise<void>;
  /** Desa un perfil ja actualitzat (p. ex. després de `recordGame`). */
  save(profile: PlayerProfile): Promise<void>;
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

  return { profile, loading, setName, save };
}
