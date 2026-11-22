import type { PlayerProfile } from '@remigi/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adoptResult,
  bestStreak,
  currentStreak,
  dayKey,
  previousDay,
  resultFor,
  withCarried,
  type DailyState,
} from '../dia/daily';
import type { LeagueState } from '../lliga/league';
import type { ProfileProgress } from '../state/profileTransfer';
import type { PersistedHandle } from '../state/usePersisted';
import { buildCloudSave, mergeCloudSave, parseCloudSave, toFirestore } from './cloudSave';
import {
  fetchCloudSave,
  fetchDayResult,
  fetchPlayer,
  submitCloudSave,
  submitDayResult,
  submitPlayer,
} from './firebase';
import { cleanAlias, dayEntry, parseDayEntry, parsePlayerEntry } from './ranking';

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
  /**
   * S'ha portat d'un altre aparell el resultat d'una partida del dia: la
   * partida d'aquell dia que hi hagués a mitges aquí ja no es pot jugar.
   */
  onDailyAdopted(day: string): void;
}

export interface CloudSync {
  /** S'ha llegit el compte i ja es pot pujar. */
  ready: boolean;
  /**
   * Porta del compte el resultat d'avui (i d'ahir) si s'ha jugat en un altre
   * aparell. Torna cert si n'ha portat cap. Sense compte o sense connexió, no
   * fa res (i no espera més de `timeoutMs`).
   */
  checkDaily(timeoutMs?: number): Promise<boolean>;
}

/** Com a molt, una consulta del resultat del dia cada tant en tornar a l'app. */
const DAILY_CHECK_EVERY_MS = 15_000;

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
  onDailyAdopted,
}: Options): CloudSync {
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const profileLoaded = profile !== null;
  const latest = useRef({ profile, setProgress, setName, league, daily, onLeagueReplaced, onRankingChange, onDailyAdopted });
  latest.current = { profile, setProgress, setName, league, daily, onLeagueReplaced, onRankingChange, onDailyAdopted };
  /* L'última vegada que s'ha mirat al compte el resultat del dia. */
  const lastDailyCheck = useRef(0);

  /*
   * El resultat del dia del compte: el desa el primer aparell que acaba la
   * partida (només es pot crear un cop), i qualsevol altre aparell el porta
   * cap aquí. Així la partida del dia es juga una sola vegada, i el resultat
   * es veu a tots els aparells.
   */
  const adoptDay = useCallback(async (forUid: string, day: string): Promise<boolean> => {
    const entry = parseDayEntry(await fetchDayResult(forUid, day));
    if (!entry) return false;
    const before = latest.current.daily.get();
    const result = { day, won: entry.won, moves: entry.moves, points: entry.points, rivals: entry.rivals };
    const next = latest.current.daily.update((state) => adoptResult(state, result, entry.streak));
    const adopted = next !== null && next !== before && before !== null && resultFor(next, day) !== resultFor(before, day);
    if (adopted) latest.current.onDailyAdopted(day);
    return adopted;
  }, []);

  const pullDaily = useCallback(
    async (forUid: string): Promise<boolean> => {
      const today = dayKey();
      const found = await Promise.all([adoptDay(forUid, today), adoptDay(forUid, previousDay(today))]);
      return found.some(Boolean);
    },
    [adoptDay],
  );

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
        await pullDaily(uid);
        lastDailyCheck.current = Date.now();
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
  }, [uid, profileLoaded, readyFor, retry, pullDaily]);

  const ready = uid !== null && readyFor === uid;

  /*
   * En tornar a l'app (d'un altre aparell, potser), es mira si la partida del
   * dia ja s'ha jugat en un altre lloc. Com a molt cada 15 segons.
   */
  const readyUid = ready ? uid : null;
  const checkDaily = useCallback(
    async (timeoutMs = 4000): Promise<boolean> => {
      if (!readyUid) return false;
      lastDailyCheck.current = Date.now();
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
      return Promise.race([pullDaily(readyUid).catch(() => false), timeout]);
    },
    [readyUid, pullDaily],
  );

  useEffect(() => {
    if (!readyUid) return;
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastDailyCheck.current < DAILY_CHECK_EVERY_MS) return;
      void checkDaily();
    };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [readyUid, checkDaily]);

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
        /*
         * Si un altre aparell ja l'havia acabat, el bo és aquell: es porta
         * aquí en comptes d'intentar pujar-ne un altre (que no es pot).
         */
        if (recent && (await adoptDay(uid, last.day))) return;
        if (recent) await submitDayResult(uid, last.day, dayEntry(last, alias, currentStreak(dailyValue, last.day)));
        await submitPlayer(uid, { alias, streak, bestStreak: Math.max(streak, bestStreak(dailyValue)), lastDay: last.day });
        latest.current.onRankingChange();
      } catch {
        synced.current = '';
      }
    })();
  }, [ready, uid, dailyValue, playerName, adoptDay]);

  return { ready, checkDaily };
}
