import type { PlayerProfile } from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bestStreak, currentStreak, dayKey, previousDay, withCarried, type DailyState } from '../dia/daily';
import type { LeagueState } from '../lliga/league';
import type { ProfileProgress } from '../state/profileTransfer';
import type { PersistedHandle } from '../state/usePersisted';
import { buildCloudSave, mergeCloudSave, parseCloudSave, toFirestore } from './cloudSave';
import { fetchCloudSave, fetchPlayer, submitCloudSave, submitDayResult, submitPlayer } from './firebase';
import { cleanAlias, dayEntry, parsePlayerEntry } from './ranking';

interface Options {
  uid: string | null;
  profile: PlayerProfile | null;
  setProgress(progress: ProfileProgress): Promise<void>;
  setName(name: string): Promise<void>;
  league: PersistedHandle<LeagueState>;
  daily: PersistedHandle<DailyState>;
  /** La temporada ha canviat per la del compte: la jornada a mitges ja no val. */
  onLeagueReplaced(): void;
  /** S'ha pujat un resultat o una ratxa: els rànquings es tornen a carregar. */
  onRankingChange(): void;
}

/** Espera abans de pujar un canvi, per ajuntar-ne uns quants en una sola escriptura. */
const UPLOAD_DELAY_MS = 2000;

/** Com a molt, una escriptura del nivell i la lliga cada tant (a més de la de tancar l'app). */
export const UPLOAD_EVERY_MS = 30 * 60_000;

/** Quant cal esperar per pujar el canvi següent, havent-ne pujat un a `lastAt`. */
export function uploadDelay(lastAt: number | null, now: number): number {
  if (lastAt === null || now < lastAt) return UPLOAD_DELAY_MS;
  return Math.max(UPLOAD_DELAY_MS, lastAt + UPLOAD_EVERY_MS - now);
}

const UPLOAD_KEY = 'remigi:nuvol:pujat:';

function lastUpload(uid: string): number | null {
  try {
    const value = Number(localStorage.getItem(UPLOAD_KEY + uid));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberUpload(uid: string, at: number): void {
  try {
    localStorage.setItem(UPLOAD_KEY + uid, String(at));
  } catch {
    // Sense emmagatzematge, la pròxima sessió pujarà de seguida.
  }
}
/** Si recuperar el compte falla (sense connexió), es torna a provar al cap d'aquest temps. */
const RETRY_MS = 60_000;

/**
 * La sincronització amb el compte de Google:
 *
 * 1. En entrar, es llegeix el desat del compte i de cada part (nivell, lliga)
 *    es queda la més avançada; la ratxa de la partida del dia es recupera de
 *    la fitxa del rànquing.
 * 2. Després, cada canvi del nivell o de la lliga es puja (només el mínim:
 *    vegeu `cloudSave.ts`), i el resultat del dia i la ratxa van als rànquings.
 *
 * No es puja res fins que s'ha llegit el compte: així un aparell nou no
 * esborra el que hi havia.
 */
export function useCloudSync({
  uid,
  profile,
  setProgress,
  setName,
  league,
  daily,
  onLeagueReplaced,
  onRankingChange,
}: Options): boolean {
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const profileLoaded = profile !== null;
  const latest = useRef({ profile, setProgress, setName, league, daily, onLeagueReplaced, onRankingChange });
  latest.current = { profile, setProgress, setName, league, daily, onLeagueReplaced, onRankingChange };

  /* 1. Recuperar el compte, un cop per sessió. */
  useEffect(() => {
    if (!uid || !profileLoaded || readyFor === uid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const [rawSave, rawPlayer] = await Promise.all([fetchCloudSave(uid), fetchPlayer(uid)]);
        if (cancelled) return;
        const now = latest.current;
        const save = parseCloudSave(rawSave);
        const leagueNow = now.league.get();
        if (save && now.profile && leagueNow) {
          const merged = mergeCloudSave(save, now.profile, leagueNow);
          if (merged.level) await now.setProgress(merged.level);
          if (merged.name) await now.setName(merged.name);
          if (merged.league) {
            if (merged.league.season?.seed !== leagueNow.season?.seed) now.onLeagueReplaced();
            now.league.update(merged.league);
          }
        }
        const player = parsePlayerEntry(rawPlayer);
        if (player) {
          now.daily.update((state) =>
            withCarried(state, { streak: player.streak, bestStreak: player.bestStreak, lastDay: player.lastDay }),
          );
        }
        if (!cancelled) setReadyFor(uid);
      } catch {
        // Sense connexió (o regles sense publicar): no es puja res i es torna a provar.
        if (!cancelled) timer = setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [uid, profileLoaded, readyFor, retry]);

  const ready = uid !== null && readyFor === uid;

  /*
   * 2a. Pujar el nivell i la lliga: com a molt un cop cada 30 minuts (cada
   * escriptura compta per a la quota gratuïta), i sempre en tancar o amagar
   * l'app, perquè el que s'ha jugat no es perdi.
   */
  const uploaded = useRef('');
  const pending = useRef<{ uid: string; payload: string } | null>(null);
  const leagueValue = league.value;
  const payload = ready && profile && leagueValue ? JSON.stringify(toFirestore(buildCloudSave(profile, leagueValue))) : null;

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next || uploaded.current === `${next.uid}|${next.payload}`) return;
    uploaded.current = `${next.uid}|${next.payload}`;
    rememberUpload(next.uid, Date.now());
    submitCloudSave(next.uid, JSON.parse(next.payload) as Record<string, unknown>).catch(() => {
      uploaded.current = '';
    });
  }, []);

  useEffect(() => {
    if (!ready || !uid || !payload) return;
    pending.current = { uid, payload };
    if (uploaded.current === `${uid}|${payload}`) return;
    const timer = setTimeout(flush, uploadDelay(lastUpload(uid), Date.now()));
    return () => clearTimeout(timer);
  }, [ready, uid, payload, flush]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

  /* 2b. El resultat del dia (d'avui o d'ahir, el més nou) i la ratxa, als rànquings. */
  const synced = useRef('');
  const dailyValue = daily.value;
  const playerName = profile?.name;
  useEffect(() => {
    if (!ready || !uid || !dailyValue || !playerName) return;
    const last = dailyValue.results[0];
    if (!last) return;
    const today = dayKey();
    const alias = cleanAlias(playerName);
    const streak = currentStreak(dailyValue, today);
    const key = `${uid}|${last.day}|${alias}|${streak}`;
    if (synced.current === key) return;
    synced.current = key;
    const recent = last.day === today || last.day === previousDay(today);
    void (async () => {
      try {
        if (recent) await submitDayResult(uid, last.day, dayEntry(last, alias, currentStreak(dailyValue, last.day)));
        await submitPlayer(uid, { alias, streak, bestStreak: Math.max(streak, bestStreak(dailyValue)), lastDay: last.day });
        latest.current.onRankingChange();
      } catch {
        synced.current = '';
      }
    })();
  }, [ready, uid, dailyValue, playerName]);

  return ready;
}
