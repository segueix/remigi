import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { cached, clearRankingCache } from './cache';
import { RANKING_SIZE, dayRanking, legacyDayEntry, parseDayEntry, type DayEntry, type PlayerEntry } from './ranking';

/**
 * La connexió amb Firebase (projecte `remigi-c37ac`): el compte de Google i
 * els rànquings. Aquesta configuració no és secreta (va dins de la web de tota
 * manera); el que protegeix les dades són les regles de Firestore
 * (`firestore.rules`) i els dominis autoritzats d'Authentication.
 *
 * El SDK es carrega a demanda (`import()`): qui no obre mai la partida del dia
 * ni ha entrat mai amb Google no baixa res de Firebase.
 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCtUkMrMJ8Ku3nQ7R5v3RP9Fb-Bo_TP7nA',
  authDomain: 'remigi-c37ac.firebaseapp.com',
  projectId: 'remigi-c37ac',
  storageBucket: 'remigi-c37ac.firebasestorage.app',
  messagingSenderId: '146496744955',
  appId: '1:146496744955:web:c04fd6d4ed3bfe85852f5e',
};

export interface CloudUser {
  uid: string;
  /**
   * El nom de pila del compte de Google: només per proposar-lo com a nom de
   * Remigi en entrar. No es desa enlloc tal qual.
   */
  firstName: string;
}

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: Promise<Services> | null = null;

function load(): Promise<Services> {
  services ??= (async () => {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  })();
  // Si falla (sense connexió), el pròxim intent ho torna a provar.
  services.catch(() => {
    services = null;
  });
  return services;
}

const toUser = (user: User | null): CloudUser | null =>
  user ? { uid: user.uid, firstName: (user.displayName ?? '').trim().split(/\s+/)[0] ?? '' } : null;

/** Avisa de cada canvi de sessió (i de la d'ara en començar). Torna com deixar d'escoltar. */
export function watchUser(callback: (user: CloudUser | null) => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  void Promise.all([load(), import('firebase/auth')])
    .then(([{ auth }, { onAuthStateChanged }]) => {
      if (cancelled) return;
      stop = onAuthStateChanged(auth, (user) => callback(toUser(user)));
    })
    .catch(() => callback(null));
  return () => {
    cancelled = true;
    stop?.();
  };
}

/**
 * Entra amb Google. Primer amb una finestra emergent; si el navegador no la
 * deixa obrir, redirigint la pàgina (i en tornar ja s'hi és).
 */
export async function signInWithGoogle(): Promise<void> {
  const { auth } = await load();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutCloud(): Promise<void> {
  const { auth } = await load();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/**
 * Desa el resultat del dia. Només es pot crear un cop: si ja hi era, les
 * regles no deixen sobreescriure'l (`permission-denied`), i això vol dir que
 * ja està fet. Així no cal llegir-lo abans (una lectura menys).
 */
export async function submitDayResult(uid: string, day: string, entry: DayEntry): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  const ref = doc(db, 'dia', day, 'resultats', uid);
  const denied = (error: unknown) => (error as { code?: string }).code === 'permission-denied';
  try {
    await setDoc(ref, { ...entry, at: serverTimestamp() });
  } catch (error) {
    if (!denied(error)) throw error;
    /*
     * O ja hi era, o les regles publicades encara són les d'abans del
     * desempat (no accepten `rivals`): llavors, el format d'abans.
     */
    try {
      await setDoc(ref, { ...legacyDayEntry(entry), at: serverTimestamp() });
    } catch (again) {
      if (!denied(again)) throw again;
    }
  }
  clearRankingCache();
}

/** Desa l'àlies i la ratxa del jugador (per al rànquing de ratxes). */
export async function submitPlayer(uid: string, entry: PlayerEntry): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  await setDoc(doc(db, 'jugadors', uid), { ...entry, at: serverTimestamp() });
  clearRankingCache();
}

export interface RawRow {
  id: string;
  data: unknown;
}

/** El top del rànquing d'un dia (per `score`, de menys a més): `RANKING_SIZE` lectures, i 10 minuts desat. */
export function fetchDayRanking(day: string): Promise<RawRow[]> {
  return cached(`dia:${day}`, async () => {
    const { db } = await load();
    const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite');
    const snap = await getDocs(query(collection(db, 'dia', day, 'resultats'), orderBy('score'), limit(RANKING_SIZE)));
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  });
}

/**
 * El top de ratxes vives: només els que han jugat avui o ahir (les altres ja
 * s'han trencat), filtrat a Firestore perquè només es llegeixin les que es
 * veuen. Demana l'índex compost `jugadors` (lastDay ↑, streak ↓), vegeu
 * `firestore.indexes.json`; mentre no hi sigui, es llegeixen més files i es
 * filtren aquí.
 */
export function fetchStreakRanking(today: string, yesterday: string): Promise<RawRow[]> {
  return cached(`ratxes:${today}`, async () => {
    const { db } = await load();
    const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore/lite');
    const players = collection(db, 'jugadors');
    try {
      const snap = await getDocs(
        query(players, where('lastDay', 'in', [yesterday, today]), orderBy('streak', 'desc'), limit(RANKING_SIZE)),
      );
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    } catch (error) {
      if ((error as { code?: string }).code !== 'failed-precondition') throw error;
      // Sense l'índex encara: les ratxes més llargues, i `streakRanking` treu les mortes.
      const snap = await getDocs(query(players, orderBy('streak', 'desc'), limit(RANKING_SIZE * 3)));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    }
  });
}

/**
 * La teva posició al rànquing d'un dia, la mateixa que surt a la llista: el
 * que compta és el resultat que hi ha a Firestore (el primer que vas pujar),
 * no el de l'aparell.
 *
 * - Si ets al top (que ja s'ha llegit i està desat), la posició de la llista:
 *   cap lectura més.
 * - Si no, el teu resultat desat (1 lectura; si encara no ha pujat, el de
 *   l'aparell) i quants n'hi ha de millors (1 recompte). Desat 10 minuts.
 */
export async function fetchMyDayPlace(
  day: string,
  uid: string,
  fallback: DayEntry | null,
): Promise<{ place: number; entry: DayEntry } | null> {
  const top = dayRanking(await fetchDayRanking(day), uid);
  const mine = top.find((row) => row.you);
  if (mine) return { place: mine.place, entry: mine.entry };
  return cached(`posicio:${day}:${uid}`, async () => {
    const { db } = await load();
    const { collection, doc, getCount, getDoc, query, where } = await import('firebase/firestore/lite');
    const snap = await getDoc(doc(db, 'dia', day, 'resultats', uid));
    const stored = snap.exists() ? snap.data() : null;
    const entry = parseDayEntry(stored) ?? fallback;
    if (!entry) return null;
    // Firestore compara les puntuacions tal com estan desades.
    const raw = (stored as { score?: unknown } | null)?.score;
    const score = typeof raw === 'number' ? raw : entry.score;
    const better = await getCount(query(collection(db, 'dia', day, 'resultats'), where('score', '<', score)));
    return { place: Math.max(better.data().count + 1, top.length + 1), entry };
  });
}

/** El desat privat del jugador (`perfils/{uid}`): nivell i lliga en curs. */
export async function fetchCloudSave(uid: string): Promise<unknown> {
  const { db } = await load();
  const { doc, getDoc } = await import('firebase/firestore/lite');
  const snap = await getDoc(doc(db, 'perfils', uid));
  return snap.exists() ? snap.data() : null;
}

export async function submitCloudSave(uid: string, data: Record<string, unknown>): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  await setDoc(doc(db, 'perfils', uid), { ...data, at: serverTimestamp() });
}

/** La fitxa pública del jugador (àlies i ratxa del rànquing). */
export async function fetchPlayer(uid: string): Promise<unknown> {
  const { db } = await load();
  const { doc, getDoc } = await import('firebase/firestore/lite');
  const snap = await getDoc(doc(db, 'jugadors', uid));
  return snap.exists() ? snap.data() : null;
}

/** Si hi havia hagut sessió amb Google en aquest aparell (per carregar Firebase d'entrada). */
const SIGNED_KEY = 'remigi:google';

export function rememberSignedIn(signed: boolean): void {
  try {
    if (signed) localStorage.setItem(SIGNED_KEY, '1');
    else localStorage.removeItem(SIGNED_KEY);
  } catch {
    // Sense emmagatzematge, Firebase es carregarà en obrir la partida del dia.
  }
}

export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_KEY) === '1';
  } catch {
    return false;
  }
}
